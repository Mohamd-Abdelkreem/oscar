import { baseLayoutTemplate } from "./base-layout.template.js";
import { escapeHtml } from "./html-escape.js";

export function adminInvitationUrl(
  destination: string | null,
  webOrigin: string,
  token: string,
): string {
  if (destination === null)
    throw new Error("Invitation destination is unavailable.");
  const url = new URL(destination);
  if (
    url.origin !== new URL(webOrigin).origin ||
    !["https:", "http:"].includes(url.protocol) ||
    url.username !== "" ||
    url.password !== ""
  )
    throw new Error("Invitation destination is invalid.");
  url.searchParams.set("token", token);
  return url.toString();
}

export const adminInvitationTemplate = (
  name: string,
  email: string,
  url: string,
): string =>
  baseLayoutTemplate({
    title: "Administrator invitation",
    previewText: "Set your password to accept administrator access.",
    bodyHtml: `<h1>Administrator invitation</h1><p>Hello ${escapeHtml(name)}, this invitation is addressed to ${escapeHtml(email)}.</p><p><a href="${escapeHtml(url)}">Set your password and accept</a></p><p>If you did not expect this invitation, you can ignore it.</p>`,
  });
