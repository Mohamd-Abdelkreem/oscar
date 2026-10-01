"use client";

import {
  Eye,
  RotateCcw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminSelect, type AdminSelectOption } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";
import type { AdminAccountStatus } from "../../types/admin.types";

const PAGE_SIZE = 10;

export function EmployeesListScreen() {
  const { employees } = useAdminState();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [restrictionFilter, setRestrictionFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Exclude soft deleted if any
      if (emp.isDeleted) return false;

      // Search matching: name, email, id, invitationCode, walletAddress
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          emp.name.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.id.toLowerCase().includes(q) ||
          emp.invitationCode.toLowerCase().includes(q) ||
          emp.walletAddress.toLowerCase().includes(q);

        if (!matches) return false;
      }

      // Status filter
      if (statusFilter !== "all" && emp.accountStatus !== statusFilter) {
        return false;
      }

      // Package filter
      if (packageFilter !== "all" && emp.packageId !== packageFilter) {
        return false;
      }

      // Restrictions filter
      if (restrictionFilter === "tasks_blocked" && !emp.restrictions.tasksBlocked) {
        return false;
      }
      if (
        restrictionFilter === "withdrawals_blocked" &&
        !emp.restrictions.withdrawalsBlocked
      ) {
        return false;
      }
      if (
        restrictionFilter === "any_blocked" &&
        !emp.restrictions.tasksBlocked &&
        !emp.restrictions.withdrawalsBlocked
      ) {
        return false;
      }
      if (
        restrictionFilter === "clean" &&
        (emp.restrictions.tasksBlocked || emp.restrictions.withdrawalsBlocked)
      ) {
        return false;
      }

      return true;
    });
  }, [employees, searchQuery, statusFilter, packageFilter, restrictionFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredEmployees.length / PAGE_SIZE) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, currentPage]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPackageFilter("all");
    setRestrictionFilter("all");
    setCurrentPage(1);
  };

  const statusMetaMap: Record<
    AdminAccountStatus,
    { label: string; variant: "success" | "warning" | "danger" }
  > = {
    active: { label: "نشط", variant: "success" },
    suspended: { label: "معلق", variant: "warning" },
    blocked: { label: "محظور", variant: "danger" },
  };

  const statusOptions: readonly AdminSelectOption[] = [
    { value: "all", label: "كل حالات الحساب" },
    { value: "active", label: "نشط" },
    { value: "suspended", label: "معلق" },
    { value: "blocked", label: "محظور" },
  ];

  const packageOptions: readonly AdminSelectOption[] = [
    { value: "all", label: "جميع المناصب والباقات" },
    { value: "FREE", label: "الحساب المجاني (FREE)" },
    { value: "S1", label: "منصب S1" },
    { value: "S2", label: "منصب S2" },
    { value: "O1", label: "منصب O1" },
    { value: "O2", label: "منصب O2" },
    { value: "A1", label: "منصب A1" },
  ];

  const restrictionOptions: readonly AdminSelectOption[] = [
    { value: "all", label: "كل القيود التشغيلية" },
    { value: "clean", label: "بدون أي قيود" },
    { value: "tasks_blocked", label: "حظر المهام مفعل" },
    { value: "withdrawals_blocked", label: "حظر السحب مفعل" },
    { value: "any_blocked", label: "أي قيد تشغيلي" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إدارة الموظفين والاشتراكات"
        description="استعراض حسابات الموظفين، أرصدتهم، حالات التقييد التشغيلي، وسجلات الأنشطة"
        breadcrumbs={[{ label: "الموظفون" }]}
      />

      {/* Filter and Search Bar: Standardized 44px Height Control Grid (Requirement 9) */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-center">
          {/* Search Box */}
          <AdminInput
            type="text"
            icon={Search}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="بحث بالاسم، البريد، الرمز، المحفظة..."
            aria-label="بحث في الموظفين"
          />

          {/* Account Status Filter */}
          <AdminSelect
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
            options={statusOptions}
            aria-label="تصفية حسب حالة الحساب"
          />

          {/* Package Filter */}
          <AdminSelect
            value={packageFilter}
            onValueChange={(val) => {
              setPackageFilter(val);
              setCurrentPage(1);
            }}
            options={packageOptions}
            aria-label="تصفية حسب المنصب/الباقة"
          />

          {/* Restrictions Filter */}
          <AdminSelect
            value={restrictionFilter}
            onValueChange={(val) => {
              setRestrictionFilter(val);
              setCurrentPage(1);
            }}
            options={restrictionOptions}
            aria-label="تصفية حسب القيود التشغيلية"
          />
        </div>

        {/* Filters Summary & Reset */}
        {(searchQuery || statusFilter !== "all" || packageFilter !== "all" || restrictionFilter !== "all") && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
            <span>
              تم العثور على{" "}
              <strong className="text-slate-900">{filteredEmployees.length}</strong>{" "}
              موظف مطابق
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>إعادة ضبط التصفية</span>
            </button>
          </div>
        )}
      </div>

      {/* Employees Table */}
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredEmployees.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        }
      >
        {filteredEmployees.length === 0 ? (
          <AdminEmptyState
            title="لم يتم العثور على أي موظف"
            description="لا توجد نتائج تطابق معايير البحث والتصفية المحددة حالياً."
            action={
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                إلغاء التصفية واستعراض الكل
              </button>
            }
          />
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">الموظف والهوية</th>
                <th className="px-4 py-3">المنصب المفعّل</th>
                <th className="px-4 py-3">الرصيد المتاح</th>
                <th className="px-4 py-3">حالة الحساب</th>
                <th className="px-4 py-3">القيود التشغيلية</th>
                <th className="px-4 py-3">آخر نشاط</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEmployees.map((emp) => {
                const statusMeta = statusMetaMap[emp.accountStatus];

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/70">
                    {/* Identity Cell */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700">
                          {emp.name.charAt(0)}
                        </div>
                        <div className="space-y-0.5">
                          <Link
                            href={`/admin/employees/${emp.id}`}
                            className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                          >
                            {emp.name}
                          </Link>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <bdi dir="ltr">{emp.email}</bdi>
                            <span>&bull;</span>
                            <span className="font-mono text-slate-600 font-semibold" dir="ltr">
                              {emp.invitationCode}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Package */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-bold text-slate-800">
                        {emp.packageId === "FREE" ? "الحساب المجاني" : `منصب ${emp.packageId}`}
                      </span>
                    </td>

                    {/* Available Balance */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-slate-900" dir="ltr">
                      {emp.balance.available.toFixed(2)} USDT
                    </td>

                    {/* Account Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <AdminBadge variant={statusMeta.variant} size="sm" dot>
                        {statusMeta.label}
                      </AdminBadge>
                    </td>

                    {/* Restrictions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {emp.restrictions.tasksBlocked && (
                          <span className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                            حظر المهام
                          </span>
                        )}
                        {emp.restrictions.withdrawalsBlocked && (
                          <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            حظر السحب
                          </span>
                        )}
                        {!emp.restrictions.tasksBlocked && !emp.restrictions.withdrawalsBlocked && (
                          <span className="text-[11px] text-slate-400">
                            لا توجد قيود
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Active */}
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      <bdi dir="ltr">{emp.lastActiveAt}</bdi>
                    </td>

                    {/* Actions: Reusable AdminButton */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <AdminButton
                        href={`/admin/employees/${emp.id}`}
                        variant="outline"
                        size="sm"
                        icon={Eye}
                        title="عرض الملف الكامل للموظف"
                      >
                        تفاصيل الحساب
                      </AdminButton>
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
