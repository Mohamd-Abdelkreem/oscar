"use client";
import { useCallback } from "react";
import type { TaskStatus } from "../../types/employee.types";
import { creditTaskReward } from "../../utils/balance-transitions";
import { formatLocalTime } from "../../utils/financial-calculations";
import { createTaskRewardTransaction } from "../../utils/ledger-transactions";
import type { EmployeeActionDependencies } from "../employee-state.types";

export function useEmployeeTaskActions({
  task,
  setBalance,
  setTask,
  setTransactions,
}: Pick<
  EmployeeActionDependencies,
  "task" | "setBalance" | "setTask" | "setTransactions"
>) {
  const submitTask = useCallback(
    (screenshotUrl: string): { success: boolean; message: string } => {
      if (task.status === "submitted" || task.status === "approved") {
        return { success: false, message: "تم إرسال مهمة اليوم مسبقاً." };
      }

      const reward = task.rewardAmount;
      const now = new Date();
      const timeStr = formatLocalTime(now);

      setTask((prev) => ({
        ...prev,
        status: "submitted",
        submittedScreenshot: screenshotUrl,
        submittedAt: timeStr,
      }));

      // In the demo, reward is added immediately on submission
      setBalance((prev) => creditTaskReward(prev, reward));

      const newTx = createTaskRewardTransaction(reward, now);

      setTransactions((prev) => [newTx, ...prev]);

      return {
        success: true,
        message:
          "تم إرسال المهمة بنجاح وإضافة المكافأة (" +
          reward.toFixed(2) +
          " USDT) قيد المراجعة.",
      };
    },
    [task.rewardAmount, task.status, setBalance, setTask, setTransactions],
  );

  const replaceTaskScreenshot = useCallback(
    (screenshotUrl: string): { success: boolean; message: string } => {
      if (task.status !== "submitted") {
        return {
          success: false,
          message:
            "يمكن استبدال لقطة الشاشة فقط عندما تكون المهمة قيد المراجعة.",
        };
      }

      setTask((prev) => ({
        ...prev,
        submittedScreenshot: screenshotUrl,
      }));

      return {
        success: true,
        message: "تم تحديث لقطة الشاشة المرفقة بنجاح دون تغيير المكافأة.",
      };
    },
    [task.status, setTask],
  );

  const setTaskScenario = useCallback(
    (scenario: TaskStatus) => {
      setTask((prev) => ({
        ...prev,
        status: scenario,
        submittedScreenshot:
          scenario === "submitted"
            ? prev.submittedScreenshot || "/employee/task-preview.svg"
            : undefined,
        rejectionReason:
          scenario === "rejected"
            ? "لقطة الشاشة غير واضحة ولا تثبت التفاعل المطلوب على المنصة."
            : undefined,
      }));
    },
    [setTask],
  );
  return { submitTask, replaceTaskScreenshot, setTaskScenario };
}
