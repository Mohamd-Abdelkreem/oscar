import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

export const project = "/opt/oscar";
export const configPath = (service) => `/private/${service}/config.json`;
export const loadConfig = async (service) =>
  JSON.parse(await readFile(configPath(service), "utf8"));

export async function invokeCli(script, input, environment) {
  const child = spawn("node", [`${project}/apps/api/dist/${script}`], {
    env: { ...process.env, ...environment },
    stdio: ["pipe", "pipe", "inherit"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    if (output.length > 262144) child.kill("SIGTERM");
  });
  const timer = setTimeout(() => child.kill("SIGTERM"), 180000);
  try {
    const result = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0
          ? resolve(output)
          : reject(new Error(`CLI failed: ${script}`)),
      );
    });
    child.stdin.end(JSON.stringify(input));
    return await result;
  } finally {
    clearTimeout(timer);
  }
}
