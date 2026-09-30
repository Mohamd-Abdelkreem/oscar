import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

import { emailConfig } from "./email.config.js";

export type SmtpTransporter = Transporter<SMTPTransport.SentMessageInfo>;

let transporter: SmtpTransporter | undefined;

export const getSmtpTransporter = (): SmtpTransporter => {
  transporter ??= nodemailer.createTransport({
    host: emailConfig.smtpHost,
    port: emailConfig.smtpPort,
    secure: emailConfig.smtpSecure,
    ...(emailConfig.smtpUser !== "" && emailConfig.smtpPassword !== ""
      ? {
          auth: {
            user: emailConfig.smtpUser,
            pass: emailConfig.smtpPassword,
          },
        }
      : {}),
    tls: {
      rejectUnauthorized: !emailConfig.allowSelfSignedTls,
      minVersion: emailConfig.tlsMinVersion,
    },
    connectionTimeout: emailConfig.connectionTimeoutMs,
    greetingTimeout: emailConfig.greetingTimeoutMs,
    socketTimeout: emailConfig.socketTimeoutMs,
  });

  return transporter;
};
