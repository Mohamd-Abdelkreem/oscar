import type { Prisma } from "@template/database";
import type { TronPublicPayoutCapability } from "../../core/config/tron.config.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";

export type WithdrawalCapabilityContext = {
  capability?: TronPublicPayoutCapability | undefined;
  admission?: FinancialRuntimeAdmission | undefined;
};

export async function withdrawalExecutionReady(
  transaction: Prisma.TransactionClient,
  context: WithdrawalCapabilityContext,
): Promise<boolean> {
  if (context.capability === undefined || context.admission === undefined)
    return false;
  return (await context.admission.readApiAdmission(transaction))
    .newRequestsAdmitted;
}
