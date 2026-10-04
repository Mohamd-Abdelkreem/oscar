import type { UserRole } from "@template/contracts";
import type { Route } from "next";
import { roleHomePath } from "./session-navigation";

const credentialKeys = new Set([
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "code",
  "secret",
  "password",
  "returnto",
  "next",
  "redirect",
  "redirecturi",
]);
const hasUnsafeCharacters = (path: string) =>
  Array.from(path).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || code === 92;
  });
export const sanitizeReturnPath = (
  value: string | null | undefined,
  role?: UserRole,
): string | null => {
  if (!value || value.length > 2048) return null;
  try {
    let decoded = value;
    for (let pass = 0; pass < 4; pass++) {
      if (
        !decoded.startsWith("/") ||
        decoded.startsWith("//") ||
        hasUnsafeCharacters(decoded) ||
        decoded.includes("://")
      )
        return null;
      const parsed = new URL(decoded, "https://oscar.invalid");
      if (parsed.origin !== "https://oscar.invalid" || parsed.hash.length > 0)
        return null;
      const roots =
        role === "ADMIN"
          ? ["/admin"]
          : role === "USER"
            ? ["/employee", "/dashboard", "/settings"]
            : ["/employee", "/admin", "/dashboard", "/settings"];
      if (
        !roots.some(
          (root) =>
            parsed.pathname === root || parsed.pathname.startsWith(`${root}/`),
        )
      )
        return null;
      if (/\/auth(?:\/|$)/u.test(parsed.pathname)) return null;
      for (const key of parsed.searchParams.keys()) {
        if (credentialKeys.has(key.toLowerCase().replace(/[-_]/gu, "")))
          return null;
      }
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        const original = new URL(value, "https://oscar.invalid");
        if (original.pathname.includes("%")) return null;
        return `${original.pathname}${original.search}`;
      }
      decoded = next;
    }
    return null;
  } catch {
    return null;
  }
};
export const resolvePostLoginPath = (
  value: string | null | undefined,
  role: UserRole = "USER",
): Route => (sanitizeReturnPath(value, role) ?? roleHomePath(role)) as Route;
