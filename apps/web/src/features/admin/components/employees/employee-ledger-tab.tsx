"use client";

import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminTableShell } from "../common/admin-table";
import type { AdminFinanceTransaction } from "../../types/admin.types";

export function EmployeeLedgerTab({
  employeeTransactions,
}: {
  readonly employeeTransactions: readonly AdminFinanceTransaction[];
}) {
  return (
    <AdminTableShell>
      {employeeTransactions.length === 0 ? (
        <AdminEmptyState title="لا توجد عمليات مالية مسجلة لهذا الموظف" />
      ) : (
        <table className="w-full text-right text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
            <tr>
              <th className="px-4 py-3">البيان / العملية</th>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3">المبلغ</th>
              <th className="px-4 py-3">المرجع</th>
              <th className="px-4 py-3">المصدر</th>
              <th className="px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employeeTransactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 font-bold text-slate-900">
                  {tx.title}
                </td>
                <td className="px-4 py-3 text-slate-500">{tx.type}</td>
                <td className="px-4 py-3 font-mono font-bold" dir="ltr">
                  <span
                    className={
                      tx.amount > 0
                        ? "text-emerald-700"
                        : tx.amount < 0
                          ? "text-rose-600"
                          : "text-slate-500"
                    }
                  >
                    {tx.amount > 0
                      ? `+${tx.amount.toFixed(2)}`
                      : tx.amount.toFixed(2)}{" "}
                    USDT
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-slate-500" dir="ltr">
                  {tx.reference}
                </td>
                <td className="px-4 py-3 text-slate-500">{tx.source}</td>
                <td className="px-4 py-3 text-slate-500" dir="ltr">
                  {tx.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminTableShell>
  );
}
