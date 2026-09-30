import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type {
  AuthUserData,
  ChangePasswordBody,
  EmailRequestBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
} from "@template/contracts";

import { usersApi } from "@/features/users/api/users.api";
import {
  clearAccessToken,
  getAccessToken,
  getApiError,
  type ApiError,
} from "@/services/api/api-client";

import { authApi } from "../api/auth.api";
import { replaceWithLogin } from "../utils/session-navigation";

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"] as const;

const isExpectedAnonymousAuthError = (error: ApiError): boolean =>
  (error.statusCode === 400 && error.code === "BAD_REQUEST") ||
  (error.statusCode === 401 && error.code === "UNAUTHORIZED");

export const loadSession = async (): Promise<AuthUserData | null> => {
  if (getAccessToken().kind === "missing") {
    try {
      await authApi.refresh();
    } catch (error: unknown) {
      const apiError = getApiError(error);

      if (isExpectedAnonymousAuthError(apiError)) {
        clearAccessToken();
        return null;
      }
      throw error;
    }
  }

  try {
    return await usersApi.getMe();
  } catch (error: unknown) {
    const apiError = getApiError(error);

    if (isExpectedAnonymousAuthError(apiError)) {
      clearAccessToken();
      return null;
    }
    throw error;
  }
};

export const useSession = () =>
  useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: loadSession,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
  });

export function useLogin(): UseMutationResult<
  AuthUserData,
  unknown,
  LoginBody
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      await authApi.login(body);
      return usersApi.getMe();
    },
    onSuccess: (account) => {
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    },
  });
}

export const useRegister = () =>
  useMutation({ mutationFn: (body: RegisterBody) => authApi.register(body) });

export const useVerifyEmail = () =>
  useMutation({ mutationFn: (token: string) => authApi.verifyEmail(token) });

export const useResendVerification = () =>
  useMutation({
    mutationFn: (body: EmailRequestBody) => authApi.resendVerification(body),
  });

const useSessionEndingMutation = (allDevices: boolean) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => (allDevices ? authApi.logoutAll() : authApi.logout()),
    onSuccess: () => {
      clearAccessToken();
      queryClient.clear();
    },
  });
};

export const useLogout = () => useSessionEndingMutation(false);
export const useLogoutAll = () => useSessionEndingMutation(true);

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (body: EmailRequestBody) => authApi.forgotPassword(body),
  });

export const useResetPassword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token, body }: { token: string; body: ResetPasswordBody }) =>
      authApi.resetPassword(token, body),
    onSuccess: () => {
      clearAccessToken();
      queryClient.clear();
      replaceWithLogin();
    },
  });
};

export const useValidateResetToken = (token: string) =>
  useQuery({
    queryKey: ["auth", "reset-token", token] as const,
    queryFn: () => authApi.validateResetToken(token),
    enabled: token.length > 0,
    staleTime: 300_000,
    retry: false,
  });

export const useChangePassword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangePasswordBody) => authApi.changePassword(body),
    onSuccess: () => {
      clearAccessToken();
      queryClient.clear();
      replaceWithLogin();
    },
  });
};
