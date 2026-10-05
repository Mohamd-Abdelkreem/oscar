import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const webDirectory = fileURLToPath(new URL("../../", import.meta.url));
const nextCli = fileURLToPath(
  new URL("../../node_modules/next/dist/bin/next", import.meta.url),
);
const environment = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:4103/api/v1",
};
let build;

/** @param {number} port */
export const requireFreePort = async (port) => {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => resolve(undefined));
  });
  await new Promise((resolve) => probe.close(() => resolve(undefined)));
};

/** @param {import("node:child_process").ChildProcess} child */
export const stopOwnedProcess = async (child) => {
  if (
    child.pid === undefined ||
    child.exitCode !== null ||
    child.signalCode !== null
  )
    return;
  const closed = new Promise((resolve) =>
    child.once("exit", () => resolve(undefined)),
  );
  child.kill("SIGTERM");
  const deadline = setTimeout(() => {
    child.kill("SIGKILL");
  }, 10_000);
  try {
    await closed;
  } finally {
    clearTimeout(deadline);
  }
};

export const prepareWeb = () => {
  build ??= (async () => {
    await requireFreePort(3103);
    const child = spawn(process.execPath, [nextCli, "build"], {
      cwd: webDirectory,
      env: environment,
      windowsHide: true,
      stdio: "ignore",
    });
    const deadline = setTimeout(() => {
      child.kill();
    }, 240_000);
    try {
      await new Promise((resolve, reject) => {
        child.once("error", () => reject(new Error("P03_BUILD_FAILED")));
        child.once("exit", (code) =>
          code === 0
            ? resolve(undefined)
            : reject(new Error("P03_BUILD_FAILED")),
        );
      });
    } finally {
      clearTimeout(deadline);
    }
  })();
  return build;
};

export const startWeb = async () => {
  await prepareWeb();
  await requireFreePort(3103);
  const child = spawn(
    process.execPath,
    [nextCli, "start", "--hostname", "127.0.0.1", "--port", "3103"],
    { cwd: webDirectory, env: environment, windowsHide: true, stdio: "ignore" },
  );
  let failed = false;
  child.once("error", () => {
    failed = true;
  });
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && !failed && child.exitCode === null) {
      try {
        const response = await fetch(
          "http://127.0.0.1:3103/employee/auth/login",
          { signal: AbortSignal.timeout(1000) },
        );
        if (response.ok) return child;
      } catch {
        /* Readiness failure is bounded and never attached to diagnostics. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("P03_WEB_START_FAILED");
  } catch {
    await stopOwnedProcess(child);
    throw new Error("P03_WEB_START_FAILED");
  }
};
