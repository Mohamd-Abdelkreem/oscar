import {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiClient,
  clearAccessToken,
  getAccessToken,
  getApiError,
  isPublicAuthRequest,
  setAccessToken,
} from "./api-client";

const navigationMocks = vi.hoisted(() => ({
  assign: vi.fn(),
  getLocation: vi.fn(() => ({ pathname: "/", search: "" })),
}));

vi.mock("./browser-location", () => ({
  assignBrowserLocation: navigationMocks.assign,
  getBrowserLocation: navigationMocks.getLocation,
}));

const responseFor = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse<unknown> => ({
  data,
  status,
  statusText: status >= 400 ? "Error" : "OK",
  headers: new AxiosHeaders(),
  config,
});

const failureFor = (
  config: InternalAxiosRequestConfig,
  options: Readonly<{
    status?: number;
    data?: unknown;
    code?: string;
  }> = {},
): Error => {
  const error = Object.assign(
    new Error(
      options.status === undefined
        ? "Network request failed"
        : `HTTP ${String(options.status)}`,
    ),
    {
      name: "AxiosError",
      code: options.code ?? "ERR_BAD_REQUEST",
      config,
      isAxiosError: true,
    },
  );
  return options.status === undefined
    ? error
    : Object.assign(error, {
        response: responseFor(config, options.data ?? {}, options.status),
      });
};

const rejectFor = (
  config: InternalAxiosRequestConfig,
  status = 401,
  data: unknown = {},
): Promise<never> => Promise.reject(failureFor(config, { status, data }));

const errorEnvelope = (statusCode: number, code: string) => ({
  success: false,
  statusCode,
  code,
  message: `Failure ${code}`,
  requestId: `request-${code}`,
});

const captureFailure = async (request: Promise<unknown>): Promise<unknown> => {
  try {
    await request;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the request to fail.");
};

const refreshResponse = (config: InternalAxiosRequestConfig) =>
  responseFor(config, {
    success: true,
    statusCode: 200,
    message: "Session refreshed.",
    data: { tokens: { accessToken: "fresh-token" } },
    requestId: "refresh-request",
    timestamp: "2026-08-18T00:00:00.000Z",
    path: "/api/v1/auth/refresh",
  });

const defaultAdapter = apiClient.defaults.adapter;

afterEach(() => {
  clearAccessToken();
  if (defaultAdapter !== undefined) apiClient.defaults.adapter = defaultAdapter;
  navigationMocks.assign.mockReset();
  navigationMocks.getLocation.mockReset();
  navigationMocks.getLocation.mockReturnValue({ pathname: "/", search: "" });
});

describe("apiClient configuration and errors", () => {
  it("normalizes the configured base URL and sends credentials", () => {
    expect(apiClient.defaults.baseURL).toBe("http://localhost:4000/api/v1");
    expect(apiClient.defaults.withCredentials).toBe(true);
  });

  it("keeps the access token in discriminated module memory", () => {
    expect(getAccessToken()).toEqual({ kind: "missing" });
    setAccessToken("token");
    expect(getAccessToken()).toEqual({ kind: "value", value: "token" });
  });

  it("parses the real error envelope and groups repeated field errors", () => {
    const result = getApiError({
      isAxiosError: true,
      response: {
        status: 422,
        headers: {},
        data: {
          success: false,
          statusCode: 422,
          code: "VALIDATION_ERROR",
          message: "Validation failed.",
          requestId: "request-1",
          errors: [
            { field: "body.email", message: "Invalid." },
            { field: "body.email", message: "Already used." },
          ],
        },
      },
    });
    expect(result).toEqual({
      message: "Validation failed.",
      statusCode: 422,
      code: "VALIDATION_ERROR",
      requestId: "request-1",
      fieldErrors: { "body.email": ["Invalid.", "Already used."] },
    });
  });

  it("uses generic English network and timeout fallbacks", () => {
    expect(getApiError({ isAxiosError: true }).statusCode).toBe(0);
    expect(getApiError({ isAxiosError: true }).message).toContain(
      "Unable to reach",
    );
    expect(
      getApiError({ isAxiosError: true, code: "ECONNABORTED" }).message,
    ).toContain("timed out");
  });

  it("preserves a response-header request ID for malformed envelopes", () => {
    const result = getApiError({
      isAxiosError: true,
      response: {
        status: 503,
        data: "not-an-envelope",
        headers: { "x-request-id": "header-request" },
      },
    });
    expect(result.requestId).toBe("header-request");
    expect(result.code).toBe("HTTP_ERROR");
    expect(result.message).toContain("temporarily unavailable");
  });

  it("classifies only exact public auth paths, including absolute URLs", () => {
    expect(isPublicAuthRequest("/auth/login?next=x")).toBe(true);
    expect(
      isPublicAuthRequest(
        "http://localhost:4000/api/v1/auth/validate-reset-token?token=x",
      ),
    ).toBe(true);
    expect(isPublicAuthRequest("/auth/login-extra")).toBe(false);
    expect(isPublicAuthRequest("/users/me")).toBe(false);
  });
});

describe("apiClient transport security", () => {
  it("attaches and then removes the in-memory bearer token", async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    apiClient.defaults.adapter = (config) => {
      requests.push(config);
      return Promise.resolve(responseFor(config, {}));
    };
    setAccessToken("access-token");
    await apiClient.get("/users/me");
    clearAccessToken();
    await apiClient.get("/users/me");
    expect(requests[0]?.headers.get("Authorization")).toBe(
      "Bearer access-token",
    );
    expect(requests[1]?.headers.get("Authorization")).toBeUndefined();
  });

  it("never writes access tokens to browser storage", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(responseFor(config, {}));
    setAccessToken("memory-only");
    await apiClient.get("/users/me");
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("attaches decoded CSRF only to unsafe methods", async () => {
    Object.defineProperty(document, "cookie", {
      configurable: true,
      value: "csrfToken=csrf%20value",
    });
    const requests: InternalAxiosRequestConfig[] = [];
    apiClient.defaults.adapter = (config) => {
      requests.push(config);
      return Promise.resolve(responseFor(config, {}));
    };
    await apiClient.get("/users/me");
    for (const method of ["post", "put", "patch", "delete"] as const) {
      await apiClient.request({ method, url: "/resource", data: {} });
    }
    expect(requests[0]?.headers.get("x-csrf-token")).toBeUndefined();
    for (const request of requests.slice(1)) {
      expect(request.headers.get("x-csrf-token")).toBe("csrf value");
    }
  });

  it("never refreshes a public authentication 401", async () => {
    let refreshCalls = 0;
    apiClient.defaults.adapter = (config) => {
      if (config.url === "/auth/refresh") refreshCalls += 1;
      return rejectFor(config);
    };

    await expect(apiClient.post("/auth/login", {})).rejects.toBeDefined();

    expect(refreshCalls).toBe(0);
  });

  it("refreshes one protected 401 and replays it once with the new token", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    const authorization: unknown[] = [];
    apiClient.defaults.adapter = (config) => {
      if (config.url === "/auth/refresh") {
        refreshCalls += 1;
        return Promise.resolve(refreshResponse(config));
      }
      protectedCalls += 1;
      authorization.push(config.headers.get("Authorization"));
      return protectedCalls === 1
        ? rejectFor(config)
        : Promise.resolve(responseFor(config, { ok: true }));
    };
    setAccessToken("expired-token");
    await expect(apiClient.get("/users/me")).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(2);
    expect(authorization).toEqual([
      "Bearer expired-token",
      "Bearer fresh-token",
    ]);
  });

  it("uses a single refresh for concurrent protected failures", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    apiClient.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshCalls += 1;
        return refreshResponse(config);
      }
      protectedCalls += 1;
      if (protectedCalls <= 2) {
        await gate;
        return rejectFor(config);
      }
      return responseFor(config, {});
    };
    const first = apiClient.get("/users/me");
    const second = apiClient.get("/users/preferences");
    await vi.waitFor(() => {
      expect(protectedCalls).toBe(2);
    });
    release();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(refreshCalls).toBe(1);
  });

  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
  ])(
    "clears, redirects, and propagates exact anonymous refresh %s/%s",
    async (statusCode, code) => {
      navigationMocks.getLocation.mockReturnValue({
        pathname: "/settings",
        search: "?section=security",
      });
      let protectedFailure: unknown;
      let refreshFailure = new Error("Refresh failure was not captured.");
      apiClient.defaults.adapter = (config) => {
        const failure =
          config.url === "/auth/refresh"
            ? failureFor(config, {
                status: statusCode,
                data: errorEnvelope(statusCode, code),
              })
            : failureFor(config, { status: 401 });
        if (config.url === "/auth/refresh") refreshFailure = failure;
        else protectedFailure = failure;
        return Promise.reject(failure);
      };
      setAccessToken("expired-token");

      const failure = await captureFailure(apiClient.get("/users/me"));

      expect(failure).toBe(refreshFailure);
      expect(failure).not.toBe(protectedFailure);
      expect(getApiError(failure)).toMatchObject({ statusCode, code });
      expect(getAccessToken()).toEqual({ kind: "missing" });
      expect(navigationMocks.assign).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fsettings%3Fsection%3Dsecurity",
      );
    },
  );

  it.each([
    [400, "VALIDATION_ERROR"],
    [401, "TOKEN_REPLAYED"],
    [403, "FORBIDDEN"],
    [409, "CONFLICT"],
    [429, "TOO_MANY_REQUESTS"],
    [500, "INTERNAL_SERVER_ERROR"],
    [501, "NOT_IMPLEMENTED"],
    [502, "BAD_GATEWAY"],
    [503, "SERVICE_UNAVAILABLE"],
    [504, "GATEWAY_TIMEOUT"],
  ])(
    "surfaces unexpected refresh %s/%s without redirecting",
    async (statusCode, code) => {
      let refreshFailure = new Error("Refresh failure was not captured.");
      apiClient.defaults.adapter = (config) => {
        if (config.url !== "/auth/refresh") return rejectFor(config);
        refreshFailure = failureFor(config, {
          status: statusCode,
          data: errorEnvelope(statusCode, code),
        });
        return Promise.reject(refreshFailure);
      };
      setAccessToken("expired-token");

      const failure = await captureFailure(apiClient.get("/users/me"));

      expect(failure).toBe(refreshFailure);
      expect(getApiError(failure)).toMatchObject({ statusCode, code });
      expect(getAccessToken()).toEqual({ kind: "missing" });
      expect(navigationMocks.assign).not.toHaveBeenCalled();
    },
  );

  it("surfaces a refresh network failure without redirecting", async () => {
    let refreshFailure = new Error("Refresh failure was not captured.");
    apiClient.defaults.adapter = (config) => {
      if (config.url !== "/auth/refresh") return rejectFor(config);
      refreshFailure = failureFor(config, { code: "ERR_NETWORK" });
      return Promise.reject(refreshFailure);
    };
    setAccessToken("expired-token");

    const failure = await captureFailure(apiClient.get("/users/me"));

    expect(failure).toBe(refreshFailure);
    expect(getApiError(failure)).toMatchObject({
      statusCode: 0,
      code: "NETWORK_ERROR",
    });
    expect(getAccessToken()).toEqual({ kind: "missing" });
    expect(navigationMocks.assign).not.toHaveBeenCalled();
  });

  it("surfaces refresh timeout behavior without redirecting", async () => {
    let refreshFailure = new Error("Refresh failure was not captured.");
    apiClient.defaults.adapter = (config) => {
      if (config.url !== "/auth/refresh") return rejectFor(config);
      refreshFailure = failureFor(config, { code: "ECONNABORTED" });
      return Promise.reject(refreshFailure);
    };

    const failure = await captureFailure(apiClient.get("/users/me"));
    const apiError = getApiError(failure);

    expect(failure).toBe(refreshFailure);
    expect(apiError).toMatchObject({ statusCode: 0, code: "NETWORK_ERROR" });
    expect(apiError.message).toContain("timed out");
    expect(navigationMocks.assign).not.toHaveBeenCalled();
  });

  it.each([403, 500, 401])(
    "propagates replay HTTP %s without another refresh or redirect",
    async (replayStatus) => {
      let protectedCalls = 0;
      let refreshCalls = 0;
      let replayFailure = new Error("Replay failure was not captured.");
      apiClient.defaults.adapter = (config) => {
        if (config.url === "/auth/refresh") {
          refreshCalls += 1;
          return Promise.resolve(refreshResponse(config));
        }
        protectedCalls += 1;
        if (protectedCalls === 1) return rejectFor(config);
        replayFailure = failureFor(config, { status: replayStatus });
        return Promise.reject(replayFailure);
      };

      const failure = await captureFailure(apiClient.get("/users/me"));

      expect(failure).toBe(replayFailure);
      expect(getApiError(failure).statusCode).toBe(replayStatus);
      expect(refreshCalls).toBe(1);
      expect(protectedCalls).toBe(2);
      expect(getAccessToken()).toEqual({
        kind: "value",
        value: "fresh-token",
      });
      expect(navigationMocks.assign).not.toHaveBeenCalled();
    },
  );

  it("resets the refresh promise after success", async () => {
    let refreshCalls = 0;
    apiClient.defaults.adapter = (config) => {
      if (config.url === "/auth/refresh") {
        refreshCalls += 1;
        return Promise.resolve(refreshResponse(config));
      }
      return config._templateRetried === true
        ? Promise.resolve(responseFor(config, {}))
        : rejectFor(config);
    };

    await apiClient.get("/users/me");
    await apiClient.get("/users/preferences");

    expect(refreshCalls).toBe(2);
  });

  it("resets the refresh promise after failure", async () => {
    let refreshCalls = 0;
    apiClient.defaults.adapter = (config) => {
      if (config.url === "/auth/refresh") {
        refreshCalls += 1;
        return refreshCalls === 1
          ? Promise.reject(
              failureFor(config, {
                status: 503,
                data: errorEnvelope(503, "SERVICE_UNAVAILABLE"),
              }),
            )
          : Promise.resolve(refreshResponse(config));
      }
      return config._templateRetried === true
        ? Promise.resolve(responseFor(config, {}))
        : rejectFor(config);
    };

    await expect(apiClient.get("/users/me")).rejects.toBeDefined();
    await expect(apiClient.get("/users/me")).resolves.toBeDefined();

    expect(refreshCalls).toBe(2);
  });

  it("drops credential-bearing return paths on refresh failure", async () => {
    navigationMocks.getLocation.mockReturnValue({
      pathname: "/settings",
      search: "?token=secret",
    });
    apiClient.defaults.adapter = (config) =>
      config.url === "/auth/refresh"
        ? rejectFor(config, 401, errorEnvelope(401, "UNAUTHORIZED"))
        : rejectFor(config);
    await expect(apiClient.get("/users/me")).rejects.toBeDefined();
    expect(navigationMocks.assign).toHaveBeenCalledWith("/auth/login");
  });

  it("does not redirect again while already on an auth route", async () => {
    navigationMocks.getLocation.mockReturnValue({
      pathname: "/auth/login",
      search: "",
    });
    apiClient.defaults.adapter = (config) =>
      config.url === "/auth/refresh"
        ? rejectFor(config, 401, errorEnvelope(401, "UNAUTHORIZED"))
        : rejectFor(config);
    await expect(apiClient.get("/users/me")).rejects.toBeDefined();
    expect(navigationMocks.assign).not.toHaveBeenCalled();
  });
});
