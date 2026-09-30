import { DEFAULT_RETURN_PATH } from "../constants/auth.constants";

const ALLOWED_ROOTS = ["/dashboard", "/settings"] as const;
const CREDENTIAL_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "secret",
  "password",
]);

export const sanitizeReturnPath = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null || value.length === 0) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (
    value.includes("://") ||
    value.includes(String.fromCharCode(92)) ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    return null;
  }
  try {
    const parsed = new URL(value, "https://template.invalid");
    if (parsed.origin !== "https://template.invalid") return null;
    if (
      !ALLOWED_ROOTS.some(
        (root) =>
          parsed.pathname === root || parsed.pathname.startsWith(`${root}/`),
      )
    ) {
      return null;
    }
    for (const key of parsed.searchParams.keys()) {
      if (CREDENTIAL_QUERY_KEYS.has(key.toLowerCase())) return null;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
};

export const resolvePostLoginPath = (
  value: string | null | undefined,
): string => sanitizeReturnPath(value) ?? DEFAULT_RETURN_PATH;
