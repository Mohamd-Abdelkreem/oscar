"use client";

import { useCallback } from "react";
import type {
  CodeUsageRecord,
  TaskUnlockCode,
  UnlockCodeResult,
} from "../../types/admin.types";
import { CURRENT_ADMIN } from "../../constants/admin.constants";
import { generateId, getNowTimestamp } from "../../utils/admin-records";
import type { AdminActionDependencies } from "../admin-state.types";

export function useTaskCodeActions({
  employees,
  tasks,
  codes,
  codeUsages,
  setCodes,
  setCodeUsages,
  addAuditLog,
}: Pick<
  AdminActionDependencies,
  | "employees"
  | "tasks"
  | "codes"
  | "codeUsages"
  | "setCodes"
  | "setCodeUsages"
  | "addAuditLog"
>) {
  const isTaskUnlockedForEmployee = useCallback(
    (taskId: string, employeeId: string): boolean => {
      return codeUsages.some(
        (usage) => usage.taskId === taskId && usage.employeeId === employeeId,
      );
    },
    [codeUsages],
  );

  const unlockTaskWithCode = useCallback(
    (
      taskId: string,
      employeeId: string,
      inputCode: string,
    ): UnlockCodeResult => {
      const normalizedCode = inputCode.trim().toUpperCase();
      const emp = employees.find((e) => e.id === employeeId);

      if (
        emp?.accountStatus === "suspended" ||
        emp?.accountStatus === "blocked"
      ) {
        return {
          success: false,
          reason: "account_suspended",
          message: "حسابك معلق حالياً من قبل الإدارة",
        };
      }

      if (emp?.restrictions.tasksBlocked) {
        return {
          success: false,
          reason: "task_restricted",
          message: "تم إيقاف صلاحية تنفيذ المهام لحسابك من قبل الإدارة",
        };
      }

      const matchingCode = codes.find((c) => c.code === normalizedCode);

      if (!matchingCode) {
        return {
          success: false,
          reason: "invalid_code",
          message: "الرمز غير صحيح",
        };
      }

      if (matchingCode.taskId !== taskId) {
        return {
          success: false,
          reason: "wrong_task",
          message: "هذا الرمز مخصص لمهمة أخرى",
        };
      }

      if (matchingCode.status !== "active") {
        return {
          success: false,
          reason: "code_paused",
          message: "هذا الرمز متوقف حالياً",
        };
      }

      const alreadyUnlocked = codeUsages.some(
        (u) => u.taskId === taskId && u.employeeId === employeeId,
      );
      if (alreadyUnlocked) {
        return {
          success: true,
          message: "تم فتح المهمة بنجاح",
        };
      }

      const targetTask = tasks.find((t) => t.id === taskId);
      const nowStr = getNowTimestamp();

      const newUsage: CodeUsageRecord = {
        id: generateId("usg"),
        codeId: matchingCode.id,
        code: matchingCode.code,
        taskId,
        taskTitle: targetTask?.title ?? "مهمة غير معروفة",
        employeeId,
        employeeName: emp?.name ?? "موظف مجهول",
        employeeEmail: emp?.email ?? "",
        unlockedAt: nowStr,
        submissionState: "not_submitted",
      };

      setCodeUsages((prev) => [newUsage, ...prev]);

      addAuditLog({
        action: "فتح مهمة بواسطة رمز",
        targetType: "code",
        targetId: matchingCode.id,
        targetTitle: matchingCode.code,
        previousState: "مقفل",
        newState: `مفتوح للموظف (${emp?.name ?? employeeId})`,
        reason: "استخدام ناجح لرمز فتح المهمة",
      });

      return {
        success: true,
        message: "تم فتح المهمة بنجاح",
      };
    },
    [addAuditLog, codeUsages, codes, employees, tasks, setCodeUsages],
  );

  const createCode = useCallback(
    (data: {
      code: string;
      taskId: string;
      status: "active" | "paused";
      description?: string | undefined;
    }): {
      success: boolean;
      message: string;
      code?: TaskUnlockCode | undefined;
    } => {
      const normalized = data.code.trim().toUpperCase();

      if (!normalized) {
        return { success: false, message: "يرجى إدخال رمز صالح" };
      }

      const exists = codes.some((c) => c.code === normalized);
      if (exists) {
        return {
          success: false,
          message: "هذا الرمز موجود مسبقاً في النظام. يرجى اختيار رمز فريد.",
        };
      }

      const targetTask = tasks.find((t) => t.id === data.taskId);
      if (!targetTask) {
        return { success: false, message: "المهمة المحددة غير موجودة" };
      }

      const newCode: TaskUnlockCode = {
        id: generateId("cod"),
        code: normalized,
        taskId: data.taskId,
        status: data.status,
        createdBy: `${CURRENT_ADMIN.name} (ADMIN)`,
        createdAt: getNowTimestamp(),
        description: data.description?.trim() || undefined,
      };

      setCodes((prev) => [newCode, ...prev]);

      addAuditLog({
        action: "إنشاء رمز فتح مهمة",
        targetType: "code",
        targetId: newCode.id,
        targetTitle: newCode.code,
        previousState: "غير موجود",
        newState: `${newCode.status === "active" ? "نشط" : "متوقف"} (مهمة: ${targetTask.title})`,
        reason: data.description?.trim() || "إنشاء رمز مهمة جديد",
      });

      return {
        success: true,
        message: "تم إنشاء رمز فتح المهمة بنجاح",
        code: newCode,
      };
    },
    [addAuditLog, codes, tasks, setCodes],
  );

  const toggleCodeStatus = useCallback(
    (codeId: string) => {
      const target = codes.find((c) => c.id === codeId);
      if (!target) return;

      const nextStatus = target.status === "active" ? "paused" : "active";

      setCodes((prev) =>
        prev.map((c) =>
          c.id === codeId
            ? { ...c, status: nextStatus, updatedAt: getNowTimestamp() }
            : c,
        ),
      );

      addAuditLog({
        action: "تعديل حالة رمز المهمة",
        targetType: "code",
        targetId: target.id,
        targetTitle: target.code,
        previousState: target.status === "active" ? "نشط" : "متوقف",
        newState: nextStatus === "active" ? "نشط" : "متوقف",
        reason:
          nextStatus === "paused"
            ? "إيقاف الرمز مؤقتاً لمنع فتح المهمة لمستخدمين جدد"
            : "إعادة تفعيل الرمز للسماح بالاستخدام",
      });
    },
    [addAuditLog, codes, setCodes],
  );

  const getDistinctCodeUsersCount = useCallback(
    (codeId: string): number => {
      const users = new Set(
        codeUsages.filter((u) => u.codeId === codeId).map((u) => u.employeeId),
      );
      return users.size;
    },
    [codeUsages],
  );

  const getDistinctTaskUnlocksCount = useCallback(
    (taskId: string): number => {
      const users = new Set(
        codeUsages.filter((u) => u.taskId === taskId).map((u) => u.employeeId),
      );
      return users.size;
    },
    [codeUsages],
  );
  return {
    isTaskUnlockedForEmployee,
    unlockTaskWithCode,
    createCode,
    toggleCodeStatus,
    getDistinctCodeUsersCount,
    getDistinctTaskUnlocksCount,
  };
}
