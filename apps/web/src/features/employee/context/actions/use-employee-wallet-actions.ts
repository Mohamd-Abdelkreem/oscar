"use client";
import { useCallback } from "react";
import { FINANCIAL_RULES } from "../../constants/branding";

import {
  completeWithdrawal,
  releaseWithdrawal,
  reserveWithdrawal,
} from "../../utils/balance-transitions";

import {
  createWithdrawalReservationTransaction,
  createWithdrawalReversalTransaction,
} from "../../utils/ledger-transactions";
import { createWithdrawalRequest } from "../../utils/withdrawal-request";
import type { EmployeeActionDependencies } from "../employee-state.types";

export function useEmployeeWalletActions({
  user,
  balance,
  setUser,
  setBalance,
  setWithdrawals,
  setDeposits,
  setTransactions,
  pendingWithdrawal,
  hasPendingWithdrawal,
}: Pick<
  EmployeeActionDependencies,
  | "user"
  | "balance"
  | "setUser"
  | "setBalance"
  | "setWithdrawals"
  | "setDeposits"
  | "setTransactions"
  | "pendingWithdrawal"
  | "hasPendingWithdrawal"
>) {
  const setupWithdrawalAddress = useCallback(
    (address: string): { success: boolean; message: string } => {
      const trimmed = address.trim();
      if (!trimmed.startsWith("T") || trimmed.length !== 34) {
        return {
          success: false,
          message:
            "يرجى إدخال عنوان TRC20 صالح يبدأ بحرف T ويتكون من 34 رمزاً.",
        };
      }

      setUser((prev) => ({
        ...prev,
        savedWithdrawalAddress: trimmed,
      }));

      return {
        success: true,
        message: "تم حفظ عنوان السحب وتأمينه بنجاح.",
      };
    },
    [setUser],
  );

  const requestWithdrawal = useCallback(
    (amount: number): { success: boolean; message: string } => {
      if (hasPendingWithdrawal) {
        return {
          success: false,
          message:
            "لديك طلب سحب قيد المعالجة حالياً. لا يمكن تقديم أكثر من طلب في وقت واحد.",
        };
      }

      if (!user.savedWithdrawalAddress) {
        return {
          success: false,
          message: "يرجى تعيين وتأكيد عنوان السحب أولاً في حسابك.",
        };
      }

      if (amount < FINANCIAL_RULES.withdrawalMinAmount) {
        return {
          success: false,
          message:
            "الحد الأدنى للسحب هو " +
            FINANCIAL_RULES.withdrawalMinAmount.toString() +
            " USDT.",
        };
      }

      if (amount > FINANCIAL_RULES.withdrawalMaxAmount) {
        return {
          success: false,
          message:
            "الحد الأقصى للسحب هو " +
            FINANCIAL_RULES.withdrawalMaxAmount.toString() +
            " USDT.",
        };
      }

      if (amount > balance.available) {
        return {
          success: false,
          message:
            "الرصيد المتاح (" +
            balance.available.toFixed(2) +
            " USDT) غير كافٍ لتغطية المبلغ المطلوب.",
        };
      }

      const now = new Date();
      const newReq = createWithdrawalRequest(
        amount,
        user.savedWithdrawalAddress,
        now,
      );
      const netAmount = newReq.netAmount;

      // Reserve funds: available decreases, reserved increases, total stays same!
      setBalance((prev) => reserveWithdrawal(prev, amount));

      setWithdrawals((prev) => [newReq, ...prev]);

      const newTx = createWithdrawalReservationTransaction(newReq, now);

      setTransactions((prev) => [newTx, ...prev]);

      return {
        success: true,
        message:
          "تم تقديم طلب السحب بنجاح وحجز " +
          amount.toFixed(2) +
          " USDT. الصافي المتوقع " +
          netAmount.toFixed(2) +
          " USDT بعد خصم الرسوم 21%.",
      };
    },
    [
      balance.available,
      hasPendingWithdrawal,
      user.savedWithdrawalAddress,
      setBalance,
      setWithdrawals,
      setTransactions,
    ],
  );

  const checkDepositStatus = useCallback(
    (depositId: string) => {
      setDeposits((prev) =>
        prev.map((d) =>
          d.id === depositId ? { ...d, status: "confirmed" } : d,
        ),
      );
    },
    [setDeposits],
  );

  const simulateRejectPendingWithdrawal = useCallback(() => {
    if (!pendingWithdrawal) return;

    const amount = pendingWithdrawal.amount;

    setBalance((prev) => releaseWithdrawal(prev, amount));

    setWithdrawals((prev) =>
      prev.map((w) =>
        w.id === pendingWithdrawal.id
          ? {
              ...w,
              status: "rejected",
              rejectionReason:
                "تم إيقاف الطلب من قبل الإدارة للتحقق الأمني من ملكية العنوان.",
            }
          : w,
      ),
    );

    const reversalTx = createWithdrawalReversalTransaction(
      pendingWithdrawal,
      new Date(),
    );

    setTransactions((prev) => [reversalTx, ...prev]);
  }, [pendingWithdrawal, setBalance, setWithdrawals, setTransactions]);

  const simulateApprovePendingWithdrawal = useCallback(() => {
    if (!pendingWithdrawal) return;

    const amount = pendingWithdrawal.amount;

    setBalance((prev) => completeWithdrawal(prev, amount));

    setWithdrawals((prev) =>
      prev.map((w) =>
        w.id === pendingWithdrawal.id
          ? {
              ...w,
              status: "completed",
            }
          : w,
      ),
    );
  }, [pendingWithdrawal, setBalance, setWithdrawals]);
  return {
    setupWithdrawalAddress,
    requestWithdrawal,
    checkDepositStatus,
    simulateRejectPendingWithdrawal,
    simulateApprovePendingWithdrawal,
  };
}
