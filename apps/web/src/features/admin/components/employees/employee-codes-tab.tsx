"use client";

import Link from "next/link";
import { AdminBadge } from "../common/admin-badge";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminTableShell } from "../common/admin-table";
import type { CodeUsageRecord } from "../../types/admin.types";

export function EmployeeCodesTab({
  employeeCodeUsages,
}: {
  readonly employeeCodeUsages: readonly CodeUsageRecord[];
}) {
  return (
    <AdminTableShell>
      {employeeCodeUsages.length === 0 ? (
        <AdminEmptyState title="لم يقم الموظف باستخدام رموز مهام حتى الآن" />
      ) : (
        <table className="w-full text-right text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
            <tr>
              <th className="px-4 py-3">الرمز المستخدم</th>
              <th className="px-4 py-3">المهمة المرتبطة</th>
              <th className="px-4 py-3">توقيت الفتح الناجح</th>
              <th className="px-4 py-3">حالة التسليم اللاحقة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employeeCodeUsages.map((usage) => (
              <tr key={usage.id} className="hover:bg-slate-50/70">
                <td
                  className="px-4 py-3 font-mono font-bold text-emerald-800"
                  dir="ltr"
                >
                  <Link
                    href={`/admin/codes/${usage.codeId}`}
                    className="hover:underline"
                  >
                    {usage.code}
                  </Link>
                </td>
                <td className="px-4 py-3 font-bold text-slate-800">
                  <Link
                    href={`/admin/tasks/${usage.taskId}`}
                    className="hover:underline"
                  >
                    {usage.taskTitle}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500" dir="ltr">
                  {usage.unlockedAt}
                </td>
                <td className="px-4 py-3">
                  <AdminBadge
                    variant={
                      usage.submissionState === "approved"
                        ? "success"
                        : usage.submissionState === "submitted"
                          ? "info"
                          : "neutral"
                    }
                    size="sm"
                  >
                    {usage.submissionState === "approved"
                      ? "معتمد"
                      : usage.submissionState === "submitted"
                        ? "تم الإرسال"
                        : "لم يتم الإرسال بعد"}
                  </AdminBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminTableShell>
  );
}
