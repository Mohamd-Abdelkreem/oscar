import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient, setAccessToken } from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";

import {
  useLogin,
  useLogout,
  useLogoutAll,
  useResetPassword,
  useChangePassword,
  useSession,
} from "./auth.hooks";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Employee",
  email: "employee@example.test",
  phone: null,
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: "2026-10-01T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  referralCode: "a".repeat(32),
  tasksBlocked: false,
  withdrawalsBlocked: false,
  accountVersion: 0,
};
const original = apiClient.defaults.adapter;
const clients: QueryClient[] = [];
const wrapperFor = () => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) =>
        Promise.resolve(callback()),
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
};
afterEach(() => {
  if (original !== undefined) apiClient.defaults.adapter = original;
  getSessionRuntime().dispose();
  localStorage.clear();
  clients.splice(0).forEach((client) => {
    client.clear();
  });
});

describe("scoped session and transient login", () => {
  it("US4 resetting unrelated B retires browser A without admitting B's reset reply as a session", async () => {
    const { wrapper, client } = wrapperFor();
    const runtime = getSessionRuntime();
    runtime.admitIdentity(runtime.scope(), { id: user.id, role: "USER" });
    setAccessToken("account-a-token");
    client.setQueryData(["private", user.id], { user });
    const target = {
      ...user,
      id: "00000000-0000-4000-8000-000000000002",
      email: "unrelated@example.test",
      role: "ADMIN",
      referralCode: null,
    };
    apiClient.defaults.adapter = (config) =>
      Promise.resolve({
        config,
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        data: {
          success: true,
          statusCode: 200,
          message: "OK",
          requestId: "id",
          timestamp: user.createdAt,
          path: config.url,
          data: { user: target },
        },
      });
    const hook = renderHook(() => useResetPassword(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync({
        token: "UNRELATED-TOKEN-SENTINEL",
        body: {
          newPassword: "PASSWORD-SENTINEL",
          passwordConfirmation: "PASSWORD-SENTINEL",
        },
      });
    });
    expect(hook.result.current.isSuccess).toBe(true);
    expect(runtime.scope().accountId).toBeNull();
    expect(client.getQueryCache().getAll()).toEqual([]);
    expect(client.getMutationCache().getAll()).toEqual([]);
  });
  it("US4 a terminal wrong-current denial preserves the active form authority; committed change retires it and clears private state", async () => {
    const { wrapper, client } = wrapperFor();
    const runtime = getSessionRuntime();
    runtime.admitIdentity(runtime.scope(), { id: user.id, role: "USER" });
    const scope = runtime.scope();
    setAccessToken("test-token");
    client.setQueryData(["private"], { userId: user.id });
    let denied = true;
    apiClient.defaults.adapter = (config) => {
      const response = {
        config,
        status: denied ? 400 : 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        data: denied
          ? {
              success: false,
              statusCode: 400,
              code: "BAD_REQUEST",
              message: "SENTINEL",
            }
          : {
              success: true,
              statusCode: 200,
              message: "OK",
              requestId: "id",
              timestamp: user.createdAt,
              path: config.url,
              data: { user },
            },
      };
      return denied
        ? Promise.reject(
            new AxiosError(
              "SENTINEL",
              "ERR_BAD_REQUEST",
              config,
              undefined,
              response,
            ),
          )
        : Promise.resolve(response);
    };
    const hook = renderHook(() => useChangePassword(), { wrapper });
    const body = {
      currentPassword: "wrong-current",
      newPassword: "PASSWORD-SENTINEL",
      passwordConfirmation: "PASSWORD-SENTINEL",
    };
    await act(async () => {
      await expect(hook.result.current.mutateAsync(body)).rejects.toMatchObject(
        { statusCode: 400 },
      );
    });
    expect(runtime.isCurrent(scope)).toBe(true);
    expect(client.getQueryData(["private"])).toEqual({ userId: user.id });
    expect(hook.result.current.isSuccess).toBe(false);
    denied = false;
    await act(async () => {
      await hook.result.current.mutateAsync({
        ...body,
        currentPassword: "correct-current",
      });
    });
    expect(runtime.isCurrent(scope)).toBe(false);
    expect(hook.result.current.isSuccess).toBe(true);
    expect(client.getQueryCache().getAll()).toEqual([]);
    expect(client.getMutationCache().getAll()).toEqual([]);
    expect(JSON.stringify(hook.result.current)).not.toContain("SENTINEL");
  });
  it.each(["reset", "change", "logout", "logout-all"])(
    "US4 %s lost response clears private caches and cannot infer commitment from denied restoration",
    async (operation) => {
      const { wrapper, client } = wrapperFor();
      client.setQueryData(["private", "account-a"], {
        secret: "PRIVATE-SENTINEL",
      });
      setAccessToken("test-only-token");
      let sends = 0;
      apiClient.defaults.adapter = (config) => {
        sends++;
        return Promise.reject(
          new AxiosError("PASSWORD-SENTINEL", "ERR_NETWORK", config),
        );
      };
      const hook = renderHook(
        () => ({
          reset: useResetPassword(),
          change: useChangePassword(),
          logout: useLogout(),
          all: useLogoutAll(),
        }),
        { wrapper },
      );
      await act(async () => {
        const command =
          operation === "reset"
            ? hook.result.current.reset.mutateAsync({
                token: "TOKEN-SENTINEL",
                body: {
                  newPassword: "PASSWORD-SENTINEL",
                  passwordConfirmation: "PASSWORD-SENTINEL",
                },
              })
            : operation === "change"
              ? hook.result.current.change.mutateAsync({
                  currentPassword: "CURRENT-SENTINEL",
                  newPassword: "PASSWORD-SENTINEL",
                  passwordConfirmation: "PASSWORD-SENTINEL",
                })
              : operation === "logout"
                ? hook.result.current.logout.mutateAsync()
                : hook.result.current.all.mutateAsync();
        await command.catch(() => undefined);
      });
      expect(sends).toBe(1);
      expect(client.getQueryCache().getAll()).toEqual([]);
      expect(client.getMutationCache().getAll()).toEqual([]);
      expect(JSON.stringify(hook.result.current)).not.toContain("SENTINEL");
      expect(getSessionRuntime().coordinationAvailable()).toBe(false);
      const active =
        operation === "reset"
          ? hook.result.current.reset
          : operation === "change"
            ? hook.result.current.change
            : operation === "logout"
              ? hook.result.current.logout
              : hook.result.current.all;
      expect(active.uncertain).toBe(true);
      expect(active.isSuccess).toBe(false);
    },
  );
  it("reconciles a policy denial through a fresh authority check without granting the denied response", async () => {
    const { wrapper } = wrapperFor();
    setAccessToken("test-only-token");
    let reads = 0;
    apiClient.defaults.adapter = (config) => {
      reads++;
      const response = {
        config,
        status: reads === 1 ? 403 : 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        data:
          reads === 1
            ? {
                success: false,
                statusCode: 403,
                code: "FORBIDDEN",
                message: "SENTINEL",
              }
            : {
                success: true,
                statusCode: 200,
                message: "OK",
                requestId: "id",
                timestamp: user.createdAt,
                path: config.url,
                data: { user },
              },
      };
      return reads === 1
        ? Promise.reject(
            new AxiosError(
              "SENTINEL",
              "ERR_BAD_REQUEST",
              config,
              undefined,
              response,
            ),
          )
        : Promise.resolve(response);
    };
    const hook = renderHook(() => useSession(), { wrapper });
    await vi.waitFor(() => {
      expect(hook.result.current.data?.user.id).toBe(user.id);
    });
    expect(getSessionRuntime().scope()).toMatchObject({
      epoch: 0,
      check: 1,
      accountId: user.id,
      role: "USER",
    });
    expect(reads).toBeGreaterThanOrEqual(2);
    hook.unmount();
  });
  it("validates current authority after login and retains no passwords/tokens in query or mutation state", async () => {
    const { client, wrapper } = wrapperFor();
    apiClient.defaults.adapter = (config) =>
      Promise.resolve({
        config,
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        data: {
          success: true,
          statusCode: 200,
          message: "OK",
          requestId: "id",
          timestamp: user.createdAt,
          path: config.url,
          data:
            config.url === "/auth/login"
              ? { user, tokens: { accessToken: "SENTINEL-TOKEN" } }
              : { user },
        },
      });
    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        email: user.email,
        password: "SENTINEL-PASSWORD",
        rememberMe: false,
      });
    });
    expect(client.getMutationCache().getAll()).toEqual([]);
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state),
      ),
    ).not.toContain("SENTINEL");
  });

  it("blocks remounted duplicate commands and clears private cache before logout settles", async () => {
    const { client, wrapper } = wrapperFor();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    apiClient.defaults.adapter = async (config) => {
      await gate;
      return {
        config,
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        data: {
          success: true,
          statusCode: 200,
          message: "OK",
          requestId: "id",
          timestamp: user.createdAt,
          path: "/auth/logout",
          data: {},
        },
      };
    };
    client.setQueryData(["private"], { sentinel: "SENTINEL" });
    const first = renderHook(() => useLogout(), { wrapper });
    let pending!: Promise<unknown>;
    act(() => {
      pending = first.result.current.mutateAsync();
    });
    first.unmount();
    const second = renderHook(() => useLogout(), { wrapper });
    await act(async () => {
      await expect(second.result.current.mutateAsync()).rejects.toMatchObject({
        code: "COMMAND_PENDING",
      });
    });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    await act(async () => {
      finish();
      await expect(pending).rejects.toMatchObject({ code: "OBSOLETE_SCOPE" });
    });
  });

  it("never grants authority to inactive current-user data", async () => {
    const { wrapper } = wrapperFor();
    apiClient.defaults.adapter = (config) =>
      Promise.resolve({
        config,
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        data: {
          success: true,
          statusCode: 200,
          message: "OK",
          requestId: "id",
          timestamp: user.createdAt,
          path: config.url,
          data:
            config.url === "/auth/refresh"
              ? { user, tokens: { accessToken: "token" } }
              : { user: { ...user, status: "BANNED" } },
        },
      });
    const { result } = renderHook(() => useSession(), { wrapper });
    await vi.waitFor(() => {
      expect(result.current.isFetched).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });
});
