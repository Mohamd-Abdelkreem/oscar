"use client";

import {
  CheckSquare,
  Clock,
  Edit,
  ExternalLink,
  KeyRound,
  Pause,
  Play,
  Plus,
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

interface TaskDetailScreenProps {
  readonly taskId: string;
}

export function TaskDetailScreen({ taskId }: TaskDetailScreenProps) {
  const {
    tasks,
    codes,
    codeUsages,
    submissions,
    toggleTaskStatus,
    toggleCodeStatus,
  } = useAdminState();

  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const task = useMemo(
    () => tasks.find((t) => t.id === taskId),
    [tasks, taskId],
  );

  const relatedCodes = useMemo(
    () => codes.filter((c) => c.taskId === taskId),
    [codes, taskId],
  );

  const taskUnlocks = useMemo(
    () => codeUsages.filter((u) => u.taskId === taskId),
    [codeUsages, taskId],
  );

  const distinctUnlockedUsers = useMemo(() => {
    const map = new Map<string, (typeof taskUnlocks)[0]>();
    for (const u of taskUnlocks) {
      if (!map.has(u.employeeId)) {
        map.set(u.employeeId, u);
      }
    }
    return Array.from(map.values());
  }, [taskUnlocks]);

  const taskSubmissions = useMemo(
    () => submissions.filter((s) => s.taskId === taskId),
    [submissions, taskId],
  );

  if (!task) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="المهمة غير موجودة"
          breadcrumbs={[
            { label: "المهام", href: "/admin/tasks" },
            { label: "غير موجودة" },
          ]}
        />
        <AdminEmptyState
          title="لم يتم العثور على المهمة المطلوبة"
          description={`المعرف (${taskId}) غير مسجل في جدول المهام.`}
          action={
            <AdminButton href="/admin/tasks" variant="primary">
              العودة لقائمة المهام
            </AdminButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={task.title}
        description={`المنصة: ${task.platform} — المعرف: ${task.id}`}
        breadcrumbs={[
          { label: "المهام", href: "/admin/tasks" },
          { label: task.title },
        ]}
        action={
          <div className="flex items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              icon={Edit}
              href={`/admin/tasks/${task.id}/edit`}
            >
              تعديل المهمة
            </AdminButton>
            <AdminButton
              variant={task.status === "active" ? "secondary" : "primary"}
              size="sm"
              icon={task.status === "active" ? Pause : Play}
              onClick={() => {
                setStatusConfirmOpen(true);
              }}
            >
              {task.status === "active" ? "إيقاف المهمة" : "تفعيل المهمة"}
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

      {/* Task Summary Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Info */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                حالة المهمة:
              </span>
              <AdminBadge
                variant={
                  task.status === "active"
                    ? "success"
                    : task.status === "scheduled"
                      ? "warning"
                      : "neutral"
                }
                size="sm"
              >
                {task.status === "active"
                  ? "نشطة الآن"
                  : task.status === "scheduled"
                    ? "مجدولة"
                    : "متوقفة / مغلقة"}
              </AdminBadge>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Clock size={14} className="text-slate-400" aria-hidden="true" />
              <span>
                النافذة اليومية:{" "}
                <bdi dir="ltr">
                  {task.windowStart} - {task.windowEnd}
                </bdi>{" "}
                ({task.timezone})
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500">
              وصف المهمة:
            </span>
            <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
              {task.description}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-500">
                الرابط المستهدف:{" "}
              </span>
              <bdi dir="ltr" className="font-mono font-bold text-emerald-800">
                {task.targetUrl}
              </bdi>
            </div>
            <a
              href={task.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
            >
              <span>فتح الرابط</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Right: Metrics & Preview Image */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={task.previewImageUrl}
              alt="معاينة المهمة"
              className="h-32 w-full object-cover"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
              <span className="block text-[11px] text-slate-500">
                مرات الفتح الفريدة
              </span>
              <span className="font-mono text-lg font-black text-slate-900">
                {distinctUnlockedUsers.length}
              </span>
            </div>

            <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
              <span className="block text-[11px] text-slate-500">
                إجمالي التسليمات
              </span>
              <span className="font-mono text-lg font-black text-slate-900">
                {taskSubmissions.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Related Codes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound
              size={18}
              className="text-emerald-700"
              aria-hidden="true"
            />
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">
              رموز الفتح المخصصة لهذه المهمة ({relatedCodes.length})
            </h2>
          </div>
          <AdminButton
            href={`/admin/codes/new?taskId=${task.id}`}
            variant="outline"
            size="sm"
            icon={Plus}
          >
            إنشاء رمز لهذه المهمة
          </AdminButton>
        </div>

        <AdminTableShell>
          {relatedCodes.length === 0 ? (
            <AdminEmptyState
              title="لا توجد رموز فتح مرتبطة بهذه المهمة"
              description="يمكنك إنشاء رمز جديد لتمكين الموظفين من فتح المهمة أثناء النافذة المفتوحة."
              action={
                <AdminButton
                  href={`/admin/codes/new?taskId=${task.id}`}
                  variant="primary"
                  size="sm"
                >
                  إنشاء أول رمز للمهمة
                </AdminButton>
              }
            />
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">الرمز</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">الموظفون الذين استخدموه</th>
                  <th className="px-4 py-3">تاريخ الإنشاء</th>
                  <th className="px-4 py-3">المنشئ</th>
                  <th className="px-4 py-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relatedCodes.map((code) => {
                  const distinctUsersCount = new Set(
                    codeUsages
                      .filter((u) => u.codeId === code.id)
                      .map((u) => u.employeeId),
                  ).size;

                  return (
                    <tr key={code.id} className="hover:bg-slate-50/70">
                      <td
                        className="px-4 py-3 font-mono text-sm font-bold text-emerald-800"
                        dir="ltr"
                      >
                        <Link
                          href={`/admin/codes/${code.id}`}
                          className="hover:underline"
                        >
                          {code.code}
                        </Link>
                      </td>

                      <td className="px-4 py-3">
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

                      <td className="px-4 py-3 font-bold text-slate-900">
                        {distinctUsersCount} موظف
                      </td>

                      <td className="px-4 py-3 text-slate-500" dir="ltr">
                        {code.createdAt}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {code.createdBy}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/admin/codes/${code.id}`}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
                          >
                            <span>سجل الاستخدام</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              toggleCodeStatus(code.id);
                            }}
                            className={`inline-flex min-h-[36px] items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${
                              code.status === "active"
                                ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            }`}
                          >
                            {code.status === "active"
                              ? "إيقاف الرمز"
                              : "تفعيل الرمز"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </AdminTableShell>
      </div>

      {/* Section 3: Submissions for this Task */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckSquare
            size={18}
            className="text-emerald-700"
            aria-hidden="true"
          />
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">
            التسليمات الواردة للمهمة ({taskSubmissions.length})
          </h2>
        </div>

        <AdminTableShell>
          {taskSubmissions.length === 0 ? (
            <AdminEmptyState title="لا توجد تسليمات مرسلة لهذه المهمة حتى الآن" />
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">الموظف</th>
                  <th className="px-4 py-3">المكافأة</th>
                  <th className="px-4 py-3">تاريخ الإرسال</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">قرار التدقيق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taskSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/employees/${sub.employeeId}`}
                        className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {sub.employeeName}
                      </Link>
                    </td>

                    <td
                      className="px-4 py-3 font-mono font-bold text-emerald-700"
                      dir="ltr"
                    >
                      +{sub.rewardAmount.toFixed(2)} USDT
                    </td>

                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                      {sub.submittedAt}
                    </td>

                    <td className="px-4 py-3">
                      <AdminBadge
                        variant={
                          sub.status === "approved"
                            ? "success"
                            : sub.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                        size="sm"
                      >
                        {sub.status === "approved"
                          ? "معتمد"
                          : sub.status === "rejected"
                            ? "مرفوض"
                            : "قيد المراجعة"}
                      </AdminBadge>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {sub.rejectionReason ??
                        (sub.reviewedBy
                          ? `معتمد بواسطة ${sub.reviewedBy}`
                          : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AdminTableShell>
      </div>

      {/* Confirm Task Status Toggle Dialog */}
      <AdminConfirmDialog
        isOpen={statusConfirmOpen}
        title={
          task.status === "active"
            ? `إيقاف المهمة: ${task.title}`
            : `تفعيل المهمة: ${task.title}`
        }
        description={
          task.status === "active"
            ? "سيؤدي إيقاف المهمة إلى حجبها عن الموظفين ومنع رفع أي تسليمات جديدة عليها فوراً."
            : "سيتم تفعيل المهمة وإتاحتها لجميع الموظفين المؤهلين لتنفيذها وتقديم الإثباتات."
        }
        confirmLabel={
          task.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"
        }
        variant={task.status === "active" ? "destructive" : "primary"}

        onConfirm={() => {
          toggleTaskStatus(task.id);
          setFeedback(
            task.status === "active"
              ? `تم إيقاف المهمة "${task.title}" بنجاح.`
              : `تم تفعيل المهمة "${task.title}" بنجاح.`,
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
