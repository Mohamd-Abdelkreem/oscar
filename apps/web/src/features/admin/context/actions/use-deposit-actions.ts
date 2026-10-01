"use client";

import { useCallback } from "react";
import type {
  AdminDeposit,
  AdminFinanceTransaction,
} from "../../types/admin.types";
import { generateId, getNowTimestamp } from "../../utils/admin-records";
import type { AdminActionDependencies } from "../admin-state.types";

export function useDepositActions({
  employees,
  deposits,
  setEmployees,
  setDeposits,
  setFinanceTransactions,
  addAuditLog,
}: Pick<
  AdminActionDependencies,
  | "employees"
  | "deposits"
  | "setEmployees"
  | "setDeposits"
  | "setFinanceTransactions"
  | "addAuditLog"
>) {
  const manualCreditDeposit = useCallback(
    (
      employeeId: string,
      amount: number,
      reference: string,
      reason: string,
    ): { success: boolean; message: string } => {
      const trimmedRef = reference.trim();
      const trimmedReason = reason.trim();

      if (!trimmedRef || !trimmedReason) {
        return {
          success: false,
          message: "يرجى تعبئة الرقم المرجعي والسبب الإلزامي.",
        };
      }

      if (amount <= 0 || isNaN(amount)) {
        return { success: false, message: "يرجى إدخال مبلغ صحيح." };
      }

      const refExists = deposits.some((d) => d.reference === trimmedRef);
      if (refExists) {
        return {
          success: false,
          message: "هذا الرقم المرجعي مسجل مسبقاً لمنع تكرار الإيداع.",
        };
      }

      const emp = employees.find((e) => e.id === employeeId);
      if (!emp) return { success: false, message: "الموظف غير موجود" };

      const nowStr = getNowTimestamp();
      const newDep: AdminDeposit = {
        id: generateId("dep_man"),
        employeeId: emp.id,
        employeeName: emp.name,
        employeeEmail: emp.email,
        amount,
        currency: "USDT",
        network: "TRON (TRC20)",
        txId: generateId("MANUAL"),
        toAddress: emp.walletAddress,
        status: "confirmed",
        createdAt: nowStr,
        reference: trimmedRef,
        isManual: true,
        manualReason: trimmedReason,
      };

      setDeposits((prev) => [newDep, ...prev]);

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                balance: {
                  ...e.balance,
                  available: e.balance.available + amount,
                  total: e.balance.total + amount,
                },
              }
            : e,
        ),
      );

      const depTx: AdminFinanceTransaction = {
        id: generateId("tx_dep"),
        employeeId: emp.id,
        employeeName: emp.name,
        type: "deposit",
        title: "إيداع يدوي معتمد من الإدارة",
        amount,
        direction: "credit",
        status: "completed",
        reference: trimmedRef,
        source: "إدارة العمليات",
        date: nowStr,
        details: {
          السبب: trimmedReason,
        },
      };

      setFinanceTransactions((prev) => [depTx, ...prev]);

      addAuditLog({
        action: "إيداع يدوي معتمد",
        targetType: "deposit",
        targetId: newDep.id,
        targetTitle: `إيداع ${amount.toFixed(2)} USDT - ${emp.name}`,
        previousState: "غير موجود",
        newState: "مؤكد",
        reason: `${trimmedReason} (المرجع: ${trimmedRef})`,
      });

      return {
        success: true,
        message: `تم إضافة الإيداع واعتماد ${amount.toFixed(2)} USDT في رصيد الموظف بنجاح.`,
      };
    },
    [
      addAuditLog,
      deposits,
      employees,
      setDeposits,
      setEmployees,
      setFinanceTransactions,
    ],
  );
  return { manualCreditDeposit };
}
