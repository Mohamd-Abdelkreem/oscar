import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  cleanupNetwork,
  networkSession,
  reply,
  actorId,
  otherId,
  now,
} from "@/test/p04-network";
import { deferred } from "@/test/p04-query";
import {
  destination,
  pendingDestination,
  withdrawal,
  withdrawalQuote,
  withdrawalStatus,
  withdrawalHistory,
} from "@/test/p09-withdrawals";
import { withdrawalsApi } from "./withdrawals.api";

cleanupNetwork();
describe("employee withdrawal wire boundary", () => {
  it.each([
    ["status", () => withdrawalsApi.status(), 200],
    ["destination", () => withdrawalsApi.destination(), 200],
    ["detail", () => withdrawalsApi.detail(otherId), 200],
    ["outcome", () => withdrawalsApi.outcome(actorId), 200],
    ["history", () => withdrawalsApi.history({ page: 1, limit: 25 }), 200],
    ["issuance", () => withdrawalsApi.issue(destination.address), 201],
    ["resend", () => withdrawalsApi.resend(1), 200],
    ["consume", () => withdrawalsApi.consume("a".repeat(43)), 200],
  ] as const)(
    "rejects malformed %s success safely",
    async (_name, read, status) => {
      networkSession();
      apiClient.defaults.adapter = (config) =>
        Promise.resolve(
          reply(config, { token: "SENTINEL_PRIVATE_PROOF" }, status),
        );
      const failure: unknown = await read().catch((error: unknown) => error);
      expect(failure).toMatchObject({ category: "contract" });
      expect(JSON.stringify(failure)).not.toContain("SENTINEL_PRIVATE_PROOF");
    },
  );
  it("honors cancellation instead of publishing a private late response", async () => {
    networkSession();
    const pending = deferred<undefined>();
    const controller = new AbortController();
    apiClient.defaults.adapter = (config) =>
      pending.promise.then(() => reply(config, withdrawalStatus));
    const read = withdrawalsApi.status(controller.signal);
    controller.abort();
    pending.resolve(undefined);
    await expect(read).rejects.toMatchObject({ category: "cancelled" });
  });
  it("validates cancellable private reads and exact resource/page identity", async () => {
    networkSession();
    const signal = new AbortController().signal;
    apiClient.defaults.adapter = (config) => {
      expect(config.signal).toBe(signal);
      const body =
        config.url === "/withdrawals/me"
          ? withdrawalStatus
          : config.url === "/withdrawals/me/destination"
            ? destination
            : config.url === "/withdrawals"
              ? withdrawalHistory
              : config.url?.endsWith("/outcome")
                ? {
                    status: "COMMITTED",
                    quoteId: actorId,
                    withdrawal,
                    serverNow: now,
                  }
                : withdrawal;
      return Promise.resolve(reply(config, body));
    };
    expect(await withdrawalsApi.status(signal)).toEqual(withdrawalStatus);
    expect(await withdrawalsApi.destination(signal)).toEqual(destination);
    expect(await withdrawalsApi.detail(otherId, signal)).toEqual(withdrawal);
    expect(await withdrawalsApi.outcome(actorId, signal)).toMatchObject({
      status: "COMMITTED",
    });
    expect(
      await withdrawalsApi.history({ page: 1, limit: 25 }, signal),
    ).toEqual(withdrawalHistory);
    await expect(withdrawalsApi.detail(actorId, signal)).rejects.toMatchObject({
      category: "contract",
    });
    await expect(withdrawalsApi.outcome(otherId, signal)).rejects.toMatchObject(
      { category: "contract" },
    );
    await expect(
      withdrawalsApi.history({ page: 2, limit: 25 }, signal),
    ).rejects.toMatchObject({ category: "contract" });
  });
  it.each([
    [201, false],
    [200, true],
  ])(
    "binds acceptance status %s to replay and the reviewed quote/key",
    async (status, replayed) => {
      networkSession();
      apiClient.defaults.adapter = (config) => {
        expect(JSON.parse(String(config.data))).toEqual({
          quoteId: actorId,
          confirmed: true,
        });
        expect(config.headers.get("Idempotency-Key")).toBe(otherId);
        return Promise.resolve(reply(config, { withdrawal, replayed }, status));
      };
      expect(await withdrawalsApi.accept(actorId, otherId)).toEqual({
        withdrawal,
        replayed,
      });
    },
  );
  it.each([
    null,
    { ...withdrawalQuote, net: "78" },
    { ...withdrawalQuote, privateKey: "SENTINEL" },
    { ...withdrawalQuote, gross: "1e2" },
  ])(
    "rejects malformed/unsafe quote success without retaining payload",
    async (body) => {
      networkSession();
      apiClient.defaults.adapter = (config) =>
        Promise.resolve(reply(config, body, 201));
      const failure = await withdrawalsApi
        .quote("100")
        .catch((error: unknown) => error);
      expect(failure).toMatchObject({ category: "contract" });
      expect(JSON.stringify(failure)).not.toContain("SENTINEL");
    },
  );
  it("rejects mismatched quote amounts, mixed command statuses and privileged input before sending", async () => {
    networkSession();
    let requests = 0;
    apiClient.defaults.adapter = (config) => {
      requests++;
      return Promise.resolve(
        reply(
          config,
          config.url === "/withdrawals/quotes"
            ? withdrawalQuote
            : { withdrawal, replayed: false },
          config.url === "/withdrawals/quotes" ? 201 : 200,
        ),
      );
    };
    await expect(withdrawalsApi.quote("16")).rejects.toMatchObject({
      category: "contract",
    });
    await expect(withdrawalsApi.accept(actorId, otherId)).rejects.toMatchObject(
      { category: "uncertain" },
    );
    await expect(withdrawalsApi.quote("100.0000001")).rejects.toMatchObject({
      category: "request",
    });
    await expect(withdrawalsApi.detail("bad")).rejects.toMatchObject({
      category: "request",
    });
    expect(requests).toBe(2);
  });
  it("keeps proof consumption cache-free and validates destination command bindings", async () => {
    networkSession();
    const token = "a".repeat(43);
    apiClient.defaults.adapter = (config) => {
      if (config.url?.endsWith("consume"))
        expect(JSON.parse(String(config.data))).toEqual({ token });
      return Promise.resolve(
        reply(
          config,
          config.url?.endsWith("consume") ? destination : pendingDestination,
          config.url?.endsWith("confirmations") ? 201 : 200,
        ),
      );
    };
    expect(await withdrawalsApi.consume(token)).toEqual(destination);
    expect(await withdrawalsApi.issue(destination.address)).toEqual(
      pendingDestination,
    );
    expect(await withdrawalsApi.resend(1)).toEqual(pendingDestination);
    await expect(withdrawalsApi.resend(2)).rejects.toMatchObject({
      category: "contract",
    });
    await expect(withdrawalsApi.consume("bad")).rejects.toMatchObject({
      category: "request",
    });
  });
  it("discards reads and quote replies after an authority check changes", async () => {
    const runtime = networkSession();
    const pending = deferred<undefined>();
    apiClient.defaults.adapter = (config) =>
      pending.promise.then(() => reply(config, withdrawalQuote, 201));
    const read = withdrawalsApi.quote("100");
    runtime.beginCheck();
    pending.resolve(undefined);
    await expect(read).rejects.toMatchObject({ category: "obsolete" });
  });
});
