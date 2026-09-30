import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { defineConfig, env } from "prisma/config";

const findWorkspaceRoot = (startDirectory: string): string => {
  let currentDirectory = startDirectory;
  const fileSystemRoot = parse(startDirectory).root;

  while (currentDirectory !== fileSystemRoot) {
    if (existsSync(join(currentDirectory, "pnpm-workspace.yaml"))) {
      return currentDirectory;
    }

    currentDirectory = dirname(currentDirectory);
  }

  throw new Error("Could not locate the pnpm workspace root.");
};

const configDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = findWorkspaceRoot(configDirectory);

loadDotenv({ path: join(workspaceRoot, ".env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file ../../.env prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
