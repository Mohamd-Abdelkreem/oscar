import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_SESSION_QUERY_KEY,
  loadSession,
  useChangePassword,
  useLogin,
  useLogout,
  useLogoutAll,
  useResetPassword,
} from "./auth.hooks";

const mocks = vi.hoisted(() => ({
  clearAccessToken: vi.fn(),
  changePassword: vi.fn(),
  getAccessToken: vi.fn(),
  getApiError: vi.fn(),
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  logoutAll: vi.fn(),
  refresh: vi.fn(),
  replaceWithLogin: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/services/api/api-client", () => ({
  clearAccessToken: mocks.clearAccessToken,
  getAccessToken: mocks.getAccessToken,
  getApiError: mocks.getApiError,
}));
vi.mock("@/features/users/api/users.api", () => ({
  usersApi: { getMe: mocks.getMe },
}));
vi.mock("../api/auth.api", () => ({
  authApi: {
    changePassword: mocks.changePassword,
    login: mocks.login,
    logout: mocks.logout,
    logoutAll: mocks.logoutAll,
    refresh: mocks.refresh,
    resetPassword: mocks.resetPassword,
  },
}));
vi.mock("../utils/session-navigation", () => ({
  replaceWithLogin: mocks.replaceWithLogin,
}));

const apiError = (statusCode: number, code: string) => ({
  message: "test",
  statusCode,
  code,
  requestId: "request",
  fieldErrors: {},
});

describe("loadSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockReturnValue({ kind: "missing" });
  });

  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
  ])("treats refresh %s/%s as anonymous", async (statusCode, code) => {
    mocks.refresh.mockRejectedValue(new Error("anonymous"));
    mocks.getApiError.mockReturnValue(apiError(statusCode, code));
    await expect(loadSession()).resolves.toBeNull();
    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it.each([
    [400, "VALIDATION_ERROR"],
    [401, "TOKEN_REPLAYED"],
    [403, "FORBIDDEN"],
    [503, "SERVICE_UNAVAILABLE"],
  ])("rethrows unexpected refresh %s/%s", async (statusCode, code) => {
    const error = new Error("unexpected");
    mocks.refresh.mockRejectedValue(error);
    mocks.getApiError.mockReturnValue(apiError(statusCode, code));
    await expect(loadSession()).rejects.toBe(error);
    expect(mocks.clearAccessToken).not.toHaveBeenCalled();
  });

  it("loads the current user after refresh", async () => {
    const account = { user: { id: "user" } };
    mocks.refresh.mockResolvedValue(undefined);
    mocks.getMe.mockResolvedValue(account);
    await expect(loadSession()).resolves.toBe(account);
  });

  it("skips proactive refresh when an access token already exists", async () => {
    const account = { user: { id: "user" } };
    mocks.getAccessToken.mockReturnValue({ kind: "value", value: "token" });
    mocks.getMe.mockResolvedValue(account);
    await expect(loadSession()).resolves.toBe(account);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
  ])("treats current-user %s/%s as anonymous", async (statusCode, code) => {
    mocks.getAccessToken.mockReturnValue({ kind: "value", value: "token" });
    mocks.getMe.mockRejectedValue(new Error("anonymous current user"));
    mocks.getApiError.mockReturnValue(apiError(statusCode, code));

    await expect(loadSession()).resolves.toBeNull();

    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
  });

  it.each([
    [400, "VALIDATION_ERROR"],
    [401, "TOKEN_REPLAYED"],
    [403, "FORBIDDEN"],
    [500, "INTERNAL_SERVER_ERROR"],
    [0, "NETWORK_ERROR"],
  ])("rethrows unexpected current-user %s/%s", async (statusCode, code) => {
    const error = new Error("unexpected current-user failure");
    mocks.getAccessToken.mockReturnValue({ kind: "value", value: "token" });
    mocks.getMe.mockRejectedValue(error);
    mocks.getApiError.mockReturnValue(apiError(statusCode, code));

    await expect(loadSession()).rejects.toBe(error);

    expect(mocks.clearAccessToken).not.toHaveBeenCalled();
  });
});

const createHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

const account = {
  user: {
    id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
    fullName: "Template User",
    email: "user@example.com",
    phone: null,
    role: "USER" as const,
    status: "ACTIVE" as const,
    emailVerifiedAt: "2026-08-18T00:00:00.000Z",
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
  },
};

describe("session mutation hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("populates the session cache only after login and current-user lookup", async () => {
    const { queryClient, wrapper } = createHarness();
    mocks.login.mockResolvedValue({});
    mocks.getMe.mockResolvedValue(account);
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        email: "user@example.com",
        password: "CorrectHorseBatteryStaple!1",
        rememberMe: false,
      });
    });

    expect(mocks.login).toHaveBeenCalledOnce();
    expect(mocks.getMe).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual(account);
  });

  it("preserves the local session and reports the mutation error when logout fails", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    queryClient.setQueryData(["unrelated"], "cached");
    const failure = new Error("network");
    mocks.logout.mockRejectedValue(failure);
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(failure);
    });

    expect(mocks.clearAccessToken).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual(account);
    expect(queryClient.getQueryData(["unrelated"])).toBe("cached");
  });

  it("clears in-memory credentials and every query after server logout succeeds", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    queryClient.setQueryData(["unrelated"], "cached");
    mocks.logout.mockResolvedValue({});
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("preserves the local session when logout-all fails", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    queryClient.setQueryData(["unrelated"], "cached");
    const failure = new Error("network");
    mocks.logoutAll.mockRejectedValue(failure);
    const { result } = renderHook(() => useLogoutAll(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(failure);
    });

    expect(mocks.clearAccessToken).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual(account);
    expect(queryClient.getQueryData(["unrelated"])).toBe("cached");
  });

  it("clears in-memory credentials and every query after logout-all succeeds", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    queryClient.setQueryData(["unrelated"], "cached");
    mocks.logoutAll.mockResolvedValue({});
    const { result } = renderHook(() => useLogoutAll(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("fully clears the session after a password change", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    mocks.changePassword.mockResolvedValue({});
    const { result } = renderHook(() => useChangePassword(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        currentPassword: "OldCorrectHorseBatteryStaple!1",
        newPassword: "NewCorrectHorseBatteryStaple!1",
        passwordConfirmation: "NewCorrectHorseBatteryStaple!1",
      });
    });

    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(mocks.replaceWithLogin).toHaveBeenCalledOnce();
  });

  it("fully clears the session after a password reset", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    mocks.resetPassword.mockResolvedValue({});
    const { result } = renderHook(() => useResetPassword(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        token: "opaque-reset-token",
        body: {
          newPassword: "NewCorrectHorseBatteryStaple!1",
          passwordConfirmation: "NewCorrectHorseBatteryStaple!1",
        },
      });
    });

    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(mocks.replaceWithLogin).toHaveBeenCalledOnce();
  });
});
