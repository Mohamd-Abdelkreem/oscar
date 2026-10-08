"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminSelect } from "../common/admin-select";
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
    {
      label: string;
      variant: "success" | "warning" | "danger" | "info" | "neutral";
    }
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

  const targetOptions = [
    {
      value: "all",
      label: `كل الأهداف والعمليات (${String(auditLogs.length)})`,
    },
    { value: "code", label: "رموز المهام (Task Codes)" },
    { value: "employee", label: "حسابات الموظفين (Employees)" },
    { value: "submission", label: "مراجعة المهام (Submissions)" },
    { value: "withdrawal", label: "السحوبات (Withdrawals)" },
    { value: "deposit", label: "الإيداعات (Deposits)" },
    { value: "task", label: "المهام (Tasks)" },
    { value: "settings", label: "إعدادات النظام (Settings)" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="سجل التدقيق والرقابة الإدارية (Audit Log)"
        description="سجل غير قابل للتعديل يوثق كافة القرارات والتعديلات الإدارية وتغييرات القيود التشغيلية مع المسؤول المنفذ والسبب الموثق"
        breadcrumbs={[{ label: "سجل التدقيق" }]}
      />

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <AdminInput
              icon={Search}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث بالإجراء، الهدف، المسؤول، أو السبب الموثق..."
              aria-label="بحث في سجل التدقيق"
            />
          </div>

          <div>
            <AdminSelect
              value={targetFilter}
              onValueChange={(val) => {
                setTargetFilter(val);
                setCurrentPage(1);
              }}
              options={targetOptions}
              ariaLabel="تصفية حسب نوع الهدف"
            />
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
                    <td className="px-4 py-3 font-bold whitespace-nowrap text-slate-900">
                      {log.action}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <AdminBadge variant={badge.variant} size="sm">
                        {badge.label}
                      </AdminBadge>
                    </td>

                    <td
                      className="max-w-xs truncate px-4 py-3 font-semibold text-slate-800"
                      title={log.targetTitle}
                    >
                      {log.targetTitle}
                    </td>

                    <td
                      className="max-w-sm px-4 py-3 text-slate-600"
                      title={log.reason}
                    >
                      {log.reason ?? "—"}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      <div className="space-y-0.5">
                        <span className="block font-bold">{log.adminName}</span>
                        <bdi
                          dir="ltr"
                          className="block font-mono text-[10px] text-slate-400"
                        >
                          {log.adminEmail}
                        </bdi>
                      </div>
                    </td>

                    <td
                      className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-slate-500"
                      dir="ltr"
                    >
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
