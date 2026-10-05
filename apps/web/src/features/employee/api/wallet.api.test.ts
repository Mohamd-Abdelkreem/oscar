import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  otherId,
  wallet,
  ledger,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { walletApi } from "./wallet.api";

cleanupNetwork();
describe("source-aware employee wallet", () => {
  it("retains referral locks/reservations and passes cancellation", async () => {
    networkSession();
    const signal = new AbortController().signal;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        expect(config.signal).toBe(signal);
        return reply(config, wallet);
      });
    expect(await walletApi.wallet(actorId, signal)).toEqual(wallet);
  });
  it.each([
    { ...wallet, employeeId: otherId },
    { ...wallet, privateKey: "SENTINEL" },
    { ...wallet, purchaseEligibleAmount: "45" },
  ])("rejects malformed or foreign wallet without zeros", async (payload) => {
    networkSession();
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => reply(config, payload));
    await expect(walletApi.wallet(actorId)).rejects.toMatchObject({
      category: "contract",
    });
  });
  it("rejects disagreeing page/envelope and unsupported filters before a request", async () => {
    networkSession();
    let calls = 0;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        calls++;
        const response = reply(config, ledger);
        response.data.paginationMeta = {
          ...ledger.pagination,
          page: 2,
          hasPreviousPage: true,
        };
        return response;
      });
    await expect(
      walletApi.ledger({ page: 1, limit: 25 }),
    ).rejects.toMatchObject({ category: "contract" });
    await expect(
      walletApi.ledger({ page: 1, limit: 101 }),
    ).rejects.toMatchObject({ category: "request" });
    expect(calls).toBe(1);
  });
});
