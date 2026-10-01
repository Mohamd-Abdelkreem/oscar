import { FINANCIAL_RULES } from "../constants/branding";
import type { WithdrawalRequest } from "../types/employee.types";
import {
  formatLocalDateTime,
  getWithdrawalAmounts,
} from "./financial-calculations";

export function createWithdrawalRequest(
  amount: number,
  address: string,
  now: Date,
): WithdrawalRequest {
  const { fee, netAmount } = getWithdrawalAmounts(amount);
  const dueTime = new Date(
    now.getTime() + FINANCIAL_RULES.withdrawalProcessingHours * 3600 * 1000,
  );
  return {
    id: "wth_" + now.getTime().toString().slice(-6),
    amount,
    fee,
    feeRate: FINANCIAL_RULES.withdrawalFeeRate,
    netAmount,
    targetAddress: address,
    status: "pending",
    requestedAt: formatLocalDateTime(now),
    dueAt: formatLocalDateTime(dueTime),
  };
}
