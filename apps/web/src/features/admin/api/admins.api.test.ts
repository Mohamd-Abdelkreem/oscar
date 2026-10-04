import { AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { adminsApi } from "./admins.api";

const id = "00000000-0000-4000-8000-000000000001";
const date = "2026-10-01T00:00:00.000Z";
const admin = {
  id,
  fullName: "Admin",
  email: "admin@example.test",
  phone: null,
  role: "ADMIN",
  status: "ACTIVE",
  emailVerifiedAt: date,
  createdAt: date,
  updatedAt: date,
  accountVersion: 2,
};
const invitation = {
  id,
  fullName: "Invited",
  email: "invited@example.test",
  issuerUserId: id,
  tokenVersion: 1,
  issuedAt: date,
  expiresAt: date,
  acceptedAt: null,
  revokedAt: null,
  status: "PENDING",
  deliveryStatus: "UNKNOWN",
};
const pagination = {
  page: 2,
  limit: 25,
  total: 26,
  totalPages: 2,
  hasNextPage: false,
  hasPreviousPage: true,
};
const command = {
  reason: "Reviewed request",
  confirmed: true as const,
  expectedVersion: 2,
};
const original = apiClient.defaults.adapter;
beforeEach(() => {
  getSessionRuntime().dispose();
  localStorage.clear();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) => callback(),
    },
  });
});
afterEach(() => {
  if (original !== undefined) apiClient.defaults.adapter = original;
  getSessionRuntime().dispose();
  localStorage.clear();
});

describe("administrator boundary", () => {
  const signal = new AbortController().signal;
  const cases = [
    {
      method: "get",
      path: "/admin/admins",
      invoke: () => adminsApi.listAdmins({ page: 2, limit: 25 }, signal),
      payload: { items: [admin], pagination },
      params: { page: 2, limit: 25 },
    },
    {
      method: "get",
      path: `/admin/admins/${id}`,
      invoke: () => adminsApi.getAdmin(id, signal),
      payload: { admin },
    },
    {
      method: "patch",
      path: `/admin/admins/${id}/status`,
      invoke: () =>
        adminsApi.changeStatus(id, { ...command, status: "DEACTIVATED" }),
      payload: { admin },
      body: { ...command, status: "DEACTIVATED" },
    },
    {
      method: "get",
      path: "/admin/invitations",
      invoke: () => adminsApi.listInvitations({ page: 2, limit: 25 }, signal),
      payload: { items: [invitation], pagination },
      params: { page: 2, limit: 25 },
    },
    {
      method: "get",
      path: `/admin/invitations/${id}`,
      invoke: () => adminsApi.getInvitation(id, signal),
      payload: { invitation },
    },
    {
      method: "post",
      path: "/admin/invitations",
      invoke: () =>
        adminsApi.issueInvitation({
          fullName: "Invited",
          email: " INVITED@example.test ",
          reason: command.reason,
          confirmed: true,
        }),
      payload: { invitation },
      status: 201,
      body: {
        fullName: "Invited",
        email: "invited@example.test",
        reason: command.reason,
        confirmed: true,
      },
    },
    {
      method: "post",
      path: `/admin/invitations/${id}/reissue`,
      invoke: () => adminsApi.reissueInvitation(id, command),
      payload: { invitation },
      body: command,
    },
    {
      method: "post",
      path: `/admin/invitations/${id}/revoke`,
      invoke: () => adminsApi.revokeInvitation(id, command),
      payload: { invitation },
      body: command,
    },
  ];
  it.each(cases)(
    "$method $path uses the existing validated wire contract",
    async ({ method, path, invoke, payload, ...expected }) => {
      const status = "status" in expected ? expected.status : 200;
      apiClient.defaults.adapter = (config) => {
        expect(config.method).toBe(method);
        expect(config.url).toBe(path);
        if (method === "get") expect(config.signal).toBe(signal);
        if ("params" in expected)
          expect(config.params).toEqual(expected.params);
        if ("body" in expected)
          expect(JSON.parse(String(config.data))).toEqual(expected.body);
        return Promise.resolve({
          config,
          status,
          statusText: "OK",
          headers: new AxiosHeaders(),
          data: {
            success: true,
            statusCode: status,
            message: "OK",
            requestId: "id",
            timestamp: date,
            path,
            data: payload,
            ...("pagination" in payload ? { paginationMeta: pagination } : {}),
          },
        });
      };
      await expect(invoke()).resolves.toEqual(payload);
    },
  );
  it.each(["private", "status", "metadata", "request-page", "oversized"])(
    "rejects %s success without retaining its payload",
    async (fault) => {
      apiClient.defaults.adapter = (config) =>
        Promise.resolve({
          config,
          status: fault === "status" ? 201 : 200,
          statusText: "OK",
          headers: new AxiosHeaders(),
          data: {
            success: true,
            statusCode: 200,
            message: "OK",
            requestId: "id",
            timestamp: date,
            path: "/admin/admins",
            data: {
              items:
                fault === "oversized"
                  ? Array.from({ length: 26 }, () => admin)
                  : [
                      {
                        ...admin,
                        ...(fault === "private"
                          ? { passwordHash: "PRIVATE_SENTINEL" }
                          : {}),
                      },
                    ],
              pagination:
                fault === "request-page"
                  ? { ...pagination, page: 1, hasPreviousPage: false }
                  : pagination,
            },
            paginationMeta:
              fault === "metadata" ? { ...pagination, total: 27 } : pagination,
          },
        });
      await expect(
        adminsApi.listAdmins({ page: 2, limit: 25 }),
      ).rejects.toMatchObject({ category: "contract" });
    },
  );
  it("rejects unbounded input before dispatch", async () => {
    apiClient.defaults.adapter = () => {
      throw new Error("UNEXPECTED_DISPATCH");
    };
    await expect(
      adminsApi.listAdmins({ page: 1, limit: 101 }),
    ).rejects.toMatchObject({ category: "request" });
  });
  it("rejects a valid detail belonging to a different target", async () => {
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
          timestamp: date,
          path: config.url,
          data: {
            admin: { ...admin, id: "00000000-0000-4000-8000-000000000099" },
          },
        },
      });
    await expect(adminsApi.getAdmin(id)).rejects.toMatchObject({
      category: "contract",
    });
  });
  it("discards a read completed after authority retirement", async () => {
    apiClient.defaults.adapter = (config) => {
      getSessionRuntime().retire();
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
          timestamp: date,
          path: config.url,
          data: { admin },
        },
      });
    };
    await expect(adminsApi.getAdmin(id)).rejects.toMatchObject({
      category: "obsolete",
    });
  });
});
