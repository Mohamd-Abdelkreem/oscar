"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChangePasswordBody,
  EmailRequestBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  IdentityUserData,
} from "@template/contracts";

import { usersApi } from "@/features/users/api/users.api";
import {
  clearAccessToken,
  getAccessToken,
  getApiError,
} from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import {
  getSessionRuntime,
  peekSessionRuntime,
} from "@/services/api/session-runtime";
import type { SessionScope } from "@/services/api/session-runtime";

import { authApi } from "../api/auth.api";
import { useCredentialCommand } from "./credential-commands.hooks";

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"] as const;
const serverScope: SessionScope = Object.freeze({
  epoch: 0,
  check: 0,
  accountId: null,
  role: null,
});
export const useSessionScope = () =>
  useSyncExternalStore(
    (listener) => getSessionRuntime().subscribe(listener),
    () => peekSessionRuntime()?.scope() ?? serverScope,
    () => serverScope,
  );
export const sessionQueryKey = (scope: SessionScope) =>
  [
    ...AUTH_SESSION_QUERY_KEY,
    scope.epoch,
    scope.check,
    scope.accountId,
    scope.role,
  ] as const;

export const loadSession = async (
  signal?: AbortSignal,
  expectedScope?: SessionScope,
): Promise<IdentityUserData | null> => {
  const runtime = getSessionRuntime();
  const scope = expectedScope ?? runtime.scope();
  if (!runtime.isCurrentCheck(scope))
    throw safeApiError("obsolete", "OBSOLETE_SCOPE");
  if (!runtime.coordinationAvailable())
    throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
  try {
    if (getAccessToken().kind === "missing") await authApi.refresh();
    runtime.assertCurrent(scope);
    const account = await usersApi.getMe(signal);
    if (!runtime.isCurrentCheck(scope))
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    if (
      account.user.status !== "ACTIVE" ||
      account.user.emailVerifiedAt === null
    )
      throw safeApiError("denied", "UNAUTHORIZED", 401);
    runtime.admitIdentity(scope, account.user);
    return account;
  } catch (failure: unknown) {
    const error = getApiError(failure);
    if (
      error.statusCode === 401 ||
      (error.statusCode === 400 && error.code === "BAD_REQUEST")
    ) {
      clearAccessToken();
      return null;
    }
    throw error;
  }
};

const useSessionQuery = (mode: "check" | "observe", pathname?: string) => {
  const scope = useSessionScope();
  const client = useQueryClient();
  useEffect(
    () =>
      getSessionRuntime().onRetire(() => {
        void client.cancelQueries();
        client.clear();
      }),
    [client],
  );
  return useQuery({
    queryKey:
      pathname === undefined
        ? sessionQueryKey(scope)
        : [...sessionQueryKey(scope), pathname],
    queryFn: ({ signal }) => loadSession(signal, scope),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: mode === "check",
    // A superseded refresh must settle before the latest check restores again.
    // Unknown cookie outcomes remain quarantined by coordinationAvailable.
    retry: (attempt, failure) =>
      attempt === 0 &&
      getApiError(failure).category === "obsolete" &&
      getSessionRuntime().isCurrentCheck(scope) &&
      getSessionRuntime().coordinationAvailable(),
    retryDelay: 0,
  });
};

export const useSession = (pathname?: string) =>
  useSessionQuery("check", pathname);
export const useCurrentSession = () => useSessionQuery("observe");

// A persistent layout cannot treat a cached identity as new route permission.
export const useRouteSession = (pathname: string) => {
  const session = useSession(pathname);
  useEffect(() => {
    getSessionRuntime().beginCheck();
  }, [pathname]);
  useEffect(() => {
    const check = () => {
      getSessionRuntime().beginCheck();
    };
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, []);
  return {
    ...session,
    refetch: () => {
      getSessionRuntime().beginCheck();
    },
  };
};

const usePasswordLogin = (
  key: string,
  signIn: (body: LoginBody) => ReturnType<typeof authApi.login>,
) => {
  const client = useQueryClient();
  return useCredentialCommand(key, async (body: LoginBody) => {
    void client.cancelQueries();
    client.clear();
    const signedIn = await signIn(body);
    const account = await loadSession();
    if (account === null) throw safeApiError("denied", "UNAUTHORIZED", 401);
    if (
      account.user.id !== signedIn.data.user.id ||
      account.user.role !== signedIn.data.user.role
    ) {
      getSessionRuntime().retire();
      clearAccessToken();
      throw safeApiError("contract", "CONTRACT_ERROR");
    }
    client.setQueryData(sessionQueryKey(getSessionRuntime().scope()), account);
    return account;
  });
};
export const useLogin = () => usePasswordLogin("login", authApi.login);
export const useAdminLogin = () =>
  usePasswordLogin("admin-login", authApi.adminLogin);
export const useRegister = () =>
  useCredentialCommand("register", (body: RegisterBody) =>
    authApi.register(body),
  );
export const useVerifyEmail = () =>
  useCredentialCommand("verify-email", (token: string) =>
    authApi.verifyEmail(token),
  );
export const useResendVerification = () =>
  useCredentialCommand("resend-verification", (body: EmailRequestBody) =>
    authApi.resendVerification(body),
  );
export const useForgotPassword = () =>
  useCredentialCommand("forgot-password", (body: EmailRequestBody) =>
    authApi.forgotPassword(body),
  );
const useSessionEndingCommand = <TInput, TOutput>(
  key: string,
  execute: (input: TInput) => Promise<TOutput>,
) => {
  const client = useQueryClient();
  return useCredentialCommand(key, (input: TInput) => {
    void client.cancelQueries();
    client.clear();
    return execute(input);
  });
};
export const useLogout = () => {
  const command = useSessionEndingCommand("logout", (_input: undefined) =>
    authApi.logout(),
  );
  return { ...command, mutateAsync: () => command.mutateAsync(undefined) };
};
export const useLogoutAll = () => {
  const command = useSessionEndingCommand("logout-all", (_input: undefined) =>
    authApi.logoutAll(),
  );
  return { ...command, mutateAsync: () => command.mutateAsync(undefined) };
};
export const useResetPassword = () =>
  useSessionEndingCommand(
    "reset-password",
    ({ token, body }: { token: string; body: ResetPasswordBody }) =>
      authApi.resetPassword(token, body),
  );
export const useChangePassword = () => {
  const client = useQueryClient();
  return useCredentialCommand(
    "change-password",
    async (body: ChangePasswordBody) => {
      try {
        return await authApi.changePassword(body);
      } catch (failure: unknown) {
        const safe = getApiError(failure);
        if (
          [
            "transient",
            "uncertain",
            "contract",
            "coordination",
            "obsolete",
          ].includes(safe.category)
        ) {
          void client.cancelQueries();
          client.clear();
        }
        throw safe;
      }
    },
    () => {
      getSessionRuntime().retire();
      clearAccessToken();
      void client.cancelQueries();
      client.clear();
    },
  );
};
