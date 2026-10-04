import {
  credentialValidityDataSchema,
  emptyActionDataSchema,
  neutralEmailDataSchema,
  identitySessionDataSchema,
  identityUserDataSchema,
  type ChangePasswordBody,
  type EmailRequestBody,
  type LoginBody,
  type RegisterBody,
  type ResetPasswordBody,
  type AdminInvitationAcceptBody,
  type IdentityUserData,
} from "@template/contracts";
import type { z } from "zod";
import type { AxiosResponse } from "axios";

import {
  apiClient,
  clearAccessToken,
  getApiError,
  getAccessToken,
  parseApiResponse,
  refreshSession,
  setAccessToken,
  type ApiResponse,
} from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";

const action = async <T>(
  request: Promise<AxiosResponse<unknown>>,
  schema: z.ZodType<T>,
  status = 200,
): Promise<ApiResponse<T>> => parseApiResponse(await request, schema, status);
const neutral = async (request: Promise<AxiosResponse<unknown>>) => {
  const parsed = await action(request, neutralEmailDataSchema);
  return {
    ...parsed,
    data: { message: "إذا كان الحساب مؤهلاً، ستصلك رسالة بالخطوات المطلوبة." },
  };
};
const endingAction = async <T>(
  request: Promise<AxiosResponse<unknown>>,
  schema: z.ZodType<T>,
) => {
  try {
    return await action(request, schema);
  } finally {
    clearAccessToken();
  }
};
const login = async (
  path: "/auth/login" | "/auth/admin/login",
  body: LoginBody,
): Promise<ApiResponse<IdentityUserData>> => {
  const runtime = getSessionRuntime();
  runtime.beginCheck();
  if (!runtime.coordinationAvailable())
    throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
  runtime.retire();
  const scope = runtime.scope();
  const parsed = await action(
    apiClient.post<unknown>(path, body),
    identitySessionDataSchema,
  );
  runtime.assertCurrent(scope);
  if (
    parsed.data.user.status !== "ACTIVE" ||
    parsed.data.user.emailVerifiedAt === null ||
    (path === "/auth/admin/login" && parsed.data.user.role !== "ADMIN")
  )
    throw safeApiError("contract", "CONTRACT_ERROR");
  runtime.admitIdentity(scope, parsed.data.user);
  setAccessToken(parsed.data.tokens.accessToken);
  return { ...parsed, data: { user: parsed.data.user } };
};
const endingHeaders = () => {
  const token = getAccessToken();
  getSessionRuntime().retire();
  clearAccessToken();
  return token.kind === "value"
    ? { Authorization: `Bearer ${token.value}` }
    : {};
};

export const authApi = {
  register: (body: RegisterBody) =>
    action(
      apiClient.post<unknown>("/auth/register", body),
      identityUserDataSchema,
      201,
    ),
  login: (body: LoginBody) => login("/auth/login", body),
  adminLogin: (body: LoginBody) => login("/auth/admin/login", body),
  refresh: refreshSession,
  verifyEmail: (token: string) =>
    action(
      apiClient.post<unknown>("/auth/verify-email", {}, { params: { token } }),
      identityUserDataSchema,
    ),
  validateVerificationToken: (token: string, signal?: AbortSignal) =>
    action(
      apiClient.get<unknown>("/auth/validate-verification-token", {
        params: { token },
        ...(signal === undefined ? {} : { signal }),
      }),
      credentialValidityDataSchema,
    ),
  validateResetToken: (token: string, signal?: AbortSignal) =>
    action(
      apiClient.get<unknown>("/auth/validate-reset-token", {
        params: { token },
        ...(signal === undefined ? {} : { signal }),
      }),
      credentialValidityDataSchema,
    ),
  validateAdminInvitation: (token: string, signal?: AbortSignal) =>
    action(
      apiClient.get<unknown>("/auth/validate-admin-invitation", {
        params: { token },
        ...(signal === undefined ? {} : { signal }),
      }),
      credentialValidityDataSchema,
    ),
  acceptAdminInvitation: async (
    token: string,
    body: AdminInvitationAcceptBody,
  ) => {
    const parsed = await action(
      apiClient.post<unknown>("/auth/admin-invitations/accept", body, {
        params: { token },
      }),
      identityUserDataSchema,
      201,
    );
    if (
      parsed.data.user.role !== "ADMIN" ||
      parsed.data.user.status !== "ACTIVE" ||
      parsed.data.user.emailVerifiedAt === null
    )
      throw safeApiError("contract", "CONTRACT_ERROR");
    return parsed;
  },
  resendVerification: (body: EmailRequestBody) =>
    neutral(apiClient.post<unknown>("/auth/resend-verification", body)),
  forgotPassword: (body: EmailRequestBody) =>
    neutral(apiClient.post<unknown>("/auth/forgot-password", body)),
  logout: () =>
    endingAction(
      apiClient.post<unknown>("/auth/logout", {}, { headers: endingHeaders() }),
      emptyActionDataSchema,
    ),
  logoutAll: () =>
    endingAction(
      apiClient.post<unknown>(
        "/auth/logout-all",
        {},
        { headers: endingHeaders() },
      ),
      emptyActionDataSchema,
    ),
  resetPassword: (token: string, body: ResetPasswordBody) => {
    getSessionRuntime().retire();
    return action(
      apiClient.post<unknown>("/auth/reset-password", body, {
        params: { token },
      }),
      identityUserDataSchema,
    );
  },
  changePassword: async (body: ChangePasswordBody) => {
    try {
      return await action(
        apiClient.patch<unknown>("/auth/change-password", body),
        identityUserDataSchema,
      );
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (
        ["transient", "uncertain", "contract", "coordination"].includes(
          safe.category,
        )
      ) {
        getSessionRuntime().retire();
        clearAccessToken();
      }
      throw safe;
    }
  },
};
