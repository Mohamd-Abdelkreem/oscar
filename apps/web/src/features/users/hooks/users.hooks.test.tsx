import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { afterEach, expect, it } from "vitest";

import { sessionQueryKey } from "@/features/auth/hooks/auth.hooks";
import { apiClient } from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";

import { useUpdateProfile } from "./users.hooks";

const original = apiClient.defaults.adapter;
afterEach(() => {
  if (original !== undefined) apiClient.defaults.adapter = original;
  getSessionRuntime().dispose();
  localStorage.clear();
});
it("stores a parsed profile only in its current scope", async () => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) =>
        Promise.resolve(callback()),
    },
  });
  const account = {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      fullName: "Updated Employee",
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
    },
  };
  apiClient.defaults.adapter = (config) => {
    expect(config.method).toBe("patch");
    expect(JSON.parse(String(config.data))).toEqual({
      fullName: "Updated Employee",
      phone: null,
    });
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
        timestamp: account.user.createdAt,
        path: "/users/me",
        data: account,
      },
    });
  };
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateProfile(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({
      fullName: "Updated Employee",
      phone: null,
    });
  });
  expect(
    client.getQueryData(sessionQueryKey(getSessionRuntime().scope())),
  ).toEqual(account);
  expect(client.getMutationCache().getAll()).toEqual([]);
  client.clear();
});
