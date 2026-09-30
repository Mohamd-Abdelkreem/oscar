import { baseLayoutTemplate } from "./base-layout.template.js";
import { escapeHtml } from "./html-escape.js";

export const verifyEmailTemplate = (name: string, url: string): string =>
  baseLayoutTemplate({
    title: "Verify your email",
    previewText: "Confirm your email address to activate your account.",
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:24px;">Verify your email</h1>
      <p style="margin:0 0 24px;color:#465753;line-height:1.7;">Hello ${escapeHtml(name)}, confirm this address to activate your account.</p>
      <p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;border-radius:10px;background:#176b61;color:#ffffff;padding:13px 20px;text-decoration:none;font-weight:700;">Verify email</a></p>
      <p style="margin:0;color:#64726e;font-size:13px;line-height:1.6;">If you did not create this account, you can ignore this email.</p>`,
  });
