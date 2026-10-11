import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  cleanupNetwork,
  networkSession,
  reply,
  actorId,
  otherId,
  pagination,
} from "@/test/p04-network";
import { withdrawal } from "@/test/p09-withdrawals";
import { adminWithdrawalsApi } from "./withdrawals.api";

cleanupNetwork();
const adminRequest = {
  ...withdrawal,
  employee: {
    id: actorId,
    fullName: "Employee",
    email: "employee@example.test",
  },
  canExtend: true,
  canReject: true,
};
const observation = {
  status: "NOT_OBSERVED",
  kind: "EXTEND",
  requestKey: actorId,
  expectedVersion: 1,
  withdrawalId: otherId,
  serverNow: withdrawal.serverNow,
  withdrawal: adminRequest,
};
describe("admin withdrawal wire boundary", () => {
  it.each([
    { requestKey: "different-key-0000001" },
    { expectedVersion: 2, withdrawal: { ...adminRequest, version: 2 } },
    { withdrawalId: actorId, withdrawal: { ...adminRequest, id: actorId } },
  ])("rejects an outcome bound to another original intent", async (changes) => {
    networkSession("ADMIN");
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(reply(config, { ...observation, ...changes }));
    await expect(
      adminWithdrawalsApi.outcome(otherId, {
        kind: "EXTEND",
        requestKey: actorId,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ category: "contract" });
  });
  it("validates rejection base results without requiring admin-only fields", async () => {
    networkSession("ADMIN");
    const rejected = {
      ...withdrawal,
      version: 2,
      state: "REJECTED",
      finalizedAt: withdrawal.serverNow,
      release: {
        gross: withdrawal.gross,
        chargedFee: "0",
        sourceAllocation: withdrawal.sourceAllocation,
        releasedAt: withdrawal.serverNow,
      },
    };
    const body = {
      expectedVersion: 1,
      confirmed: true as const,
      reason: "Reviewed release",
    };
    apiClient.defaults.adapter = (config) => {
      expect(config.url).toBe(`/admin/withdrawals/${otherId}/rejections`);
      expect(JSON.parse(String(config.data))).toEqual(body);
      return Promise.resolve(
        reply(config, { withdrawal: rejected, replayed: false }),
      );
    };
    expect(
      (await adminWithdrawalsApi.reject(otherId, body, actorId)).withdrawal
        .release?.chargedFee,
    ).toBe("0");
  });
  it("validates enriched detail, admin10 pages, exact outcomes and cancellation", async () => {
    networkSession("ADMIN");
    const controller = new AbortController();
    apiClient.defaults.adapter = (config) => {
      expect(config.signal).toBe(controller.signal);
      return Promise.resolve(
        reply(
          config,
          config.url?.endsWith("/outcome")
            ? observation
            : config.url === "/admin/withdrawals"
              ? {
                  items: [adminRequest],
                  pagination: {
                    ...pagination,
                    limit: 10,
                    total: 1,
                    totalPages: 1,
                  },
                }
              : adminRequest,
        ),
      );
    };
    expect(
      await adminWithdrawalsApi.detail(otherId, controller.signal),
    ).toEqual(adminRequest);
    expect(
      (
        await adminWithdrawalsApi.history(
          { page: 1, limit: 10 },
          controller.signal,
        )
      ).items,
    ).toHaveLength(1);
    expect(
      await adminWithdrawalsApi.outcome(
        otherId,
        { kind: "EXTEND", requestKey: actorId, expectedVersion: 1 },
        controller.signal,
      ),
    ).toEqual(observation);
    await expect(
      adminWithdrawalsApi.detail(actorId, controller.signal),
    ).rejects.toMatchObject({ category: "contract" });
    await expect(
      adminWithdrawalsApi.outcome(
        otherId,
        { kind: "REJECT", requestKey: actorId, expectedVersion: 1 },
        controller.signal,
      ),
    ).rejects.toMatchObject({ category: "contract" });
    controller.abort();
    await expect(
      adminWithdrawalsApi.detail(otherId, controller.signal),
    ).rejects.toMatchObject({ category: "cancelled" });
  });
  it.each([
    null,
    { ...adminRequest, privateKey: "SENTINEL" },
    { ...adminRequest, employee: null },
    { ...adminRequest, net: "78" },
  ])("rejects malformed/private projections safely", async (raw) => {
    networkSession("ADMIN");
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(reply(config, raw));
    const failure = await adminWithdrawalsApi
      .detail(otherId)
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ category: "contract" });
    expect(JSON.stringify(failure)).not.toContain("SENTINEL");
  });
  it("sends the original strict fractional intent/key and validates base results", async () => {
    networkSession("ADMIN");
    const body = {
      expectedVersion: 1,
      countedHours: "1.5",
      confirmed: true as const,
      reason: "Reviewed",
    };
    const extended = {
      ...withdrawal,
      version: 2,
      scheduleVersion: 2,
      dueAt: "2026-10-08T10:30:00.000Z",
      dispatchAt: "2026-10-08T10:30:00.000Z",
    };
    apiClient.defaults.adapter = (config) => {
      expect(config.headers.get("Idempotency-Key")).toBe(actorId);
      expect(JSON.parse(String(config.data))).toEqual(body);
      return Promise.resolve(
        reply(config, { withdrawal: extended, replayed: false }),
      );
    };
    expect(
      (await adminWithdrawalsApi.extend(otherId, body, actorId)).withdrawal
        .version,
    ).toBe(2);
    await expect(
      adminWithdrawalsApi.extend(actorId, body, actorId),
    ).rejects.toMatchObject({ category: "uncertain" });
    await expect(
      adminWithdrawalsApi.extend(
        otherId,
        { ...body, countedHours: "1e2" },
        actorId,
      ),
    ).rejects.toMatchObject({ category: "request" });
  });
});
