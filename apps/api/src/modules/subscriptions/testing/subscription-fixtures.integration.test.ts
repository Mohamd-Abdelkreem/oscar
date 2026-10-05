import { describe, expect, it } from "vitest";

import {
  createSubscriptionScenario,
  activateSubscriptionFixture,
  fundSubscriptionFixture,
  P04_FIXTURE_NOW,
  withIndependentSubscriptionClients,
  withSubscriptionDatabase,
  withSubscriptionUserLock,
} from "./subscription-fixtures.js";

describe("isolated P04 financial fixtures", () => {
  it("creates five immutable ancestors/current sessions and funds a saved term through the real ledger", async () => {
    await withSubscriptionDatabase(async (database) => {
      const scenario = await createSubscriptionScenario(database);
      expect(scenario.ancestors).toHaveLength(5);
      expect(scenario.buyer.user.sponsorUserId).toBe(
        scenario.ancestors[0]?.user.id,
      );
      for (let level = 0; level < 5; level += 1) {
        const ancestor = scenario.ancestors[level];
        expect(ancestor?.user.sponsorUserId).toBe(
          scenario.ancestors[level + 1]?.user.id ?? null,
        );
        expect(ancestor?.session.createdAt).toEqual(P04_FIXTURE_NOW);
      }
      expect(scenario.buyer.session.expiresAt.getTime()).toBe(
        P04_FIXTURE_NOW.getTime() + 86400000,
      );
      await fundSubscriptionFixture(database, scenario.buyer, {
        referral: "10",
        nonReferral: "70",
      });
      const accepted = await activateSubscriptionFixture(
        database,
        scenario.buyer,
      );
      expect(accepted.reply.result.walletAfter).toEqual({
        availableReferral: "0",
        reservedReferral: "0",
        availableNonReferral: "20",
        reservedNonReferral: "0",
        total: "20",
      });
      expect(accepted.subscription.priceUnits).toBe(60000000n);
      expect(accepted.subscription.firstWorkDate.toISOString()).toBe(
        "2026-10-05T00:00:00.000Z",
      );
      expect(
        await database.financialOperation.count({
          where: { walletId: accepted.reply.result.walletId },
        }),
      ).toBe(3);
      expect(
        await database.auditRecord.count({
          where: { operation: { walletId: accepted.reply.result.walletId } },
        }),
      ).toBe(3);
    });
  });

  it("holds and releases the actual user lock across independent connections", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const { buyer } = await createSubscriptionScenario(database);
      await withIndependentSubscriptionClients(url, async (first, second) => {
        await withSubscriptionUserLock(
          first,
          buyer.user.id,
          async (releaseLock) => {
            const waiting =
              second.$queryRaw`SELECT id FROM users WHERE id=${buyer.user.id}::uuid FOR UPDATE /* p04-fixture-wait */`.then(
                (rows) => rows,
              );
            try {
              let blocked = false;
              for (let attempt = 0; attempt < 100; attempt += 1) {
                const activity = await database.$queryRaw<
                  { blocked: boolean }[]
                >`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND query LIKE '%p04-fixture-wait%' AND wait_event_type='Lock') AS blocked`;
                if (activity[0]?.blocked) {
                  blocked = true;
                  break;
                }
              }
              expect(blocked).toBe(true);
            } finally {
              releaseLock();
              await waiting;
            }
          },
        );
      });
      expect(await database.purchase.count()).toBe(0);
    });
  });
});
