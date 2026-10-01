"use client";

import { useCallback } from "react";
import type { AdminFinanceTransaction } from "../../types/admin.types";
import { generateId, getNowTimestamp } from "../../utils/admin-records";
import type { AdminActionDependencies } from "../admin-state.types";

export function useEmployeeAccountActions({
  employees,
  setEmployees,
  setFinanceTransactions,
  addAuditLog,
}: Pick<
  AdminActionDependencies,
  "employees" | "setEmployees" | "setFinanceTransactions" | "addAuditLog"
>) {
  const adjustEmployeeBalance = useCallback(
    (
      employeeId: string,
      amount: number,
      direction: "credit" | "debit",
      reason: string,
    ): { success: boolean; message: string } => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        return { success: false, message: "يرجى كتابة سبب التسوية الإلزامي." };
      }

      if (amount <= 0 || isNaN(amount)) {
        return {
          success: false,
          message: "يرجى إدخال مبلغ صحيح أكبر من الصفر.",
        };
      }

      const emp = employees.find((e) => e.id === employeeId);
      if (!emp) {
        return { success: false, message: "الموظف غير موجود" };
      }

      if (direction === "debit" && emp.balance.available < amount) {
        return {
          success: false,
          message: `الرصيد المتاح الحالي (${emp.balance.available.toFixed(2)} USDT) لا يكفي لخصم (${amount.toFixed(2)} USDT).`,
        };
      }

      const signedAmount = direction === "credit" ? amount : -amount;
      const nowStr = getNowTimestamp();

      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id === employeeId) {
            return {
              ...e,
              balance: {
                ...e.balance,
                available: e.balance.available + signedAmount,
                total: e.balance.total + signedAmount,
              },
            };
          }
          return e;
        }),
      );

      const adjTx: AdminFinanceTransaction = {
        id: generateId("tx_adj"),
        employeeId: emp.id,
        employeeName: emp.name,
        type: "admin_adjustment",
        title:
          direction === "credit"
            ? "تسوية إدارية دائنة (إضافة رصيد)"
            : "تسوية إدارية مدينة (خصم رصيد)",
        amount: signedAmount,
        direction: direction,
        status: "completed",
        reference: generateId("ADM-ADJ"),
        source: "إدارة النظام",
        date: nowStr,
        details: {
          السبب: trimmedReason,
          "نوع التسوية": direction === "credit" ? "إضافة" : "خصم",
        },
      };

      setFinanceTransactions((prev) => [adjTx, ...prev]);

      addAuditLog({
        action: "تسوية رصيد الموظف",
        targetType: "employee",
        targetId: employeeId,
        targetTitle: emp.name,
        previousState: `${emp.balance.available.toFixed(2)} USDT`,
        newState: `${(emp.balance.available + signedAmount).toFixed(2)} USDT`,
        reason: `${trimmedReason} (${direction === "credit" ? "+" : "-"}${amount.toFixed(2)} USDT)`,
      });

      return {
        success: true,
        message: `تمت تسوية الرصيد بنجاح بمقدار ${signedAmount > 0 ? "+" : ""}${signedAmount.toFixed(2)} USDT.`,
      };
    },
    [addAuditLog, employees, setEmployees, setFinanceTransactions],
  );

  const updateEmployeeWithdrawalAddress = useCallback(
    (
      employeeId: string,
      newAddress: string,
      reason: string,
    ): { success: boolean; message: string } => {
      const trimmedAddress = newAddress.trim();
      const trimmedReason = reason.trim();

      if (!trimmedReason) {
        return { success: false, message: "يرجى كتابة سبب التغيير الإلزامي." };
      }

      if (!trimmedAddress.startsWith("T") || trimmedAddress.length !== 34) {
        return {
          success: false,
          message:
            "يرجى إدخال عنوان TRC20 صالح يبدأ بحرف T ويتكون من 34 رمزاً.",
        };
      }

      const emp = employees.find((e) => e.id === employeeId);
      if (!emp) return { success: false, message: "الموظف غير موجود" };

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId ? { ...e, walletAddress: trimmedAddress } : e,
        ),
      );

      addAuditLog({
        action: "تغيير عنوان سحب الموظف",
        targetType: "employee",
        targetId: employeeId,
        targetTitle: emp.name,
        previousState: emp.walletAddress,
        newState: trimmedAddress,
        reason: trimmedReason,
      });

      return {
        success: true,
        message: "تم تحديث عنوان السحب بنجاح.",
      };
    },
    [addAuditLog, employees, setEmployees],
  );

  const deleteEmployeeAccount = useCallback(
    (
      employeeId: string,
      reason: string,
    ): { success: boolean; message: string } => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        return { success: false, message: "يرجى إدخال سبب الحذف الإلزامي." };
      }

      const emp = employees.find((e) => e.id === employeeId);
      if (!emp) return { success: false, message: "الموظف غير موجود" };

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? { ...e, isDeleted: true, accountStatus: "blocked" }
            : e,
        ),
      );

      addAuditLog({
        action: "أرشفة وحذف حساب موظف",
        targetType: "employee",
        targetId: employeeId,
        targetTitle: emp.name,
        previousState: "نشط",
        newState: "محذوف ومؤرشف (مع الاحتفاظ بالسجلات)",
        reason: trimmedReason,
      });

      return {
        success: true,
        message:
          "تم حذف الحساب وأرشفته مع الحفاظ الكامل على السجلات المالية والرقابية.",
      };
    },
    [addAuditLog, employees, setEmployees],
  );
  return {
    adjustEmployeeBalance,
    updateEmployeeWithdrawalAddress,
    deleteEmployeeAccount,
  };
}
