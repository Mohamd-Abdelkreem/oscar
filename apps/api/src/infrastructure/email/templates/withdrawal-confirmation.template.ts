import { baseLayoutTemplate } from "./base-layout.template.js";
import { escapeHtml } from "./html-escape.js";

export function withdrawalConfirmationUrl(
  destination: string | null,
  webOrigin: string,
  token: string,
): string {
  if (destination === null)
    throw new Error("Withdrawal confirmation destination is unavailable.");
  const url = new URL(destination);
  if (
    url.origin !== new URL(webOrigin).origin ||
    url.pathname !== "/employee/account" ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  )
    throw new Error("Withdrawal confirmation destination is invalid.");
  url.hash = `withdrawal-confirmation=${encodeURIComponent(token)}`;
  return url.toString();
}

export const withdrawalConfirmationTemplate = (
  name: string,
  address: string,
  url: string,
): string =>
  baseLayoutTemplate({
    title: "Confirm withdrawal destination",
    previewText: "Confirm your first fixed withdrawal recipient.",
    bodyHtml: `<h1>Confirm withdrawal destination</h1><p>Hello ${escapeHtml(name)}.</p><p>Requested recipient: <bdi>${escapeHtml(address)}</bdi></p><p><a href="${escapeHtml(url)}">Review and confirm your recipient</a></p><p>Opening this link does not save the address. Confirmation requires your authenticated account. Ignore this email if you did not request it.</p>`,
  });
