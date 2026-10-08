import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiClient,
  clearAccessToken,
  getAccessToken,
  getApiError,
  isPublicAuthRequest,
  refreshSession,
  setAccessToken,
} from "./api-client";
import { COOKIE_WRITE_BARRIER_KEY, getSessionRuntime } from "./session-runtime";

const account = {
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

it.each([
  "/auth/reset-password",
  "/auth/change-password",
  "/auth/logout",
  "/auth/logout-all",
])(
  "US4 response loss for %s quarantines cookies without replay or retained secrets",
  async (path) => {
    let sends = 0;
    apiClient.defaults.adapter = (config) => {
      sends++;
      return Promise.reject(
        new AxiosError("US4-SENTINEL", "ERR_NETWORK", config),
      );
    };
    setAccessToken("test-token");
    const pending =
      path === "/auth/change-password"
        ? apiClient.patch(path, { newPassword: "US4-SENTINEL" })
        : apiClient.post(path, { newPassword: "US4-SENTINEL" });
    await expect(pending).rejects.toMatchObject({ category: "coordination" });
    expect(sends).toBe(1);
    const barrier = localStorage.getItem(COOKIE_WRITE_BARRIER_KEY);
    expect(barrier).not.toBeNull();
    expect(barrier).not.toContain("US4-SENTINEL");
    await expect(refreshSession()).rejects.toMatchObject({
      category: "coordination",
    });
    expect(sends).toBe(1);
    expect(localStorage.getItem(COOKIE_WRITE_BARRIER_KEY)).toBe(barrier);
  },
);
const reply = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ config, status, statusText: "OK", headers: new AxiosHeaders(), data });
const envelope = (data: unknown, statusCode = 200) => ({
  success: true,
  statusCode,
  data,
  message: "OK",
  requestId: "id",
  timestamp: "2026-10-01T00:00:00.000Z",
  path: "/api/v1/auth/refresh",
});
const denied = (config: InternalAxiosRequestConfig, status = 401) => {
  const error = new AxiosError("SENTINEL", "ERR_BAD_REQUEST", config);
  error.response = reply(
    config,
    {
      success: false,
      statusCode: status,
      code: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      message: "SENTINEL",
    },
    status,
  );
  return error;
};
const originalAdapter = apiClient.defaults.adapter;
beforeEach(() => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) =>
        Promise.resolve(callback()),
    },
  });
});
afterEach(() => {
  clearAccessToken();
  getSessionRuntime().dispose();
  localStorage.clear();
  if (originalAdapter !== undefined)
    apiClient.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("transport boundary", () => {
  it.each(["/deposits/me/address", "/admin/deposits/manual-credits"])(
    "never refreshes or replays deposit POST %s after authentication or reply loss",
    async (url) => {
      for (const status of [401, 0]) {
        let sends = 0;
        apiClient.defaults.adapter = (config) => {
          sends++;
          throw status === 401
            ? denied(config)
            : new AxiosError("PRIVATE", "ERR_NETWORK", config);
        };
        await expect(apiClient.post(url, {})).rejects.toMatchObject({
          category: status === 401 ? "denied" : "uncertain",
        });
        expect(sends).toBe(1);
      }
    },
  );
  it.each([
    "/tasks/today",
    "/proofs/id/content",
    "/task-illustrations/id",
    "/admin/task-submissions/id",
    "/admin/task-codes",
    "/deposits/me/address",
    "/deposits/me/history",
    "/admin/deposits",
    "/admin/deposits/manual-credits/00000000-0000-4000-8000-000000000001",
    "/admin/employees/manual-credit-targets",
  ])(
    "leaves private denial revalidation to the read owner for %s",
    async (url) => {
      const runtime = getSessionRuntime();
      runtime.admitIdentity(runtime.scope(), { id: account.id, role: "USER" });
      const scope = runtime.scope();
      let requests = 0;
      apiClient.defaults.adapter = (config) => {
        requests++;
        throw denied(config, 403);
      };
      await expect(apiClient.get(url)).rejects.toMatchObject({
        category: "denied",
        statusCode: 403,
      });
      expect(runtime.scope()).toEqual(scope);
      expect(requests).toBe(1);
    },
  );
  it("retains only validated P05 conflict codes without private diagnostics", () => {
    const config = {
      url: "/task-submissions",
      method: "post",
      headers: new AxiosHeaders(),
    };
    const error = new AxiosError("PRIVATE", "ERR_BAD_REQUEST", config);
    error.response = reply(
      config,
      {
        success: false,
        statusCode: 409,
        code: "DAILY_CLAIM_EXISTS",
        message: "PRIVATE",
        requestId: "id",
        timestamp: "2026-10-01T00:00:00.000Z",
        path: "/api/v1/task-submissions",
      },
      409,
    );
    const projection = getApiError(error);
    expect(projection).toMatchObject({
      code: "DAILY_CLAIM_EXISTS",
      statusCode: 409,
    });
    expect(JSON.stringify(projection)).not.toContain("PRIVATE");
  });
  it("rejects a different refresh identity before admitting its bearer token", async () => {
    const runtime = getSessionRuntime();
    runtime.admitIdentity(runtime.scope(), { id: account.id, role: "USER" });
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(
        reply(
          config,
          envelope({
            user: { ...account, id: "00000000-0000-4000-8000-000000000002" },
            tokens: { accessToken: "SENTINEL" },
          }),
        ),
      );
    await expect(refreshSession()).rejects.toMatchObject({
      category: "denied",
    });
    expect(getAccessToken()).toEqual({ kind: "missing" });
    expect(runtime.scope().accountId).toBeNull();
  });
  it("safe cancellation does not retain a read URL, body or headers", async () => {
    const abort = new AbortController();
    apiClient.defaults.adapter = (config) => {
      abort.abort();
      return Promise.resolve(reply(config, {}));
    };
    const failure = await apiClient
      .get("/users/me?private=SENTINEL", { signal: abort.signal })
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ category: "cancelled" });
    expect(JSON.stringify(failure)).not.toContain("SENTINEL");
  });

  it.each([
    ["/auth/validate-reset-token", "get"],
    ["/admin/invitations", "post"],
  ] as const)(
    "does not mark %s failures as retryable reads",
    async (url, method) => {
      apiClient.defaults.adapter = (config) =>
        Promise.reject(new AxiosError("SENTINEL", "ERR_NETWORK", config));
      await expect(apiClient.request({ url, method })).rejects.toMatchObject({
        category: "uncertain",
      });
    },
  );

  it("blocks retired delayed reads and reconciles policy denial without global revocation", async () => {
    setAccessToken("memory");
    const epoch = getSessionRuntime().scope().epoch;
    apiClient.defaults.adapter = (config) =>
      Promise.reject(denied(config, 403));
    await expect(apiClient.get("/users/me")).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(getSessionRuntime().scope().epoch).toBe(epoch);
    expect(getSessionRuntime().scope().check).toBeGreaterThan(0);
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    apiClient.defaults.adapter = async (config) => {
      await gate;
      return reply(config, { private: "SENTINEL" });
    };
    const pending = apiClient.get("/users/me");
    await Promise.resolve();
    getSessionRuntime().retire();
    finish();
    await expect(pending).rejects.toMatchObject({ category: "obsolete" });
  });
  it.each([
    "/auth/admin/login",
    "/auth/validate-verification-token",
    "/auth/validate-admin-invitation",
    "/auth/admin-invitations/accept",
    "http://localhost:4000/api/v1/auth/reset-password?token=x",
  ])("does not refresh public action %s", async (url) => {
    let requests = 0;
    apiClient.defaults.adapter = (config) => {
      requests++;
      throw denied(config);
    };
    expect(isPublicAuthRequest(url)).toBe(true);
    await expect(apiClient.post(url, {})).rejects.toMatchObject({
      category: "denied",
    });
    expect(requests).toBe(1);
  });
  it("projects errors before a real query cache retains them", async () => {
    apiClient.defaults.adapter = (config) => {
      const error = denied(config, 403);
      throw Object.assign(error, { nested: { secret: "SENTINEL" } });
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await client
      .fetchQuery({
        queryKey: ["private"],
        queryFn: () => apiClient.get("/users/me?private=SENTINEL"),
      })
      .catch(() => undefined);
    expect(
      JSON.stringify(client.getQueryState(["private"])?.error),
    ).not.toContain("SENTINEL");
    expect(client.getQueryState(["private"])?.error).toMatchObject({
      category: "denied",
      statusCode: 403,
      fieldErrors: {},
    });
    client.clear();
  });
  it("rejects conflicting error status and never echoes field messages or headers", () => {
    expect(
      getApiError({
        isAxiosError: true,
        response: {
          status: 403,
          data: { success: false, statusCode: 503, message: "SENTINEL" },
        },
      }),
    ).toMatchObject({ category: "contract" });
    const safe = getApiError({
      isAxiosError: true,
      response: {
        status: 400,
        headers: { "x-request-id": "SENTINEL" },
        data: {
          success: false,
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: "SENTINEL",
          errors: [
            { field: "body.email", message: "SENTINEL" },
            { field: "SENTINEL", message: "SENTINEL" },
          ],
        },
      },
    });
    expect(safe.fieldErrors).toEqual({ email: ["راجع هذه القيمة."] });
    expect(JSON.stringify(safe)).not.toContain("SENTINEL");
  });
  it("shares one parsed refresh between restoration and concurrent protected failures", async () => {
    let refreshCount = 0;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    apiClient.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshCount++;
        await gate;
        return reply(
          config,
          envelope({ user: account, tokens: { accessToken: "fresh" } }),
        );
      }
      if (!config._templateRetried) throw denied(config);
      return reply(config, envelope({ user: account }));
    };
    const first = apiClient.get("/users/me");
    const second = refreshSession();
    await vi.waitFor(() => {
      expect(refreshCount).toBe(1);
    });
    finish();
    await Promise.all([first, second]);
    expect(refreshCount).toBe(1);
    expect(getAccessToken()).toEqual({ kind: "value", value: "fresh" });
  });
  it.each([
    { tokens: { accessToken: "SENTINEL" } },
    {
      user: account,
      tokens: { accessToken: "SENTINEL", refreshToken: "SENTINEL" },
    },
  ])("never admits malformed/private refresh output", async (data) => {
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(reply(config, envelope(data)));
    await expect(refreshSession()).rejects.toMatchObject({
      category: "contract",
    });
    expect(getAccessToken()).toEqual({ kind: "missing" });
    expect(localStorage.getItem(COOKIE_WRITE_BARRIER_KEY)).toBeNull();
  });
  it("suppresses delayed refresh after retirement but settles its cookie barrier", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    apiClient.defaults.adapter = async (config) => {
      await gate;
      return reply(
        config,
        envelope({ user: account, tokens: { accessToken: "old" } }),
      );
    };
    const pending = refreshSession();
    await vi.waitFor(() => {
      expect(localStorage.getItem(COOKIE_WRITE_BARRIER_KEY)).not.toBeNull();
    });
    getSessionRuntime().retire();
    finish();
    await expect(pending).rejects.toMatchObject({ category: "obsolete" });
    expect(getAccessToken().kind).toBe("missing");
    expect(localStorage.getItem(COOKIE_WRITE_BARRIER_KEY)).toBeNull();
  });
  it("preserves cookie observation on dismissal while network failure blocks replacement", async () => {
    const abort = new AbortController();
    apiClient.defaults.adapter = (config) => {
      expect(config.signal).toBeUndefined();
      abort.abort();
      throw new AxiosError("SENTINEL", "ERR_NETWORK", config);
    };
    await expect(
      apiClient.post("/auth/login", {}, { signal: abort.signal }),
    ).rejects.toMatchObject({ category: "coordination" });
    const replacement = vi.fn();
    apiClient.defaults.adapter = replacement;
    await expect(apiClient.post("/auth/login", {})).rejects.toMatchObject({
      category: "coordination",
    });
    await expect(apiClient.get("/users/me")).rejects.toMatchObject({
      category: "coordination",
    });
    expect(replacement).not.toHaveBeenCalled();
  });
  it("passes read signals and keeps bearer in memory", async () => {
    setAccessToken("memory");
    const abort = new AbortController();
    apiClient.defaults.adapter = (config) => {
      expect(config.signal).toBe(abort.signal);
      expect(config.headers.get("Authorization")).toBe("Bearer memory");
      return Promise.resolve(reply(config, envelope({ user: account })));
    };
    await apiClient.get("/users/me", { signal: abort.signal });
    expect(JSON.stringify(localStorage)).not.toContain("memory");
  });
});
