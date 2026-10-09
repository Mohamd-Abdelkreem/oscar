import { createHash } from "node:crypto";
import { z } from "zod";
import { positiveUsdtAmountSchema } from "@template/contracts";
import type { parseTronSignerEnvironment } from "../../core/config/tron.config.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";

export type TreasuryConfig = ReturnType<typeof parseTronSignerEnvironment>;
export const treasuryCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("PROVISION_PAYOUT_KEY"),
      privateKey: z.string().regex(/^[0-9a-fA-F]{64}$/u),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      operation: z.literal("CREATE"),
      operationId: z.uuid(),
      assignmentId: z.uuid(),
      amount: positiveUsdtAmountSchema,
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z.object({ operation: z.literal("STATUS"), operationId: z.uuid() }).strict(),
  z
    .object({ operation: z.literal("RECONCILE"), operationId: z.uuid() })
    .strict(),
  z
    .object({
      operation: z.literal("PAUSE"),
      action: z.enum(["PAUSE", "RESUME"]),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
]);
const units = z
  .string()
  .regex(/^[1-9]\d{0,18}$/u)
  .refine((s) => BigInt(s) <= 9223372036854775807n);
export const sweepPolicySchema = z
  .object({
    maximumSweepUnits: units,
    energyFeeLimitSun: units,
    maximumCompanyCostSun: units,
    maximumManualFundingSun: units,
  })
  .strict();
export const sweepIntentSchema = z
  .object({
    id: z.uuid(),
    assignmentId: z.uuid(),
    network: z.enum(["TRON_MAINNET", "TRON_SHASTA", "TRON_NILE"]),
    tokenContract: z.string(),
    source: z.string(),
    treasury: z.string(),
    amountUnits: units,
    policySnapshot: sweepPolicySchema,
    operatorIdentity: z.string().min(1).max(160),
    reason: z.string().min(1).max(500),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type SweepIntent = z.infer<typeof sweepIntentSchema>;
export function policySnapshot(config: TreasuryConfig) {
  return sweepPolicySchema.parse({
    maximumSweepUnits: String(config.maximumSweepUnits),
    energyFeeLimitSun: String(config.energyFeeLimitSun),
    maximumCompanyCostSun: String(config.maximumCompanyCostSun),
    maximumManualFundingSun: String(config.maximumManualFundingSun),
  });
}
export function intentHash(intent: SweepIntent): string {
  return createHash("sha256")
    .update(JSON.stringify(sweepIntentSchema.parse(intent)))
    .digest("hex");
}
export function assertCurrentPolicy(
  intent: SweepIntent,
  config: TreasuryConfig,
): void {
  if (
    intent.network !== config.network ||
    intent.tokenContract !== config.token.contract ||
    intent.treasury !== config.treasury ||
    intent.source === config.treasury ||
    BigInt(intent.amountUnits) > config.maximumSweepUnits ||
    JSON.stringify(intent.policySnapshot) !==
      JSON.stringify(policySnapshot(config))
  )
    throw new TreasuryPolicyError();
}
