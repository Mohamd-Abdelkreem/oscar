"use client";

import { AdminBadge } from "../common/admin-badge";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminTableShell } from "../common/admin-table";
import type { AdminSubmission } from "../../types/admin.types";

export function EmployeeTasksTab({
  employeeSubmissions,
}: {
  readonly employeeSubmissions: readonly AdminSubmission[];
}) {
  return (
    <AdminTableShell>
      {employeeSubmissions.length === 0 ? (
        <AdminEmptyState title="لا توجد مهام مرسلة من هذا الموظف" />
      ) : (
        <table className="w-full text-right text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
            <tr>
              <th className="px-4 py-3">عنوان المهمة</th>
              <th className="px-4 py-3">المكافأة</th>
              <th className="px-4 py-3">تاريخ الإرسال</th>
              <th className="px-4 py-3">حالة المراجعة</th>
              <th className="px-4 py-3">ملاحظات التدقيق</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employeeSubmissions.map((sub) => (
              <tr key={sub.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 font-bold text-slate-900">
                  {sub.taskTitle}
                </td>
                <td
                  className="px-4 py-3 font-mono font-bold text-emerald-700"
                  dir="ltr"
                >
                  +{sub.rewardAmount.toFixed(2)} USDT
                </td>
                <td className="px-4 py-3 text-slate-500" dir="ltr">
                  {sub.submittedAt}
                </td>
                <td className="px-4 py-3">
                  <AdminBadge
                    variant={
                      sub.status === "approved"
                        ? "success"
                        : sub.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                    size="sm"
                  >
                    {sub.status === "approved"
                      ? "معتمد"
                      : sub.status === "rejected"
                        ? "مرفوض"
                        : "قيد المراجعة"}
                  </AdminBadge>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {sub.rejectionReason ??
                    (sub.reviewedBy ? `معتمد بواسطة ${sub.reviewedBy}` : "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminTableShell>
  );
}
