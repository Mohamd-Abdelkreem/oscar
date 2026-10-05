import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { afterEach } from "vitest";
import { apiClient, setAccessToken } from "@/services/api/api-client";
import {
  actorId,
  now,
  networkSession,
  reply,
  cleanupNetwork,
} from "./p04-network";

export const employee = {
  id: actorId,
  fullName: "Employee",
  email: "employee@example.test",
  phone: null,
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: now,
  createdAt: now,
  updatedAt: now,
  referralCode: "a".repeat(32),
  tasksBlocked: false,
  withdrawalsBlocked: false,
  accountVersion: 0,
};
const clients: QueryClient[] = [];
export function queryHarness(
  role: "USER" | "ADMIN",
  boundary: (
    config: InternalAxiosRequestConfig,
  ) => AxiosResponse<unknown> | Promise<AxiosResponse<unknown>>,
) {
  const runtime = networkSession(role);
  setAccessToken("test-only-token");
  apiClient.defaults.adapter = (config) =>
    Promise.resolve().then(() =>
      config.url === "/users/me"
        ? reply(config, {
            user: {
              ...employee,
              role,
              referralCode: role === "ADMIN" ? null : employee.referralCode,
            },
          })
        : boundary(config),
    );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return {
    runtime,
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
export function cleanupQueries() {
  cleanupNetwork();
  afterEach(() => {
    clients.splice(0).forEach((client) => {
      client.clear();
    });
  });
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
