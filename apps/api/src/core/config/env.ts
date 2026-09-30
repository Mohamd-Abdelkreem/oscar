import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

import dotenv from "dotenv";

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

if (
  process.env["NODE_ENV"] !== "production" &&
  process.env["RAILWAY_ENVIRONMENT"] === undefined
) {
  dotenv.config({
    path: join(findWorkspaceRoot(process.cwd()), ".env"),
    quiet: true,
  });
}

export const getEnvVariable = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue;

  if (value === undefined) {
    throw new Error(
      `Environment variable ${key} is not set and no default value was provided.`,
    );
  }

  return value;
};

export const getEnvVarAsNumber = (
  key: string,
  defaultValue?: number,
): number => {
  const value = process.env[key];

  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is not defined.`);
    }

    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Environment variable ${key} must be a number.`);
  }

  return parsedValue;
};

export const getEnvVarAsBoolean = (
  key: string,
  defaultValue?: boolean,
): boolean => {
  const value = process.env[key];

  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is not defined.`);
    }

    return defaultValue;
  }

  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`Environment variable ${key} must be 'true' or 'false'.`);
};

export const getEnvVarAsInteger = (
  key: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number => {
  const value = getEnvVarAsNumber(key, defaultValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Environment variable ${key} must be an integer between ${String(minimum)} and ${String(maximum)}.`,
    );
  }

  return value;
};
