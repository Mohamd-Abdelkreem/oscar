import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { adminsApi } from "../api/admins.api";
import {
  useAdminLists,
  useIssueInvitation,
  useAdminStatus,
  useAdminDetail,
} from "./admins.hooks";

const id = "00000000-0000-4000-8000-000000000002";
const date = "2026-10-01T00:00:00.000Z";
const admin = {
  id,
  fullName: "Admin",
  email: "real@example.test",
  phone: null,
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  emailVerifiedAt: date,
  createdAt: date,
  updatedAt: date,
  accountVersion: 2,
};
const pagination = {
  page: 1,
  limit: 25,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
beforeEach(() => {
  getSessionRuntime().dispose();
  localStorage.clear();
  const runtime = getSessionRuntime();
  runtime.admitIdentity(runtime.scope(), { id, role: "ADMIN" });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  cleanup();
  await client.cancelQueries();
  client.clear();
  vi.restoreAllMocks();
  getSessionRuntime().dispose();
  localStorage.clear();
});

it("keeps independent account/epoch/pages and discards late A reads after retirement", async () => {
  vi.spyOn(adminsApi, "listAdmins").mockResolvedValue({
    items: [admin],
    pagination,
  });
  vi.spyOn(adminsApi, "listInvitations").mockResolvedValue({
    items: [],
    pagination: { ...pagination, total: 0, totalPages: 0 },
  });
  const lists = renderHook(() => useAdminLists(), { wrapper });
  await waitFor(() => {
    expect(lists.result.current.admins.isSuccess).toBe(true);
  });
  expect(lists.result.current.invitations.data?.items).toEqual([]);
  await act(async () => {
    getSessionRuntime().retire();
    await Promise.resolve();
  });
  expect(lists.result.current.admins.data).toBeUndefined();
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(false);
});
it("guards a pending versioned target across dismissal/remount and suppresses late authority results", async () => {
  let complete: (reply: { admin: typeof admin }) => void = () => {
    throw new Error("NOT_STARTED");
  };
  const patch = vi.spyOn(adminsApi, "changeStatus").mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const command = renderHook(() => useAdminStatus(id), { wrapper });
  let request: Promise<unknown>;
  await act(async () => {
    request = command.result.current
      .mutateAsync({
        status: "DEACTIVATED",
        reason: "reason",
        confirmed: true,
        expectedVersion: 2,
      })
      .catch((failure: unknown) => failure);
    await Promise.resolve();
  });
  command.unmount();
  const remount = renderHook(() => useAdminStatus(id), { wrapper });
  expect(remount.result.current.isPending).toBe(true);
  await expect(
    remount.result.current.mutateAsync({
      status: "DEACTIVATED",
      reason: "reason",
      confirmed: true,
      expectedVersion: 3,
    }),
  ).rejects.toMatchObject({ code: "COMMAND_PENDING" });
  await act(async () => {
    getSessionRuntime().retire();
    complete({ admin });
    await request;
  });
  expect(patch).toHaveBeenCalledTimes(1);
  expect(remount.result.current.isSuccess).toBe(false);
});
it("refreshes a conflicting detail without attributing the observed newer version to the command", async () => {
  vi.spyOn(adminsApi, "getAdmin").mockResolvedValue({ admin });
  vi.spyOn(adminsApi, "changeStatus").mockRejectedValue(
    safeApiError("request", "CONFLICT", 409),
  );
  const view = renderHook(
    () => ({ detail: useAdminDetail(id), command: useAdminStatus(id) }),
    { wrapper },
  );
  await waitFor(() => {
    expect(view.result.current.detail.data?.admin.accountVersion).toBe(2);
  });
  vi.mocked(adminsApi.getAdmin).mockResolvedValue({
    admin: { ...admin, accountVersion: 3 },
  });
  await act(async () => {
    await expect(
      view.result.current.command.mutateAsync({
        status: "DEACTIVATED",
        reason: "draft",
        confirmed: true,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  await waitFor(() => {
    expect(view.result.current.detail.data?.admin.accountVersion).toBe(3);
  });
  expect(view.result.current.command.isSuccess).toBe(false);
});
it("bounded invitation absence cannot resolve lost issuance or permit replay after remount", async () => {
  const issue = vi
    .spyOn(adminsApi, "issueInvitation")
    .mockRejectedValue(safeApiError("transient", "NETWORK_ERROR"));
  const command = renderHook(() => useIssueInvitation(), { wrapper });
  const body = {
    fullName: "Invited",
    email: "invite@example.test",
    reason: "draft",
    confirmed: true as const,
  };
  await act(async () => {
    await expect(
      command.result.current.mutateAsync(body),
    ).rejects.toMatchObject({ category: "transient" });
  });
  command.unmount();
  const remount = renderHook(() => useIssueInvitation(), { wrapper });
  expect(remount.result.current.uncertain).toBe(true);
  await expect(remount.result.current.mutateAsync(body)).rejects.toMatchObject({
    code: "COMMAND_PENDING",
  });
  expect(issue).toHaveBeenCalledTimes(1);
  expect(client.getMutationCache().getAll()).toHaveLength(0);
});
it("reconciles policy denial without assuming global revocation", async () => {
  vi.spyOn(adminsApi, "changeStatus").mockRejectedValue(
    safeApiError("denied", "FORBIDDEN", 403),
  );
  const runtime = getSessionRuntime();
  const epoch = runtime.scope().epoch;
  const check = runtime.scope().check;
  const command = renderHook(() => useAdminStatus(id), { wrapper });
  await act(async () => {
    await expect(
      command.result.current.mutateAsync({
        status: "DEACTIVATED",
        reason: "draft",
        confirmed: true,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  expect(runtime.scope().epoch).toBe(epoch);
  expect(runtime.scope().check).toBeGreaterThan(check);
});
