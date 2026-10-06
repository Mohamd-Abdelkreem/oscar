import { spawn, execFile, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { controlReplySchema } from "./control.js";

let database: StartedPostgreSqlContainer | undefined,
  child: ChildProcess | undefined,
  temporary: string | undefined;
const name = "oscar-p05-e2e-" + randomUUID();
const snapshotRoot = resolve(
  import.meta.dirname,
  "../../../../node_modules/.cache/p05-e2e",
);
let cleanupPromise: Promise<void> | undefined;
let stopping = false;
let stage = "DATABASE";
const cleanup = () =>
  (cleanupPromise ??= (async () => {
    if (child?.stdin) child.stdin.end();
    await promisify(execFile)("docker", ["rm", "--force", name], {
      windowsHide: true,
    }).catch(() => {});
    await database?.stop();
    if (temporary) {
      const target = resolve(temporary),
        root = snapshotRoot;
      if (!target.startsWith(root + sep) || !target.includes("oscar-p05-e2e-"))
        throw new Error("P05_TEMP_BOUNDARY");
      await rm(target, { recursive: true, force: true });
    }
  })());
const fail = () => {
  process.send?.({ id: 0, status: "failed", data: { nativeFailure: stage } });
  void cleanup().finally(() => {
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
};
process.once("disconnect", () => {
  void cleanup().finally(() => process.exit());
});
process.once("SIGTERM", () => {
  void cleanup().finally(() => process.exit());
});
async function start() {
  if (!process.send) throw new Error("P05_PRIVATE_IPC_REQUIRED");
  const root = resolve(import.meta.dirname, "../../../..");
  database = await new PostgreSqlContainer("postgres:18.4")
    .withDatabase("p05_e2e")
    .withUsername("p05_test")
    .withPassword("isolated-test-only")
    .withStartupTimeout(120_000)
    .start();
  const migrationCli = process.env["npm_execpath"];
  stage = "MIGRATION";
  if (!migrationCli) throw new Error("PNPM_REQUIRED");
  await promisify(execFile)(
    process.execPath,
    [migrationCli, "exec", "prisma", "migrate", "deploy"],
    {
      cwd: join(root, "packages/database"),
      env: { ...process.env, DATABASE_URL: database.getConnectionUri() },
      windowsHide: true,
      timeout: 180_000,
    },
  );
  stage = "SNAPSHOT";
  await mkdir(snapshotRoot, { recursive: true });
  temporary = await mkdtemp(join(snapshotRoot, "oscar-p05-e2e-"));
  for (const source of [
    "apps/api/src",
    "apps/api/tests/e2e",
    "packages/contracts/dist",
    "packages/database/dist",
  ])
    await cp(join(root, source), join(temporary, source), { recursive: true });
  const manifest = JSON.parse(
    await readFile(join(root, "apps/api/package.json"), "utf8"),
  ) as { dependencies: Record<string, string> };
  const dependencies = Object.fromEntries(
    Object.entries(manifest.dependencies).filter(
      ([key]) => !key.startsWith("@template/"),
    ),
  );
  await writeFile(
    join(temporary, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        ...dependencies,
        tsx: "4.23.1",
        "@testcontainers/postgresql": "12.1.0",
        "@prisma/client": "7.9.1",
        "@prisma/adapter-pg": "7.9.1",
        pg: "8.22.0",
      },
    }),
  );
  const databaseUrl = new URL(database.getConnectionUri());
  databaseUrl.hostname = "host.docker.internal";
  await writeFile(
    join(temporary, "environment.json"),
    JSON.stringify({ P05_E2E_DATABASE_URL: databaseUrl.toString() }),
  );
  await writeFile(
    join(temporary, "launch.mjs"),
    'import {readFile} from "node:fs/promises";Object.assign(process.env,JSON.parse(await readFile("/fixture/environment.json","utf8")));await import("./apps/api/tests/e2e/server.ts");',
  );
  const bootstrap = `mkdir -p /work && cp -r /fixture/. /work/ && cd /work && npm install --no-audit --no-fund >/dev/null 2>&1 && mkdir -p node_modules/@template/contracts node_modules/@template/database && cp -r packages/contracts/dist/. node_modules/@template/contracts/ && cp -r packages/database/dist/. node_modules/@template/database/ && echo '{"type":"module","exports":"./index.js"}' > node_modules/@template/contracts/package.json && echo '{"type":"module","exports":"./index.js"}' > node_modules/@template/database/package.json && touch pnpm-workspace.yaml && node --import tsx launch.mjs`;
  stage = "LINUX_LAUNCH";
  child = spawn(
    "docker",
    [
      "run",
      "--name",
      name,
      "-i",
      "-p",
      "127.0.0.1:4103:4103",
      "--mount",
      "type=bind,source=" + temporary + ",target=/fixture,readonly",
      "--mount",
      "type=volume,source=oscar-p05-e2e-npm-cache,target=/root/.npm",
      "--entrypoint",
      "sh",
      "node:24.18.1-bookworm-slim",
      "-c",
      bootstrap,
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] },
  );
  if (!child.stdout) throw new Error("P05_PRIVATE_CHANNEL_MISSING");
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      return;
    }
    const reply = controlReplySchema.safeParse(raw);
    if (!reply.success) return;
    if (reply.data.status === "stopped") {
      stopping = true;
      void cleanup()
        .then(() => {
          process.send?.(reply.data, () => {
            if (process.connected) process.disconnect();
          });
        })
        .catch(fail);
      return;
    }
    process.send?.(
      reply.data.status === "failed" && reply.data.id === 0
        ? { ...reply.data, data: { nativeFailure: "API_BOOT" } }
        : reply.data,
    );
  });
  child.once("error", fail);
  child.once("exit", () => {
    if (stopping) return;
    void cleanup().finally(() => {
      if (process.connected) process.disconnect();
    });
  });
  process.on("message", (raw: unknown) => {
    child?.stdin?.write(JSON.stringify(raw) + "\n");
  });
}
void start().catch(fail);
