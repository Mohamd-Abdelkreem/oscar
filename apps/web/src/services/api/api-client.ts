import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from "axios";

import type { SuccessEnvelope } from "@template/contracts";

import { publicEnvironment } from "@/config/public-environment";

import { assignBrowserLocation, getBrowserLocation } from "./browser-location";

export type ApiResponse<T> = Omit<SuccessEnvelope<T>, "data"> & {
  readonly data: T;
};

export type ApiError = Readonly<{
  message: string;
  statusCode: number;
  code: string;
  requestId: string;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
}>;

export type ValueState<T> =
  { readonly kind: "missing" } | { readonly kind: "value"; readonly value: T };

type ParsedErrorEnvelope = Readonly<{
  message: string;
  statusCode: number;
  requestId: string;
  code: string;
  errors: unknown;
}>;

const STATUS_MESSAGES: Readonly<Record<number, string>> = Object.freeze({
  0: "Unable to reach the server. Check your connection and try again.",
  400: "The request contains invalid data. Review it and try again.",
  401: "Your session has expired. Sign in again to continue.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource could not be found.",
  409: "The request conflicts with the current resource state.",
  422: "Some submitted values are invalid.",
  429: "Too many requests. Wait a moment and try again.",
  500: "The server encountered an unexpected error.",
  501: "The requested operation is not available.",
  502: "The upstream service returned an invalid response.",
  503: "The service is temporarily unavailable.",
  504: "The upstream service took too long to respond.",
});

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PUBLIC_AUTH_PATHS = new Set([
  "/auth/register",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/login",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/validate-reset-token",
]);
const CREDENTIAL_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "secret",
  "password",
]);

const baseURL = publicEnvironment.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
const basePath = new URL(baseURL).pathname.replace(/\/+$/, "");

let accessToken: ValueState<string> = { kind: "missing" };
let refreshPromise: ValueState<Promise<string>> = { kind: "missing" };

declare module "axios" {
  interface AxiosRequestConfig {
    _templateRetried?: boolean;
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

export const setAccessToken = (token: string): void => {
  accessToken = { kind: "value", value: token };
};

export const getAccessToken = (): ValueState<string> => accessToken;

export const clearAccessToken = (): void => {
  accessToken = { kind: "missing" };
};

const readBrowserCookie = (name: string): ValueState<string> => {
  if (typeof document === "undefined") return { kind: "missing" };
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (cookie === undefined) return { kind: "missing" };
  try {
    return {
      kind: "value",
      value: decodeURIComponent(cookie.slice(prefix.length)),
    };
  } catch {
    return { kind: "missing" };
  }
};

const getRequestPath = (url: string): string => {
  try {
    const pathname = new URL(url, baseURL).pathname;
    return pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
};

export const isPublicAuthRequest = (url: string): boolean =>
  PUBLIC_AUTH_PATHS.has(getRequestPath(url));

const isUnsafeMethod = (method: string): boolean =>
  UNSAFE_METHODS.has(method.toUpperCase());

const safeCurrentPath = (): string | null => {
  const location = getBrowserLocation();
  if (location === null) return null;
  const value = `${location.pathname}${location.search}`;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (location.pathname.startsWith("/auth/")) return null;
  const parsed = new URL(value, "https://template.invalid");
  for (const key of parsed.searchParams.keys()) {
    if (CREDENTIAL_QUERY_KEYS.has(key.toLowerCase())) return null;
  }
  return `${parsed.pathname}${parsed.search}`;
};

const redirectToLogin = (): void => {
  const location = getBrowserLocation();
  if (location === null || location.pathname.startsWith("/auth/")) return;
  const returnTo = safeCurrentPath();
  assignBrowserLocation(
    returnTo === null
      ? "/auth/login"
      : `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
  );
};

const refreshAccessToken = (): Promise<string> => {
  if (refreshPromise.kind === "value") return refreshPromise.value;
  const promise = apiClient
    .post<ApiResponse<{ tokens: { accessToken: string } }>>("/auth/refresh", {})
    .then((response) => {
      const token = response.data.data.tokens.accessToken;
      setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshPromise = { kind: "missing" };
    });
  refreshPromise = { kind: "value", value: promise };
  return promise;
};

const isExpectedAnonymousRefreshFailure = (error: unknown): boolean => {
  const apiError = getApiError(error);

  return (
    (apiError.statusCode === 400 && apiError.code === "BAD_REQUEST") ||
    (apiError.statusCode === 401 && apiError.code === "UNAUTHORIZED")
  );
};

apiClient.interceptors.request.use((config) => {
  if (accessToken.kind === "value") {
    config.headers.set("Authorization", `Bearer ${accessToken.value}`);
  }
  if (isUnsafeMethod(config.method ?? "GET")) {
    const csrfToken = readBrowserCookie(CSRF_COOKIE_NAME);
    if (csrfToken.kind === "value") {
      config.headers.set(CSRF_HEADER_NAME, csrfToken.value);
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;
    const config = error.config;
    const requestUrl = config?.url;
    if (
      config === undefined ||
      typeof requestUrl !== "string" ||
      error.response?.status !== 401 ||
      isPublicAuthRequest(requestUrl) ||
      config._templateRetried === true
    ) {
      throw error;
    }
    config._templateRetried = true;
    try {
      await refreshAccessToken();
    } catch (refreshError: unknown) {
      clearAccessToken();

      if (isExpectedAnonymousRefreshFailure(refreshError)) {
        redirectToLogin();
      }

      throw refreshError;
    }
    return apiClient.request(config);
  },
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readFieldErrors = (value: unknown): Record<string, string[]> => {
  if (!Array.isArray(value)) return {};
  const grouped = new Map<string, string[]>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const field = item["field"];
    const message = item["message"];
    if (typeof field !== "string" || typeof message !== "string") continue;
    grouped.set(field, [...(grouped.get(field) ?? []), message]);
  }
  return Object.fromEntries(grouped);
};

const readErrorEnvelope = (value: unknown): ValueState<ParsedErrorEnvelope> => {
  if (!isRecord(value) || value["success"] !== false)
    return { kind: "missing" };
  const message = value["message"];
  const statusCode = value["statusCode"];
  const requestId = value["requestId"];
  const code = value["code"];
  if (
    typeof message !== "string" ||
    typeof statusCode !== "number" ||
    typeof requestId !== "string" ||
    typeof code !== "string"
  ) {
    return { kind: "missing" };
  }
  return {
    kind: "value",
    value: { message, statusCode, requestId, code, errors: value["errors"] },
  };
};

const readHeaderRequestId = (
  response: AxiosResponse<unknown> | undefined,
): string => {
  const value: unknown = response?.headers["x-request-id"] as unknown;
  return typeof value === "string" ? value : "";
};

export function getApiError(error: unknown): ApiError {
  const axiosError: AxiosError | undefined = axios.isAxiosError(error)
    ? error
    : undefined;
  const envelope = readErrorEnvelope(axiosError?.response?.data);
  const responseStatus = axiosError?.response?.status ?? 0;
  const statusCode =
    envelope.kind === "value" ? envelope.value.statusCode : responseStatus;
  const isTimeout =
    axiosError?.code === "ECONNABORTED" || axiosError?.code === "ETIMEDOUT";
  return {
    message:
      envelope.kind === "value"
        ? envelope.value.message
        : isTimeout
          ? "The request timed out. Try again."
          : (STATUS_MESSAGES[statusCode] ??
            "The request could not be completed."),
    statusCode,
    code:
      envelope.kind === "value"
        ? envelope.value.code
        : statusCode === 0
          ? "NETWORK_ERROR"
          : "HTTP_ERROR",
    requestId:
      envelope.kind === "value"
        ? envelope.value.requestId
        : readHeaderRequestId(axiosError?.response),
    fieldErrors:
      envelope.kind === "value" ? readFieldErrors(envelope.value.errors) : {},
  };
}
