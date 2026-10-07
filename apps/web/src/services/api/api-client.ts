import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import {
  identitySessionDataSchema,
  successEnvelopeSchema,
  type IdentityUserData,
} from "@template/contracts";
import type { z } from "zod";

import { publicEnvironment } from "@/config/public-environment";

import { getApiError, safeApiError } from "./safe-error";
import { getSessionRuntime, type SessionScope } from "./session-runtime";

export { getApiError } from "./safe-error";
export type { ApiError } from "./safe-error";
export type ApiResponse<T> = Readonly<{
  success: true;
  statusCode: number;
  data: T;
}>;
export type ValueState<T> =
  { readonly kind: "missing" } | { readonly kind: "value"; readonly value: T };

const baseURL = publicEnvironment.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
const basePath = new URL(baseURL).pathname.replace(/\/+$/, "");
const publicPaths = new Set([
  "/auth/register",
  "/auth/login",
  "/auth/admin/login",
  "/auth/refresh",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/validate-reset-token",
  "/auth/validate-verification-token",
  "/auth/validate-admin-invitation",
  "/auth/admin-invitations/accept",
]);
const cookiePaths = new Set([
  "/auth/login",
  "/auth/admin/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/logout-all",
  "/auth/reset-password",
  "/auth/change-password",
]);
const preExecutionAuthPaths = [
  /^\/users\/me$/u,
  /^\/auth\/(?:logout|logout-all|change-password)$/u,
  /^\/admin\/(?:admins|invitations)(?:\/[^/]+(?:\/(?:status|reissue|revoke))?)?$/u,
];
const privateReadPath =
  /^\/(?:packages|subscriptions|wallet|referrals|tasks|task-submissions|task-commands|proofs|task-illustrations|admin\/(?:packages|finance|wallets|referrals|referral-settings|configuration-changes|tasks|task-codes|task-submissions|task-illustrations))(?:\/|$)/u;
let accessToken: ValueState<string> = { kind: "missing" };
let refreshPromise: Promise<ApiResponse<IdentityUserData>> | undefined;
let subscribedRuntime: ReturnType<typeof getSessionRuntime> | undefined;
const runtime = () => {
  const current = getSessionRuntime();
  if (subscribedRuntime !== current) {
    current.onRetire(clearAccessToken);
    subscribedRuntime = current;
  }
  return current;
};

declare module "axios" {
  interface AxiosRequestConfig {
    _templateRetried?: boolean;
    _sessionScope?: SessionScope;
  }
}
export const apiClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});
export const clearAccessToken = (): void => {
  accessToken = { kind: "missing" };
};
export const setAccessToken = (token: string): void => {
  if (typeof window === "undefined")
    throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
  runtime();
  accessToken = { kind: "value", value: token };
};
export const getAccessToken = (): ValueState<string> => accessToken;

const requestPath = (url: string): string => {
  try {
    const parsed = new URL(url, baseURL);
    return parsed.pathname.startsWith(`${basePath}/`)
      ? parsed.pathname.slice(basePath.length)
      : parsed.pathname;
  } catch {
    return "";
  }
};
export const isPublicAuthRequest = (url: string): boolean =>
  publicPaths.has(requestPath(url));
const csrfCookie = (): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrfToken="));
  try {
    return cookie === undefined
      ? undefined
      : decodeURIComponent(cookie.slice(10));
  } catch {
    return undefined;
  }
};

export const parseApiResponse = <T>(
  response: AxiosResponse<unknown>,
  schema: z.ZodType<T>,
  expectedStatus: number,
): ApiResponse<T> => {
  const envelope = successEnvelopeSchema.safeParse(response.data);
  if (
    !envelope.success ||
    response.status !== expectedStatus ||
    envelope.data.statusCode !== response.status
  )
    throw safeApiError("contract", "CONTRACT_ERROR");
  const payload = schema.safeParse(envelope.data.data);
  if (!payload.success) throw safeApiError("contract", "CONTRACT_ERROR");
  return { success: true, statusCode: expectedStatus, data: payload.data };
};

export const refreshSession = (): Promise<ApiResponse<IdentityUserData>> => {
  if (refreshPromise !== undefined) return refreshPromise;
  const scope = runtime().scope();
  const pending = apiClient
    .post<unknown>("/auth/refresh", {})
    .then((response) => {
      const parsed = parseApiResponse(response, identitySessionDataSchema, 200);
      runtime().assertCurrent(scope);
      if (
        parsed.data.user.status !== "ACTIVE" ||
        parsed.data.user.emailVerifiedAt === null
      )
        throw safeApiError("contract", "CONTRACT_ERROR");
      runtime().admitIdentity(scope, parsed.data.user);
      setAccessToken(parsed.data.tokens.accessToken);
      return { ...parsed, data: { user: parsed.data.user } };
    })
    .catch((failure: unknown) => {
      clearAccessToken();
      throw getApiError(failure);
    })
    .finally(() => {
      if (refreshPromise === pending) refreshPromise = undefined;
    });
  refreshPromise = pending;
  return pending;
};

apiClient.interceptors.request.use((config) => {
  const current = runtime();
  const scope = config._sessionScope ?? current.scope();
  current.assertCurrent(scope);
  config._sessionScope = scope;
  const route = requestPath(config.url ?? "");
  if (new URL(config.url ?? "", baseURL).origin !== new URL(baseURL).origin)
    throw safeApiError("request", "REQUEST_ERROR");
  const cookieWrite =
    cookiePaths.has(route) && (config.method ?? "get").toLowerCase() !== "get";
  if (
    !isPublicAuthRequest(config.url ?? "") &&
    !cookieWrite &&
    !current.coordinationAvailable()
  )
    throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
  if (accessToken.kind === "value" && !isPublicAuthRequest(config.url ?? ""))
    config.headers.set("Authorization", `Bearer ${accessToken.value}`);
  else if (!cookiePaths.has(route)) config.headers.delete("Authorization");
  if (
    ["post", "patch", "put", "delete"].includes(
      (config.method ?? "get").toLowerCase(),
    )
  ) {
    const csrf = csrfCookie();
    if (csrf !== undefined) config.headers.set("x-csrf-token", csrf);
  }
  if (cookieWrite) {
    const adapter = axios.getAdapter(
      config.adapter ?? apiClient.defaults.adapter,
    );
    delete config.signal;
    delete config.cancelToken;
    config.timeout = 0;
    config.adapter = (request) =>
      current.cookieWrite(async (observeTerminal) => {
        current.assertCurrent(scope);
        try {
          const response = await adapter(request);
          observeTerminal();
          return response;
        } catch (failure: unknown) {
          if (axios.isAxiosError(failure) && failure.response !== undefined)
            observeTerminal();
          throw failure;
        }
      }, scope);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (response.config._sessionScope !== undefined)
      runtime().assertCurrent(response.config._sessionScope);
    return response;
  },
  async (failure: unknown) => {
    const projection = getApiError(failure);
    if (!axios.isAxiosError(failure)) throw projection;
    if (
      projection.category === "transient" &&
      cookiePaths.has(requestPath(failure.config?.url ?? "")) &&
      !runtime().coordinationAvailable()
    )
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    const read =
      ["get", "head"].includes(
        (failure.config?.method ?? "get").toLowerCase(),
      ) && !isPublicAuthRequest(failure.config?.url ?? "");
    const safe =
      projection.category === "transient" && !read
        ? safeApiError("uncertain", projection.code, projection.statusCode)
        : projection;
    const config = failure.config;
    if (config?._sessionScope !== undefined)
      runtime().assertCurrent(config._sessionScope);
    const route = requestPath(config?.url ?? "");
    if (
      safe.statusCode === 403 &&
      !isPublicAuthRequest(config?.url ?? "") &&
      !(read && privateReadPath.test(requestPath(config?.url ?? "")))
    )
      runtime().beginCheck();
    if (
      config === undefined ||
      safe.statusCode !== 401 ||
      isPublicAuthRequest(config.url ?? "") ||
      config._templateRetried === true ||
      !preExecutionAuthPaths.some((pattern) => pattern.test(route))
    )
      throw safe;
    config._templateRetried = true;
    // Cookie-writing commands must not reacquire their previous wrapper on replay.
    delete config.adapter;
    try {
      await refreshSession();
    } catch (refreshFailure: unknown) {
      const error = getApiError(refreshFailure);
      if (
        error.category === "denied" ||
        (error.statusCode === 400 && error.code === "BAD_REQUEST")
      )
        runtime().retire();
      throw error;
    }
    return apiClient.request(config);
  },
);
