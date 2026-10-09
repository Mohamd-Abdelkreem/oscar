import {
  financialOperationResultSchema,
  sourceAllocationSchema,
  walletComponentsSchema,
  type FinancialOperationResult,
  type WalletComponents,
} from "@template/contracts";
import type { Wallet } from "@template/database";

import { formatUsdtAmount, totalUnits } from "../../core/financial/money.js";
import { LedgerError } from "./ledger.errors.js";

export type WalletAmounts = Pick<
  Wallet,
  | "availableNonReferralUnits"
  | "reservedNonReferralUnits"
  | "availableReferralUnits"
  | "reservedReferralUnits"
>;
export const mapWalletComponents = (wallet: WalletAmounts): WalletComponents =>
  walletComponentsSchema.parse({
    availableNonReferral: formatUsdtAmount(wallet.availableNonReferralUnits),
    reservedNonReferral: formatUsdtAmount(wallet.reservedNonReferralUnits),
    availableReferral: formatUsdtAmount(wallet.availableReferralUnits),
    reservedReferral: formatUsdtAmount(wallet.reservedReferralUnits),
    total: formatUsdtAmount(
      totalUnits([
        wallet.availableNonReferralUnits,
        wallet.reservedNonReferralUnits,
        wallet.availableReferralUnits,
        wallet.reservedReferralUnits,
      ]),
    ),
  });
export const mapSourceAllocation = (allocation: {
  nonReferralUnits: bigint;
  referralUnits: bigint;
  grossUnits: bigint;
}) =>
  sourceAllocationSchema.parse({
    nonReferral: formatUsdtAmount(allocation.nonReferralUnits),
    referral: formatUsdtAmount(allocation.referralUnits),
    gross: formatUsdtAmount(allocation.grossUnits),
  });
export const mapRecordedOutcome = (
  outcome: unknown,
): FinancialOperationResult => {
  const parsed = financialOperationResultSchema.safeParse(outcome);
  if (!parsed.success) throw new LedgerError("LEDGER_INTERNAL");
  const recorded = parsed.data;
  Object.freeze(recorded.walletAfter);
  if (
    recorded.kind === "RESERVE" ||
    recorded.kind === "RELEASE" ||
    recorded.kind === "SETTLE"
  ) {
    Object.freeze(recorded.reservation.allocation);
    Object.freeze(recorded.reservation);
  }
  return Object.freeze(recorded);
};
