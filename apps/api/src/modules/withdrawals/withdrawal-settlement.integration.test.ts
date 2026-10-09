import { describe, expect, it } from "vitest";
import {
  withPayoutFixture,
  withPayoutSigners,
} from "./testing/withdrawal-payout-fixtures.js";
import { withdrawalRaceBarrier } from "./testing/withdrawal-fixtures.js";
import { WithdrawalSettlementService } from "./withdrawal-settlement.service.js";
import { fenceFinancialRuntime } from "../custody/runtime-control.js";
import { TronWeb, utils } from "tronweb";

describe("canonical original gross settlement", () => {
  // Nile 2026-10-08 returns the SDK's uppercase signature as lowercase hex.
  it.each(["HEX_CASE", "DIFFERENT_BYTES"] as const)(
    "accepts signature hex case but preserves original signed bytes: %s",
    async (encoding) =>
      withPayoutFixture(async (fixture) => {
        await fixture.attempts().sign(fixture.request.id);
        await fixture.attempts().broadcast(fixture.request.id);
        const original = fixture.sent[0];
        const signature = original?.signature?.[0];
        if (original === undefined || signature === undefined)
          throw new Error("Missing actual signed payout");
        const recovery = Number.parseInt(signature.slice(-2), 16);
        const observedSignature =
          encoding === "HEX_CASE"
            ? signature.toLowerCase()
            : signature.slice(0, -2) +
              (recovery >= 27 ? recovery - 27 : recovery + 27)
                .toString(16)
                .padStart(2, "0");
        expect(
          TronWeb.address.fromHex(
            utils.crypto.ecRecover(original.txID, observedSignature),
          ),
        ).toBe(fixture.config.treasury);
        const canonicalTransaction = fixture.provider.transaction;
        fixture.provider.transaction = async (id) => ({
          ...(await canonicalTransaction(id)),
          signature: [observedSignature],
        });
        const observation = fixture
          .attempts()
          .reconciliation.observe(fixture.request.id);
        if (encoding === "HEX_CASE") {
          await expect(observation).resolves.toMatchObject({
            state: "COMPLETED",
          });
        } else {
          await expect(observation).rejects.toThrow("PAYOUT_IDENTITY_CONFLICT");
          expect(
            await fixture.database.reservationAllocation.findUniqueOrThrow({
              where: { id: fixture.request.reservationId },
            }),
          ).toMatchObject({ state: "ACTIVE", releaseOperationId: null });
        }
        expect(
          await fixture.database.financialOperation.count({
            where: { kind: "SETTLE" },
          }),
        ).toBe(encoding === "HEX_CASE" ? 1 : 0);
        expect(fixture.sent).toHaveLength(1);
      }),
  );
  it("observes and settles the original payment on a Baghdad weekend", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      await fixture.setTime(new Date("2026-10-10T12:00:00Z"));
      expect(
        await fixture.attempts().reconciliation.observe(fixture.request.id),
      ).toMatchObject({ state: "COMPLETED" });
      expect(fixture.sent).toHaveLength(1);
    }));
  it("retains all money when canonical observation reaches a financial mutation fence", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      await fenceFinancialRuntime(fixture.database, {
        operatorIdentity: "disposable-test",
        reason: "Controlled financial fence",
      });
      await expect(
        fixture.attempts().reconciliation.observe(fixture.request.id),
      ).rejects.toThrow();
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({ state: "ACTIVE" });
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "SUBMITTED", settlementOperationId: null });
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "SETTLE" },
        }),
      ).toBe(0);
    }));
  it("settles 70/30 once, charges the snapshotted fee, and leaves company chain costs outside employee postings", async () =>
    withPayoutFixture(async (fixture) =>
      withPayoutSigners(fixture, async (first, second) => {
        await first.sign(fixture.request.id);
        await first.broadcast(fixture.request.id);
        const original =
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { withdrawalId: fixture.request.id },
          });
        const barrier = withdrawalRaceBarrier(2);
        const canonicalBlock = fixture.provider.transactionBlock;
        let readers = 0;
        fixture.provider.transactionBlock = async () => {
          readers++;
          await barrier();
          return canonicalBlock();
        };
        try {
          const replies = await Promise.all([
            first.reconciliation.observe(fixture.request.id),
            second.reconciliation.observe(fixture.request.id),
          ]);
          expect(readers).toBe(2);
          expect(replies.map((reply) => reply.state)).toEqual([
            "COMPLETED",
            "COMPLETED",
          ]);
        } finally {
          fixture.provider.transactionBlock = canonicalBlock;
        }
        const operation =
          await fixture.database.financialOperation.findUniqueOrThrow({
            where: {
              kind_businessNamespace_businessKey: {
                kind: "SETTLE",
                businessNamespace: "p08.withdrawal.settle",
                businessKey: fixture.request.id,
              },
            },
            include: { postings: true, audit: true },
          });
        expect(operation).toMatchObject({
          kind: "SETTLE",
          origin: "WITHDRAWAL_SETTLEMENT",
          magnitudeUnits: 100000000n,
        });
        expect(operation.postings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              source: "NON_REFERRAL",
              availableDeltaUnits: 0n,
              reservedDeltaUnits: -70000000n,
            }),
            expect.objectContaining({
              source: "REFERRAL",
              availableDeltaUnits: 0n,
              reservedDeltaUnits: -30000000n,
            }),
          ]),
        );
        expect(operation.postings).toHaveLength(2);
        expect(operation.audit).not.toBeNull();
        expect(
          await fixture.database.wallet.findUniqueOrThrow({
            where: { id: fixture.request.walletId },
          }),
        ).toMatchObject({
          reservedNonReferralUnits: 0n,
          reservedReferralUnits: 0n,
          availableNonReferralUnits: 0n,
          availableReferralUnits: 20000000n,
        });
        expect(
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        ).toMatchObject({
          state: "SETTLED",
          settlementOperationId: operation.id,
          releaseOperationId: null,
        });
        expect(
          await fixture.database.withdrawalAction.count({
            where: { requestId: fixture.request.id, kind: "COMPLETE" },
          }),
        ).toBe(1);
        expect(fixture.sent).toHaveLength(1);
        expect(
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { id: original.id },
          }),
        ).toMatchObject({
          state: "CONFIRMED_SUCCESS",
          transactionId: original.transactionId,
          signedDigest: original.signedDigest,
          recipient: fixture.request.recipient,
          netUnits: 79000000n,
        });
        expect(await fixture.database.withdrawalAttempt.count()).toBe(1);
        expect(
          await fixture.database.withdrawalAttempt.count({
            where: {
              network: original.network,
              tokenContract: original.tokenContract,
              source: original.source,
              state: { notIn: ["CONFIRMED_SUCCESS", "CHAIN_FAILED"] },
            },
          }),
        ).toBe(0);
        expect(
          await fixture.database.financialOperation.count({
            where: { kind: "RELEASE" },
          }),
        ).toBe(0);
        expect(fixture.sent[0]?.txID).toBe(original.transactionId);
        expect(fixture.request).toMatchObject({
          grossUnits: 100000000n,
          feeUnits: 21000000n,
          netUnits: 79000000n,
        });
      }),
    ));
  it("replays a completed original observation without another posting or terminal action", async () =>
    withPayoutFixture(async (fixture) => {
      const attempts = fixture.attempts();
      await attempts.sign(fixture.request.id);
      await attempts.broadcast(fixture.request.id);
      await attempts.reconciliation.observe(fixture.request.id);
      const terminal =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      expect(
        await attempts.reconciliation.observe(fixture.request.id),
      ).toMatchObject({ state: "COMPLETED" });
      expect(
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { id: terminal.id },
        }),
      ).toEqual(terminal);
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "SETTLE" },
        }),
      ).toBe(1);
      expect(
        await fixture.database.ledgerPosting.count({
          where: { operation: { kind: "SETTLE" } },
        }),
      ).toBe(2);
      expect(
        await fixture.database.withdrawalAction.count({
          where: { kind: "COMPLETE" },
        }),
      ).toBe(1);
      expect(fixture.sent).toHaveLength(1);
    }));
  it.each(["CONFIRMED_SUCCESS", "CHAIN_FAILED"] as const)(
    "rejects caller-invented %s before any database mutation",
    async (outcome) =>
      withPayoutFixture(async (fixture) => {
        const settlement = new WithdrawalSettlementService(
          fixture.attempts().transactions,
        );
        expect(() =>
          (outcome === "CHAIN_FAILED"
            ? settlement.fail.bind(settlement)
            : settlement.settle.bind(settlement))(fixture.request.id, {
            transactionId: "a".repeat(64),
            network: "TRON_NILE",
            tokenContract: fixture.config.token.contract,
            source: fixture.config.treasury,
            recipient: fixture.request.recipient,
            amountUnits: "79000000",
            blockId: "b".repeat(64),
            blockNumber: "101",
            intentHash: fixture.request.termsHash,
            outcome,
            evidenceDigest: "c".repeat(64),
          }),
        ).toThrow("PAYOUT_EVIDENCE_UNVERIFIED");
        expect(
          await fixture.database.financialOperation.count({
            where: { kind: { in: ["SETTLE", "RELEASE"] } },
          }),
        ).toBe(0);
      }),
  );
  it("rolls back every terminal write when the dependent COMPLETE action fails, then settles on retry", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      const before = {
        attempt: await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        }),
        request: await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
        wallet: await fixture.database.wallet.findUniqueOrThrow({
          where: { id: fixture.request.walletId },
        }),
        allocation:
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        key: await fixture.database.treasuryPayoutKey.findUniqueOrThrow({
          where: { id: fixture.key.id },
        }),
      };
      await fixture.database.$executeRawUnsafe(
        "CREATE FUNCTION p08_test_complete_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='COMPLETE' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='controlled dependent action failure'; END IF; RETURN NEW; END $$",
      );
      await fixture.database.$executeRawUnsafe(
        "CREATE TRIGGER p08_test_complete_failure AFTER INSERT ON withdrawal_actions FOR EACH ROW EXECUTE FUNCTION p08_test_complete_failure()",
      );
      try {
        await expect(
          fixture.attempts().reconciliation.observe(fixture.request.id),
        ).rejects.toThrow();
      } finally {
        await fixture.database.$executeRawUnsafe(
          "DROP TRIGGER p08_test_complete_failure ON withdrawal_actions",
        );
        await fixture.database.$executeRawUnsafe(
          "DROP FUNCTION p08_test_complete_failure()",
        );
      }
      expect(
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        }),
      ).toEqual(before.attempt);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toEqual(before.request);
      expect(
        await fixture.database.wallet.findUniqueOrThrow({
          where: { id: fixture.request.walletId },
        }),
      ).toEqual(before.wallet);
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toEqual(before.allocation);
      expect(
        await fixture.database.treasuryPayoutKey.findUniqueOrThrow({
          where: { id: fixture.key.id },
        }),
      ).toEqual(before.key);
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "SETTLE" },
        }),
      ).toBe(0);
      expect(
        await fixture.attempts().reconciliation.observe(fixture.request.id),
      ).toMatchObject({ state: "COMPLETED" });
    }));
  it.each([
    "WRONG_NET",
    "REVERT",
    "NONFINAL",
    "MISSING",
    "DISAPPEARING",
    "MALFORMED",
  ] as const)(
    "rejects %s evidence and keeps the original reservation active",
    async (outcome) =>
      withPayoutFixture(async (fixture) => {
        await fixture.attempts().sign(fixture.request.id);
        await fixture.attempts().broadcast(fixture.request.id);
        fixture.outcome(outcome);
        await expect(
          fixture.attempts().reconciliation.observe(fixture.request.id),
        ).rejects.toThrow();
        expect(
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        ).toMatchObject({ state: "ACTIVE" });
        expect(
          await fixture.database.financialOperation.count({
            where: { kind: "SETTLE" },
          }),
        ).toBe(0);
        expect(
          await fixture.database.withdrawalRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
          }),
        ).toMatchObject({
          state: "SUBMITTED",
          settlementOperationId: null,
          releaseOperationId: null,
        });
      }),
  );
});
