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

export const createLogger = (options: CreateLoggerOptions = {}): Logger => {
  const shouldUsePretty =
    options.destination === undefined &&
    (options.pretty ?? appConfig.isDevelopment);

  const loggerOptions: LoggerOptions = {
    level: options.level ?? loggerConfig.level,
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
