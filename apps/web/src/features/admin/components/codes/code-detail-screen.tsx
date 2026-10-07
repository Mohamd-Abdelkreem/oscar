"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import {
  Check,
  Copy,
  ExternalLink,
  Pause,
  Play,
  Search,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminTableShell } from "../common/admin-table";
import {
  useAdminTaskCode,
  useAdminCodeUsage,
  useAdminCodeAudit,
} from "../../hooks/task-codes.hooks";
import { useAdminTaskCommand } from "../../hooks/tasks.hooks";
import { adminTaskCodesApi } from "../../api/task-codes.api";
import { TaskCommandFeedback } from "../common/task-command-feedback";
import { TaskQueryState } from "../common/task-query-state";
import { AdminPagination } from "../common/admin-pagination";

interface CodeDetailScreenProps {
  readonly codeId: string;
}

// Function-size exception: usage and audit panels follow one selected code and its
// status confirmation. Revisit when either panel needs an independent workflow.
export function CodeDetailScreen({ codeId }: CodeDetailScreenProps) {
  const scheduleTimeout = useManagedTimeout();

  const [searchUsageQuery, setSearchUsageQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = useAdminTaskCode(codeId),
    usageQuery = useAdminCodeUsage(
      codeId,
      searchUsageQuery.trim() || undefined,
    ),
    auditQuery = useAdminCodeAudit(codeId);
  const code = query.data,
    task = code?.task,
    distinctUsersCount = code?.distinctSuccessfulEmployeeCount ?? 0,
    filteredUsages = usageQuery.data?.items ?? [],
    relatedAuditLogs = auditQuery.data?.items ?? [];
  const command = useAdminTaskCommand({
    kind: "CODE_STATUS",
    targetId: codeId,
  });
  const [confirmedVersion, setConfirmedVersion] = useState<number | null>(null);
  const confirm = async () => {
    if (
      !code ||
      code.version !== confirmedVersion ||
      !command.allowed ||
      command.retained
    )
      return false;
    try {
      const result = await command.execute((commandId) =>
        adminTaskCodesApi.status(code.id, {
          commandId,
          confirmed: true,
          expectedCodeVersion: code.version,
          state: code.state === "ENABLED" ? "PAUSED" : "ENABLED",
        }),
      );
      if (result?.state !== "OBSERVED") return false;
      setFeedback("تم حفظ حالة الرمز بنجاح.");
      setStatusConfirmOpen(false);
      return true;
    } catch {
      return false;
    }
  };
  const handleCopy = () => {
    if (!code) return;
    void navigator.clipboard.writeText(code.normalizedText);
    setCopied(true);
    scheduleTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  if (!code)
    return (
      <TaskQueryState error={query.error?.message} retry={query.refetch} />
    );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`تفاصيل رمز فتح المهمة: ${code.normalizedText}`}
        description={`تاريخ الإنشاء: ${code.createdAt} — المنشئ: ${code.creator.fullName}`}
        breadcrumbs={[
          { label: "رموز المهام", href: "/admin/codes" },
          { label: code.normalizedText },
        ]}
        action={
          <div className="flex items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopy}
            >
              {copied ? "تم النسخ" : "نسخ الرمز"}
            </AdminButton>
            <AdminButton
              variant={code.state === "ENABLED" ? "secondary" : "primary"}
              size="sm"
              icon={code.state === "ENABLED" ? Pause : Play}
              onClick={() => {
                setConfirmedVersion(code.version);
                setStatusConfirmOpen(true);
              }}
            >
              {code.state === "ENABLED" ? "إيقاف الرمز مؤقتاً" : "تفعيل الرمز"}
            </AdminButton>
          </div>
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

      {/* Code Summary Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Card: Info & Target Task */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                حالة الرمز:
              </span>
              <AdminBadge
                variant={code.state === "ENABLED" ? "success" : "neutral"}
                size="sm"
                dot
              >
                {code.state === "ENABLED"
                  ? "نشط (يقبل الفتح)"
                  : "متوقف (محظور الفتح)"}
              </AdminBadge>
            </div>

            <div className="font-mono text-xs text-slate-500" dir="ltr">
              المعرف: {code.id}
            </div>
          </div>

          {/* Large Code Display */}
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="space-y-1">
              <span className="block text-[11px] font-bold tracking-wider text-emerald-800 uppercase">
                رمز الفتح المعتمد:
              </span>
              <span
                className="font-mono text-xl font-black tracking-wider text-emerald-950 sm:text-2xl"
                dir="ltr"
              >
                {code.normalizedText}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
            >
              {copied ? (
                <>
                  <Check
                    size={14}
                    className="text-emerald-700"
                    aria-hidden="true"
                  />
                  <span>تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy size={14} aria-hidden="true" />
                  <span>نسخ الرمز</span>
                </>
              )}
            </button>
          </div>

          {/* Linked Task Details */}
          <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-4">
            <span className="block text-xs font-bold text-slate-500">
              المهمة المرتبطة:
            </span>
            {task ? (
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <Link
                    href={`/admin/tasks/${task.id}`}
                    className="block text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                  >
                    {task.title}
                  </Link>
                  <span className="text-xs text-slate-500">
                    المنصة: {task.platform} &bull; النافذة:{" "}
                    <bdi dir="ltr">12:00 - 18:00</bdi>
                  </span>
                </div>
                <Link
                  href={`/admin/tasks/${task.id}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                >
                  <span>استعراض المهمة</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <span className="text-xs text-slate-400">مهمة غير معروفة</span>
            )}
          </div>

          {code.description && (
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-700">ملاحظات إدارية: </span>
              <span>{code.description}</span>
            </div>
          )}
        </div>

        {/* Right Card: Metrics */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">
            إحصائيات استخدام الرمز
          </h2>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
            <span className="text-xs font-semibold text-slate-500">
              عدد الموظفين الفريدين الذين فتحوا المهمة بهذا الرمز
            </span>
            <div className="mt-1 font-mono text-3xl font-black text-slate-900">
              {distinctUsersCount}
            </div>
            <span className="mt-1 block text-[11px] text-slate-400">
              (يتم احتساب كل موظف مرة واحدة فقط لمنع التكرار)
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-500">تاريخ وساعة الإنشاء:</span>
              <span className="font-mono text-slate-700" dir="ltr">
                {code.createdAt}
              </span>
            </div>
            {code.updatedAt && (
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">آخر تعديل للحالة:</span>
                <span className="font-mono text-slate-700" dir="ltr">
                  {code.updatedAt}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-500">تم الإنشاء بواسطة:</span>
              <span className="font-bold text-slate-800">
                {code.creator.fullName}
              </span>
            </div>
          </div>
        </div>
      </div>

      <TaskCommandFeedback command={command} />
      {/* Usage Table Section */}
      <div className="space-y-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-emerald-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">
              سجل الموظفين الذين استخدموا هذا الرمز بنجاح (
              {code.successfulUsageCount})
            </h2>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchUsageQuery}
              onChange={(e) => {
                setSearchUsageQuery(e.target.value);
              }}
              placeholder="بحث في سجل الاستخدام..."
              className="w-full rounded-md border border-slate-300 py-1.5 pr-8 pl-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        {!usageQuery.data && (
          <TaskQueryState
            error={usageQuery.error?.message}
            retry={usageQuery.refetch}
          />
        )}
        {usageQuery.data && (
          <AdminTableShell
            footer={
              <AdminPagination
                currentPage={usageQuery.page}
                totalPages={usageQuery.data.pagination.totalPages}
                totalItems={usageQuery.data.pagination.total}
                pageSize={25}
                onPageChange={usageQuery.setPage}
              />
            }
          >
            {filteredUsages.length === 0 ? (
              <AdminEmptyState
                title="لم يتم استخدام هذا الرمز بعد"
                description="عندما يقوم موظف بإدخال هذا الرمز بنجاح في واجهة المهمة اليومية، سيظهر سجله هنا تلقائياً."
              />
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">الموظف</th>
                    <th className="px-4 py-3">البريد الإلكتروني</th>
                    <th className="px-4 py-3">معرف الموظف</th>
                    <th className="px-4 py-3">توقيت الفتح الناجح</th>
                    <th className="px-4 py-3">حالة التسليم اللاحقة</th>
                    <th className="px-4 py-3 text-center">الملف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsages.map((usage) => (
                    <tr key={usage.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <Link
                          href={`/admin/employees/${usage.employee.id}`}
                          className="hover:text-emerald-700 hover:underline"
                        >
                          {usage.employee.fullName}
                        </Link>
                      </td>

                      <td
                        className="px-4 py-3 font-mono text-slate-500"
                        dir="ltr"
                      >
                        {usage.employee.email}
                      </td>

                      <td
                        className="px-4 py-3 font-mono font-bold text-slate-600"
                        dir="ltr"
                      >
                        {usage.employee.id}
                      </td>

                      <td
                        className="px-4 py-3 font-mono text-slate-600"
                        dir="ltr"
                      >
                        {usage.unlockedAt}
                      </td>

                      <td className="px-4 py-3">
                        <AdminBadge
                          variant={
                            usage.submissionStatus === "APPROVED"
                              ? "success"
                              : usage.submissionStatus === "PENDING"
                                ? "info"
                                : usage.submissionStatus === "REJECTED"
                                  ? "danger"
                                  : "neutral"
                          }
                          size="sm"
                        >
                          {usage.submissionStatus === "APPROVED"
                            ? "تم الاعتماد"
                            : usage.submissionStatus === "PENDING"
                              ? "تم إرسال المهمة"
                              : usage.submissionStatus === "REJECTED"
                                ? "مرفوضة"
                                : "لم يتم الإرسال بعد"}
                        </AdminBadge>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/admin/employees/${usage.employee.id}`}
                          className="text-xs font-bold text-emerald-700 hover:underline"
                        >
                          عرض الحساب &larr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AdminTableShell>
        )}
      </div>

      {!auditQuery.data && (
        <TaskQueryState
          error={auditQuery.error?.message}
          retry={auditQuery.refetch}
        />
      )}
      {/* Relevant Audit History */}
      {relatedAuditLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-slate-600" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">
              سجل العمليات والتدقيق المرتبط بهذا الرمز
            </h2>
          </div>

          <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs shadow-xs">
            {relatedAuditLogs.map((log) => (
              <div key={log.id} className="space-y-1 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{log.action}</span>
                  <bdi dir="ltr" className="text-[11px] text-slate-400">
                    {log.occurredAt}
                  </bdi>
                </div>
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {log.after.state}
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    — الإصدار {log.after.version}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  المسؤول: {log.actor.fullName}
                </div>
              </div>
            ))}
          </div>
          {auditQuery.data && (
            <AdminPagination
              currentPage={auditQuery.page}
              totalPages={auditQuery.data.pagination.totalPages}
              totalItems={auditQuery.data.pagination.total}
              pageSize={25}
              onPageChange={auditQuery.setPage}
            />
          )}
        </div>
      )}

      {/* Confirm Code Status Toggle Dialog */}
      <AdminConfirmDialog
        isOpen={statusConfirmOpen}
        title={
          code.state === "ENABLED"
            ? `إيقاف رمز فتح المهمة: ${code.normalizedText}`
            : `تفعيل رمز فتح المهمة: ${code.normalizedText}`
        }
        description={
          code.state === "ENABLED"
            ? "سيؤدي إيقاف الرمز إلى منع الموظفين من استخدامه لفتح المهمة اليومية المرتبطة فوراً."
            : "سيتم تفعيل الرمز والسماح للموظفين باستخدامه للوصول إلى تفاصيل المهمة ورفع الإثبات."
        }
        confirmLabel={
          code.state === "ENABLED" ? "تأكيد إيقاف الرمز" : "تأكيد تفعيل الرمز"
        }
        variant={code.state === "ENABLED" ? "destructive" : "primary"}

        isLoading={command.isPending}
        confirmDisabled={
          !command.allowed ||
          !!command.retained ||
          code.version !== confirmedVersion
        }
        error={
          command.error?.message ??
          (code.version !== confirmedVersion
            ? "تغير الرمز؛ أغلق التأكيد وراجع الحالة الحالية."
            : null)
        }
        onConfirm={confirm}
        onClose={() => {
          setStatusConfirmOpen(false);
        }}
      />
    </div>
  );
}
