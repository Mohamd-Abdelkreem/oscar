import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import { cleanupNetwork, networkSession, reply } from "@/test/p04-network";
import { deferred } from "@/test/p04-query";
import {
  depositMetadata,
  emptyDepositHistory,
  readyAssignment,
  provisioningAssignment,
} from "@/test/p07-deposits";
import { depositsApi } from "./deposits.api";

cleanupNetwork();
describe("employee deposit wire boundary", () => {
  it("rejects a valid history page belonging to different requested bounds", async () => {
    networkSession();
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(reply(config, emptyDepositHistory));
    await expect(
      depositsApi.history({ page: 2, limit: 25 }),
    ).rejects.toMatchObject({ category: "contract" });
  });
  it("reads strict configured instructions and first-page history with cancellation", async () => {
    networkSession();
    const signal = new AbortController().signal;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        expect(config.signal).toBe(signal);
        if (config.url === "/deposits/me/address")
          return reply(config, readyAssignment);
        expect(config.url).toBe("/deposits/me/history");
        expect(config.params).toEqual({ page: 1, limit: 25 });
        return reply(config, emptyDepositHistory);
      });
    expect(await depositsApi.address(signal)).toEqual(readyAssignment);
    expect(await depositsApi.history({ page: 1, limit: 25 }, signal)).toEqual(
      emptyDepositHistory,
    );
  });

  it.each([
    [200, readyAssignment],
    [202, provisioningAssignment],
    [202, { ...depositMetadata, state: "UNASSIGNED" }],
    [
      202,
      {
        ...depositMetadata,
        state: "UNAVAILABLE",
        reasonCode: "RECOVERY_UNAVAILABLE",
        retryable: true,
      },
    ],
  ])(
    "accepts provision status %s only with its actual readiness",
    async (status, assignment) => {
      networkSession();
      apiClient.defaults.adapter = (config) =>
        Promise.resolve().then(() => {
          expect(config.method).toBe("post");
          expect(config.url).toBe("/deposits/me/address");
          expect(config.data).toBe("{}");
          return reply(config, assignment, status);
        });
      expect(await depositsApi.provision()).toEqual(assignment);
    },
  );

  it.each([
    [202, readyAssignment],
    [200, provisioningAssignment],
    [201, readyAssignment],
    [200, { ...readyAssignment, privateKey: "SENTINEL" }],
    [200, { ...depositMetadata, state: "READY" }],
  ])(
    "rejects inconsistent or unsafe provisioning response %s",
    async (status, assignment) => {
      networkSession();
      apiClient.defaults.adapter = (config) =>
        Promise.resolve(reply(config, assignment, status));
      await expect(depositsApi.provision()).rejects.toMatchObject({
        category: "contract",
      });
    },
  );

  it("rejects invalid GET status/envelope, history metadata and unsupported input", async () => {
    networkSession();
    let requests = 0;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        requests++;
        if (config.url === "/deposits/me/address")
          return reply(config, readyAssignment, 202);
        const response = reply(config, emptyDepositHistory);
        response.data.paginationMeta = {
          ...emptyDepositHistory.pagination,
          total: 1,
          totalPages: 1,
        };
        return response;
      });
    await expect(depositsApi.address()).rejects.toMatchObject({
      category: "contract",
    });
    await expect(
      depositsApi.history({ page: 1, limit: 25 }),
    ).rejects.toMatchObject({ category: "contract" });
    await expect(
      depositsApi.history({ page: 1, limit: 101 }),
    ).rejects.toMatchObject({ category: "request" });
    expect(requests).toBe(2);
  });

  it("rejects a late assignment after current authority changes", async () => {
    const runtime = networkSession();
    const pending = deferred<undefined>();
    apiClient.defaults.adapter = (config) =>
      pending.promise.then(() => reply(config, readyAssignment));
    const read = depositsApi.address();
    runtime.beginCheck();
    pending.resolve(undefined);
    await expect(read).rejects.toMatchObject({ category: "obsolete" });
  });
});
