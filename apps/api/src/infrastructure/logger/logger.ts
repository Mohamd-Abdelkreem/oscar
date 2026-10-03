import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";

import { appConfig } from "../../core/config/app.config.js";
import { loggerConfig } from "../../core/config/logger.config.js";

export const LOGGER_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-csrf-token']",
  "req.body.password",
  "req.body.passwordConfirmation",
  "req.body.token",
  "req.body.newPassword",
  "req.body.currentPassword",
  "res.headers['set-cookie']",
  "*.password",
  "*.passwordConfirmation",
  "*.currentPassword",
  "*.newPassword",
  "*.accessToken",
  "*.refreshToken",
  "*.resetToken",
  "*.csrfToken",
  "*.secret",
  "*.apiKey",
  "*.databaseUrl",
  "*.smtpPassword",
  "*.resendApiKey",
  "*.verificationToken",
  "*.cookie",
  "*.cookies",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "resetToken",
  "csrfToken",
  "verificationToken",
  "SMTP_PASSWORD",
  "RESEND_API_KEY",
  "DATABASE_URL",
  "API_KEY",
] as const;

export type CreateLoggerOptions = Readonly<{
  level?: string;
  destination?: DestinationStream;
  pretty?: boolean;
}>;

const safeLogMetadata = (input: unknown, depth = 0): unknown => {
  if (input instanceof Error || depth >= 8) return "[OMITTED]";
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input))
    return input.map((entry: unknown) => safeLogMetadata(entry, depth + 1));
  return Object.fromEntries(
    Object.entries(input).map(([key, field]) => [
      key,
      /^(?:err|error|cause|stack|message)$/iu.test(key)
        ? "[OMITTED]"
        : /password|token|secret|api_?key|private_?key|signing_?payload|signed_?bytes|mnemonic|seed/iu.test(
              key,
            )
          ? "[REDACTED]"
          : safeLogMetadata(field, depth + 1),
    ]),
  );
};

export const createLogger = (options: CreateLoggerOptions = {}): Logger => {
  const shouldUsePretty =
    options.destination === undefined &&
    (options.pretty ?? appConfig.isDevelopment);

  const loggerOptions: LoggerOptions = {
    level: options.level ?? loggerConfig.level,
    formatters: {
      log: (metadata) => {
        const sanitized = safeLogMetadata(metadata);
        return sanitized !== null &&
          typeof sanitized === "object" &&
          !Array.isArray(sanitized)
          ? Object.fromEntries(Object.entries(sanitized))
          : {};
      },
    },
    redact: {
      paths: [...LOGGER_REDACT_PATHS],
      censor: "[REDACTED]",
    },
    ...(shouldUsePretty
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              singleLine: true,
            },
          },
        }
      : {}),
  };

  return options.destination === undefined
    ? pino(loggerOptions)
    : pino(loggerOptions, options.destination);
};

export const logger = createLogger();
