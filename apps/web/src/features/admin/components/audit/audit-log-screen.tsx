"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";

const PAGE_SIZE = 12;

export function AuditLogScreen() {
  const { auditLogs } = useAdminState();

  const [searchQuery, setSearchQuery] = useState("");
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (
          !log.action.toLowerCase().includes(q) &&
          !log.targetTitle.toLowerCase().includes(q) &&
          !log.adminName.toLowerCase().includes(q) &&
          !(log.reason && log.reason.toLowerCase().includes(q))
        ) {
          return false;
        }
      }

      if (targetFilter !== "all" && log.targetType !== targetFilter) {
        return false;
      }

      return true;
    });
  }, [auditLogs, searchQuery, targetFilter]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const targetTypeBadgeMap: Record<
    string,
    { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }
  > = {
    code: { label: "رموز المهام", variant: "success" },
    employee: { label: "حسابات الموظفين", variant: "info" },
    task: { label: "المهام اليومية", variant: "warning" },
    submission: { label: "تدقيق المهام", variant: "warning" },
    deposit: { label: "الإيداعات", variant: "success" },
    withdrawal: { label: "السحوبات", variant: "danger" },
    package: { label: "الباقات والمناصب", variant: "info" },
    settings: { label: "إعدادات النظام", variant: "neutral" },
    banner: { label: "البانرات والمحتوى", variant: "neutral" },
    admin: { label: "مسؤولو النظام", variant: "neutral" },
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="سجل التدقيق والرقابة الإدارية (Audit Log)"
        description="سجل غير قابل للتعديل يوثق كافة القرارات والتعديلات الإدارية وتغييرات القيود التشغيلية مع المسؤول المنفذ والسبب الموثق"
        breadcrumbs={[{ label: "سجل التدقيق" }]}
      />

      {/* Filter and Search Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث بالإجراء، الهدف، المسؤول، أو السبب الموثق..."
              className="w-full rounded-md border border-slate-300 bg-white py-2 pr-9 pl-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 sm:text-sm"
            />
          </div>

          <div>
            <select
              value={targetFilter}
              onChange={(e) => {
                setTargetFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 sm:text-sm"
              aria-label="تصفية حسب نوع الهدف"
            >
              <option value="all">كل الأهداف والعمليات ({auditLogs.length})</option>
              <option value="code">رموز المهام (Task Codes)</option>
              <option value="employee">حسابات الموظفين (Employees)</option>
              <option value="submission">مراجعة المهام (Submissions)</option>
              <option value="withdrawal">السحوبات (Withdrawals)</option>
              <option value="deposit">الإيداعات (Deposits)</option>
              <option value="task">المهام (Tasks)</option>
              <option value="settings">إعدادات النظام (Settings)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredLogs.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        }
      >
        {filteredLogs.length === 0 ? (
          <AdminEmptyState
            title="لا توجد سجلات تدقيق مطابقة"
            description="لم يتم العثور على أي إجراءات مسجلة تطابق معايير البحث الحالية."
          />
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">الإجراء الإداري</th>
                <th className="px-4 py-3">تصنيف الهدف</th>
                <th className="px-4 py-3">الهدف المستهدف</th>
                <th className="px-4 py-3">السبب الموثق</th>
                <th className="px-4 py-3">المسؤول المنفذ</th>
                <th className="px-4 py-3">التوقيت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map((log) => {
                const badge = targetTypeBadgeMap[log.targetType] ?? {
                  label: log.targetType,
                  variant: "neutral",
                };

                return (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">
                      {log.action}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <AdminBadge variant={badge.variant} size="sm">
                        {badge.label}
                      </AdminBadge>
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-800 max-w-xs truncate" title={log.targetTitle}>
                      {log.targetTitle}
                    </td>

                    <td className="px-4 py-3 text-slate-600 max-w-sm" title={log.reason}>
                      {log.reason ?? "—"}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      <div className="space-y-0.5">
                        <span className="font-bold block">{log.adminName}</span>
                        <bdi dir="ltr" className="text-[10px] text-slate-400 block font-mono">
                          {log.adminEmail}
                        </bdi>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-500" dir="ltr">
                      {log.timestamp}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminTableShell>
    </div>
  );
}
