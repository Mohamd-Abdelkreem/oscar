"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import { Copy, Check, Eye, Pause, Play, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminSelect } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";
import type { TaskUnlockCode } from "../../types/admin.types";

const PAGE_SIZE = 10;

export function CodesListScreen() {
  const scheduleTimeout = useManagedTimeout();
  const { codes, tasks, codeUsages, toggleCodeStatus } = useAdminState();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [taskFilter, setTaskFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [statusConfirmCode, setStatusConfirmCode] =
    useState<TaskUnlockCode | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredCodes = useMemo(() => {
    return codes.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const task = tasks.find((t) => t.id === c.taskId);
        const matchesCode = c.code.toLowerCase().includes(q);
        const matchesTask = task?.title.toLowerCase().includes(q) ?? false;
        const matchesCreator = c.createdBy.toLowerCase().includes(q);
        if (!matchesCode && !matchesTask && !matchesCreator) {
          return false;
        }
      }

      if (statusFilter !== "all" && c.status !== statusFilter) {
        return false;
      }

      if (taskFilter !== "all" && c.taskId !== taskFilter) {
        return false;
      }

      return true;
    });
  }, [codes, tasks, searchQuery, statusFilter, taskFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredCodes.length / PAGE_SIZE) || 1;
  const paginatedCodes = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCodes.slice(start, start + PAGE_SIZE);
  }, [filteredCodes, currentPage]);

  const handleCopy = (codeText: string) => {
    void navigator.clipboard.writeText(codeText);
    setCopiedCode(codeText);
    scheduleTimeout(() => {
      setCopiedCode(null);
    }, 1500);
  };

  const statusOptions = [
    { value: "all", label: "كل الحالات (نشط ومتوقف)" },
    { value: "active", label: "نشط (يقبل الفتح)" },
    { value: "paused", label: "متوقف (محظور الفتح)" },
  ];

  const taskOptions = useMemo(() => {
    return [
      { value: "all", label: "كل المهام المرتبطة" },
      ...tasks.map((t) => ({ value: t.id, label: t.title })),
    ];
  }, [tasks]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="رموز فتح المهام اليومية"
        description="إنشاء وإدارة رموز الوصول الخاصة بالمهام اليومية، مراقبة الموظفين الذين قاموا بفتح المهام، وتفعيل أو إيقاف الرموز"
        breadcrumbs={[{ label: "رموز فتح المهام" }]}
        action={
          <AdminButton href="/admin/codes/new" variant="primary" icon={Plus}>
            إنشاء رمز جديد
          </AdminButton>
        }
      />

      {feedback && (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800"
          role="alert"
        >
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
            }}
            className="text-xs underline hover:no-underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Search Input */}
          <div>
            <AdminInput
              icon={Search}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث بالرمز، المهمة، أو المنشئ..."
              aria-label="بحث في الرموز"
            />
          </div>

          {/* Status Filter */}
          <div>
            <AdminSelect
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              options={statusOptions}
              aria-label="تصفية حسب حالة الرمز"
            />
          </div>

          {/* Task Filter */}
          <div>
            <AdminSelect
              value={taskFilter}
              onValueChange={(val) => {
                setTaskFilter(val);
                setCurrentPage(1);
              }}
              options={taskOptions}
              aria-label="تصفية حسب المهمة"
            />
          </div>
        </div>
      </div>

      {/* Codes Table */}
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredCodes.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        }
      >
        {filteredCodes.length === 0 ? (
          <AdminEmptyState
            title="لا توجد رموز مطابقة"
            description="لم يتم العثور على أي رموز فتح تطابق معايير البحث الحالية."
            action={
              <AdminButton href="/admin/codes/new" variant="primary">
                إنشاء رمز مهمة جديد
              </AdminButton>
            }
          />
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">رمز الفتح (Task Code)</th>
                <th className="px-4 py-3">المهمة المرتبطة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الموظفون الذين فتحوها</th>
                <th className="px-4 py-3">تاريخ الإنشاء</th>
                <th className="px-4 py-3">المنشئ</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedCodes.map((code) => {
                const linkedTask = tasks.find((t) => t.id === code.taskId);
                const distinctUsersCount = new Set(
                  codeUsages
                    .filter((u) => u.codeId === code.id)
                    .map((u) => u.employeeId),
                ).size;

                return (
                  <tr key={code.id} className="hover:bg-slate-50/70">
                    {/* Code & Copy */}
                    <td className="px-4 py-3 font-mono text-sm font-bold text-emerald-800">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/codes/${code.id}`}
                          className="font-mono hover:underline"
                          dir="ltr"
                        >
                          {code.code}
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            handleCopy(code.code);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="نسخ الرمز"
                          aria-label={`نسخ الرمز ${code.code}`}
                        >
                          {copiedCode === code.code ? (
                            <Check
                              size={13}
                              className="text-emerald-600"
                              aria-hidden="true"
                            />
                          ) : (
                            <Copy size={13} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Linked Task */}
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {linkedTask ? (
                        <Link
                          href={`/admin/tasks/${linkedTask.id}`}
                          className="block max-w-xs truncate hover:text-emerald-700 hover:underline"
                        >
                          {linkedTask.title}
                        </Link>
                      ) : (
                        <span className="text-slate-400">مهمة غير معروفة</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <AdminBadge
                        variant={
                          code.status === "active" ? "success" : "neutral"
                        }
                        size="sm"
                        dot
                      >
                        {code.status === "active" ? "نشط" : "متوقف"}
                      </AdminBadge>
                    </td>

                    {/* Distinct successful employees count */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/codes/${code.id}`}
                        className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {distinctUsersCount} موظف
                      </Link>
                    </td>

                    {/* Created Date */}
                    <td
                      className="px-4 py-3 font-mono whitespace-nowrap text-slate-500"
                      dir="ltr"
                    >
                      {code.createdAt}
                    </td>

                    {/* Creator */}
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {code.createdBy}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <AdminButton
                          href={`/admin/codes/${code.id}`}
                          variant="outline"
                          size="sm"
                          icon={Eye}
                        >
                          سجل الاستخدام
                        </AdminButton>

                        <AdminButton
                          variant={
                            code.status === "active" ? "secondary" : "primary"
                          }
                          size="sm"
                          icon={code.status === "active" ? Pause : Play}
                          onClick={() => {
                            setStatusConfirmCode(code);
                          }}
                        >
                          {code.status === "active" ? "إيقاف" : "تفعيل"}
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminTableShell>

      {/* Confirm Code Status Toggle Dialog */}
      {statusConfirmCode && (
        <AdminConfirmDialog
          isOpen={true}
          title={
            statusConfirmCode.status === "active"
              ? `إيقاف رمز فتح المهمة: ${statusConfirmCode.code}`
              : `تفعيل رمز فتح المهمة: ${statusConfirmCode.code}`
          }
          description={
            statusConfirmCode.status === "active"
              ? "سيؤدي إيقاف الرمز إلى منع الموظفين من استخدامه لفتح المهمة اليومية المرتبطة فوراً."
              : "سيتم تفعيل الرمز والسماح للموظفين باستخدامه للوصول إلى تفاصيل المهمة ورفع الإثبات."
          }
          confirmLabel={
            statusConfirmCode.status === "active"
              ? "تأكيد إيقاف الرمز"
              : "تأكيد تفعيل الرمز"
          }
          variant={
            statusConfirmCode.status === "active" ? "destructive" : "primary"
          }

          onConfirm={() => {
            toggleCodeStatus(statusConfirmCode.id);
            setFeedback(
              statusConfirmCode.status === "active"
                ? `تم إيقاف الرمز "${statusConfirmCode.code}" بنجاح.`
                : `تم تفعيل الرمز "${statusConfirmCode.code}" بنجاح.`,
            );
            setStatusConfirmCode(null);
          }}
          onClose={() => {
            setStatusConfirmCode(null);
          }}
        />
      )}
    </div>
  );
}
