import { describe, expect, it } from "vitest";
import {
  createIdentityFixture,
  withIdentityDatabase,
} from "../../auth/testing/identity-fixtures.js";
import {
  FinancialRuntimeAdmission,
  fenceFinancialRuntime,
} from "../../custody/runtime-control.js";
import { admitCleanDisposableFinancialBoot } from "../../ledger/testing/financial-fixtures.js";
import { manualState } from "../../deposits/testing/deposit-http-fixtures.js";

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
  it("uses explicit admission for source-aware funding/activation and preserves money/audit when pending or fenced", async () =>
    withIdentityDatabase(async (database) => {
      const account = await createIdentityFixture(database);
      const pending = new FinancialRuntimeAdmission(database, "API");
      await pending.register();
      const before = await manualState(database);
      await expect(
        fundSubscriptionFixture(
          database,
          account,
          { referral: "10", nonReferral: "70" },
          { now: P04_FIXTURE_NOW, admission: pending },
        ),
      ).rejects.toMatchObject({ code: "FINANCIAL_WRITES_FENCED" });
      await expect(
        activateSubscriptionFixture(database, account, "S1", {
          now: P04_FIXTURE_NOW,
          admission: pending,
        }),
      ).rejects.toMatchObject({ code: "FINANCIAL_WRITES_FENCED" });
      expect(await manualState(database)).toEqual(before);
      const admission = await admitCleanDisposableFinancialBoot(database);
      const runtime = { now: P04_FIXTURE_NOW, admission };
      await fundSubscriptionFixture(
        database,
        account,
        { referral: "10", nonReferral: "70" },
        runtime,
      );
      const active = await activateSubscriptionFixture(
        database,
        account,
        "S1",
        runtime,
      );
      expect(active.reply.result.walletAfter).toMatchObject({
        availableReferral: "0",
        availableNonReferral: "20",
        total: "20",
      });
      const admitted = await manualState(database);
      expect(admitted.operations).toHaveLength(3);
      expect(admitted.audit).toHaveLength(3);
      await fenceFinancialRuntime(database, {
        operatorIdentity: "fixture-test",
        reason: "Test explicit admission recheck",
      });
      await expect(
        fundSubscriptionFixture(
          database,
          account,
          { referral: "1", nonReferral: "1" },
          runtime,
        ),
      ).rejects.toMatchObject({ code: "FINANCIAL_WRITES_FENCED" });
      await expect(
        activateSubscriptionFixture(database, account, "S1", runtime),
      ).rejects.toMatchObject({ code: "FINANCIAL_WRITES_FENCED" });
      expect(await manualState(database)).toEqual(admitted);
    }));
  it("creates five immutable ancestors/current sessions and funds a saved term through the real ledger", async () => {
    await withSubscriptionDatabase(async (database) => {
      const startedAt = Date.now();
      const scenario = await createSubscriptionScenario(database);
      const completedAt = Date.now();
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
      expect(scenario.buyer.session.expiresAt.getTime()).toBeGreaterThanOrEqual(
        Math.max(P04_FIXTURE_NOW.getTime(), startedAt) + 86400000,
      );
      expect(scenario.buyer.session.expiresAt.getTime()).toBeLessThanOrEqual(
        Math.max(P04_FIXTURE_NOW.getTime(), completedAt) + 86400000,
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
