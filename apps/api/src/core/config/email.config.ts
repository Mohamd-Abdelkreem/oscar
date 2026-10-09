import {
  getEnvVarAsBoolean,
  getEnvVarAsInteger,
  getEnvVariable,
} from "./env.js";
import { appConfig } from "./app.config.js";

export type EmailProvider = "console" | "resend" | "smtp";
export type SmtpTlsMinVersion = "TLSv1" | "TLSv1.2" | "TLSv1.3";

const emailAddressPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const parseEmailEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
  environmentName: string,
) => {
  const production = environmentName === "production";
  const setting = (key: string, fallback: string): string => {
    const configured = environment[key] ?? (production ? undefined : fallback);
    if (configured === undefined || configured.trim().length === 0)
      throw new Error(`${key} is required.`);
    return configured;
  };
  const provider = parseEmailProvider(setting("EMAIL_PROVIDER", "console"));
  if (production && provider !== "resend")
    throw new Error("EMAIL_PROVIDER must be resend in production.");
  const publicWebUrl = setting("WEB_APP_URL", "http://localhost:3000");
  let webUrl: URL;
  try {
    webUrl = new URL(publicWebUrl);
  } catch {
    throw new Error("WEB_APP_URL must be a valid web origin.");
  }
  if (
    !["http:", "https:"].includes(webUrl.protocol) ||
    webUrl.username !== "" ||
    webUrl.password !== "" ||
    webUrl.pathname !== "/" ||
    webUrl.search !== "" ||
    webUrl.hash !== "" ||
    (production && webUrl.protocol !== "https:")
  )
    throw new Error(
      "WEB_APP_URL must be an approved web origin using HTTPS in production.",
    );
  const fromName = setting("MAIL_FROM_NAME", "Full-Stack Boilerplate");
  const fromAddress = setting("MAIL_FROM_ADDRESS", "no-reply@example.com");
  const replyTo = production
    ? setting("MAIL_REPLY_TO", "")
    : (environment["MAIL_REPLY_TO"] ?? "");
  for (const [key, address] of [
    ["MAIL_FROM_ADDRESS", fromAddress],
    ["MAIL_REPLY_TO", replyTo],
  ]) {
    if (
      address !== undefined &&
      address !== "" &&
      (!emailAddressPattern.test(address) ||
        (production &&
          /@(?:example\.(?:com|org|net)|resend\.dev|localhost)$/iu.test(
            address,
          )))
    )
      throw new Error(
        `${key ?? "Mail identity"} must be a configured company email address.`,
      );
  }
  if (
    fromName.length > 150 ||
    /[\r\n"]/u.test(fromName) ||
    fromName.includes(String.fromCharCode(0)) ||
    (production && /boilerplate|^template$|^example$/iu.test(fromName))
  )
    throw new Error("MAIL_FROM_NAME must be a configured company name.");
  const resendApiKey = environment["RESEND_API_KEY"] ?? "";
  if (
    provider === "resend" &&
    (resendApiKey.length < 10 ||
      /\s/u.test(resendApiKey) ||
      resendApiKey.includes(String.fromCharCode(0)) ||
      /^(?:change[-_ ]?me|placeholder|your[-_ ]|re_(?:test|example))/iu.test(
        resendApiKey,
      ))
  )
    throw new Error(
      "RESEND_API_KEY must be an explicit non-placeholder provider credential.",
    );
  const invitationSetting = environment["ADMIN_INVITATION_ACCEPT_URL"];
  let invitationAcceptUrl: string | null = null;
  if (
    production ||
    (invitationSetting !== undefined && invitationSetting !== "")
  ) {
    let destination: URL;
    try {
      destination = new URL(setting("ADMIN_INVITATION_ACCEPT_URL", ""));
    } catch {
      throw new Error(
        "ADMIN_INVITATION_ACCEPT_URL must be an explicit approved destination.",
      );
    }
    if (
      destination.origin !== webUrl.origin ||
      destination.username !== "" ||
      destination.password !== "" ||
      destination.search !== "" ||
      destination.hash !== "" ||
      (production && destination.protocol !== "https:")
    )
      throw new Error(
        "ADMIN_INVITATION_ACCEPT_URL must use the approved web origin.",
      );
    invitationAcceptUrl = destination.toString();
  }
  const confirmationSetting = environment["WITHDRAWAL_ADDRESS_CONFIRM_URL"];
  let withdrawalConfirmationUrl: string | null = null;
  if (
    production ||
    (confirmationSetting !== undefined && confirmationSetting !== "")
  ) {
    let destination: URL;
    try {
      destination = new URL(setting("WITHDRAWAL_ADDRESS_CONFIRM_URL", ""));
    } catch {
      throw new Error(
        "WITHDRAWAL_ADDRESS_CONFIRM_URL requires an approved account destination.",
      );
    }
    if (
      destination.origin !== webUrl.origin ||
      destination.pathname !== "/employee/account" ||
      destination.username !== "" ||
      destination.password !== "" ||
      destination.search !== "" ||
      destination.hash !== "" ||
      (production && destination.protocol !== "https:")
    )
      throw new Error(
        "WITHDRAWAL_ADDRESS_CONFIRM_URL must use the approved same-origin account destination.",
      );
    withdrawalConfirmationUrl = destination.toString();
  }
  return Object.freeze({
    provider,
    publicWebUrl: webUrl.toString().replace(/\/+$/, ""),
    resendApiKey,
    fromName,
    fromAddress,
    replyTo,
    invitationAcceptUrl,
    withdrawalConfirmationUrl,
  });
};

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

const parsedEmail = parseEmailEnvironment(process.env, appConfig.nodeEnv);
const smtpHost = getEnvVariable("SMTP_HOST", "");
const smtpUser = getEnvVariable("SMTP_USER", "");
const smtpPassword = getEnvVariable("SMTP_PASSWORD", "");

export const emailConfig = Object.freeze({
  ...parsedEmail,
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
