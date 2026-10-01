"use client";

import { useContext } from "react";
import { AdminStateContext } from "../context/admin-state.context";
import type { UnlockCodeResult } from "../types/admin.types";

export function useTaskCodeGate(taskId: string, employeeId: string) {
  const adminState = useContext(AdminStateContext);

  if (!adminState) {
    return {
      hasAdminProvider: false,
      isTaskUnlocked: true,
      unlockTaskWithCode: (_code: string): UnlockCodeResult => ({
        success: true,
        message: "تم فتح المهمة بنجاح",
      }),
    };
  }

  return {
    hasAdminProvider: true,
    isTaskUnlocked: adminState.isTaskUnlockedForEmployee(taskId, employeeId),
    unlockTaskWithCode: (code: string): UnlockCodeResult =>
      adminState.unlockTaskWithCode(taskId, employeeId, code),
  };
}
