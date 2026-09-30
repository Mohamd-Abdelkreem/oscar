import { getEnvVarAsInteger, getEnvVariable } from "./env.js";

const nodeEnv = getEnvVariable("NODE_ENV", "development");

if (!["development", "test", "production"].includes(nodeEnv)) {
  throw new Error(
    "Environment variable NODE_ENV must be development, test, or production.",
  );
}

const trustProxyValue = getEnvVariable("TRUST_PROXY", "false");
const trustProxy =
  trustProxyValue === "false"
    ? false
    : getEnvVarAsInteger("TRUST_PROXY", 1, 1, 10);

export const appConfig = Object.freeze({
  name: getEnvVariable("APP_NAME", "Full-Stack Boilerplate API"),
  nodeEnv,
  host: getEnvVariable("API_HOST", "0.0.0.0"),
  port: getEnvVarAsInteger("API_PORT", 4000, 1, 65_535),
  apiPrefix: getEnvVariable("API_PREFIX", "/api/v1"),
  bodyLimit: getEnvVariable("BODY_LIMIT", "1mb"),
  trustProxy,
  requestTimeoutMs: getEnvVarAsInteger(
    "REQUEST_TIMEOUT_MS",
    30_000,
    1_000,
    300_000,
  ),
  headersTimeoutMs: getEnvVarAsInteger(
    "HEADERS_TIMEOUT_MS",
    31_000,
    1_000,
    301_000,
  ),
  keepAliveTimeoutMs: getEnvVarAsInteger(
    "KEEP_ALIVE_TIMEOUT_MS",
    5_000,
    1_000,
    120_000,
  ),
  shutdownTimeoutMs: getEnvVarAsInteger(
    "SHUTDOWN_TIMEOUT_MS",
    10_000,
    1_000,
    120_000,
  ),
  isDevelopment: nodeEnv === "development",
  isProduction: nodeEnv === "production",
  isTest: nodeEnv === "test",
});

export type AppConfig = typeof appConfig;
