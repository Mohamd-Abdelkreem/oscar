import { AxiosHeaders } from "axios";
import { afterEach, describe, expect, it } from "vitest";

import { apiClient } from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";

import { usersApi } from "./users.api";

const original = apiClient.defaults.adapter;
afterEach(() => {
  if (original !== undefined) apiClient.defaults.adapter = original;
  getSessionRuntime().dispose();
  localStorage.clear();
});
describe("current-user parsing", () => {
  it("passes read cancellation and rejects private identity fields", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (_name: string, callback: () => Promise<unknown>) =>
          Promise.resolve(callback()),
      },
    });
    const signal = new AbortController().signal;
    apiClient.defaults.adapter = (config) => {
      expect(config.url).toBe("/users/me");
      expect(config.signal).toBe(signal);
      return Promise.resolve({
        config,
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        data: {
          success: true,
          statusCode: 200,
          message: "OK",
          requestId: "id",
          timestamp: "2026-10-01T00:00:00.000Z",
          path: "/users/me",
          data: { user: { password: "SENTINEL" } },
        },
      });
    };
    await expect(usersApi.getMe(signal)).rejects.toMatchObject({
      category: "contract",
    });
  });
});
