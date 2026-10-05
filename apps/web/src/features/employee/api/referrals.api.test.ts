import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  otherId,
  now,
  summary,
  pagination,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { referralsApi } from "./referrals.api";

cleanupNetwork();
describe("own relative team privacy", () => {
  it("keeps current rates distinct and rejects foreign roots and beneficiary", async () => {
    networkSession();
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => reply(config, summary));
    expect(await referralsApi.summary(actorId)).toEqual(summary);
    await expect(referralsApi.summary(otherId)).rejects.toMatchObject({
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
      referralsApi.commissions(actorId, { page: 1, limit: 25 }),
    ).rejects.toMatchObject({ category: "contract" });
  });
  it("rejects descendant private fields and passes bounded relative-level filters", async () => {
    networkSession();
    const signal = new AbortController().signal;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        expect(config.params).toEqual({ page: 1, limit: 25, level: 2 });
        expect(config.signal).toBe(signal);
        return reply(config, {
          items: [
            {
              id: otherId,
              fullName: "Member",
              joinedAt: now,
              level: 2,
              packageCode: null,
              viewerEarnedFromMember: "0",
              email: "private@example.test",
            },
          ],
          pagination: { ...pagination, total: 1, totalPages: 1 },
          rootId: actorId,
          memberCountScope: "FILTERED_MEMBERS",
          serverNow: now,
        });
      });
    await expect(
      referralsApi.members(actorId, { page: 1, limit: 25, level: 2 }, signal),
    ).rejects.toMatchObject({ category: "contract" });
  });
});
