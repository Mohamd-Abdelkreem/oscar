import { getEnvVariable } from "./env.js";

const allowedOrigins = getEnvVariable("CORS_ORIGINS", "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

for (const origin of allowedOrigins) {
  try {
    new URL(origin);
  } catch {
    throw new Error(
      `Environment variable CORS_ORIGINS contains an invalid URL: ${origin}.`,
    );
  }
}

export const corsConfig = Object.freeze({
  allowedOrigins,
  credentials: true,
});
