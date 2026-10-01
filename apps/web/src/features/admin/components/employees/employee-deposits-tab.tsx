"use client";

import { AdminBadge } from "../common/admin-badge";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminTableShell } from "../common/admin-table";
import type { AdminDeposit } from "../../types/admin.types";

export function EmployeeDepositsTab({
  employeeDeposits,
}: {
  readonly employeeDeposits: readonly AdminDeposit[];
}) {
  return (
    <AdminTableShell>
      {employeeDeposits.length === 0 ? (
        <AdminEmptyState title="لا توجد إيداعات مسجلة لهذا الموظف" />
      ) : (
        <table className="w-full text-right text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
            <tr>
              <th className="px-4 py-3">المبلغ</th>
              <th className="px-4 py-3">الشبكة</th>
              <th className="px-4 py-3">معرف المعاملة (TxID)</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employeeDeposits.map((dep) => (
              <tr key={dep.id} className="hover:bg-slate-50/70">
                <td
                  className="px-4 py-3 font-mono font-bold text-emerald-700"
                  dir="ltr"
                >
                  {dep.amount.toFixed(2)} USDT
                </td>
                <td className="px-4 py-3 text-slate-600">{dep.network}</td>
                <td
                  className="px-4 py-3 font-mono text-[11px] break-all text-slate-500"
                  dir="ltr"
                >
                  {dep.txId}
                </td>
                <td className="px-4 py-3">
                  <AdminBadge
                    variant={dep.status === "confirmed" ? "success" : "warning"}
                    size="sm"
                  >
                    {dep.status === "confirmed" ? "مؤكد" : "قيد التحقق"}
                  </AdminBadge>
                </td>
                <td className="px-4 py-3 text-slate-500" dir="ltr">
                  {dep.createdAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminTableShell>
  );
}
