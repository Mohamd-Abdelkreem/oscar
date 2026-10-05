import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { describe, expect, it } from "vitest";

import { createQueryClient, shouldRetryRequest } from "./query-client";
import { safeApiError } from "@/services/api/safe-error";

const httpError = (status: number): AxiosError => {
  const config: InternalAxiosRequestConfig = {
    headers: new AxiosHeaders(),
    method: "GET",
    url: "/test",
  };
  const error = new AxiosError("failed", "ERR_BAD_REQUEST", config);
  error.response = {
    data: {},
    status,
    statusText: "Error",
    headers: new AxiosHeaders(),
    config,
  };
  return error;
};

describe("query client defaults", () => {
  it.each([
    "contract",
    "denied",
    "cancelled",
    "coordination",
    "obsolete",
    "request",
  ] as const)("does not retry safe %s failures", (category) => {
    expect(
      shouldRetryRequest(0, safeApiError(category, "REQUEST_ERROR", 503)),
    ).toBe(false);
  });

  it("allows at most two classified transient read retries", () => {
    expect(
      shouldRetryRequest(0, safeApiError("transient", "NETWORK_ERROR")),
    ).toBe(true);
    expect(
      shouldRetryRequest(2, safeApiError("transient", "NETWORK_ERROR")),
    ).toBe(false);
  });
  it("creates isolated clients with a 30-second stale time", () => {
    const first = createQueryClient();
    const second = createQueryClient();
    expect(first).not.toBe(second);
    expect(first.getDefaultOptions().queries?.staleTime).toBe(30_000);
    expect(first.getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("retries only network and 500 through 504 errors at most twice", () => {
    expect(shouldRetryRequest(0, new AxiosError("network"))).toBe(true);
    for (const status of [500, 501, 502, 503, 504]) {
      expect(shouldRetryRequest(0, httpError(status))).toBe(true);
    }
    for (const status of [400, 401, 403, 404, 409, 422, 429, 505]) {
      expect(shouldRetryRequest(0, httpError(status))).toBe(false);
    }
    expect(shouldRetryRequest(2, new AxiosError("network"))).toBe(false);
    expect(shouldRetryRequest(0, new TypeError("bug"))).toBe(false);
  });
});
