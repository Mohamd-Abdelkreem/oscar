import { FINANCIAL_RULES } from "../constants/branding";

export function roundMoney(amount: number): number {
  return Number(amount.toFixed(2));
}

export function calculateExpectedTotalIncome(
  dailyReward: number,
  durationDays: number,
): number {
  return roundMoney(dailyReward * durationDays);
}

export function getWithdrawalAmounts(amount: number): {
  fee: number;
  netAmount: number;
} {
  const fee = roundMoney(amount * FINANCIAL_RULES.withdrawalFeeRate);
  return { fee, netAmount: roundMoney(amount - fee) };
}

export function formatLocalTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

export function formatLocalDateTime(date: Date): string {
  return `${date.getFullYear().toString()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${formatLocalTime(date)}`;
}
