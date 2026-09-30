const CREDENTIAL_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "secret",
  "password",
]);

const safelyDecode = (value: string): string => {
  try {
    return decodeURIComponent(value.replace(/\+/gu, " "));
  } catch {
    return value;
  }
};

export const sanitizeRequestUrl = (value: string): string => {
  const queryStart = value.indexOf("?");
  if (queryStart === -1) return value;
  const fragmentStart = value.indexOf("#", queryStart);
  const path = value.slice(0, queryStart);
  const query =
    fragmentStart === -1
      ? value.slice(queryStart + 1)
      : value.slice(queryStart + 1, fragmentStart);
  const fragment = fragmentStart === -1 ? "" : value.slice(fragmentStart);
  const sanitized = query
    .split("&")
    .map((part) => {
      const equals = part.indexOf("=");
      const rawKey = equals === -1 ? part : part.slice(0, equals);
      return CREDENTIAL_QUERY_KEYS.has(safelyDecode(rawKey).toLowerCase())
        ? `${rawKey}=[REDACTED]`
        : part;
    })
    .join("&");
  return `${path}?${sanitized}${fragment}`;
};

export const sanitizeRequestQuery = (
  value: unknown,
): Record<string, unknown> | undefined => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      CREDENTIAL_QUERY_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : item,
    ]),
  );
};

export const sanitizeRequestForLog = (
  value: Record<string, unknown>,
): Record<string, unknown> => ({
  ...value,
  ...(typeof value["url"] === "string"
    ? { url: sanitizeRequestUrl(value["url"]) }
    : {}),
  ...(typeof value["originalUrl"] === "string"
    ? { originalUrl: sanitizeRequestUrl(value["originalUrl"]) }
    : {}),
  ...(sanitizeRequestQuery(value["query"]) === undefined
    ? {}
    : { query: sanitizeRequestQuery(value["query"]) }),
  raw: undefined,
});
