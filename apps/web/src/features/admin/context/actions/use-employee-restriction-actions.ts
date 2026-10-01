"use client";

import { useCallback } from "react";

import type { AdminActionDependencies } from "../admin-state.types";

export function useEmployeeRestrictionActions({
  employees,
  setEmployees,
  addAuditLog,
}: Pick<
  AdminActionDependencies,
  "employees" | "setEmployees" | "addAuditLog"
>) {
  const toggleEmployeeAccountStatus = useCallback(
    (employeeId: string) => {
      const emp = employees.find((e) => e.id === employeeId);
      if (!emp) return;

      const nextStatus =
        emp.accountStatus === "active" ? "suspended" : "active";

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId ? { ...e, accountStatus: nextStatus } : e,
        ),
      );

      addAuditLog({
        action: "تغيير حالة حساب الموظف",
        targetType: "employee",
        targetId: employeeId,
        targetTitle: emp.name,
        previousState: emp.accountStatus,
        newState: nextStatus,
        reason:
          nextStatus === "suspended"
            ? "تعليق حساب الموظف"
            : "إعادة تفعيل الحساب",
      });
    },
    [addAuditLog, employees, setEmployees],
  );

  const toggleEmployeeTaskRestriction = useCallback(
    (employeeId: string) => {
      const emp = employees.find((e) => e.id === employeeId);
      if (!emp) return;

      const nextVal = !emp.restrictions.tasksBlocked;

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                restrictions: {
                  ...e.restrictions,
                  tasksBlocked: nextVal,
                },
              }
            : e,
        ),
      );

      addAuditLog({
        action: "تعديل حظر تنفيذ المهام",
        targetType: "employee",
        targetId: employeeId,
        targetTitle: emp.name,
        previousState: emp.restrictions.tasksBlocked ? "محظور" : "مسموح",
        newState: nextVal ? "محظور" : "مسموح",
        reason: nextVal
          ? "حظر الموظف من تنفيذ المهام"
          : "إلغاء حظر تنفيذ المهام",
      });
    },
    [addAuditLog, employees, setEmployees],
  );

  const toggleEmployeeWithdrawalRestriction = useCallback(
    (employeeId: string) => {
      const emp = employees.find((e) => e.id === employeeId);
      if (!emp) return;

      const nextVal = !emp.restrictions.withdrawalsBlocked;

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? {
                ...e,
                restrictions: {
                  ...e.restrictions,
                  withdrawalsBlocked: nextVal,
                },
              }
            : e,
        ),
      );

      addAuditLog({
        action: "تعديل حظر السحب",
        targetType: "employee",
        targetId: employeeId,
        targetTitle: emp.name,
        previousState: emp.restrictions.withdrawalsBlocked ? "محظور" : "مسموح",
        newState: nextVal ? "محظور" : "مسموح",
        reason: nextVal ? "حظر الموظف من طلب السحب" : "إلغاء حظر طلب السحب",
      });
    },
    [addAuditLog, employees, setEmployees],
  );
  return {
    toggleEmployeeAccountStatus,
    toggleEmployeeTaskRestriction,
    toggleEmployeeWithdrawalRestriction,
  };
}
