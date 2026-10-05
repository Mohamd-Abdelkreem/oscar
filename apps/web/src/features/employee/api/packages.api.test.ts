import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  otherId,
  now,
  terms,
  quote,
  purchase,
  membership,
  pagination,
  networkSession,
  reply,
  reject,
  cleanupNetwork,
} from "@/test/p04-network";
import { packagesApi } from "./packages.api";

cleanupNetwork();

describe("owned package transport", () => {
  it("reads bounded history with cancellation and rejects foreign membership/outcome", async () => {
    networkSession();
    const signal = new AbortController().signal;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        expect(config.signal).toBe(signal);
        if (config.url === "/subscriptions/me")
          return reply(config, { ...membership, employeeId: otherId });
        if (config.url?.endsWith("/outcome"))
          return reply(config, {
            status: "NOT_OBSERVED",
            quoteId: otherId,
            quote,
            serverNow: now,
          });
        return reply(config, { items: [], pagination });
      });
    expect(
      await packagesApi.history({ page: 1, limit: 25 }, signal),
    ).toMatchObject({ items: [] });
    await expect(packagesApi.membership(actorId, signal)).rejects.toMatchObject(
      { category: "contract" },
    );
    await expect(packagesApi.outcome(actorId, signal)).rejects.toMatchObject({
      category: "contract",
    });
  });
  it.each([false, true])(
    "binds exact reviewed purchase and status (replayed=%s)",
    async (replayed) => {
      networkSession();
      apiClient.defaults.adapter = (config) =>
        Promise.resolve().then(() => {
          expect(JSON.parse(String(config.data))).toEqual({
            quoteId: actorId,
            confirmed: true,
          });
          expect(config.headers.get("Idempotency-Key")).toBe(actorId);
          return reply(config, { purchase, replayed }, replayed ? 200 : 201);
        });
      expect(
        await packagesApi.purchase({ quoteId: actorId, confirmed: true }),
      ).toMatchObject({ purchase, replayed });
    },
  );
  it.each(["missing", "wrong-status", "wrong-quote"])(
    "keeps %s command success uncertain",
    async (variant) => {
      networkSession();
      apiClient.defaults.adapter = (config) =>
        Promise.resolve().then(() =>
          reply(
            config,
            variant === "missing"
              ? {}
              : {
                  purchase:
                    variant === "wrong-quote"
                      ? { ...purchase, quoteId: otherId }
                      : purchase,
                  replayed: false,
                },
            200,
          ),
        );
      await expect(
        packagesApi.purchase({ quoteId: actorId, confirmed: true }),
      ).rejects.toMatchObject({ category: "uncertain" });
    },
  );
  it("quotes explicit intent without automatic 401 purchase replay or private error retention", async () => {
    networkSession();
    let writes = 0;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        if (config.url === "/subscriptions/purchase-quotes") {
          expect(JSON.parse(String(config.data))).toEqual({
            packageCode: "S1",
          });
          return reply(config, quote, 201);
        }
        writes++;
        reject(config, "UNAUTHORIZED", 401);
      });
    expect(await packagesApi.quote("S1")).toEqual(quote);
    const failure = await packagesApi
      .purchase({ quoteId: actorId, confirmed: true })
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ category: "denied" });
    expect(JSON.stringify(failure)).not.toContain("SENTINEL");
    expect(writes).toBe(1);
  });
  it("rejects incomplete catalog instead of fixture fallback", async () => {
    networkSession();
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() =>
        reply(config, { items: [terms], serverNow: now }),
      );
    await expect(packagesApi.catalog()).rejects.toMatchObject({
      category: "contract",
    });
  });
});
