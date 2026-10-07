import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export async function runLinuxProofProgram(
  program: string,
  databaseUrl: string,
  fixtures: unknown,
  timeoutMs = 240_000,
): Promise<string> {
  const root = fileURLToPath(new URL("../../../../../../", import.meta.url));
  const temporary = await mkdtemp(join(tmpdir(), "oscar-proof-runtime-"));
  const containerName = `oscar-proof-runtime-${randomUUID()}`;
  // Snapshot emitted artifacts before launch so a later build cannot invalidate a bind mount.
  for (const [source, destination] of [
    ["apps/api/dist", "api"],
    ["packages/contracts/dist", "contracts"],
    ["packages/database/dist", "database"],
  ] as const)
    await cp(join(root, source), join(temporary, destination), {
      recursive: true,
    });
  const manifest = JSON.parse(
    await readFile(join(root, "apps/api/package.json"), "utf8"),
  ) as { dependencies: Record<string, string> };
  const dependencies = Object.fromEntries(
    Object.entries(manifest.dependencies).filter(
      ([name]) => !name.startsWith("@template/"),
    ),
  );
  const url = new URL(databaseUrl);
  url.hostname = "host.docker.internal";
  await writeFile(
    join(temporary, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        ...dependencies,
        "@prisma/client": "7.9.1",
        "@prisma/adapter-pg": "7.9.1",
        pg: "8.22.0",
      },
    }),
  );
  await writeFile(join(temporary, "fixtures.json"), JSON.stringify(fixtures));
  await writeFile(join(temporary, "program.mjs"), program);
  await writeFile(
    join(temporary, "environment.json"),
    JSON.stringify({
      NODE_ENV: "test",
      DATABASE_URL: url.toString(),
      LOG_LEVEL: "silent",
      EMAIL_PROVIDER: "console",
      WEB_APP_URL: "http://localhost:3000",
      ADMIN_INVITATION_ACCEPT_URL: "http://localhost:3000/test-only-invitation",
      MAIL_FROM_ADDRESS: "no-reply@example.com",
      AUTH_JWT_SECRET: "test-only-access-secret-000000000000000000000000",
      AUTH_REFRESH_JWT_SECRET:
        "test-only-refresh-secret-00000000000000000000000",
      AUTH_VERIFICATION_JWT_SECRET:
        "test-only-verify-secret-000000000000000000000000",
      AUTH_RESET_JWT_SECRET: "test-only-reset-secret-0000000000000000000000000",
    }),
  );
  const bootstrap =
    'mkdir -p /work/node_modules/@template/contracts /work/node_modules/@template/database /work/api && cp /fixture/package.json /work/package.json && cd /work && npm install --no-audit --no-fund >/dev/null && cp -r /api/. /work/api/ && cp -r /contracts/. /work/node_modules/@template/contracts/ && cp -r /database/. /work/node_modules/@template/database/ && printf \'{"type":"module","exports":"./index.js"}\' > /work/node_modules/@template/contracts/package.json && printf \'{"type":"module","exports":"./index.js"}\' > /work/node_modules/@template/database/package.json && cp /fixture/program.mjs /work/program.mjs && touch /work/pnpm-workspace.yaml && node --expose-gc /work/program.mjs';
  let output = "";
  let diagnostics = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const child = spawn(
      "docker",
      [
        "run",
        "--name",
        containerName,
        "--mount",
        `type=bind,source=${join(temporary, "api")},target=/api,readonly`,
        "--mount",
        `type=bind,source=${join(temporary, "contracts")},target=/contracts,readonly`,
        "--mount",
        `type=bind,source=${join(temporary, "database")},target=/database,readonly`,
        "--mount",
        `type=bind,source=${temporary},target=/fixture,readonly`,
        "--entrypoint",
        "sh",
        "node:24.18.1-bookworm-slim",
        "-c",
        bootstrap,
      ],
      { windowsHide: true },
    );
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      diagnostics += chunk;
    });
    timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);
    const exit = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    if (exit !== 0)
      throw new Error(
        `Linux proof acceptance failed (${String(exit)}): ${diagnostics}`,
      );
    return output;
  } finally {
    clearTimeout(timer);
    const cleanup = spawn("docker", ["rm", "--force", containerName], {
      windowsHide: true,
      stdio: "ignore",
      timeout: 10_000,
    });
    await new Promise<void>((resolve, reject) => {
      cleanup.once("error", reject);
      cleanup.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error("Proof runtime container cleanup failed."));
      });
    });
    await rm(temporary, { recursive: true, force: true });
  }
}
