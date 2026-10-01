"use client";

import { AdminEmptyState } from "../common/admin-empty-state";
import type { AdminAuditLog } from "../../types/admin.types";

export function EmployeeAuditTab({
  employeeAuditLogs,
}: {
  readonly employeeAuditLogs: readonly AdminAuditLog[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
      {employeeAuditLogs.length === 0 ? (
        <AdminEmptyState title="لا توجد إجراءات تدقيقية مسجلة على هذا الحساب" />
      ) : (
        <div className="divide-y divide-slate-100">
          {employeeAuditLogs.map((log) => (
            <div key={log.id} className="space-y-1 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{log.action}</span>
                <bdi dir="ltr" className="text-[11px] text-slate-400">
                  {log.timestamp}
                </bdi>
              </div>
              <div className="text-slate-600">
                <span className="font-semibold text-slate-800">
                  {log.targetTitle}
                </span>
                {log.reason && (
                  <span className="text-slate-500"> — {log.reason}</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                المسؤول: {log.adminName}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
