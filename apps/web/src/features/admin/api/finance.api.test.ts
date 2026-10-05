import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  finance,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { financeApi } from "./finance.api";

cleanupNetwork();
describe("filtered administrator finance", () => {
  it("passes SQL filters and preserves exact aggregate and neutral count scope", async () => {
    networkSession("ADMIN");
    const signal = new AbortController().signal;
    const payload = {
      ...finance,
      summary: {
        ...finance.summary,
        credits: "12345678901234567890.000001",
        debits: "0",
        net: "12345678901234567890.000001",
        neutralOperationsCount: 200,
      },
    };
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        expect(config.params).toEqual({
          page: 1,
          limit: 25,
          q: "reference",
          source: "REFERRAL",
        });
        expect(config.signal).toBe(signal);
        return reply(config, payload);
      });
    expect(
      await financeApi.ledger(
        { page: 1, limit: 25, q: " reference ", source: "REFERRAL" },
        signal,
      ),
    ).toEqual(payload);
  });
  it.each(["missing-count", "foreign-scope", "wrong-page"])(
    "rejects %s as unavailable",
    async (variant) => {
      networkSession("ADMIN");
      const { neutralOperationsCount: _count, ...withoutCount } =
        finance.summary;
      const payload =
        variant === "missing-count"
          ? { ...finance, summary: withoutCount }
          : finance;
      apiClient.defaults.adapter = (config) =>
        Promise.resolve().then(() => reply(config, payload));
      await expect(
        financeApi.ledger({
          page: variant === "wrong-page" ? 2 : 1,
          limit: 25,
          ...(variant === "foreign-scope" ? { employeeId: actorId } : {}),
        }),
      ).rejects.toMatchObject({ category: "contract" });
    },
  );
});
