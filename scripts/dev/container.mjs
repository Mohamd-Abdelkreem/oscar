import { spawn } from "node:child_process";
import { loadConfig, project } from "./runtime.mjs";

const action = process.argv[2];
if (action === "files") {
  await import("./files.mjs");
} else if (action === "database") {
  await import("./database.mjs");
} else if (action === "admit") {
  await import("./admit.mjs");
} else if (action === "run") {
  const service = process.argv[3];
  const scripts = {
    api: "server.js",
    worker: "worker.js",
    signer: "signer.js",
  };
  if (!Object.hasOwn(scripts, service))
    throw new Error("Unknown runtime service.");
  const environment = await loadConfig(
    service === "worker" ? "worker" : service,
  );
  const child = spawn(
    "node",
    [`${project}/apps/api/dist/${scripts[service]}`],
    {
      env: { ...process.env, ...environment },
      stdio: "inherit",
    },
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => child.kill(signal));
  child.once("error", (error) => {
    throw error;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} else {
  throw new Error("Unknown local development operation.");
}
