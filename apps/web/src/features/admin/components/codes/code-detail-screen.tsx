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
import { useMemo, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";

interface CodeDetailScreenProps {
  readonly codeId: string;
}

// Function-size exception: usage and audit panels follow one selected code and its
// status confirmation. Revisit when either panel needs an independent workflow.
export function CodeDetailScreen({ codeId }: CodeDetailScreenProps) {
  const scheduleTimeout = useManagedTimeout();
  const { codes, tasks, codeUsages, auditLogs, toggleCodeStatus } =
    useAdminState();

  const [searchUsageQuery, setSearchUsageQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const code = useMemo(
    () => codes.find((c) => c.id === codeId),
    [codes, codeId],
  );

  const task = useMemo(
    () => tasks.find((t) => t.id === code?.taskId),
    [tasks, code?.taskId],
  );

  const usagesForCode = useMemo(
    () => codeUsages.filter((u) => u.codeId === codeId),
    [codeUsages, codeId],
  );

  const distinctUsersCount = useMemo(() => {
    return new Set(usagesForCode.map((u) => u.employeeId)).size;
  }, [usagesForCode]);

  const filteredUsages = useMemo(() => {
    if (!searchUsageQuery.trim()) return usagesForCode;
    const q = searchUsageQuery.trim().toLowerCase();
    return usagesForCode.filter(
      (u) =>
        u.employeeName.toLowerCase().includes(q) ||
        u.employeeEmail.toLowerCase().includes(q) ||
        u.employeeId.toLowerCase().includes(q),
    );
  }, [usagesForCode, searchUsageQuery]);

  const relatedAuditLogs = useMemo(() => {
    return auditLogs.filter(
      (a) => a.targetId === codeId || a.targetTitle === code?.code,
    );
  }, [auditLogs, codeId, code?.code]);

  const handleCopy = () => {
    if (!code) return;
    void navigator.clipboard.writeText(code.code);
    setCopied(true);
    scheduleTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  if (!code) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="رمز المهمة غير موجود"
          breadcrumbs={[
            { label: "رموز المهام", href: "/admin/codes" },
            { label: "غير موجود" },
          ]}
        />
        <AdminEmptyState
          title="لم يتم العثور على رمز المهمة"
          description={`المعرف (${codeId}) غير مسجل في جدول الرموز.`}
          action={
            <AdminButton href="/admin/codes" variant="primary">
              العودة لقائمة الرموز
            </AdminButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`تفاصيل رمز فتح المهمة: ${code.code}`}
        description={`تاريخ الإنشاء: ${code.createdAt} — المنشئ: ${code.createdBy}`}
        breadcrumbs={[
          { label: "رموز المهام", href: "/admin/codes" },
          { label: code.code },
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
              variant={code.status === "active" ? "secondary" : "primary"}
              size="sm"
              icon={code.status === "active" ? Pause : Play}
              onClick={() => {
                setStatusConfirmOpen(true);
              }}
            >
              {code.status === "active" ? "إيقاف الرمز مؤقتاً" : "تفعيل الرمز"}
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
                variant={code.status === "active" ? "success" : "neutral"}
                size="sm"
                dot
              >
                {code.status === "active"
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
                {code.code}
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
                    <bdi dir="ltr">
                      {task.windowStart} - {task.windowEnd}
                    </bdi>
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
              <span className="font-bold text-slate-800">{code.createdBy}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Table Section */}
      <div className="space-y-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-emerald-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">
              سجل الموظفين الذين استخدموا هذا الرمز بنجاح (
              {usagesForCode.length})
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

        <AdminTableShell>
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
                        href={`/admin/employees/${usage.employeeId}`}
                        className="hover:text-emerald-700 hover:underline"
                      >
                        {usage.employeeName}
                      </Link>
                    </td>

                    <td
                      className="px-4 py-3 font-mono text-slate-500"
                      dir="ltr"
                    >
                      {usage.employeeEmail}
                    </td>

                    <td
                      className="px-4 py-3 font-mono font-bold text-slate-600"
                      dir="ltr"
                    >
                      {usage.employeeId}
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
                          usage.submissionState === "approved"
                            ? "success"
                            : usage.submissionState === "submitted"
                              ? "info"
                              : usage.submissionState === "rejected"
                                ? "danger"
                                : "neutral"
                        }
                        size="sm"
                      >
                        {usage.submissionState === "approved"
                          ? "تم الاعتماد"
                          : usage.submissionState === "submitted"
                            ? "تم إرسال المهمة"
                            : usage.submissionState === "rejected"
                              ? "مرفوضة"
                              : "لم يتم الإرسال بعد"}
                      </AdminBadge>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/admin/employees/${usage.employeeId}`}
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
      </div>

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
        </div>
      )}

      {/* Confirm Code Status Toggle Dialog */}
      <AdminConfirmDialog
        isOpen={statusConfirmOpen}
        title={
          code.status === "active"
            ? `إيقاف رمز فتح المهمة: ${code.code}`
            : `تفعيل رمز فتح المهمة: ${code.code}`
        }
        description={
          code.status === "active"
            ? "سيؤدي إيقاف الرمز إلى منع الموظفين من استخدامه لفتح المهمة اليومية المرتبطة فوراً."
            : "سيتم تفعيل الرمز والسماح للموظفين باستخدامه للوصول إلى تفاصيل المهمة ورفع الإثبات."
        }
        confirmLabel={
          code.status === "active" ? "تأكيد إيقاف الرمز" : "تأكيد تفعيل الرمز"
        }
        variant={code.status === "active" ? "destructive" : "primary"}

        onConfirm={() => {
          toggleCodeStatus(code.id);
          setFeedback(
            code.status === "active"
              ? `تم إيقاف الرمز "${code.code}" بنجاح.`
              : `تم تفعيل الرمز "${code.code}" بنجاح.`,
          );
          setStatusConfirmOpen(false);
        }}
        onClose={() => {
          setStatusConfirmOpen(false);
        }}
      />
    </div>
  );
}
