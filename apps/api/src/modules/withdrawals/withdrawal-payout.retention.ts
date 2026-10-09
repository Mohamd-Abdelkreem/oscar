import { TronWeb } from "tronweb";
import type { TreasuryPayoutKey } from "@template/database";
import type { RecoveryEnvelope } from "../../infrastructure/custody/encrypted-envelope.js";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import {
  assertTransferTransaction,
  signRetainedTransferTransaction,
} from "../../infrastructure/tron/tron-signer.js";
import { treasuryKeyPayloadSchema } from "../treasury/treasury-payout-key.js";
import { recordPayoutAction } from "./withdrawal-payout.transaction.js";
import {
  assertPayoutPolicy,
  storedPayoutIntent,
} from "./withdrawal-payout.intent.js";
import { checkPayoutResources } from "./withdrawal-payout.resources.js";
import {
  acknowledgePayoutRecord,
  retainedPayoutRecord,
} from "./payout-records.js";
import {
  unsignedPayoutSchema,
  signedPayoutSchema,
  signedPayoutRecordId,
  validateUnsignedPayoutRecord,
  validateSignedPayoutRecord,
} from "./withdrawal-payout.records.js";
import {
  assertPayoutDispatchable,
  type PayoutExecution,
} from "./withdrawal-payout.execution.js";
import type { PayoutClaim } from "./withdrawal-payout.claim.js";

export class PayoutRetention {
  constructor(
    private readonly context: PayoutExecution,
    private readonly claims: PayoutClaim,
  ) {}
  private async recoveredKey(key: TreasuryPayoutKey) {
    const envelope = await retainedPayoutRecord(
      this.context.stores,
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
      this.context.stores.keys.openRecord(envelope),
    );
    if (
      payload.keyRecordId !== key.id ||
      payload.network !== key.network ||
      payload.source !== key.source ||
      payload.tokenContract !== key.tokenContract ||
      TronWeb.address.fromPrivateKey(payload.privateKey) !== key.source
    )
      throw new TreasuryPolicyError("PAYOUT_KEY_CONFLICT");
    return payload.privateKey;
  }
  private async prepare(requestId: string) {
    const scope = await this.context.transactions.dispatch(
      requestId,
      async (current) => {
        await assertPayoutDispatchable(current);
        return current;
      },
    );
    const attempt = scope.attempt;
    if (attempt === null)
      throw new TreasuryPolicyError("PAYOUT_IDENTITY_MISSING");
    const intent = storedPayoutIntent(scope.request, attempt);
    assertPayoutPolicy(intent, this.context.config);
    const stores = this.context.stores;
    let envelope = await stores.keys.readRecord(attempt.id);
    if (envelope === null) {
      if (attempt.transactionId !== null) {
        await this.markMissingOriginal(requestId);
        throw new TreasuryPolicyError("RECOVERY_UNAVAILABLE");
      }
      await checkPayoutResources(
        this.context.provider,
        this.context.config,
        intent.recipient,
        BigInt(intent.netUnits),
      );
      const transaction = assertTransferTransaction(
        await this.context.provider.buildTransfer(
          intent.source,
          intent.recipient,
          BigInt(intent.netUnits),
          this.context.config.payoutEnergyFeeLimitSun,
        ),
        { ...intent, amountUnits: BigInt(intent.netUnits) },
        {
          now: Date.now(),
          maximumFeeSun: this.context.config.payoutEnergyFeeLimitSun,
          signed: false,
        },
      );
      envelope = await stores.keys.obtainRecord(
        stores.keys.sealRecord(
          "PAYOUT_SIGNED_ATTEMPT",
          attempt.id,
          unsignedPayoutSchema.parse({
            kind: "UNSIGNED",
            intent,
            preparedAt: new Date().toISOString(),
            transaction,
          }),
        ),
      );
    }
    const unsigned = validateUnsignedPayoutRecord(stores, envelope, {
      request: scope.request,
      attempt,
    });
    const digest = envelopeDigest(envelope);
    const saved = await this.context.transactions.dispatch(
      requestId,
      async (current) => {
        await assertPayoutDispatchable(current);
        if (current.attempt === null) throw new TreasuryPolicyError();
        if (current.attempt.transactionId !== null) {
          if (
            current.attempt.transactionId !== unsigned.transaction.txID ||
            current.attempt.unsignedDigest !== digest
          )
            throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
          return current.attempt;
        }
        return current.transaction.withdrawalAttempt.update({
          where: { id: attempt.id },
          data: {
            transactionId: unsigned.transaction.txID,
            unsignedRecordId: attempt.id,
            unsignedDigest: digest,
            expiration: BigInt(unsigned.transaction.raw_data.expiration),
            preparedAt: new Date(unsigned.preparedAt),
            version: { increment: 1 },
          },
        });
      },
    );
    return { scope, attempt: saved, unsigned };
  }
  private markMissingOriginal(requestId: string) {
    return this.context.transactions.mutate(requestId, async (scope) => {
      if (scope.attempt === null) throw new TreasuryPolicyError();
      await scope.transaction.withdrawalAttempt.update({
        where: { id: scope.attempt.id },
        data: {
          state: "UNKNOWN",
          blocker: "RECOVERY_UNAVAILABLE",
          version: { increment: 1 },
        },
      });
      if (scope.request.state === "UNKNOWN") {
        await scope.transaction.withdrawalRequest.update({
          where: { id: requestId },
          data: { blocker: "RECOVERY_UNAVAILABLE" },
        });
      } else {
        const after = await scope.transaction.withdrawalRequest.update({
          where: { id: requestId },
          data: {
            state: "UNKNOWN",
            blocker: "RECOVERY_UNAVAILABLE",
            version: { increment: 1 },
          },
        });
        await recordPayoutAction(scope, "OBSERVE", after);
      }
    });
  }
  async sign(requestId: string) {
    const claimed = await this.claims.claim(requestId);
    if (claimed === null || claimed.signedRecordId !== null) return claimed;
    const retained = await retainedPayoutRecord(
      this.context.stores,
      signedPayoutRecordId(claimed.id),
      "PAYOUT_SIGNED_ATTEMPT",
    );
    if (retained !== null) return this.attachSigned(requestId, retained);
    const { scope, attempt, unsigned } = await this.prepare(requestId);
    const stores = this.context.stores;
    const id = signedPayoutRecordId(attempt.id);
    let envelope = await retainedPayoutRecord(
      stores,
      id,
      "PAYOUT_SIGNED_ATTEMPT",
    );
    if (envelope === null) {
      const key = await this.recoveredKey(scope.key);
      await checkPayoutResources(
        this.context.provider,
        this.context.config,
        unsigned.intent.recipient,
        BigInt(unsigned.intent.netUnits),
      );
      await this.context.transactions.dispatch(requestId, async (current) => {
        await assertPayoutDispatchable(current);
        if (
          current.attempt?.transactionId !== unsigned.transaction.txID ||
          current.attempt.signedRecordId !== null ||
          current.attempt.broadcastIntentId !== null ||
          unsigned.transaction.raw_data.expiration <= current.now.getTime()
        )
          throw new TreasuryPolicyError("PAYOUT_STATE_CONFLICT");
      });
      const transaction = await signRetainedTransferTransaction(
        unsigned.transaction,
        { ...unsigned.intent, amountUnits: BigInt(unsigned.intent.netUnits) },
        {
          now: Date.now(),
          maximumFeeSun: this.context.config.payoutEnergyFeeLimitSun,
        },
        key,
      );
      envelope = await stores.keys.obtainRecord(
        stores.keys.sealRecord(
          "PAYOUT_SIGNED_ATTEMPT",
          id,
          signedPayoutSchema.parse({
            kind: "SIGNED",
            intent: unsigned.intent,
            signedAt: new Date().toISOString(),
            transaction,
          }),
        ),
      );
    }
    return this.attachSigned(requestId, envelope);
  }
  private async attachSigned(requestId: string, envelope: RecoveryEnvelope) {
    const request =
      await this.context.database.withdrawalRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
    const attempt =
      await this.context.database.withdrawalAttempt.findUniqueOrThrow({
        where: { withdrawalId: requestId },
      });
    const stores = this.context.stores;
    if (
      attempt.transactionId === null ||
      attempt.unsignedDigest === null ||
      envelope.objectId !== signedPayoutRecordId(attempt.id)
    )
      throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
    const signed = validateSignedPayoutRecord(stores, envelope, {
      request,
      attempt,
    });
    const ack = await acknowledgePayoutRecord(stores, envelope);
    const digest = envelopeDigest(envelope);
    return this.context.transactions.dispatch(requestId, async (current) => {
      await assertPayoutDispatchable(current);
      if (
        current.attempt === null ||
        current.attempt.transactionId !== signed.transaction.txID
      )
        throw new TreasuryPolicyError();
      if (current.attempt.signedRecordId !== null) {
        if (current.attempt.signedDigest !== digest)
          throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
        return current.attempt;
      }
      const saved = await current.transaction.withdrawalAttempt.update({
        where: { id: attempt.id },
        data: {
          state: "SIGNED",
          signedRecordId: envelope.objectId,
          signedDigest: digest,
          signedAckId: ack.ackId,
          signedAcknowledgedAt: new Date(ack.acknowledgedAt),
          signedAt: new Date(signed.signedAt),
          version: { increment: 1 },
        },
      });
      const after = await current.transaction.withdrawalRequest.update({
        where: { id: requestId },
        data: { state: "SIGNED", version: { increment: 1 } },
      });
      await recordPayoutAction(current, "SIGNED", after);
      return saved;
    });
  }
}
