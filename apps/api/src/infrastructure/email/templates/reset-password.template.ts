import { baseLayoutTemplate } from "./base-layout.template.js";
import { escapeHtml } from "./html-escape.js";

export const resetPasswordTemplate = (name: string, url: string): string =>
  baseLayoutTemplate({
    title: "Reset your password",
    previewText: "Use this link to choose a new password.",
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:24px;">Reset your password</h1>
      <p style="margin:0 0 24px;color:#465753;line-height:1.7;">Hello ${escapeHtml(name)}, use the secure link below to choose a new password.</p>
      <p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;border-radius:10px;background:#176b61;color:#ffffff;padding:13px 20px;text-decoration:none;font-weight:700;">Choose a new password</a></p>
      <p style="margin:0;color:#64726e;font-size:13px;line-height:1.6;">If you did not request a reset, no action is required.</p>`,
  });
