import {
  getEnvVarAsBoolean,
  getEnvVarAsInteger,
  getEnvVariable,
} from "./env.js";
import { appConfig } from "./app.config.js";

export type EmailProvider = "console" | "resend" | "smtp";
export type SmtpTlsMinVersion = "TLSv1" | "TLSv1.2" | "TLSv1.3";

const emailAddressPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const parseEmailProvider = (value: string): EmailProvider => {
  if (value === "console" || value === "resend" || value === "smtp") {
    return value;
  }
  throw new Error("EMAIL_PROVIDER must be console, resend, or smtp.");
};

export const parseSmtpTlsMinVersion = (value: string): SmtpTlsMinVersion => {
  if (value === "TLSv1" || value === "TLSv1.2" || value === "TLSv1.3") {
    return value;
  }
  throw new Error("SMTP_TLS_MIN_VERSION must be TLSv1, TLSv1.2, or TLSv1.3.");
};

const webUrl = new URL(getEnvVariable("WEB_APP_URL", "http://localhost:3000"));
if (webUrl.protocol !== "http:" && webUrl.protocol !== "https:") {
  throw new Error("WEB_APP_URL must use http or https.");
}
if (appConfig.isProduction && webUrl.protocol !== "https:") {
  throw new Error("WEB_APP_URL must use https in production.");
}

const provider = parseEmailProvider(
  getEnvVariable(
    "EMAIL_PROVIDER",
    appConfig.isProduction ? "resend" : "console",
  ),
);
const fromAddress = getEnvVariable("MAIL_FROM_ADDRESS", "no-reply@example.com");
const resendApiKey = getEnvVariable("RESEND_API_KEY", "");
const smtpHost = getEnvVariable("SMTP_HOST", "");
const smtpUser = getEnvVariable("SMTP_USER", "");
const smtpPassword = getEnvVariable("SMTP_PASSWORD", "");

if (!emailAddressPattern.test(fromAddress)) {
  throw new Error("MAIL_FROM_ADDRESS must be a valid email address.");
}
if (appConfig.isProduction && provider === "console") {
  throw new Error("EMAIL_PROVIDER=console is not allowed in production.");
}
if (
  provider === "resend" &&
  (resendApiKey.length < 10 ||
    /^(?:change[-_ ]?me|placeholder|your[-_ ]|re_(?:test|example))/iu.test(
      resendApiKey,
    ))
) {
  throw new Error(
    "RESEND_API_KEY must be a non-placeholder key when Resend is selected.",
  );
}
if (
  appConfig.isProduction &&
  provider === "smtp" &&
  (smtpHost === "" || smtpUser === "" || smtpPassword === "")
) {
  throw new Error(
    "SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required for production SMTP.",
  );
}

export const emailConfig = Object.freeze({
  provider,
  publicWebUrl: webUrl.toString().replace(/\/+$/, ""),
  resendApiKey,
  fromName: getEnvVariable("MAIL_FROM_NAME", "Full-Stack Boilerplate"),
  fromAddress,
  replyTo: getEnvVariable("MAIL_REPLY_TO", ""),
  smtpHost: smtpHost || "localhost",
  smtpPort: getEnvVarAsInteger("SMTP_PORT", 587, 1, 65_535),
  smtpSecure: getEnvVarAsBoolean("SMTP_SECURE", false),
  smtpUser,
  smtpPassword,
  allowSelfSignedTls: getEnvVarAsBoolean("SMTP_ALLOW_SELF_SIGNED_TLS", false),
  connectionTimeoutMs: getEnvVarAsInteger(
    "SMTP_CONNECTION_TIMEOUT_MS",
    10_000,
    1_000,
    120_000,
  ),
  greetingTimeoutMs: getEnvVarAsInteger(
    "SMTP_GREETING_TIMEOUT_MS",
    10_000,
    1_000,
    120_000,
  ),
  socketTimeoutMs: getEnvVarAsInteger(
    "SMTP_SOCKET_TIMEOUT_MS",
    15_000,
    1_000,
    120_000,
  ),
  tlsMinVersion: parseSmtpTlsMinVersion(
    getEnvVariable("SMTP_TLS_MIN_VERSION", "TLSv1.2"),
  ),
});
