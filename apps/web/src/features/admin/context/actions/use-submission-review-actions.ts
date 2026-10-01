"use client";

import { useCallback } from "react";
import type { AdminFinanceTransaction } from "../../types/admin.types";
import { CURRENT_ADMIN } from "../../constants/admin.constants";
import { generateId, getNowTimestamp } from "../../utils/admin-records";
import type { AdminActionDependencies } from "../admin-state.types";

export function useSubmissionReviewActions({
  submissions,
  setEmployees,
  setCodeUsages,
  setSubmissions,
  setFinanceTransactions,
  addAuditLog,
}: Pick<
  AdminActionDependencies,
  | "submissions"
  | "setEmployees"
  | "setCodeUsages"
  | "setSubmissions"
  | "setFinanceTransactions"
  | "addAuditLog"
>) {
  const approveSubmission = useCallback(
    (submissionId: string) => {
      const sub = submissions.find((s) => s.id === submissionId);
      if (!sub || sub.status === "approved") return;

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                status: "approved",
                reviewedAt: getNowTimestamp(),
                reviewedBy: `${CURRENT_ADMIN.name} (ADMIN)`,
              }
            : s,
        ),
      );

      setCodeUsages((prev) =>
        prev.map((u) =>
          u.taskId === sub.taskId && u.employeeId === sub.employeeId
            ? { ...u, submissionState: "approved" }
            : u,
        ),
      );

      addAuditLog({
        action: "اعتماد تسليم مهمة",
        targetType: "submission",
        targetId: submissionId,
        targetTitle: `تسليم ${sub.employeeName} لمهمة (${sub.taskTitle})`,
        previousState: sub.status,
        newState: "معتمد",
        reason: "تم التحقق من لقطة الشاشة وصحة التقييم",
      });
    },
    [addAuditLog, submissions, setSubmissions, setCodeUsages],
  );

  const rejectSubmission = useCallback(
    (
      submissionId: string,
      rejectionReason: string,
    ): { success: boolean; message: string } => {
      const trimmedReason = rejectionReason.trim();
      if (!trimmedReason) {
        return { success: false, message: "يرجى كتابة سبب الرفض الإلزامي." };
      }

      const sub = submissions.find((s) => s.id === submissionId);
      if (!sub) {
        return { success: false, message: "التسليم غير موجود" };
      }

      if (sub.status === "rejected") {
        return { success: false, message: "تم رفض هذا التسليم مسبقاً" };
      }

      const nowStr = getNowTimestamp();

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                status: "rejected",
                reviewedAt: nowStr,
                reviewedBy: `${CURRENT_ADMIN.name} (ADMIN)`,
                rejectionReason: trimmedReason,
                isReversed: true,
              }
            : s,
        ),
      );

      if (!sub.isReversed) {
        const reward = sub.rewardAmount;
        setEmployees((prev) =>
          prev.map((emp) => {
            if (emp.id === sub.employeeId) {
              const newAvail = Math.max(0, emp.balance.available - reward);
              const newTotal = Math.max(0, emp.balance.total - reward);
              return {
                ...emp,
                balance: {
                  ...emp.balance,
                  available: newAvail,
                  total: newTotal,
                },
              };
            }
            return emp;
          }),
        );

        const reversalTx: AdminFinanceTransaction = {
          id: generateId("tx_rev"),
          employeeId: sub.employeeId,
          employeeName: sub.employeeName,
          type: "task_reward_reversal",
          title: `عكس مكافأة مهمة مرفوضة (${sub.taskTitle})`,
          amount: -reward,
          direction: "debit",
          status: "completed",
          reference: `REV-SUB-${submissionId}`,
          source: "تدقيق المهام الإداري",
          date: nowStr,
          details: {
            السبب: trimmedReason,
            "مبلغ الخصم": `${reward.toFixed(2)} USDT`,
          },
        };

        setFinanceTransactions((prev) => [reversalTx, ...prev]);
      }

      setCodeUsages((prev) =>
        prev.map((u) =>
          u.taskId === sub.taskId && u.employeeId === sub.employeeId
            ? { ...u, submissionState: "rejected" }
            : u,
        ),
      );

      addAuditLog({
        action: "رفض تسليم مهمة وعكس المكافأة",
        targetType: "submission",
        targetId: submissionId,
        targetTitle: `تسليم ${sub.employeeName} لمهمة (${sub.taskTitle})`,
        previousState: sub.status,
        newState: "مرفوض وعكس المكافأة",
        reason: trimmedReason,
      });

      return {
        success: true,
        message: "تم رفض التسليم وعكس المكافأة من رصيد الموظف بنجاح.",
      };
    },
    [
      addAuditLog,
      submissions,
      setSubmissions,
      setEmployees,
      setFinanceTransactions,
      setCodeUsages,
    ],
  );
  return { approveSubmission, rejectSubmission };
}
