"use client";

import { AdminBadge } from "../common/admin-badge";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminTableShell } from "../common/admin-table";
import type { AdminWithdrawal } from "../../types/admin.types";

export function EmployeeWithdrawalsTab({
  employeeWithdrawals,
}: {
  readonly employeeWithdrawals: readonly AdminWithdrawal[];
}) {
  return (
    <AdminTableShell>
      {employeeWithdrawals.length === 0 ? (
        <AdminEmptyState title="لا توجد طلبات سحب لهذا الموظف" />
      ) : (
        <table className="w-full text-right text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
            <tr>
              <th className="px-4 py-3">المبلغ المطلوب</th>
              <th className="px-4 py-3">الرسوم (21%)</th>
              <th className="px-4 py-3">الصافي المحول</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">تاريخ الطلب</th>
              <th className="px-4 py-3">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employeeWithdrawals.map((wth) => (
              <tr key={wth.id} className="hover:bg-slate-50/70">
                <td
                  className="px-4 py-3 font-mono font-bold text-slate-900"
                  dir="ltr"
                >
                  {wth.amount.toFixed(2)} USDT
                </td>
                <td className="px-4 py-3 font-mono text-slate-500" dir="ltr">
                  {wth.fee.toFixed(2)} USDT
                </td>
                <td
                  className="px-4 py-3 font-mono font-bold text-emerald-700"
                  dir="ltr"
                >
                  {wth.netAmount.toFixed(2)} USDT
                </td>
                <td className="px-4 py-3">
                  <AdminBadge
                    variant={
                      wth.status === "completed"
                        ? "success"
                        : wth.status === "held"
                          ? "danger"
                          : "info"
                    }
                    size="sm"
                  >
                    {wth.status === "completed"
                      ? "مكتمل"
                      : wth.status === "held"
                        ? "معلق"
                        : wth.status === "scheduled"
                          ? "مجدول"
                          : "قيد المعالجة"}
                  </AdminBadge>
                </td>
                <td className="px-4 py-3 text-slate-500" dir="ltr">
                  {wth.requestedAt}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {wth.holdReason ?? wth.rejectionReason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminTableShell>
  );
}
