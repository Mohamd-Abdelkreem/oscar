const CREDENTIAL_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "secret",
  "password",
  "api_key",
  "apikey",
  "private_key",
  "privatekey",
  "signing_payload",
  "seed",
  "mnemonic",
]);

const safelyDecode = (value: string): string => {
  try {
    return decodeURIComponent(value.replace(/\+/gu, " "));
  } catch {
    return value;
  }
};

const isCredentialQueryKey = (key: string): boolean =>
  CREDENTIAL_QUERY_KEYS.has(key.toLowerCase()) ||
  /password|token|secret|api[_-]?key|private[_-]?key|signing[_-]?payload|signed[_-]?bytes|mnemonic/iu.test(
    key,
  );

export const sanitizeRequestUrl = (value: string): string => {
  const fragmentStart = value.indexOf("#");
  const fragment = fragmentStart === -1 ? "" : value.slice(fragmentStart);
  const credentialFragment = fragment
    .slice(1)
    .split("&")
    .some(
      (part) =>
        isCredentialQueryKey(safelyDecode(part.split("=")[0] ?? "")) &&
        part.includes("="),
    );
  const withoutFragment =
    fragmentStart === -1 ? value : value.slice(0, fragmentStart);
  const queryStart = value.indexOf("?");
  if (queryStart === -1 || queryStart >= withoutFragment.length)
    return `${withoutFragment}${credentialFragment ? "" : fragment}`;
  const path = value.slice(0, queryStart);
  const query =
    fragmentStart === -1
      ? value.slice(queryStart + 1)
      : value.slice(queryStart + 1, fragmentStart);
  const sanitized = query
    .split("&")
    .map((part) => {
      const equals = part.indexOf("=");
      const rawKey = equals === -1 ? part : part.slice(0, equals);
      return isCredentialQueryKey(safelyDecode(rawKey))
        ? `${rawKey}=[REDACTED]`
        : part;
    })
    .join("&");
  return `${path}?${sanitized}${credentialFragment ? "" : fragment}`;
};

export const sanitizeRequestQuery = (
  value: unknown,
  depth = 0,
): Record<string, unknown> | undefined => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  if (depth >= 8) return undefined;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isCredentialQueryKey(key)
        ? "[REDACTED]"
        : item !== null && typeof item === "object"
          ? Array.isArray(item)
            ? item.map((element: unknown) =>
                typeof element === "object" && element !== null
                  ? sanitizeRequestQuery(element, depth + 1)
                  : element,
              )
            : sanitizeRequestQuery(item, depth + 1)
          : item,
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
  ...(value["headers"] !== null && typeof value["headers"] === "object"
    ? {
        headers: Object.fromEntries(
          Object.entries(value["headers"]).filter(
            ([key]) => !["referer", "referrer"].includes(key.toLowerCase()),
          ),
        ),
      }
    : {}),
});
