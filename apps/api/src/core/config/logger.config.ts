import { getEnvVariable } from "./env.js";

const logLevels = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

type LogLevel = (typeof logLevels)[number];
const level = getEnvVariable("LOG_LEVEL", "info");

if (!logLevels.some((logLevel) => logLevel === level)) {
  throw new Error(
    `Environment variable LOG_LEVEL must be one of: ${logLevels.join(", ")}.`,
  );
}

export const loggerConfig = Object.freeze({
  level: level as LogLevel,
});
