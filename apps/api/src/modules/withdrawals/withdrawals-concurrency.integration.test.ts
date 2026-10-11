import { describe, expect, it } from "vitest";
import { setTimeout as delay } from "node:timers/promises";
import { WithdrawalsService } from "./withdrawals.service.js";
import { changeDispatchPause } from "../custody/runtime-control.js";
import {
  withWithdrawalDatabase,
  withWithdrawalRaceClients,
  withdrawalRaceBarrier,
} from "./testing/withdrawal-fixtures.js";
import {
  reservationEmployee,
  reservationServices,
  reservationState,
} from "./testing/withdrawal-reservation-fixtures.js";
import { RESERVATION_NOW } from "./testing/withdrawal-reservation-fixtures.js";
import { PurchaseQuoteService } from "../subscriptions/purchase-quote.service.js";
import { SubscriptionPurchaseService } from "../subscriptions/subscription-purchase.service.js";
import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import type { DatabaseClient } from "@template/database";

async function waitBlocked(database: DatabaseClient, count: number) {
  const deadline = performance.now() + 5000;
  while (performance.now() < deadline) {
    const [row] = await database.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND cardinality(pg_blocking_pids(pid)) > 0`;
    if (row !== undefined && row.count >= BigInt(count)) return;
    await delay(10);
  }
  throw new Error("Withdrawal race did not overlap at database locks");
}

describe("independent withdrawal devices", () => {
  it("observes a committed acceptance after waiting across quote expiry", async () =>
    withWithdrawalDatabase(async (database, url) => {
      const owner = await reservationEmployee(database);
      let now = RESERVATION_NOW;
      const quote = await reservationServices(
        database,
        () => now,
        60,
      ).quotes.create(owner.identity, { gross: "100" });
      const pending: Promise<unknown>[] = [];
      await database.$executeRawUnsafe(
        "CREATE FUNCTION p09_acceptance_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(74079); RETURN NEW; END $$",
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER p09_acceptance_gate BEFORE INSERT ON withdrawal_requests FOR EACH ROW EXECUTE FUNCTION p09_acceptance_gate()",
      );
      try {
        await withWithdrawalRaceClients(url, async (writer, observer) => {
          await database.$transaction(
            async (transaction) => {
              await transaction.$queryRaw`SELECT pg_advisory_xact_lock(74079)::text`;
              pending.push(
                reservationServices(writer, () => now).reservations.accept(
                  owner.identity,
                  { quoteId: quote.quoteId, confirmed: true },
                ),
              );
              void pending[0]?.catch(() => {});
              await waitBlocked(database, 1);
              pending.push(
                new WithdrawalsService(observer, () => now).outcome(
                  owner.identity,
                  quote.quoteId,
                ),
              );
              void pending[1]?.catch(() => {});
              await waitBlocked(database, 2);
              pending.push(
                changeDispatchPause(database, {
                  action: "PAUSE",
                  operatorIdentity: "test-recovery",
                  reason: "Acceptance wins admission",
                }),
              );
              void pending[2]?.catch(() => {});
              await waitBlocked(database, 3);
              now = new Date(new Date(quote.quoteExpiresAt).getTime() + 1);
            },
            { timeout: 10000 },
          );
          const [accepted, observed] = await Promise.all(pending);
          expect(accepted).toMatchObject({ replayed: false });
          expect(observed).toMatchObject({
            status: "COMMITTED",
            quoteId: quote.quoteId,
          });
        });
        const state = await reservationState(database, owner.user.id);
        expect([
          state.requests.length,
          state.allocations.length,
          state.operations.length,
        ]).toEqual([1, 1, 1]);
        expect(state.wallet.reservedNonReferralUnits).toBe(100000000n);
        expect(
          await database.financialRuntimeControl.findUniqueOrThrow({
            where: { id: 1 },
          }),
        ).toMatchObject({ newDispatchPaused: true });
      } finally {
        await Promise.allSettled(pending);
        await database.$executeRawUnsafe(
          "DROP TRIGGER p09_acceptance_gate ON withdrawal_requests",
        );
        await database.$executeRawUnsafe("DROP FUNCTION p09_acceptance_gate()");
      }
    }));

  it("does not reserve when an overlapping dispatch pause wins admission", async () =>
    withWithdrawalDatabase(async (database, url) => {
      const owner = await reservationEmployee(database);
      const quote = await reservationServices(database).quotes.create(
        owner.identity,
        { gross: "100" },
      );
      const pending: Promise<unknown>[] = [];
      await database.$executeRawUnsafe(
        "CREATE FUNCTION p09_pause_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(74080); RETURN NEW; END $$",
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER p09_pause_gate BEFORE UPDATE ON financial_runtime_control FOR EACH ROW EXECUTE FUNCTION p09_pause_gate()",
      );
      try {
        await withWithdrawalRaceClients(url, async (writer, operator) => {
          await database.$transaction(
            async (transaction) => {
              await transaction.$queryRaw`SELECT pg_advisory_xact_lock(74080)::text`;
              pending.push(
                changeDispatchPause(operator, {
                  action: "PAUSE",
                  operatorIdentity: "test-recovery",
                  reason: "Pause wins admission",
                }),
              );
              void pending[0]?.catch(() => {});
              await waitBlocked(database, 1);
              pending.push(
                reservationServices(writer).reservations.accept(
                  owner.identity,
                  {
                    quoteId: quote.quoteId,
                    confirmed: true,
                  },
                ),
              );
              void pending[1]?.catch(() => {});
              await waitBlocked(database, 2);
            },
            { timeout: 10000 },
          );
          await pending[0];
          await expect(pending[1]).rejects.toMatchObject({
            code: "WITHDRAWAL_UNAVAILABLE",
          });
        });
      } finally {
        await Promise.allSettled(pending);
        await database.$executeRawUnsafe(
          "DROP TRIGGER p09_pause_gate ON financial_runtime_control",
        );
        await database.$executeRawUnsafe("DROP FUNCTION p09_pause_gate()");
      }
      const state = await reservationState(database, owner.user.id);
      expect([
        state.requests.length,
        state.allocations.length,
        state.operations.length,
      ]).toEqual([0, 0, 0]);
      expect(state.wallet).toMatchObject({
        availableNonReferralUnits: 100000000n,
        reservedNonReferralUnits: 0n,
      });
    }));
  it("chooses one entire purchase or withdrawal when independently reviewed intents compete for funds", async () =>
    withWithdrawalDatabase(async (database, url) => {
      const owner = await reservationEmployee(database);
      const withdrawal = await reservationServices(database).quotes.create(
        owner.identity,
        { gross: "100" },
      );
      const purchase = await new PurchaseQuoteService(
        database,
        () => RESERVATION_NOW,
      ).create(owner.identity, { packageCode: "S1" });
      await withWithdrawalRaceClients(url, async (first, second) => {
        const start = withdrawalRaceBarrier(2);
        const results = await Promise.allSettled([
          (async () => {
            await start();
            return reservationServices(first).reservations.accept(
              owner.identity,
              { quoteId: withdrawal.quoteId, confirmed: true },
            );
          })(),
          (async () => {
            await start();
            return new SubscriptionPurchaseService(
              second,
              () => RESERVATION_NOW,
              financialFixtureAdmission(second),
            ).purchase(owner.identity, {
              quoteId: purchase.quoteId,
              confirmed: true,
            });
          })(),
        ]);
        expect(
          results.filter((result) => result.status === "fulfilled"),
        ).toHaveLength(1);
      });
      const state = await reservationState(database, owner.user.id);
      const purchases = await database.purchase.findMany({
        where: { buyerId: owner.user.id },
      });
      expect(state.requests.length + purchases.length).toBe(1);
      if (state.requests.length === 1) {
        expect([
          state.allocations.length,
          state.operations.length,
          state.actions.length,
        ]).toEqual([1, 1, 1]);
        expect(state.wallet).toMatchObject({
          availableNonReferralUnits: 0n,
          reservedNonReferralUnits: 100000000n,
        });
      } else {
        expect([
          state.allocations.length,
          state.operations.length,
          state.actions.length,
        ]).toEqual([0, 0, 0]);
        expect(state.wallet.reservedNonReferralUnits).toBe(0n);
        expect(
          state.wallet.availableNonReferralUnits +
            (purchases[0]?.fullDebitUnits ?? 0n),
        ).toBe(100000000n);
      }
    }));
  it("serializes identical quote acceptance into one operation and a replay", async () =>
    withWithdrawalDatabase(async (database, url) => {
      const owner = await reservationEmployee(database);
      const quote = await reservationServices(database).quotes.create(
        owner.identity,
        { gross: "100" },
      );
      await withWithdrawalRaceClients(url, async (first, second) => {
        const start = withdrawalRaceBarrier(2);
        const responses = await Promise.all(
          [first, second].map(async (client) => {
            await start();
            return reservationServices(client).reservations.accept(
              owner.identity,
              { quoteId: quote.quoteId, confirmed: true },
            );
          }),
        );
        expect(responses.map((response) => response.replayed).sort()).toEqual([
          false,
          true,
        ]);
        expect(
          new Set(responses.map((response) => response.withdrawal.id)).size,
        ).toBe(1);
      });
      const state = await reservationState(database, owner.user.id);
      expect([
        state.requests.length,
        state.allocations.length,
        state.operations.length,
        state.actions.length,
      ]).toEqual([1, 1, 1, 1]);
    }));
  it("permits only one of two independently reviewed quotes to reserve", async () =>
    withWithdrawalDatabase(async (database, url) => {
      const owner = await reservationEmployee(database, { nonReferral: "200" });
      const quotes = await Promise.all(
        ["80", "100"].map((gross) =>
          reservationServices(database).quotes.create(owner.identity, {
            gross,
          }),
        ),
      );
      await withWithdrawalRaceClients(url, async (first, second) => {
        const start = withdrawalRaceBarrier(2);
        const responses = await Promise.allSettled(
          [first, second].map(async (client, index) => {
            await start();
            const quote = quotes[index];
            if (!quote) throw new Error("Missing race quote");
            return reservationServices(client).reservations.accept(
              owner.identity,
              { quoteId: quote.quoteId, confirmed: true },
            );
          }),
        );
        expect(
          responses.filter((result) => result.status === "fulfilled"),
        ).toHaveLength(1);
      });
      const state = await reservationState(database, owner.user.id);
      expect([
        state.requests.length,
        state.allocations.length,
        state.operations.length,
        state.actions.length,
      ]).toEqual([1, 1, 1, 1]);
      expect(
        state.wallet.availableNonReferralUnits +
          state.wallet.reservedNonReferralUnits,
      ).toBe(200000000n);
    }));
});
