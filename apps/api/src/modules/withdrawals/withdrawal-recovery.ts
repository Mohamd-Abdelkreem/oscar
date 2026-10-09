import { TronWeb } from "tronweb";
import type {
  DatabaseClient,
  WithdrawalAttempt,
  WithdrawalRequest,
} from "@template/database";
import { verifyRecoveredFinancialHistory } from "../custody/recovery-history.js";
import { hasIndependentRecoveryAuthority } from "../custody/recovery-authority.js";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import type { SshRecoveryStore } from "../../infrastructure/custody/recovery-store.js";
import { treasuryKeyPayloadSchema } from "../treasury/treasury-payout-key.js";
import {
  retainedPayoutRecord,
  acknowledgePayoutRecord,
  type PayoutStores,
} from "./payout-records.js";
import {
  broadcastPayoutSchema,
  broadcastPayoutPayload,
  validateBroadcastPayoutRecord,
  retainedSignedPayout,
  validateUnsignedPayoutRecord,
  signedPayoutSchema,
  validateSignedPayoutRecord,
  signedPayoutRecordId,
} from "./withdrawal-payout.records.js";
import {
  verifyOriginalPayout,
  type PayoutObservationProvider,
} from "./withdrawal-reconciliation.evidence.js";

export type PayoutRecoveryAdmission = Readonly<{
  generation: bigint;
  version: number;
  fingerprint: string;
}>;
const verifiedInventories = new WeakSet<PayoutRecoveryAdmission>();
type RecoveredHistory = Parameters<typeof verifyRecoveredFinancialHistory>[1];
export function assertPayoutRecoveryAdmission(
  evidence: PayoutRecoveryAdmission,
) {
  if (!verifiedInventories.has(evidence))
    throw new TreasuryPolicyError("PAYOUT_EVIDENCE_UNVERIFIED");
}

// Recovery validates/restores retained bytes; financial outcomes still require canonical observation and admission.
export class WithdrawalRecovery {
  constructor(
    private readonly database: DatabaseClient,
    private readonly stores: PayoutStores,
  ) {}

  async verifyAdmission(
    provider: PayoutObservationProvider,
    archive: {
      list: (
        cursor: string | undefined,
        type:
          "TREASURY_KEY" | "PAYOUT_SIGNED_ATTEMPT" | "PAYOUT_BROADCAST_INTENT",
      ) => ReturnType<SshRecoveryStore["list"]>;
    },
  ): Promise<PayoutRecoveryAdmission> {
    const control =
      await this.database.financialRuntimeControl.findUniqueOrThrow({
        where: { id: 1 },
      });
    if (!control.financialWritesFenced)
      throw new TreasuryPolicyError("PAYOUT_STATE_CONFLICT");
    const [before] = await this.database.$queryRaw<
      { fingerprint: string }[]
    >`SELECT p08_recovery_fingerprint() AS fingerprint`;
    if (before === undefined)
      throw new TreasuryPolicyError("RECOVERY_UNAVAILABLE");
    await this.assertInventory(archive);
    let after: string | undefined;
    for (;;) {
      const attempts: WithdrawalAttempt[] =
        await this.database.withdrawalAttempt.findMany({
          take: 100,
          orderBy: { id: "asc" },
          ...(after === undefined ? {} : { where: { id: { gt: after } } }),
        });
      if (attempts.length === 0) break;
      for (const attempt of attempts) {
        const key = await this.database.treasuryPayoutKey.findUniqueOrThrow({
          where: { id: attempt.treasuryKeyId },
        });
        if (attempt.broadcastAckId !== null) {
          const request =
            await this.database.withdrawalRequest.findUniqueOrThrow({
              where: { id: attempt.withdrawalId },
            });
          const signed = await retainedSignedPayout(
            this.stores,
            request,
            attempt,
          );
          const canonical = await verifyOriginalPayout({
            provider,
            request,
            attempt,
            retainedSigned: signed.record.transaction,
            now: new Date(),
          });
          if (
            attempt.finalBlockNumber !== null
              ? attempt.finalBlockNumber !== BigInt(canonical.blockNumber) ||
                attempt.finalBlockId !== canonical.blockId ||
                attempt.state !== canonical.outcome ||
                key.lastFinalBlockNumber < attempt.finalBlockNumber
              : BigInt(canonical.blockNumber) < key.lastFinalBlockNumber
          )
            throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
        } else if (attempt.initialFloorNumber < key.lastFinalBlockNumber) {
          throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
        }
      }
      after = attempts.at(-1)?.id;
    }
    const [current] = await this.database.$queryRaw<
      { fingerprint: string }[]
    >`SELECT p08_recovery_fingerprint() AS fingerprint`;
    if (current?.fingerprint !== before.fingerprint)
      throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
    const evidence = Object.freeze({
      generation: control.generation,
      version: control.version,
      fingerprint: before.fingerprint,
    });
    verifiedInventories.add(evidence);
    return evidence;
  }

  async assertInventory(
    archive: Parameters<WithdrawalRecovery["verifyAdmission"]>[1],
  ): Promise<void> {
    await this.assertArchiveInventory(archive);
    let afterKey: string | undefined;
    for (;;) {
      const keys = await this.database.treasuryPayoutKey.findMany({
        take: 100,
        orderBy: { id: "asc" },
        ...(afterKey === undefined ? {} : { where: { id: { gt: afterKey } } }),
      });
      for (const key of keys) await this.restoreKey(key.id);
      if (keys.length < 100) break;
      afterKey = keys.at(-1)?.id;
    }
    let afterAttempt: string | undefined;
    for (;;) {
      const attempts: WithdrawalAttempt[] =
        await this.database.withdrawalAttempt.findMany({
          take: 100,
          orderBy: { id: "asc" },
          ...(afterAttempt === undefined
            ? {}
            : { where: { id: { gt: afterAttempt } } }),
        });
      for (const attempt of attempts) await this.restore(attempt.withdrawalId);
      if (attempts.length < 100) break;
      afterAttempt = attempts.at(-1)?.id;
    }
  }

  private async assertArchiveInventory(
    archive: Parameters<WithdrawalRecovery["verifyAdmission"]>[1],
  ) {
    for (const type of [
      "TREASURY_KEY",
      "PAYOUT_SIGNED_ATTEMPT",
      "PAYOUT_BROADCAST_INTENT",
    ] as const) {
      let cursor: string | undefined;
      do {
        const page = await archive.list(cursor, type);
        for (const entry of page.records) {
          const envelope = await retainedPayoutRecord(
            this.stores,
            entry.objectId,
            type,
          );
          if (
            envelope === null ||
            entry.version !== 1 ||
            envelopeDigest(envelope) !== entry.digest
          )
            throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
          if (type === "TREASURY_KEY") {
            const payload = treasuryKeyPayloadSchema.parse(
              this.stores.keys.openRecord(envelope),
            );
            const key = await this.restoreKey(payload.keyRecordId);
            if (key.envelopeId !== entry.objectId)
              throw new TreasuryPolicyError("PAYOUT_KEY_CONFLICT");
          } else {
            const payload = this.stores.keys.openRecord(envelope);
            const attemptId =
              type === "PAYOUT_SIGNED_ATTEMPT"
                ? signedPayoutSchema.parse(payload).intent.attemptId
                : broadcastPayoutSchema.parse(payload).attemptId;
            const attempt =
              await this.database.withdrawalAttempt.findUniqueOrThrow({
                where: { id: attemptId },
              });
            const request =
              await this.database.withdrawalRequest.findUniqueOrThrow({
                where: { id: attempt.withdrawalId },
              });
            if (type === "PAYOUT_SIGNED_ATTEMPT") {
              if (envelope.objectId !== signedPayoutRecordId(attempt.id))
                throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
              validateSignedPayoutRecord(this.stores, envelope, {
                request,
                attempt,
              });
            } else await this.restore(request.id);
          }
        }
        cursor = page.cursor ?? undefined;
      } while (cursor !== undefined);
    }
  }

  async restoreKey(keyId: string) {
    const key = await this.database.treasuryPayoutKey.findUniqueOrThrow({
      where: { id: keyId },
    });
    const envelope = await retainedPayoutRecord(
      this.stores,
      key.envelopeId,
      "TREASURY_KEY",
    );
    if (
      envelope === null ||
      envelopeDigest(envelope) !== key.envelopeDigest ||
      key.recoveryDigest !== key.envelopeDigest
    )
      throw new TreasuryPolicyError("RECOVERY_UNAVAILABLE");
    const payload = treasuryKeyPayloadSchema.parse(
      this.stores.keys.openRecord(envelope),
    );
    if (
      payload.keyRecordId !== key.id ||
      payload.network !== key.network ||
      payload.tokenContract !== key.tokenContract ||
      payload.source !== key.source ||
      TronWeb.address.fromPrivateKey(payload.privateKey) !== key.source
    )
      throw new TreasuryPolicyError("PAYOUT_KEY_CONFLICT");
    const acknowledgement = await acknowledgePayoutRecord(
      this.stores,
      envelope,
    );
    if (acknowledgement.ackId !== key.recoveryAckId)
      throw new TreasuryPolicyError("PAYOUT_KEY_CONFLICT");
    return key;
  }

  async restore(requestId: string) {
    return this.restoreAttempt(requestId);
  }

  async completeUnacknowledgedBroadcasts(history: RecoveredHistory) {
    let after: string | undefined;
    for (;;) {
      const attempts: WithdrawalAttempt[] =
        await this.database.withdrawalAttempt.findMany({
          where: {
            broadcastIntentId: { not: null },
            broadcastAckId: null,
            ...(after === undefined ? {} : { id: { gt: after } }),
          },
          orderBy: { id: "asc" },
          take: 100,
        });
      for (const attempt of attempts)
        await this.restoreAttempt(attempt.withdrawalId, history);
      if (attempts.length < 100) break;
      after = attempts.at(-1)?.id;
    }
  }

  private async recoveryFingerprint() {
    const [row] = await this.database.$queryRaw<
      { fingerprint: string }[]
    >`SELECT p08_recovery_fingerprint() AS fingerprint`;
    if (row === undefined)
      throw new TreasuryPolicyError("RECOVERY_UNAVAILABLE");
    return row.fingerprint;
  }

  private async assertCompletionAuthority(history: RecoveredHistory) {
    if (!(await hasIndependentRecoveryAuthority(this.database)))
      throw new TreasuryPolicyError("PAYOUT_AUTHORITY_DENIED");
    const control =
      await this.database.financialRuntimeControl.findUniqueOrThrow({
        where: { id: 1 },
      });
    if (!control.financialWritesFenced)
      throw new TreasuryPolicyError("PAYOUT_STATE_CONFLICT");
    if (history.cutoff > new Date() || history.recoveredThrough > new Date())
      throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
    const fingerprint = await this.recoveryFingerprint();
    await verifyRecoveredFinancialHistory(this.database, history);
    return fingerprint;
  }

  private async assertOriginalAdmission(
    request: WithdrawalRequest,
    attempt: WithdrawalAttempt,
  ) {
    if (
      attempt.state !== "BROADCAST_INTENT" ||
      request.state !== "UNKNOWN" ||
      attempt.broadcastDigest !== null ||
      attempt.broadcastAckId !== null ||
      attempt.broadcastAcknowledgedAt !== null ||
      attempt.broadcastAdmittedAt === null
    )
      throw new TreasuryPolicyError("PAYOUT_STATE_CONFLICT");
    const [original] = await this.database.$queryRaw<
      { id: string }[]
    >`SELECT r.id FROM withdrawal_requests r JOIN reservation_allocations a ON a.id=r.reservation_id AND a.wallet_id=r.wallet_id JOIN treasury_payout_keys k ON k.id=${attempt.treasuryKeyId}::uuid
      WHERE r.id=${request.id}::uuid AND r.release_operation_id IS NULL AND r.settlement_operation_id IS NULL AND a.state='ACTIVE' AND a.release_operation_id IS NULL AND a.settlement_operation_id IS NULL
      AND a.gross_units=r.gross_units AND a.non_referral_units=r.non_referral_units AND a.referral_units=r.referral_units
      AND k.network=${attempt.network}::tron_network AND k.token_contract=${attempt.tokenContract} AND k.source=${attempt.source}
      AND (SELECT count(*) FROM withdrawal_attempts x WHERE x.network=k.network AND x.token_contract=k.token_contract AND x.source=k.source AND x.state NOT IN ('CONFIRMED_SUCCESS','CHAIN_FAILED'))=1
      AND (SELECT count(*) FROM withdrawal_actions x WHERE x.request_id=r.id AND x.kind='BROADCAST_ADMISSION')=1
      AND EXISTS(SELECT 1 FROM withdrawal_actions x WHERE x.request_id=r.id AND x.kind='BROADCAST_ADMISSION' AND x.intent_hash=${attempt.intentHash} AND x.occurred_at=${attempt.broadcastAdmittedAt} AND x.before_state='SIGNED' AND x.after_state='UNKNOWN' AND x.actor_scope='process:p08-payout' AND x.committed_version=r.version)`;
    if (original === undefined)
      throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
  }

  private async completeBroadcast(
    request: WithdrawalRequest,
    attempt: WithdrawalAttempt,
    history: RecoveredHistory,
  ) {
    const fingerprint = await this.assertCompletionAuthority(history);
    await this.assertOriginalAdmission(request, attempt);
    const payload = broadcastPayoutPayload(attempt);
    const envelope = await this.stores.keys.obtainRecord(
      this.stores.keys.sealRecord(
        "PAYOUT_BROADCAST_INTENT",
        payload.broadcastIntentId,
        payload,
      ),
    );
    validateBroadcastPayoutRecord(this.stores, envelope, attempt);
    await acknowledgePayoutRecord(this.stores, envelope);
    if ((await this.recoveryFingerprint()) !== fingerprint)
      throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
    return envelope;
  }

  private async restoreAttempt(requestId: string, history?: RecoveredHistory) {
    const request = await this.database.withdrawalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    const attempt = await this.database.withdrawalAttempt.findUniqueOrThrow({
      where: { withdrawalId: requestId },
    });
    await this.restoreKey(attempt.treasuryKeyId);
    const unsigned =
      attempt.unsignedRecordId === null
        ? null
        : await this.stores.keys.readRecord(attempt.unsignedRecordId);
    if (unsigned !== null) {
      if (envelopeDigest(unsigned) !== attempt.unsignedDigest)
        throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
      validateUnsignedPayoutRecord(this.stores, unsigned, { request, attempt });
    }
    if (attempt.signedRecordId === null) {
      if (attempt.transactionId !== null && unsigned === null) {
        const winner = await retainedPayoutRecord(
          this.stores,
          signedPayoutRecordId(attempt.id),
          "PAYOUT_SIGNED_ATTEMPT",
        );
        if (winner === null || attempt.unsignedDigest === null)
          throw new TreasuryPolicyError("RECOVERY_UNAVAILABLE");
        validateSignedPayoutRecord(this.stores, winner, { request, attempt });
        await acknowledgePayoutRecord(this.stores, winner);
      }
      return attempt;
    }
    const signed = await retainedSignedPayout(this.stores, request, attempt);
    const signedAck = await acknowledgePayoutRecord(
      this.stores,
      signed.envelope,
    );
    if (signedAck.ackId !== attempt.signedAckId)
      throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
    if (attempt.broadcastIntentId !== null) {
      let envelope = await retainedPayoutRecord(
        this.stores,
        attempt.broadcastIntentId,
        "PAYOUT_BROADCAST_INTENT",
      );
      if (envelope === null && history !== undefined)
        envelope = await this.completeBroadcast(request, attempt, history);
      if (
        envelope === null ||
        (attempt.broadcastDigest !== null &&
          envelopeDigest(envelope) !== attempt.broadcastDigest)
      )
        throw new TreasuryPolicyError("RECOVERY_UNAVAILABLE");
      validateBroadcastPayoutRecord(this.stores, envelope, attempt);
      const broadcastAck = await acknowledgePayoutRecord(this.stores, envelope);
      if (
        (attempt.broadcastDigest === null) !==
          (attempt.broadcastAckId === null) ||
        (attempt.broadcastAckId !== null &&
          broadcastAck.ackId !== attempt.broadcastAckId)
      )
        throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
    }
    return attempt;
  }
}
