import { getEnvVarAsInteger } from "./env.js";

export const rateLimitConfig = Object.freeze({
  windowMs: getEnvVarAsInteger(
    "API_RATE_LIMIT_WINDOW_MS",
    60_000,
    1_000,
    86_400_000,
  ),
  maxRequests: getEnvVarAsInteger("API_RATE_LIMIT_MAX", 100, 1, 100_000),
});
