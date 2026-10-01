"use client";

import Link from "next/link";
import { AdminBadge } from "../common/admin-badge";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminTableShell } from "../common/admin-table";
import type { AdminReferralMember } from "../../types/admin.types";

export function EmployeeTeamTab({
  employeeReferrals,
}: {
  readonly employeeReferrals: readonly AdminReferralMember[];
}) {
  return (
    <AdminTableShell>
      {employeeReferrals.length === 0 ? (
        <AdminEmptyState title="لا يوجد أعضاء مسجلين برابط إحالة هذا الموظف بعد" />
      ) : (
        <table className="w-full text-right text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
            <tr>
              <th className="px-4 py-3">العضو</th>
              <th className="px-4 py-3">المستوى</th>
              <th className="px-4 py-3">المنصب</th>
              <th className="px-4 py-3">تاريخ الانضمام</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employeeReferrals.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/employees/${member.id}`}
                    className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                  >
                    {member.name}
                  </Link>
                </td>
                <td className="px-4 py-3">المستوى {member.level}</td>
                <td className="px-4 py-3 font-bold text-slate-700">
                  {member.packageId}
                </td>
                <td className="px-4 py-3 text-slate-500" dir="ltr">
                  {member.joinedAt}
                </td>
                <td className="px-4 py-3">
                  <AdminBadge
                    variant={member.status === "active" ? "success" : "neutral"}
                    size="sm"
                  >
                    {member.status === "active" ? "نشط" : "غير نشط"}
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
