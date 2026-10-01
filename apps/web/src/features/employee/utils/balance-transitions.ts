import type { FinancialBalance } from "../types/employee.types";
import { roundMoney } from "./financial-calculations";

export function creditTaskReward(
  balance: FinancialBalance,
  reward: number,
): FinancialBalance {
  return {
    ...balance,
    total: roundMoney(balance.total + reward),
    available: roundMoney(balance.available + reward),
    breakdown: {
      ...balance.breakdown,
      taskRewards: roundMoney(balance.breakdown.taskRewards + reward),
    },
  };
}

export function spendAvailable(
  balance: FinancialBalance,
  amount: number,
): FinancialBalance {
  return {
    ...balance,
    total: roundMoney(balance.total - amount),
    available: roundMoney(balance.available - amount),
  };
}

export function reserveWithdrawal(
  balance: FinancialBalance,
  amount: number,
): FinancialBalance {
  return {
    ...balance,
    available: roundMoney(balance.available - amount),
    reserved: roundMoney(balance.reserved + amount),
  };
}

export function releaseWithdrawal(
  balance: FinancialBalance,
  amount: number,
): FinancialBalance {
  return {
    ...balance,
    available: roundMoney(balance.available + amount),
    reserved: roundMoney(Math.max(0, balance.reserved - amount)),
  };
}

export function completeWithdrawal(
  balance: FinancialBalance,
  amount: number,
): FinancialBalance {
  return {
    ...balance,
    total: roundMoney(balance.total - amount),
    reserved: roundMoney(Math.max(0, balance.reserved - amount)),
  };
}
