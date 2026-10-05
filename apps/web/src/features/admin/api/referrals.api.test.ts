import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  otherId,
  now,
  adminSummary,
  pagination,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { adminReferralsApi } from "./referrals.api";

cleanupNetwork();
describe("administrator root-relative reads", () => {
  it("separates bounded root search from member search and passes cancellation", async () => {
    networkSession("ADMIN");
    const signal = new AbortController().signal;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        expect(config.signal).toBe(signal);
        if (config.url === "/admin/referrals/roots") {
          expect(config.params).toEqual({ page: 1, limit: 25, q: "root" });
          return reply(config, { items: [], pagination });
        }
        expect(config.url).toBe(`/admin/referrals/${actorId}/members`);
        expect(config.params).toEqual({ page: 1, limit: 25, q: "member" });
        return reply(config, {
          items: [],
          pagination,
          rootId: actorId,
          memberCountScope: "FILTERED_MEMBERS",
          serverNow: now,
        });
      });
    expect(
      await adminReferralsApi.roots(
        { page: 1, limit: 25, q: " root " },
        signal,
      ),
    ).toMatchObject({ items: [] });
    expect(
      await adminReferralsApi.members(
        actorId,
        { page: 1, limit: 25, q: "member" },
        signal,
      ),
    ).toMatchObject({ rootId: actorId });
  });
  it("rejects a previous root and beneficiary rather than displaying old data", async () => {
    networkSession("ADMIN");
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => reply(config, adminSummary));
    await expect(adminReferralsApi.summary(otherId)).rejects.toMatchObject({
      category: "contract",
    });
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() =>
        reply(config, {
          items: [],
          pagination,
          beneficiaryId: otherId,
          summary: { scope: "FILTERED_BENEFICIARY_DECISIONS", awarded: "0" },
          serverNow: now,
        }),
      );
    await expect(
      adminReferralsApi.commissions(actorId, { page: 1, limit: 25 }),
    ).rejects.toMatchObject({ category: "contract" });
  });
});
