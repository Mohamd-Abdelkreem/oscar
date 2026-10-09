import { spawn } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { command } from "./host-process.mjs";
import {
  devHome,
  exists,
  prepareConfiguration,
  writeEnvironment,
} from "./host-config.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const action = process.argv[2] ?? "start";
if (!["start", "setup", "services", "stop", "status"].includes(action))
  throw new Error("Use start, setup, services, stop or status.");
const envFile = join(devHome, "compose.env");
const compose = (args, options = {}) =>
  command(
    "docker",
    [
      "compose",
      "--env-file",
      envFile,
      "-f",
      join(root, "compose.dev.yaml"),
      ...args,
    ],
    { cwd: root, ...options },
  );
const operator = (operation) =>
  compose([
    "exec",
    "-T",
    "operator",
    "node",
    "/opt/oscar/dev/container.mjs",
    "admit",
    operation,
  ]);

async function buildRuntime() {
  for (const name of ["contracts", "database", "api"])
    await command("pnpm", ["--filter", `@template/${name}`, "build"], {
      cwd: root,
    });
  const context = join(devHome, `build-${Date.now()}`);
  await mkdir(context, { recursive: true });
  for (const [source, target] of [
    ["apps/api/dist", "api"],
    ["packages/contracts/dist", "contracts"],
    ["packages/database/dist", "database"],
    ["scripts/dev", "dev"],
  ])
    await cp(join(root, source), join(context, target), { recursive: true });
  await cp(join(root, "scripts/dev/Dockerfile"), join(context, "Dockerfile"));
  const api = JSON.parse(
    await readFile(join(root, "apps/api/package.json"), "utf8"),
  );
  const database = JSON.parse(
    await readFile(join(root, "packages/database/package.json"), "utf8"),
  );
  const dependencies = Object.fromEntries(
    Object.entries({
      ...api.dependencies,
      ...database.dependencies,
      "pino-pretty": api.devDependencies["pino-pretty"],
    }).filter(([name]) => !name.startsWith("@template/")),
  );
  await writeFile(
    join(context, "package.json"),
    JSON.stringify({ type: "module", private: true, dependencies }),
  );
  await command("docker", ["build", "-t", "oscar-dev-runtime:local", context], {
    cwd: root,
  });
}
async function waitForApi() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        "http://localhost:4000/api/v1/health/ready",
        { signal: AbortSignal.timeout(2000) },
      );
      if (response.ok) return;
    } catch (error) {
      if (!(error instanceof TypeError) && error.name !== "TimeoutError")
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    "Local API did not become ready. Run docker compose with compose.dev.yaml to inspect its logs.",
  );
}
async function waitForBoots(startedAt) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const rows = JSON.parse(
      (
        await compose(
          [
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            "oscar_migrator",
            "-d",
            "oscar_dev",
            "-tAc",
            `SELECT coalesce(json_agg(process_kind),'[]'::json) FROM financial_runtime_admissions WHERE acknowledged_generation IS NULL AND requested_at >= '${startedAt}'::timestamptz`,
          ],
          { capture: true, quiet: true },
        )
      ).toString(),
    );
    if (
      ["API", "SIGNER", "DEPOSIT_WORKER"].every((kind) => rows.includes(kind))
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    "The API, worker and signer did not all register. Inspect the local service logs.",
  );
}
async function assertRuntimeProcesses() {
  const output = await compose(["ps", "--all", "--format", "json"], {
    capture: true,
    quiet: true,
  });
  const containers = output.toString().trim().split("\n").map(JSON.parse);
  for (const service of ["api", "worker", "signer", "recovery", "operator"])
    if (
      !containers.some(
        (container) =>
          container.Service === service && container.State === "running",
      )
    )
      throw new Error(`Local ${service} stopped. Inspect its Compose logs.`);
}
async function startServices() {
  const input = await prepareConfiguration(root);
  await writeEnvironment(envFile, {
    OSCAR_DEV_HOME: devHome.replaceAll("\\", "/"),
    OSCAR_WORKSPACE: root.replaceAll("\\", "/"),
    OSCAR_DEV_DB_PASSWORD: input.passwords.oscar_migrator,
  });
  await mkdir(join(root, ".local-emails"), { recursive: true });
  await buildRuntime();
  await compose(["stop", "api", "worker", "signer"]);
  await compose(["up", "-d", "--wait", "postgres", "redis"]);
  const ownerUrl = `postgresql://oscar_migrator:${input.passwords.oscar_migrator}@localhost:55438/oscar_dev?schema=public`;
  await command("pnpm", ["db:migrate:deploy"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: ownerUrl },
  });
  const output = await compose(["run", "--rm", "bootstrap"], { capture: true });
  const identity = JSON.parse(output.toString().trim());
  await compose([
    "run",
    "--rm",
    "bootstrap",
    "node",
    "/opt/oscar/dev/container.mjs",
    "database",
  ]);
  await compose(["up", "-d", "--wait", "recovery", "operator"]);
  await operator("fence");
  const backup = await compose(
    [
      "exec",
      "-T",
      "postgres",
      "pg_dump",
      "-U",
      "oscar_migrator",
      "-Fc",
      "oscar_dev",
    ],
    { capture: true },
  );
  await writeFile(join(devHome, `database-${Date.now()}.dump`), backup, {
    mode: 0o600,
  });
  const startedAt = new Date().toISOString();
  await compose(["up", "-d", "api", "worker", "signer"]);
  await waitForApi();
  await waitForBoots(startedAt);
  await operator("acknowledge");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await assertRuntimeProcesses();
  const environment = {
    ...input.environment,
    DATABASE_URL: `postgresql://oscar_api:${input.passwords.oscar_api}@localhost:55438/oscar_dev?schema=public`,
    TRON_TREASURY_ADDRESS: identity.treasury,
    TRON_PAYOUT_KEY_ID: identity.keyId,
    PROOF_STORAGE_ROOT: "/private/api/proofs",
    CUSTODY_KEY_FILE: "/private/signer/encryption.key",
    CUSTODY_KEY_ID: "local-nile-v1",
    CUSTODY_STORAGE_ROOT: "/private/signer/keys",
    CUSTODY_SSH_CONFIG_FILE: "/private/signer/ssh_config",
    CUSTODY_SSH_KNOWN_HOSTS_FILE: "/private/signer/known_hosts",
    CUSTODY_RECOVERY_HOST: "recovery",
    CUSTODY_OPERATOR_IDENTITY: "local-nile-operator",
  };
  await writeEnvironment(join(root, ".env"), environment);
  await writeEnvironment(join(root, "apps/web/.env.local"), {
    NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
  });
  await writeFile(
    join(devHome, "input.json"),
    JSON.stringify({ ...input, environment, configured: true }, null, 2),
    { mode: 0o600 },
  );
  console.log(
    `Local Nile services ready. Credentials: ${join(devHome, "credentials.json")}`,
  );
}
async function startWeb() {
  const windows = process.platform === "win32";
  const child = spawn(
    windows ? "cmd.exe" : "pnpm",
    windows
      ? ["/d", "/s", "/c", "pnpm --filter @template/web dev"]
      : ["--filter", "@template/web", "dev"],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    if (windows)
      void command("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        capture: true,
      }).catch(() => {
        console.error("Unable to stop the owned web process tree.");
      });
    else child.kill("SIGTERM");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await compose(["stop", "api", "worker", "signer", "operator", "recovery"]);
  }
}

try {
  if (action === "status" || action === "stop") {
    if (!(await exists(envFile))) throw new Error("Run pnpm dev:setup first.");
    await compose(action === "status" ? ["ps"] : ["stop"]);
  } else {
    await startServices();
    if (action === "start") await startWeb();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
