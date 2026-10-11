import { describe, expect, it } from "vitest";
import { withWithdrawalDatabase } from "./testing/withdrawal-fixtures.js";
import {
  reservationEmployee,
  reservationServices,
  reservationState,
  RESERVATION_NOW,
  RESERVATION_CAPABILITY,
  closeReservationFixture,
} from "./testing/withdrawal-reservation-fixtures.js";
import { fundSubscriptionFixture } from "../subscriptions/testing/subscription-fixtures.js";
import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import { withWithdrawalRole } from "./testing/withdrawal-authority-fixtures.js";
import { readWithdrawalFacts } from "./withdrawal-quote.service.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { changeDispatchPause } from "../custody/runtime-control.js";
import { WithdrawalReservationService } from "./withdrawal-reservation.service.js";

describe("accepted gross withdrawal reservation", () => {
  it("replays the original closed request without restoring an active reservation", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database);
      const services = reservationServices(database);
      const quote = await services.quotes.create(owner.identity, {
        gross: "100",
      });
      const saved = await services.reservations.accept(owner.identity, {
        quoteId: quote.quoteId,
        confirmed: true,
      });
      await closeReservationFixture(database, quote.quoteId);
      const before = await reservationState(database, owner.user.id);
      const replay = await services.reservations.accept(
        owner.identity,
        { quoteId: quote.quoteId, confirmed: true },
        "closed-replay",
      );
      expect(replay).toMatchObject({
        replayed: true,
        withdrawal: {
          id: saved.withdrawal.id,
          state: "REJECTED",
          release: { gross: "100", chargedFee: "0" },
        },
      });
      expect(await reservationState(database, owner.user.id)).toEqual(before);
      const nextQuote = await services.quotes.create(owner.identity, {
        gross: "100",
      });
      expect(nextQuote.canAccept).toBe(true);
      const next = await services.reservations.accept(owner.identity, {
        quoteId: nextQuote.quoteId,
        confirmed: true,
      });
      expect(next.withdrawal.id).not.toBe(saved.withdrawal.id);
      const activeBefore = await reservationState(database, owner.user.id);
      expect(
        await services.reservations.accept(owner.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        }),
      ).toMatchObject({
        replayed: true,
        withdrawal: { id: saved.withdrawal.id, state: "REJECTED" },
      });
      expect(await reservationState(database, owner.user.id)).toEqual(
        activeBefore,
      );
    }));
  it("rejects changed configured network and missing destination without financial effects", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database);
      const quote = await reservationServices(database).quotes.create(
        owner.identity,
        { gross: "100" },
      );
      const { WithdrawalReservationService } =
        await import("./withdrawal-reservation.service.js");
      await expect(
        new WithdrawalReservationService(database, {
          clock: () => RESERVATION_NOW,
          admission: financialFixtureAdmission(database),
          network: "TRON_MAINNET",
          capability: { ...RESERVATION_CAPABILITY, network: "TRON_MAINNET" },
        }).accept(owner.identity, { quoteId: quote.quoteId, confirmed: true }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_QUOTE_STALE" });
      const unset = await createIdentityFixture(database, {
        now: RESERVATION_NOW,
      });
      await expect(
        reservationServices(database).quotes.create(
          { userId: unset.user.id, sessionId: unset.session.id },
          { gross: "100" },
        ),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_DESTINATION_REQUIRED" });
      expect(await database.withdrawalRequest.count()).toBe(0);
    }));
  it.each(["SCHEDULED", "SIGNING", "SIGNED", "SUBMITTED", "UNKNOWN"])(
    "keeps %s nonaccepting under the actual material-facts reader",
    async (state) =>
      withWithdrawalDatabase(async (database) => {
        const owner = await reservationEmployee(database, {
          nonReferral: "200",
        });
        const services = reservationServices(database);
        const quote = await services.quotes.create(owner.identity, {
          gross: "80",
        });
        const saved = await services.reservations.accept(owner.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        });
        const rollback = new Error(
          "Disposable future-state inspection rollback",
        );
        // The migrator inspects future public active states in a rolled-back fixture; no payout or claim is executed.
        await expect(
          database.$transaction(async (transaction) => {
            await transaction.$executeRawUnsafe(
              "ALTER TABLE withdrawal_requests DISABLE TRIGGER guard_p08_request",
            );
            await transaction.$executeRaw`UPDATE withdrawal_requests SET state=${state} WHERE id=${saved.withdrawal.id}::uuid`;
            const facts = await readWithdrawalFacts(
              transaction,
              owner.user.id,
              "100",
              RESERVATION_NOW,
              "TRON_NILE",
            );
            expect(facts.material).toMatchObject({
              canAccept: false,
              blockReason: "WITHDRAWAL_ACTIVE",
            });
            throw rollback;
          }),
        ).rejects.toBe(rollback);
        expect(
          (
            await database.withdrawalRequest.findUniqueOrThrow({
              where: { id: saved.withdrawal.id },
            })
          ).state,
        ).toBe("SCHEDULED");
        expect(await database.reservationAllocation.count()).toBe(1);
      }),
  );
  it("reserves through the actual production API role grants", async () =>
    withWithdrawalDatabase(async (database, databaseUrl) => {
      const owner = await reservationEmployee(database);
      await withWithdrawalRole(
        { database, databaseUrl, role: "p06_api" },
        async (runtime) => {
          const { WithdrawalQuoteService } =
            await import("./withdrawal-quote.service.js");
          const { WithdrawalReservationService } =
            await import("./withdrawal-reservation.service.js");
          const options = {
            capability: RESERVATION_CAPABILITY,
            network: "TRON_NILE" as const,
            clock: () => RESERVATION_NOW,
            admission: financialFixtureAdmission(database),
          };
          const quote = await new WithdrawalQuoteService(
            runtime,
            options,
          ).create(owner.identity, { gross: "100" });
          const saved = await new WithdrawalReservationService(runtime, {
            clock: options.clock,
            capability: options.capability,
            admission: options.admission,
            network: options.network,
          }).accept(owner.identity, {
            quoteId: quote.quoteId,
            confirmed: true,
          });
          expect(saved).toMatchObject({
            withdrawal: { gross: "100", fee: "21", net: "79" },
          });
          const { WithdrawalsService } =
            await import("./withdrawals.service.js");
          const reads = new WithdrawalsService(runtime, options.clock);
          expect(await reads.history(owner.identity, {})).toMatchObject({
            pagination: { total: 1 },
          });
          expect(
            await reads.outcome(owner.identity, quote.quoteId),
          ).toMatchObject({ status: "COMMITTED" });
          for (const sql of [
            "UPDATE users SET role='ADMIN'",
            "UPDATE withdrawal_policy SET free_fee_bps=0",
            "UPDATE financial_runtime_control SET financial_writes_fenced=false",
            "UPDATE financial_operations SET magnitude_units=1",
            "UPDATE withdrawal_quotes SET id=id",
          ])
            await expect(runtime.$executeRawUnsafe(sql)).rejects.toMatchObject({
              code: "P2010",
            });
          expect(
            await reads.detail(owner.identity, saved.withdrawal.id),
          ).toMatchObject({ state: "SCHEDULED", gross: "100" });
        },
      );
    }));
  it.each([
    "balance",
    "policy",
    "bounds",
    "zero net",
    "withdrawal block",
    "session revocation",
  ])(
    "rejects changed %s authority without new reservation effects",
    async (change) =>
      withWithdrawalDatabase(async (database) => {
        const owner = await reservationEmployee(database);
        const service = reservationServices(database);
        const quote = await service.quotes.create(owner.identity, {
          gross: "80",
        });
        if (change === "balance")
          await fundSubscriptionFixture(
            database,
            owner,
            { nonReferral: "1", referral: "0" },
            {
              now: RESERVATION_NOW,
              admission: financialFixtureAdmission(database),
            },
          );
        if (change === "policy")
          await database.withdrawalPolicy.update({
            where: { id: 1 },
            data: { freeFeeBps: 2000, version: { increment: 1 } },
          });
        if (change === "bounds")
          await database.withdrawalPolicy.update({
            where: { id: 1 },
            data: { maximumGrossUnits: 70000000n, version: { increment: 1 } },
          });
        if (change === "zero net")
          await database.withdrawalPolicy.update({
            where: { id: 1 },
            data: { freeFeeBps: 10000, version: { increment: 1 } },
          });
        if (change === "withdrawal block")
          await database.user.update({
            where: { id: owner.user.id },
            data: { withdrawalsBlocked: true },
          });
        if (change === "session revocation")
          await database.authSession.update({
            where: { id: owner.session.id },
            data: { revokedAt: RESERVATION_NOW },
          });
        const before = await reservationState(database, owner.user.id);
        await expect(
          service.reservations.accept(owner.identity, {
            quoteId: quote.quoteId,
            confirmed: true,
          }),
        ).rejects.toMatchObject({
          code:
            change === "withdrawal block"
              ? "WITHDRAWAL_BLOCKED"
              : change === "session revocation"
                ? "UNAUTHORIZED"
                : "WITHDRAWAL_QUOTE_STALE",
        });

        expect(await reservationState(database, owner.user.id)).toEqual(before);
      }),
  );
  it("rejects saved paid eligibility at exact expiry and preserves an already accepted request", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database, {
        paid: true,
        nonReferral: "70",
        referral: "30",
      });
      const subscription = await database.subscription.findFirstOrThrow({
        where: { ownerUserId: owner.user.id, state: "CURRENT" },
      });
      let now = new Date(subscription.expiresAt.getTime() - 1000);
      await database.authSession.update({
        where: { id: owner.session.id },
        data: {
          expiresAt: new Date(subscription.expiresAt.getTime() + 86400000),
        },
      });
      const service = reservationServices(database, () => now);
      const quote = await service.quotes.create(owner.identity, {
        gross: "80",
      });
      now = subscription.expiresAt;
      await expect(
        service.reservations.accept(owner.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_QUOTE_STALE" });
      now = new Date(subscription.expiresAt.getTime() - 500);
      const acceptedQuote = await service.quotes.create(owner.identity, {
        gross: "80",
      });
      const accepted = await service.reservations.accept(owner.identity, {
        quoteId: acceptedQuote.quoteId,
        confirmed: true,
      });
      now = subscription.expiresAt;
      const { WithdrawalsService } = await import("./withdrawals.service.js");
      expect(
        await new WithdrawalsService(database, () => now).detail(
          owner.identity,
          accepted.withdrawal.id,
        ),
      ).toMatchObject({
        state: "SCHEDULED",
        effectiveMembership: "PAID",
        sourceAllocation: { nonReferral: "70", referral: "10" },
      });
    }));
  it("binds every fresh request key to the original quote and rejects conflicting intent", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database, { nonReferral: "200" });
      let now = RESERVATION_NOW;
      const service = reservationServices(database, () => now);
      const first = await service.quotes.create(owner.identity, {
        gross: "80",
      });
      const second = await service.quotes.create(owner.identity, {
        gross: "100",
      });
      const accepted = await service.reservations.accept(
        owner.identity,
        { quoteId: first.quoteId, confirmed: true },
        "first-key",
      );
      now = new Date(RESERVATION_NOW.getTime() + 601000);
      expect(
        await service.reservations.accept(
          owner.identity,
          { quoteId: first.quoteId, confirmed: true },
          "second-key",
        ),
      ).toMatchObject({
        replayed: true,
        withdrawal: { id: accepted.withdrawal.id },
      });
      const before = await reservationState(database, owner.user.id);
      for (const key of ["first-key", "second-key"])
        await expect(
          service.reservations.accept(
            owner.identity,
            { quoteId: second.quoteId, confirmed: true },
            key,
          ),
        ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
      expect(await reservationState(database, owner.user.id)).toEqual(before);
    }));
  it("reserves the exact paid 70/10 sources once and preserves immutable terms across replay", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database, {
        paid: true,
        nonReferral: "70",
        referral: "30",
      });
      const service = reservationServices(database);
      const quote = await service.quotes.create(owner.identity, {
        gross: "80",
      });
      expect(quote).toMatchObject({
        canAccept: true,
        fundedAllocation: { nonReferral: "70", referral: "10", total: "80" },
      });
      const accepted = await service.reservations.accept(
        owner.identity,
        { quoteId: quote.quoteId, confirmed: true },
        "accepted-key",
      );
      expect(accepted).toMatchObject({
        replayed: false,
        withdrawal: {
          gross: "80",
          sourceAllocation: { nonReferral: "70", referral: "10", gross: "80" },
          state: "SCHEDULED",
        },
      });
      for (const key of ["accepted-key", "fresh-key", undefined])
        expect(
          await service.reservations.accept(
            owner.identity,
            { quoteId: quote.quoteId, confirmed: true },
            key,
          ),
        ).toMatchObject({
          replayed: true,
          withdrawal: { id: accepted.withdrawal.id },
        });
      await changeDispatchPause(database, {
        action: "PAUSE",
        operatorIdentity: "test-recovery",
        reason: "Observe original reserved winner",
      });
      const disabled = new WithdrawalReservationService(database, {
        clock: () => RESERVATION_NOW,
        network: undefined,
        admission: financialFixtureAdmission(database),
      });
      expect(
        await disabled.accept(
          owner.identity,
          { quoteId: quote.quoteId, confirmed: true },
          "accepted-key",
        ),
      ).toMatchObject({
        replayed: true,
        withdrawal: { id: accepted.withdrawal.id },
      });
      const state = await reservationState(database, owner.user.id);
      expect(state.wallet).toMatchObject({
        availableNonReferralUnits: 0n,
        availableReferralUnits: 20000000n,
        reservedNonReferralUnits: 70000000n,
        reservedReferralUnits: 10000000n,
      });
      expect([
        state.requests.length,
        state.allocations.length,
        state.actions.length,
        state.operations.length,
        state.audit.length,
      ]).toEqual([1, 1, 1, 1, 1]);
      expect(state.postings).toHaveLength(2);
    }));
  it("returns a truthful Free partial preview without reserving locked referral funds", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database, {
        nonReferral: "70",
        referral: "30",
      });
      const service = reservationServices(database);
      const quote = await service.quotes.create(owner.identity, {
        gross: "100",
      });
      expect(quote).toMatchObject({
        fee: "21",
        net: "79",
        eligibleReferral: "0",
        canAccept: false,
        requiredTopUp: "30",
        blockReason: "INSUFFICIENT_FUNDS",
      });
      const before = await reservationState(database, owner.user.id);
      await expect(
        service.reservations.accept(owner.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_QUOTE_STALE" });
      expect(await reservationState(database, owner.user.id)).toEqual(before);
    }));
  it("keeps configured quote expiry immutable and rejects at its exclusive boundary", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database);
      let now = RESERVATION_NOW;
      const service = reservationServices(database, () => now, 75);
      const quote = await service.quotes.create(owner.identity, {
        gross: "100",
      });
      expect(quote.quoteExpiresAt).toBe(
        new Date(now.getTime() + 75000).toISOString(),
      );
      const changed = reservationServices(database, () => now, 3600);
      now = new Date(now.getTime() + 75000);
      await expect(
        changed.reservations.accept(owner.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_QUOTE_STALE" });
      expect(
        (
          await database.withdrawalQuote.findUniqueOrThrow({
            where: { id: quote.quoteId },
          })
        ).expiresAt.toISOString(),
      ).toBe(quote.quoteExpiresAt);
      expect(await database.withdrawalRequest.count()).toBe(0);
    }));
  it("rolls back ledger, allocation and request when the matching action write fails", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database);
      const service = reservationServices(database);
      const quote = await service.quotes.create(owner.identity, {
        gross: "100",
      });
      const before = await reservationState(database, owner.user.id);
      await database.$executeRawUnsafe(
        "CREATE FUNCTION p08_fail_accept() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled action failure'; END $$",
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER p08_fail_accept BEFORE INSERT ON withdrawal_actions FOR EACH ROW EXECUTE FUNCTION p08_fail_accept()",
      );
      await expect(
        service.reservations.accept(owner.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        }),
      ).rejects.toMatchObject({ code: "LEDGER_INTERNAL" });
      expect(await reservationState(database, owner.user.id)).toEqual(before);
    }));
});
