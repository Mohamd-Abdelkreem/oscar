"use client";

import { useCallback } from "react";
import { computeExtendedDueAt } from "../../utils/time.utils";
import type {
  AdminFinanceTransaction,
  AdminWithdrawal,
} from "../../types/admin.types";
import { generateId, getNowTimestamp } from "../../utils/admin-records";
import type { AdminActionDependencies } from "../admin-state.types";

export function useWithdrawalActions({
  withdrawals,
  setEmployees,
  setWithdrawals,
  setFinanceTransactions,
  addAuditLog,
}: Pick<
  AdminActionDependencies,
  | "withdrawals"
  | "setEmployees"
  | "setWithdrawals"
  | "setFinanceTransactions"
  | "addAuditLog"
>) {
  const holdWithdrawal = useCallback(
    (withdrawalId: string, reason: string) => {
      const wth = withdrawals.find((w) => w.id === withdrawalId);
      if (!wth) return;

      setWithdrawals((prev) =>
        prev.map((w) =>
          w.id === withdrawalId
            ? { ...w, status: "held", holdReason: reason.trim() }
            : w,
        ),
      );

      addAuditLog({
        action: "تعليق طلب سحب",
        targetType: "withdrawal",
        targetId: withdrawalId,
        targetTitle: `طلب سحب ${wth.amount.toFixed(2)} USDT - ${wth.employeeName}`,
        previousState: wth.status,
        newState: "معلق",
        reason: reason.trim() || "تعليق مؤقت للتدقيق الأمني",
      });
    },
    [addAuditLog, withdrawals, setWithdrawals],
  );

  const releaseWithdrawal = useCallback(
    (withdrawalId: string) => {
      const wth = withdrawals.find((w) => w.id === withdrawalId);
      if (!wth) return;

      setWithdrawals((prev) =>
        prev.map((w) =>
          w.id === withdrawalId
            ? { ...w, status: "scheduled", holdReason: undefined }
            : w,
        ),
      );

      addAuditLog({
        action: "فك تعليق طلب سحب",
        targetType: "withdrawal",
        targetId: withdrawalId,
        targetTitle: `طلب سحب ${wth.amount.toFixed(2)} USDT - ${wth.employeeName}`,
        previousState: wth.status,
        newState: "مجدول",
        reason: "استئناف المعالجة بعد التحقق",
      });
    },
    [addAuditLog, withdrawals, setWithdrawals],
  );

  const rejectWithdrawal = useCallback(
    (
      withdrawalId: string,
      reason: string,
    ): { success: boolean; message: string } => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        return { success: false, message: "يرجى إدخال سبب الرفض الإلزامي." };
      }

      const wth = withdrawals.find((w) => w.id === withdrawalId);
      if (!wth) return { success: false, message: "طلب السحب غير موجود" };

      if (wth.status === "rejected" || wth.status === "completed") {
        return { success: false, message: "لا يمكن تعديل هذا الطلب" };
      }

      const amount = wth.amount;
      const nowStr = getNowTimestamp();

      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id === wth.employeeId) {
            return {
              ...emp,
              balance: {
                ...emp.balance,
                available: emp.balance.available + amount,
                reserved: Math.max(0, emp.balance.reserved - amount),
              },
            };
          }
          return emp;
        }),
      );

      setWithdrawals((prev) =>
        prev.map((w) =>
          w.id === withdrawalId
            ? { ...w, status: "rejected", rejectionReason: trimmedReason }
            : w,
        ),
      );

      const revTx: AdminFinanceTransaction = {
        id: generateId("tx_wth_rev"),
        employeeId: wth.employeeId,
        employeeName: wth.employeeName,
        type: "withdrawal_reversal",
        title: `إلغاء حجز سحب مرفوض (${wth.id})`,
        amount: 0.0,
        direction: "neutral",
        isBalanceNeutral: true,
        status: "completed",
        reference: `REV-${wth.id}`,
        source: "عمليات السحب",
        date: nowStr,
        details: {
          السبب: trimmedReason,
          "المبلغ المحرر": `${amount.toFixed(2)} USDT`,
        },
      };

      setFinanceTransactions((prev) => [revTx, ...prev]);

      addAuditLog({
        action: "رفض طلب سحب وإعادة الرصيد المحجوز",
        targetType: "withdrawal",
        targetId: withdrawalId,
        targetTitle: `سحب ${amount.toFixed(2)} USDT - ${wth.employeeName}`,
        previousState: wth.status,
        newState: "مرفوض (تم تحرير الرصيد المحجوز)",
        reason: trimmedReason,
      });

      return {
        success: true,
        message:
          "تم رفض طلب السحب وإعادة الرصيد المحجوز إلى رصيد الموظف المتاح بنجاح.",
      };
    },
    [
      addAuditLog,
      withdrawals,
      setEmployees,
      setWithdrawals,
      setFinanceTransactions,
    ],
  );

  const completeWithdrawal = useCallback(
    (withdrawalId: string) => {
      const wth = withdrawals.find((w) => w.id === withdrawalId);
      if (!wth || wth.status === "completed") return;

      const amount = wth.amount;
      const nowStr = getNowTimestamp();

      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id === wth.employeeId) {
            return {
              ...emp,
              balance: {
                ...emp.balance,
                total: Math.max(0, emp.balance.total - amount),
                reserved: Math.max(0, emp.balance.reserved - amount),
              },
            };
          }
          return emp;
        }),
      );

      setWithdrawals((prev) =>
        prev.map((w) =>
          w.id === withdrawalId
            ? { ...w, status: "completed", completedAt: nowStr }
            : w,
        ),
      );

      const compTx: AdminFinanceTransaction = {
        id: generateId("tx_wth_comp"),
        employeeId: wth.employeeId,
        employeeName: wth.employeeName,
        type: "withdrawal_completion",
        title: "اكتمال تسوية سحب محفظة",
        amount: -amount,
        direction: "debit",
        status: "completed",
        reference: `SETTLE-${wth.id}`,
        source: "عمليات السحب",
        date: nowStr,
        details: {
          "المبلغ المسحوب": `${amount.toFixed(2)} USDT`,
          "الرسوم المقتطعة": `${wth.fee.toFixed(2)} USDT`,
          "الصافي المحول": `${wth.netAmount.toFixed(2)} USDT`,
        },
      };

      setFinanceTransactions((prev) => [compTx, ...prev]);

      addAuditLog({
        action: "إتمام تسوية طلب سحب",
        targetType: "withdrawal",
        targetId: withdrawalId,
        targetTitle: `سحب ${amount.toFixed(2)} USDT - ${wth.employeeName}`,
        previousState: wth.status,
        newState: "مكتمل",
        reason: "اكتمال التحويل والتسوية النهائية للطلب",
      });
    },
    [
      addAuditLog,
      withdrawals,
      setEmployees,
      setWithdrawals,
      setFinanceTransactions,
    ],
  );

  const extendWithdrawalSchedule = useCallback(
    (
      withdrawalId: string,
      additionalHours: number,
      reason: string,
    ): {
      success: boolean;
      message: string;
      withdrawal?: AdminWithdrawal | undefined;
    } => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        return {
          success: false,
          message: "يرجى إدخال سبب زيادة الجدولة الإلزامي.",
        };
      }

      if (
        !Number.isInteger(additionalHours) ||
        additionalHours <= 0 ||
        !Number.isFinite(additionalHours)
      ) {
        return {
          success: false,
          message:
            "عدد الساعات الإضافية يجب أن يكون رقماً صحيحاً وموجباً أكبر من الصفر.",
        };
      }

      const wth = withdrawals.find((w) => w.id === withdrawalId);
      if (!wth) return { success: false, message: "طلب السحب غير موجود" };

      if (wth.status !== "scheduled") {
        return {
          success: false,
          message: "لا يمكن تمديد جدولة طلب غير مجدول.",
        };
      }

      const extension = computeExtendedDueAt(wth.dueAt, additionalHours);
      if (!extension.valid) return { success: false, message: extension.error };
      const newDueAtIso = extension.newDueAtIso;

      const baseHours = wth.originalDurationHours ?? 72;
      const currentAdded = wth.addedHours ?? 0;
      const newCumulativeAdded = currentAdded + additionalHours;

      let updatedRecord: AdminWithdrawal | undefined;

      setWithdrawals((prev) =>
        prev.map((w) => {
          if (w.id === withdrawalId) {
            updatedRecord = {
              ...w,
              dueAt: newDueAtIso,
              originalDurationHours: baseHours,
              addedHours: newCumulativeAdded,
            };
            return updatedRecord;
          }
          return w;
        }),
      );

      addAuditLog({
        action: "زيادة جدولة السحب",
        targetType: "withdrawal",
        targetId: withdrawalId,
        targetTitle: `سحب ${wth.amount.toFixed(2)} USDT - ${wth.employeeName}`,
        previousState: `الموعد السابق: ${wth.dueAt}`,
        newState: `الموعد الجديد: ${newDueAtIso} (+${String(additionalHours)} ساعة، الإجمالي التراكمي: +${String(newCumulativeAdded)} ساعة)`,
        reason: trimmedReason,
      });

      return {
        success: true,
        message: `تم تمديد جدولة طلب السحب ${withdrawalId} بمقدار ${String(additionalHours)} ساعة بنجاح.`,
        withdrawal: updatedRecord,
      };
    },
    [addAuditLog, withdrawals, setWithdrawals],
  );
  return {
    holdWithdrawal,
    releaseWithdrawal,
    rejectWithdrawal,
    completeWithdrawal,
    extendWithdrawalSchedule,
  };
}
