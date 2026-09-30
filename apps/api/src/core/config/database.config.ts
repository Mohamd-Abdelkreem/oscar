import { getEnvVariable } from "./env.js";

const databaseUrl = getEnvVariable("DATABASE_URL");

try {
  const protocol = new URL(databaseUrl).protocol;

  if (protocol !== "postgres:" && protocol !== "postgresql:") {
    throw new Error("unsupported protocol");
  }
} catch {
  throw new Error(
    "Environment variable DATABASE_URL must be a valid PostgreSQL URL.",
  );
}

export const databaseConfig = Object.freeze({
  url: databaseUrl,
});
