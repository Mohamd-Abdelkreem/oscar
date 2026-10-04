import { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  apiClient,
  clearAccessToken,
  getAccessToken,
} from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";

import { authApi } from "./auth.api";

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
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({
  config,
  status,
  statusText: "OK",
  headers: new AxiosHeaders(),
  data: {
    success: true,
    statusCode: status,
    message: "SENTINEL",
    requestId: "id",
    timestamp: "2026-10-01T00:00:00.000Z",
    path: "/auth?token=SENTINEL",
    data,
  },
});
beforeEach(() =>
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) =>
        Promise.resolve(callback()),
    },
  }),
);
afterEach(() => {
  clearAccessToken();
  getSessionRuntime().dispose();
  localStorage.clear();
  if (original !== undefined) apiClient.defaults.adapter = original;
});

describe("validated auth operations", () => {
  const expectedBodies: Record<string, unknown> = {
    "/auth/register": {
      fullName: "Employee",
      email: user.email,
      password: "a".repeat(15),
      phone: null,
    },
    "/auth/login": { email: user.email, password: "secret", rememberMe: false },
    "/auth/admin/login": {
      email: user.email,
      password: "secret",
      rememberMe: false,
    },
    "/auth/refresh": {},
    "/auth/verify-email": {},
    "/auth/resend-verification": { email: user.email },
    "/auth/forgot-password": { email: user.email },
    "/auth/logout": {},
    "/auth/logout-all": {},
    "/auth/reset-password": {
      newPassword: "a".repeat(15),
      passwordConfirmation: "a".repeat(15),
    },
    "/auth/change-password": {
      currentPassword: "old",
      newPassword: "a".repeat(15),
      passwordConfirmation: "a".repeat(15),
    },
  };
  it.each([
    [
      "/auth/admin/login",
      "post",
      200,
      () =>
        authApi.adminLogin({
          email: user.email,
          password: "secret",
          rememberMe: false,
        }),
      {
        user: { ...user, role: "ADMIN", referralCode: null },
        tokens: { accessToken: "SENTINEL" },
      },
    ],
    [
      "/auth/refresh",
      "post",
      200,
      () => authApi.refresh(),
      { user, tokens: { accessToken: "SENTINEL" } },
    ],
    [
      "/auth/register",
      "post",
      201,
      () =>
        authApi.register({
          fullName: "Employee",
          email: user.email,
          password: "a".repeat(15),
          phone: null,
        }),
      { user },
    ],
    [
      "/auth/login",
      "post",
      200,
      () =>
        authApi.login({
          email: user.email,
          password: "secret",
          rememberMe: false,
        }),
      { user, tokens: { accessToken: "SENTINEL" } },
    ],
    [
      "/auth/verify-email",
      "post",
      200,
      () => authApi.verifyEmail("credential"),
      { user },
    ],
    [
      "/auth/validate-verification-token",
      "get",
      200,
      () => authApi.validateVerificationToken("credential"),
      { valid: true },
    ],
    [
      "/auth/validate-reset-token",
      "get",
      200,
      () => authApi.validateResetToken("credential"),
      { valid: true },
    ],
    [
      "/auth/validate-admin-invitation",
      "get",
      200,
      () => authApi.validateAdminInvitation("credential"),
      { valid: true },
    ],
    [
      "/auth/resend-verification",
      "post",
      200,
      () => authApi.resendVerification({ email: user.email }),
      { message: "SENTINEL" },
    ],
    [
      "/auth/forgot-password",
      "post",
      200,
      () => authApi.forgotPassword({ email: user.email }),
      { message: "SENTINEL" },
    ],
    ["/auth/logout", "post", 200, () => authApi.logout(), {}],
    ["/auth/logout-all", "post", 200, () => authApi.logoutAll(), {}],
    [
      "/auth/reset-password",
      "post",
      200,
      () =>
        authApi.resetPassword("credential", {
          newPassword: "a".repeat(15),
          passwordConfirmation: "a".repeat(15),
        }),
      { user },
    ],
    [
      "/auth/change-password",
      "patch",
      200,
      () =>
        authApi.changePassword({
          currentPassword: "old",
          newPassword: "a".repeat(15),
          passwordConfirmation: "a".repeat(15),
        }),
      { user },
    ],
  ] as const)(
    "uses %s %s and returns safe data",
    async (path, method, status, invoke, data) => {
      apiClient.defaults.adapter = (config) => {
        expect(config.url).toBe(path);
        expect(config.method).toBe(method);
        if (method === "get") expect(config.data).toBeUndefined();
        else
          expect(JSON.parse(config.data as string)).toEqual(
            expectedBodies[path],
          );
        if (
          path.includes("validate-") ||
          path === "/auth/verify-email" ||
          path === "/auth/reset-password"
        )
          expect(config.params).toEqual({ token: "credential" });
        return Promise.resolve(response(config, data, status));
      };
      const reply = await invoke();
      expect(JSON.stringify(reply)).not.toContain("SENTINEL");
      expect(reply.statusCode).toBe(status);
    },
  );

  it("propagates cancellation to every nonconsuming credential preview", async () => {
    const signal = new AbortController().signal;
    const paths: string[] = [];
    apiClient.defaults.adapter = (config) => {
      expect(config.signal).toBe(signal);
      expect(config.params).toEqual({ token: "credential" });
      paths.push(config.url ?? "");
      return Promise.resolve(response(config, { valid: true }));
    };
    await authApi.validateVerificationToken("credential", signal);
    await authApi.validateResetToken("credential", signal);
    await authApi.validateAdminInvitation("credential", signal);
    expect(paths).toEqual([
      "/auth/validate-verification-token",
      "/auth/validate-reset-token",
      "/auth/validate-admin-invitation",
    ]);
  });

  it.each([
    {},
    { user, tokens: { accessToken: "SENTINEL", privateKey: "SENTINEL" } },
    {
      user: { ...user, status: "BANNED" },
      tokens: { accessToken: "SENTINEL" },
    },
  ])("refuses token admission from malformed/inactive login", async (data) => {
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(response(config, data));
    await expect(
      authApi.login({
        email: user.email,
        password: "secret",
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ category: "contract" });
    expect(getAccessToken().kind).toBe("missing");
  });

  it("rejects USER at dedicated admin entry and validates admin acceptance without auto-login", async () => {
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(
        response(config, { user, tokens: { accessToken: "SENTINEL" } }),
      );
    await expect(
      authApi.adminLogin({
        email: user.email,
        password: "secret",
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ category: "contract" });
    apiClient.defaults.adapter = (config) => {
      expect(config.url).toBe("/auth/admin-invitations/accept");
      expect(config.params).toEqual({ token: "credential" });
      return Promise.resolve(
        response(
          config,
          { user: { ...user, role: "ADMIN", referralCode: null } },
          201,
        ),
      );
    };
    await authApi.acceptAdminInvitation("credential", {
      newPassword: "a".repeat(15),
      passwordConfirmation: "a".repeat(15),
    });
    expect(getAccessToken().kind).toBe("missing");
  });

  it("rejects HTTP/envelope status disagreement before returning identity", async () => {
    apiClient.defaults.adapter = (config) =>
      Promise.resolve({
        ...response(config, { user }, 201),
        status: 200,
      });
    await expect(
      authApi.register({
        fullName: "Employee",
        email: user.email,
        password: "a".repeat(15),
        phone: null,
      }),
    ).rejects.toMatchObject({ category: "contract" });
  });
});
