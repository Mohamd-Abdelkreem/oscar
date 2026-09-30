import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { PostgreSqlContainer } from "@testcontainers/postgresql";

const execFileAsync = promisify(execFile);

const deployMigrations = async (databaseUrl: string): Promise<void> => {
  const pnpmScript = process.env["npm_execpath"];
  if (pnpmScript === undefined) {
    throw new Error(
      "npm_execpath is required to deploy integration migrations.",
    );
  }
  await execFileAsync(
    process.execPath,
    [pnpmScript, "exec", "prisma", "migrate", "deploy"],
    {
      cwd: resolve(process.cwd(), "../../packages/database"),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      timeout: 180_000,
      windowsHide: true,
    },
  );
};

export default async function setup(): Promise<() => Promise<void>> {
  delete process.env["DATABASE_URL"];
  const container = await new PostgreSqlContainer("postgres:18.4")
    .withDatabase("template_api_integration")
    .withUsername("template_test")
    .withPassword("test-only-password")
    .withStartupTimeout(120_000)
    .start();
  const databaseUrl = container.getConnectionUri();
  process.env["DATABASE_URL"] = databaseUrl;

  try {
    await deployMigrations(databaseUrl);
  } catch (error) {
    await container.stop();
    throw error;
  }

  return async () => {
    delete process.env["DATABASE_URL"];
    await container.stop();
  };
}
