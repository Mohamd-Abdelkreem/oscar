import { describe, expect, it } from "vitest";
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

describe("independent withdrawal devices", () => {
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
