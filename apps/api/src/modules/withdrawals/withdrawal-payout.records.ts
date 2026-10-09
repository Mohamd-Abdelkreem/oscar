import { createHash } from "node:crypto";
import { z } from "zod";
import {
  sweepTransactionSchema,
  TreasuryPolicyError,
} from "../../infrastructure/tron/tron-signer.js";
import { assertTransferTransaction } from "../../infrastructure/tron/tron-signer.js";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import type { RecoveryEnvelope } from "../../infrastructure/custody/encrypted-envelope.js";
import type { WithdrawalAttempt, WithdrawalRequest } from "@template/database";
import {
  payoutIntentSchema,
  payoutIntentHash,
  storedPayoutIntent,
} from "./withdrawal-payout.intent.js";
import { retainedPayoutRecord, type PayoutStores } from "./payout-records.js";

export const unsignedPayoutSchema = z
  .object({
    kind: z.literal("UNSIGNED"),
    intent: payoutIntentSchema,
    preparedAt: z.iso.datetime(),
    transaction: sweepTransactionSchema,
  })
  .strict();
export const signedPayoutSchema = z
  .object({
    kind: z.literal("SIGNED"),
    intent: payoutIntentSchema,
    signedAt: z.iso.datetime(),
    transaction: sweepTransactionSchema,
  })
  .strict();
export const broadcastPayoutSchema = z
  .object({
    kind: z.literal("BROADCAST"),
    intentHash: z.string().regex(/^[0-9a-f]{64}$/u),
    attemptId: z.uuid(),
    transactionId: z.string().regex(/^[0-9a-f]{64}$/u),
    signedDigest: z.string().regex(/^[0-9a-f]{64}$/u),
    broadcastIntentId: z.uuid(),
    admittedAt: z.iso.datetime(),
  })
  .strict();
export function broadcastPayoutPayload(attempt: WithdrawalAttempt) {
  return broadcastPayoutSchema.parse({
    kind: "BROADCAST",
    intentHash: attempt.intentHash,
    attemptId: attempt.id,
    transactionId: attempt.transactionId,
    signedDigest: attempt.signedDigest,
    broadcastIntentId: attempt.broadcastIntentId,
    admittedAt: attempt.broadcastAdmittedAt?.toISOString(),
  });
}
export function validateBroadcastPayoutRecord(
  stores: PayoutStores,
  envelope: RecoveryEnvelope,
  attempt: WithdrawalAttempt,
) {
  const payload = broadcastPayoutSchema.parse(stores.keys.openRecord(envelope));
  if (
    envelope.type !== "PAYOUT_BROADCAST_INTENT" ||
    envelope.objectId !== attempt.broadcastIntentId ||
    JSON.stringify(payload) !== JSON.stringify(broadcastPayoutPayload(attempt))
  )
    throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
  return payload;
}
export function signedPayoutRecordId(attemptId: string) {
  const bytes = createHash("sha256")
    .update(`p08-signed:${attemptId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 15) | 64;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
type OriginalPayout = {
  request: WithdrawalRequest;
  attempt: WithdrawalAttempt;
};
function assertRecordIdentity(
  envelope: RecoveryEnvelope,
  record:
    z.infer<typeof signedPayoutSchema> | z.infer<typeof unsignedPayoutSchema>,
  original: OriginalPayout,
) {
  const intent = storedPayoutIntent(original.request, original.attempt);
  if (
    envelope.type !== "PAYOUT_SIGNED_ATTEMPT" ||
    payoutIntentHash(record.intent) !== payoutIntentHash(intent) ||
    (original.attempt.transactionId !== null &&
      record.transaction.txID !== original.attempt.transactionId)
  )
    throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
  return {
    movement: { ...intent, amountUnits: BigInt(intent.netUnits) },
    policy: {
      now: Date.now(),
      maximumFeeSun: BigInt(intent.policy.energyFeeLimitSun),
      historical: true,
    },
  };
}
export function validateUnsignedPayoutRecord(
  stores: PayoutStores,
  envelope: RecoveryEnvelope,
  original: OriginalPayout,
) {
  const record = unsignedPayoutSchema.parse(stores.keys.openRecord(envelope));
  const { movement, policy } = assertRecordIdentity(envelope, record, original);
  assertTransferTransaction(record.transaction, movement, {
    ...policy,
    signed: false,
  });
  return record;
}
export function validateSignedPayoutRecord(
  stores: PayoutStores,
  envelope: RecoveryEnvelope,
  original: OriginalPayout,
) {
  const record = signedPayoutSchema.parse(stores.keys.openRecord(envelope));
  const { movement, policy } = assertRecordIdentity(envelope, record, original);
  assertTransferTransaction(record.transaction, movement, {
    ...policy,
    signed: true,
  });
  return record;
}
export async function retainedSignedPayout(
  stores: PayoutStores,
  request: WithdrawalRequest,
  attempt: WithdrawalAttempt,
) {
  const id = signedPayoutRecordId(attempt.id);
  const envelope = await retainedPayoutRecord(
    stores,
    id,
    "PAYOUT_SIGNED_ATTEMPT",
  );
  if (
    envelope === null ||
    attempt.signedDigest === null ||
    attempt.signedRecordId !== id ||
    envelopeDigest(envelope) !== attempt.signedDigest
  )
    throw new TreasuryPolicyError("RECOVERY_UNAVAILABLE");
  const record = validateSignedPayoutRecord(stores, envelope, {
    request,
    attempt,
  });
  return { record, envelope };
}
