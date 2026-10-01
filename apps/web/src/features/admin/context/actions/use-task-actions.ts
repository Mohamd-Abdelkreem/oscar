"use client";

import { useCallback } from "react";
import type { AdminTask } from "../../types/admin.types";
import { generateId, getNowTimestamp } from "../../utils/admin-records";
import type { AdminActionDependencies } from "../admin-state.types";

export function useTaskActions({
  tasks,
  setTasks,
  addAuditLog,
}: Pick<AdminActionDependencies, "tasks" | "setTasks" | "addAuditLog">) {
  const createTask = useCallback(
    (
      taskData: Omit<AdminTask, "id" | "createdAt">,
    ): { success: boolean; message: string; task?: AdminTask } => {
      const newTask: AdminTask = {
        id: generateId("tsk"),
        createdAt: getNowTimestamp(),
        ...taskData,
      };

      setTasks((prev) => [newTask, ...prev]);

      addAuditLog({
        action: "إنشاء مهمة جديدة",
        targetType: "task",
        targetId: newTask.id,
        targetTitle: newTask.title,
        previousState: "غير موجود",
        newState: `الحالة: ${newTask.status}، النافذة: ${newTask.windowStart}-${newTask.windowEnd}`,
        reason: "إضافة مهمة جديدة لجدول المهام اليومية",
      });

      return {
        success: true,
        message: "تم إنشاء المهمة بنجاح",
        task: newTask,
      };
    },
    [addAuditLog, setTasks],
  );

  const updateTask = useCallback(
    (taskId: string, updates: Partial<AdminTask>) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      );

      addAuditLog({
        action: "تعديل بيانات المهمة",
        targetType: "task",
        targetId: taskId,
        targetTitle: target.title,
        previousState: JSON.stringify(target),
        newState: JSON.stringify({ ...target, ...updates }),
        reason: "تحديث مواصفات أو توقيت المهمة",
      });
    },
    [addAuditLog, tasks, setTasks],
  );

  const toggleTaskStatus = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      const nextStatus = target.status === "active" ? "paused" : "active";

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)),
      );

      addAuditLog({
        action: "تغيير حالة المهمة",
        targetType: "task",
        targetId: taskId,
        targetTitle: target.title,
        previousState: target.status,
        newState: nextStatus,
        reason:
          nextStatus === "active" ? "تفعيل المهمة" : "إيقاف المهمة مؤقتاً",
      });
    },
    [addAuditLog, tasks, setTasks],
  );
  return { createTask, updateTask, toggleTaskStatus };
}
