import { createHash } from "node:crypto";
import { z } from "zod";
import {
  tronNetworkSchema,
  tronPublicAddressSchema,
} from "@template/contracts";
import type { WithdrawalAttempt, WithdrawalRequest } from "@template/database";
import type { TronPayoutConfig } from "../../core/config/tron.config.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";

const units = z
  .string()
  .refine(
    (s) => /^[1-9][0-9]{0,18}$/u.test(s) && BigInt(s) <= 9223372036854775807n,
    "Invalid payout units.",
  );
export const payoutPolicySchema = z
  .object({
    maximumPayoutUnits: units,
    energyFeeLimitSun: units,
    maximumCompanyCostSun: units,
  })
  .strict();
export const payoutIntentSchema = z
  .object({
    operation: z.literal("WITHDRAWAL_PAYOUT"),
    requestId: z.uuid(),
    attemptId: z.uuid(),
    employeeId: z.uuid(),
    walletId: z.uuid(),
    reservationId: z.uuid(),
    treasuryKeyId: z.uuid(),
    network: tronNetworkSchema,
    tokenContract: tronPublicAddressSchema,
    source: tronPublicAddressSchema,
    recipient: tronPublicAddressSchema,
    addressVersion: z.number().int().positive(),
    netUnits: units,
    termsHash: z.string().regex(/^[0-9a-f]{64}$/u),
    policy: payoutPolicySchema,
  })
  .strict();
export type PayoutIntent = z.infer<typeof payoutIntentSchema>;
export function payoutPolicy(config: TronPayoutConfig) {
  return payoutPolicySchema.parse({
    maximumPayoutUnits: String(config.maximumPayoutUnits),
    energyFeeLimitSun: String(config.payoutEnergyFeeLimitSun),
    maximumCompanyCostSun: String(config.payoutMaximumCompanyCostSun),
  });
}
export function payoutIntentHash(intent: PayoutIntent): string {
  return createHash("sha256")
    .update(JSON.stringify(payoutIntentSchema.parse(intent)))
    .digest("hex");
}
export function storedPayoutIntent(
  request: WithdrawalRequest,
  attempt: WithdrawalAttempt,
): PayoutIntent {
  const intent = payoutIntentSchema.parse({
    operation: "WITHDRAWAL_PAYOUT",
    requestId: request.id,
    attemptId: attempt.id,
    employeeId: request.employeeId,
    walletId: request.walletId,
    reservationId: request.reservationId,
    treasuryKeyId: attempt.treasuryKeyId,
    network: attempt.network,
    tokenContract: attempt.tokenContract,
    source: attempt.source,
    recipient: attempt.recipient,
    addressVersion: attempt.addressVersion,
    netUnits: String(attempt.netUnits),
    termsHash: attempt.termsHash,
    policy: attempt.policySnapshot,
  });
  if (
    attempt.withdrawalId !== request.id ||
    attempt.employeeId !== request.employeeId ||
    attempt.walletId !== request.walletId ||
    attempt.network !== request.network ||
    attempt.recipient !== request.recipient ||
    attempt.addressVersion !== request.addressVersion ||
    attempt.netUnits !== request.netUnits ||
    attempt.grossUnits !== request.grossUnits ||
    attempt.feeUnits !== request.feeUnits ||
    attempt.termsHash !== request.termsHash ||
    payoutIntentHash(intent) !== attempt.intentHash
  )
    throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
  return intent;
}
export function assertPayoutPolicy(
  intent: PayoutIntent,
  config: TronPayoutConfig,
): void {
  if (
    intent.network !== config.network ||
    intent.tokenContract !== config.token.contract ||
    intent.source !== config.treasury ||
    intent.treasuryKeyId !== config.treasuryKeyId ||
    intent.source === intent.recipient ||
    BigInt(intent.netUnits) > config.maximumPayoutUnits ||
    JSON.stringify(intent.policy) !== JSON.stringify(payoutPolicy(config))
  )
    throw new TreasuryPolicyError("PAYOUT_POLICY_CONFLICT");
}
