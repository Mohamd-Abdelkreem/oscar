import { describe, expect, it } from "vitest";
import { withPayoutFixture } from "./testing/withdrawal-payout-fixtures.js";
import {
  reservationEmployee,
  reservationServices,
} from "./testing/withdrawal-reservation-fixtures.js";
import { provisionTreasuryPayoutKey } from "../treasury/treasury-payout-key.js";
import { changeDispatchPause } from "../custody/runtime-control.js";
import {
  payoutPolicySchema,
  storedPayoutIntent,
  assertPayoutPolicy,
  payoutIntentSchema,
} from "./withdrawal-payout.intent.js";
import { Prisma } from "@template/database";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import { signedPayoutRecordId } from "./withdrawal-payout.records.js";

describe("protected original payout", () => {
  it("denies a new claim on a controlled Baghdad weekend at both Node and migrated SQL boundaries", async () =>
    withPayoutFixture(async (fixture) => {
      const weekend = new Date("2026-10-10T09:00:00Z");
      await fixture.setTime(weekend);
      await expect(
        fixture.attempts().claim(fixture.request.id),
      ).rejects.toMatchObject({
        code: "LEDGER_INTERNAL",
        cause: { code: "PAYOUT_NOT_DISPATCHABLE" },
      });
      await expect(
        fixture.signer.$transaction(async (transaction) => {
          await fixture.admission.assertDispatchAdmission(transaction);
          return transaction.withdrawalRequest.update({
            where: { id: fixture.request.id },
            data: { state: "SIGNING", version: { increment: 1 } },
          });
        }),
      ).rejects.toThrow("Protected claim preconditions are not met");
      const sqlClock = await fixture.database.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp() AS now`;
      expect(sqlClock[0]?.now).toEqual(weekend);
      expect(await fixture.database.withdrawalAttempt.count()).toBe(0);
      expect(fixture.sent).toHaveLength(0);
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({
        state: "ACTIVE",
        nonReferralUnits: 70000000n,
        referralUnits: 30000000n,
      });
    }));
  it("recovers the independently stored signed winner after its PUT reply is lost", async () =>
    withPayoutFixture(async (fixture) => {
      const put = fixture.stores.archive.put;
      let loseReply = true;
      fixture.stores.archive.put = async (envelope) => {
        const acknowledgment = await put(envelope);
        if (envelope.type === "PAYOUT_SIGNED_ATTEMPT" && loseReply) {
          loseReply = false;
          throw new Error("Controlled lost archive PUT reply");
        }
        return acknowledgment;
      };
      await expect(fixture.attempts().sign(fixture.request.id)).rejects.toThrow(
        "Controlled lost archive PUT reply",
      );
      const interrupted =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      const retained = await fixture.stores.keys.readRecord(
        signedPayoutRecordId(interrupted.id),
      );
      if (retained === null) throw new Error("Expected original signed winner");
      expect(interrupted.signedRecordId).toBeNull();
      expect(fixture.sent).toHaveLength(0);
      const resumed = await fixture.attempts().sign(fixture.request.id);
      expect(resumed).toMatchObject({
        id: interrupted.id,
        transactionId: interrupted.transactionId,
        signedDigest: envelopeDigest(retained),
      });
      expect(fixture.built()).toBe(1);
      await fixture.attempts().broadcast(fixture.request.id);
      expect(fixture.sent).toHaveLength(1);
    }));
  it("rejects changed fixed authority, immutable key facts and independent company caps", async () =>
    withPayoutFixture(async (fixture) => {
      const attempt = await fixture.attempts().claim(fixture.request.id);
      if (attempt === null) throw new Error("Expected admitted attempt");
      const intent = storedPayoutIntent(fixture.request, attempt);
      for (const patch of [
        { employeeId: fixture.key.id },
        { walletId: fixture.key.id },
        { recipient: fixture.config.treasury },
        { addressVersion: 2 },
        { netUnits: attempt.netUnits + 1n },
        { termsHash: "a".repeat(64) },
      ])
        expect(() =>
          storedPayoutIntent({ ...fixture.request, ...patch }, attempt),
        ).toThrow();
      for (const patch of [
        { network: "TRON_SHASTA" as const },
        { source: fixture.request.recipient },
        { tokenContract: fixture.request.recipient },
        { treasuryKeyId: fixture.request.id },
        { netUnits: String(fixture.config.maximumPayoutUnits + 1n) },
        { policy: { ...intent.policy, energyFeeLimitSun: "1" } },
      ])
        expect(() => {
          assertPayoutPolicy({ ...intent, ...patch }, fixture.config);
        }).toThrow();
      expect(
        payoutIntentSchema.safeParse({
          ...intent,
          privateKey: "private-sentinel",
        }).success,
      ).toBe(false);
      await expect(
        fixture.operator.treasuryPayoutKey.update({
          where: { id: fixture.key.id },
          data: { source: fixture.request.recipient },
        }),
      ).rejects.toThrow();
      await expect(
        fixture.database.treasuryPayoutKey.update({
          where: { id: fixture.key.id },
          data: { lastFinalBlockNumber: 500n },
        }),
      ).rejects.toThrow();
      expect(fixture.sent).toHaveLength(0);
    }));
  it("holds a new lane claim behind the durable completed final-block floor", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      await fixture.attempts().reconciliation.observe(fixture.request.id);
      const acceptedAt = new Date(Date.now() - 10 * 86400000);
      const owner = await reservationEmployee(fixture.database, {
        now: acceptedAt,
      });
      const services = reservationServices(fixture.database, () => acceptedAt);
      const quote = await services.quotes.create(owner.identity, {
        gross: "100",
      });
      const accepted = await services.reservations.accept(owner.identity, {
        quoteId: quote.quoteId,
        confirmed: true,
      });
      // Pin a coherent stale floor across the two provider observations.
      const staleTimestamp = Date.now() - 1000;
      fixture.provider.solidifiedFloor = () =>
        Promise.resolve({
          number: 100,
          id: "ab".repeat(32),
          timestamp: staleTimestamp,
        });
      expect(await fixture.attempts().claim(accepted.withdrawal.id)).toBeNull();
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: accepted.withdrawal.id },
        }),
      ).toMatchObject({ state: "SCHEDULED", blocker: "PROVIDER_UNAVAILABLE" });
      expect(await fixture.database.withdrawalAttempt.count()).toBe(1);
      expect(
        await fixture.database.treasuryPayoutKey.findUniqueOrThrow({
          where: { id: fixture.key.id },
        }),
      ).toMatchObject({ lastFinalBlockNumber: 101n });
    }));
  it("retains the employee gross without an automatic top-up when company native resources are insufficient", async () =>
    withPayoutFixture(async (fixture) => {
      fixture.provider.sweepAccount = (address: string) =>
        Promise.resolve({
          address,
          balance: 0,
          owner_permission: { threshold: 1, keys: [{ address, weight: 1 }] },
        });
      expect(await fixture.attempts().claim(fixture.request.id)).toBeNull();
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "SCHEDULED", blocker: "RESOURCE_SHORTFALL" });
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({ state: "ACTIVE", grossUnits: 100000000n });
      expect(await fixture.database.withdrawalAttempt.count()).toBe(0);
      expect(fixture.built()).toBe(0);
      expect(fixture.sent).toHaveLength(0);
    }));
  it.each(["transaction_id", "signed_record_id", "broadcast_ack_id"] as const)(
    "recovers an interruption at %s attachment using the retained original identity",
    async (column) =>
      withPayoutFixture(async (fixture) => {
        if (column === "broadcast_ack_id")
          await fixture.attempts().sign(fixture.request.id);
        const clearFailure = await fixture.failAttachment(column);
        try {
          await expect(
            column === "broadcast_ack_id"
              ? fixture.attempts().broadcast(fixture.request.id)
              : fixture.attempts().sign(fixture.request.id),
          ).rejects.toThrow();
        } finally {
          await clearFailure();
        }
        const interrupted =
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { withdrawalId: fixture.request.id },
          });
        const unsigned = await fixture.stores.keys.readRecord(interrupted.id);
        expect(unsigned).not.toBeNull();
        expect(fixture.sent).toHaveLength(0);
        const signed = await fixture.attempts().sign(fixture.request.id);
        if (interrupted.transactionId !== null)
          expect(signed?.transactionId).toBe(interrupted.transactionId);
        await fixture.attempts().broadcast(fixture.request.id);
        const resumed =
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { id: interrupted.id },
          });
        expect(resumed.transactionId).toBe(signed?.transactionId);
        if (interrupted.broadcastIntentId !== null)
          expect(resumed.broadcastIntentId).toBe(interrupted.broadcastIntentId);
        expect(fixture.built()).toBe(1);
        expect(fixture.sent).toHaveLength(1);
      }),
  );
  it("keeps a committed identity UNKNOWN when all original unsigned and signed bodies are missing", async () =>
    withPayoutFixture(async (fixture) => {
      fixture.archiveFailure(true);
      await expect(
        fixture.attempts().sign(fixture.request.id),
      ).rejects.toThrow();
      const original =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      await fixture.discardLocalRecord(original.id);
      await fixture.discardLocalRecord(signedPayoutRecordId(original.id));
      fixture.archiveFailure(false);
      await expect(
        fixture.attempts().sign(fixture.request.id),
      ).rejects.toThrow();
      expect(
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { id: original.id },
        }),
      ).toMatchObject({
        state: "UNKNOWN",
        transactionId: original.transactionId,
        blocker: "RECOVERY_UNAVAILABLE",
      });
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({
        state: "UNKNOWN",
        blocker: "RECOVERY_UNAVAILABLE",
        releaseOperationId: null,
      });
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({ state: "ACTIVE" });
      expect(fixture.built()).toBe(1);
      expect(fixture.sent).toHaveLength(0);
    }));
  it("persists UNKNOWN before broadcast archive admission and forbids send without that acknowledgment", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      fixture.archiveFailure(true);
      await expect(
        fixture.attempts().broadcast(fixture.request.id),
      ).rejects.toThrow();
      const original =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      expect(original).toMatchObject({
        state: "BROADCAST_INTENT",
        broadcastAckId: null,
      });
      expect(original.broadcastIntentId).toBeTruthy();
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "UNKNOWN" });
      expect(fixture.sent).toHaveLength(0);
      fixture.archiveFailure(false);
      expect(
        await fixture.attempts().broadcast(fixture.request.id),
      ).toMatchObject({
        state: "SUBMITTED",
        broadcastIntentId: original.broadcastIntentId,
        transactionId: original.transactionId,
      });
      expect(fixture.sent).toHaveLength(1);
    }));
  it("allows concurrent claim replay but holds a competing request behind the same source lane", async () =>
    withPayoutFixture(async (fixture) => {
      const claims = await Promise.all([
        fixture.attempts().claim(fixture.request.id),
        fixture.attempts().claim(fixture.request.id),
      ]);
      expect(claims[0]?.id).toBe(claims[1]?.id);
      const acceptedAt = new Date(Date.now() - 10 * 86400000);
      const other = await reservationEmployee(fixture.database, {
        now: acceptedAt,
      });
      const services = reservationServices(fixture.database, () => acceptedAt);
      const quote = await services.quotes.create(other.identity, {
        gross: "100",
      });
      const accepted = await services.reservations.accept(other.identity, {
        quoteId: quote.quoteId,
        confirmed: true,
      });
      expect(await fixture.attempts().claim(accepted.withdrawal.id)).toBeNull();
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: accepted.withdrawal.id },
        }),
      ).toMatchObject({ state: "SCHEDULED", blocker: "TREASURY_BUSY" });
      expect(await fixture.database.withdrawalAttempt.count()).toBe(1);
      const original = claims[0];
      if (original === null) throw new Error("Expected admitted attempt");
      for (const patch of [
        { recipient: fixture.config.treasury },
        { netUnits: original.netUnits + 1n },
        { termsHash: "a".repeat(64) },
        { treasuryKeyId: "8f4be6e1-6b22-4c54-b9ec-9af1ba7bff15" },
      ])
        await expect(
          fixture.signer.withdrawalAttempt.update({
            where: { id: original.id },
            data: { ...patch, version: { increment: 1 } },
          }),
        ).rejects.toThrow();
      await expect(
        fixture.signer.withdrawalAttempt.create({
          data: {
            ...original,
            id: "8f4be6e1-6b22-4c54-b9ec-9af1ba7bff15",
            policySnapshot: payoutPolicySchema.parse(original.policySnapshot),
            finalEvidence: Prisma.DbNull,
          },
        }),
      ).rejects.toThrow();
      expect(
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { id: original.id },
        }),
      ).toEqual(original);
    }));
  it("provisions the acknowledged immutable company key idempotently and rejects signer provisioning or another source", async () =>
    withPayoutFixture(async (fixture) => {
      const context = {
        stores: fixture.stores,
        operatorIdentity: "disposable-replay",
        input: {
          operation: "PROVISION_PAYOUT_KEY",
          privateKey: "11".repeat(32),
          reason: "Replay",
        },
      };
      expect(
        await provisionTreasuryPayoutKey(
          fixture.operator,
          fixture.config,
          context,
        ),
      ).toEqual(fixture.key);
      await expect(
        provisionTreasuryPayoutKey(fixture.signer, fixture.config, context),
      ).rejects.toThrow();
      await expect(
        provisionTreasuryPayoutKey(fixture.operator, fixture.config, {
          ...context,
          input: { ...context.input, privateKey: "22".repeat(32) },
        }),
      ).rejects.toThrow("PAYOUT_KEY_CONFLICT");
      fixture.archiveFailure(true);
      await expect(
        provisionTreasuryPayoutKey(
          fixture.operator,
          { ...fixture.config, treasuryKeyId: fixture.request.id },
          context,
        ),
      ).rejects.toThrow("Controlled archive unavailable");
      expect(
        await fixture.stores.keys.readRecord(fixture.request.id),
      ).not.toBeNull();
      expect(await fixture.database.treasuryPayoutKey.count()).toBe(1);
    }));
  it("observes and settles after new-dispatch pause while denying a new claim", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      await changeDispatchPause(fixture.database, {
        action: "PAUSE",
        operatorIdentity: "disposable-test",
        reason: "Observe only",
      });
      expect(
        await fixture.attempts().reconciliation.observe(fixture.request.id),
      ).toMatchObject({ state: "COMPLETED" });
      expect(fixture.sent).toHaveLength(1);
    }));
  it("archives one original attempt before send and settles a lost reply without another payment", async () =>
    withPayoutFixture(async (fixture) => {
      const { request, database } = fixture;
      const signed = await fixture.attempts().sign(request.id);
      expect(signed).toMatchObject({
        state: "SIGNED",
        netUnits: request.netUnits,
      });
      expect(signed?.signedAckId).toBeTruthy();
      expect(fixture.sent).toHaveLength(0);
      fixture.loseReply();
      expect(await fixture.attempts().broadcast(request.id)).toMatchObject({
        state: "UNKNOWN",
        transactionId: signed?.transactionId,
      });
      expect(fixture.sent).toHaveLength(1);
      expect(
        await fixture.attempts().reconciliation.observe(request.id),
      ).toMatchObject({ state: "COMPLETED" });
      expect(await fixture.attempts().broadcast(request.id)).toMatchObject({
        state: "CONFIRMED_SUCCESS",
        transactionId: signed?.transactionId,
      });
      expect(fixture.sent).toHaveLength(1);
      expect(fixture.built()).toBe(1);
      expect(await database.withdrawalAttempt.count()).toBe(1);
    }));
  it("holds all employee sources on low company liquidity without creating or sending an attempt", async () =>
    withPayoutFixture(async (fixture) => {
      fixture.liquidity(0n);
      expect(await fixture.attempts().claim(fixture.request.id)).toBeNull();
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "SCHEDULED", blocker: "LIQUIDITY_SHORTFALL" });
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({ state: "ACTIVE", grossUnits: 100000000n });
      expect(await fixture.database.withdrawalAttempt.count()).toBe(0);
      expect(fixture.sent).toHaveLength(0);
    }));
  it("denies send on missing archive acknowledgment and resumes with the retained original signed bytes", async () =>
    withPayoutFixture(async (fixture) => {
      fixture.archiveFailure(true);
      await expect(fixture.attempts().sign(fixture.request.id)).rejects.toThrow(
        "Controlled archive unavailable",
      );
      const prepared =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      expect(prepared.transactionId).toBeTruthy();
      expect(prepared.signedAckId).toBeNull();
      expect(fixture.sent).toHaveLength(0);
      fixture.archiveFailure(false);
      const recovered = await fixture.attempts().sign(fixture.request.id);
      expect(recovered?.transactionId).toBe(prepared.transactionId);
      expect(fixture.built()).toBe(1);
    }));
});
