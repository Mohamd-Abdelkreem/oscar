import type {
  AuthSessionData,
  AuthUserData,
  ChangePasswordBody,
  EmailRequestBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
} from "@template/contracts";

import {
  apiClient,
  setAccessToken,
  type ApiResponse,
} from "@/services/api/api-client";

type NeutralMessage = Readonly<{ message: string }>;

const acceptToken = (
  response: ApiResponse<AuthSessionData>,
): ApiResponse<AuthSessionData> => {
  setAccessToken(response.data.tokens.accessToken);
  return response;
};

export const authApi = {
  async register(body: RegisterBody): Promise<ApiResponse<AuthUserData>> {
    const response = await apiClient.post<ApiResponse<AuthUserData>>(
      "/auth/register",
      body,
    );
    return response.data;
  },
  async verifyEmail(token: string): Promise<ApiResponse<AuthUserData>> {
    const response = await apiClient.post<ApiResponse<AuthUserData>>(
      "/auth/verify-email",
      {},
      { params: { token } },
    );
    return response.data;
  },
  async resendVerification(
    body: EmailRequestBody,
  ): Promise<ApiResponse<NeutralMessage>> {
    const response = await apiClient.post<ApiResponse<NeutralMessage>>(
      "/auth/resend-verification",
      body,
    );
    return response.data;
  },
  async login(body: LoginBody): Promise<ApiResponse<AuthSessionData>> {
    const response = await apiClient.post<ApiResponse<AuthSessionData>>(
      "/auth/login",
      body,
    );
    return acceptToken(response.data);
  },
  async refresh(): Promise<ApiResponse<AuthSessionData>> {
    const response = await apiClient.post<ApiResponse<AuthSessionData>>(
      "/auth/refresh",
      {},
    );
    return acceptToken(response.data);
  },
  async logout(): Promise<ApiResponse<Record<string, never>>> {
    const response = await apiClient.post<ApiResponse<Record<string, never>>>(
      "/auth/logout",
      {},
    );
    return response.data;
  },
  async logoutAll(): Promise<ApiResponse<Record<string, never>>> {
    const response = await apiClient.post<ApiResponse<Record<string, never>>>(
      "/auth/logout-all",
      {},
    );
    return response.data;
  },
  async forgotPassword(
    body: EmailRequestBody,
  ): Promise<ApiResponse<NeutralMessage>> {
    const response = await apiClient.post<ApiResponse<NeutralMessage>>(
      "/auth/forgot-password",
      body,
    );
    return response.data;
  },
  async validateResetToken(
    token: string,
  ): Promise<ApiResponse<{ valid: true }>> {
    const response = await apiClient.get<ApiResponse<{ valid: true }>>(
      "/auth/validate-reset-token",
      { params: { token } },
    );
    return response.data;
  },
  async resetPassword(
    token: string,
    body: ResetPasswordBody,
  ): Promise<ApiResponse<AuthUserData>> {
    const response = await apiClient.post<ApiResponse<AuthUserData>>(
      "/auth/reset-password",
      body,
      { params: { token } },
    );
    return response.data;
  },
  async changePassword(
    body: ChangePasswordBody,
  ): Promise<ApiResponse<AuthUserData>> {
    const response = await apiClient.patch<ApiResponse<AuthUserData>>(
      "/auth/change-password",
      body,
    );
    return response.data;
  },
};
