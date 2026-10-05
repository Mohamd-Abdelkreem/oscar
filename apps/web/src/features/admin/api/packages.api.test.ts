import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  now,
  terms,
  change,
  networkSession,
  reply,
  reject,
  cleanupNetwork,
} from "@/test/p04-network";
import { adminPackagesApi } from "./packages.api";

cleanupNetwork();
const body = {
  commandId: actorId,
  expectedVersion: 1,
  reason: change.reason,
  confirmed: true as const,
  price: "61.000001",
};
describe("reviewed configuration transport", () => {
  it("requires live counts outside terms and rejects missing/private catalog values", async () => {
    networkSession("ADMIN");
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() =>
        reply(config, { items: [terms], serverNow: now }),
      );
    await expect(adminPackagesApi.catalog()).rejects.toMatchObject({
      category: "contract",
    });
  });
  it("keeps original exact fields, UUID/version/reason and rejects wrong committed intent", async () => {
    networkSession("ADMIN");
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        expect(config.url).toBe("/admin/packages/S1");
        expect(JSON.parse(String(config.data))).toEqual(body);
        return reply(config, change);
      });
    expect(await adminPackagesApi.edit("S1", body)).toEqual(change);
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() =>
        reply(config, { ...change, reason: "Other reason" }),
      );
    await expect(adminPackagesApi.edit("S1", body)).rejects.toMatchObject({
      category: "uncertain",
    });
  });
  it.each([true, false])(
    "only validated original PATCH proves supersession (valid=%s)",
    async (valid) => {
      networkSession("ADMIN");
      let calls = 0;
      apiClient.defaults.adapter = (config) =>
        Promise.resolve().then(() => {
          calls++;
          reject(config, "CONFIGURATION_SUPERSEDED", 409, valid);
        });
      await expect(adminPackagesApi.edit("S1", body)).rejects.toMatchObject({
        code: valid ? "CONFIGURATION_SUPERSEDED" : "HTTP_ERROR",
      });
      expect(calls).toBe(1);
    },
  );
  it("keeps absence nonterminal and never replays 401 writes", async () => {
    networkSession("ADMIN");
    let writes = 0;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        if (config.method === "get")
          return reply(config, {
            status: "NOT_OBSERVED",
            commandId: actorId,
            serverNow: now,
          });
        writes++;
        reject(config, "UNAUTHORIZED", 401);
      });
    expect(await adminPackagesApi.outcome(actorId)).toMatchObject({
      status: "NOT_OBSERVED",
    });
    await expect(adminPackagesApi.edit("S1", body)).rejects.toMatchObject({
      category: "denied",
    });
    expect(writes).toBe(1);
  });
  it("a supersession code on outcome GET cannot be terminal proof", async () => {
    networkSession("ADMIN");
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => reject(config, "CONFIGURATION_SUPERSEDED"));
    await expect(adminPackagesApi.outcome(actorId)).rejects.toMatchObject({
      code: "HTTP_ERROR",
    });
  });
});
