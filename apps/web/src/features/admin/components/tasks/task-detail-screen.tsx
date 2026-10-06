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
import { useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminTableShell } from "../common/admin-table";
import type { z } from "zod";
import type { taskCodeSummarySchema } from "@template/contracts";
import { useAdminTask, useAdminTaskCommand } from "../../hooks/tasks.hooks";
import { useAdminTaskCodes } from "../../hooks/task-codes.hooks";
import { useAdminTaskSubmissions } from "../../hooks/task-submissions.hooks";
import { adminTasksApi } from "../../api/tasks.api";
import { adminTaskCodesApi } from "../../api/task-codes.api";
import { TaskQueryState } from "../common/task-query-state";
import { TaskCommandFeedback } from "../common/task-command-feedback";
import { AdminPagination } from "../common/admin-pagination";
import { PrivateTaskImage } from "../common/private-task-image";

interface TaskDetailScreenProps {
  readonly taskId: string;
}

export function TaskDetailScreen({ taskId }: TaskDetailScreenProps) {
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = useAdminTask(taskId),
    codesQuery = useAdminTaskCodes({ taskId }),
    submissionsQuery = useAdminTaskSubmissions({ taskId });
  const task = query.data,
    relatedCodes = codesQuery.data?.items ?? [],
    taskSubmissions = submissionsQuery.data?.items ?? [];
  const [confirmedRevision, setConfirmedRevision] = useState<number | null>(
    null,
  );
  const [selectedCode, setSelectedCode] = useState<z.infer<
    typeof taskCodeSummarySchema
  > | null>(null);
  const command = useAdminTaskCommand({
    kind: "TASK_STATUS",
    targetId: taskId,
  });
  const codeCommand = useAdminTaskCommand({
    kind: "CODE_STATUS",
    targetId: selectedCode?.id ?? null,
  });
  const confirmTask = async () => {
    if (
      !task ||
      task.revision !== confirmedRevision ||
      !command.allowed ||
      command.retained
    )
      return false;
    try {
      const result = await command.execute((commandId) =>
        adminTasksApi.status(task.id, {
          commandId,
          confirmed: true,
          expectedTaskRevision: task.revision,
          publicationState:
            task.publicationState === "PUBLISHED" ? "PAUSED" : "PUBLISHED",
        }),
      );
      if (result?.state !== "OBSERVED") return false;
      setFeedback("تم حفظ حالة المهمة بنجاح.");
      setStatusConfirmOpen(false);
      return true;
    } catch {
      return false;
    }
  };
  const confirmCode = async () => {
    if (!selectedCode || !codeCommand.allowed || codeCommand.retained)
      return false;
    try {
      const result = await codeCommand.execute((commandId) =>
        adminTaskCodesApi.status(selectedCode.id, {
          commandId,
          confirmed: true,
          expectedCodeVersion: selectedCode.version,
          state: selectedCode.state === "ENABLED" ? "PAUSED" : "ENABLED",
        }),
      );
      if (result?.state !== "OBSERVED") return false;
      setSelectedCode(null);
      return true;
    } catch {
      return false;
    }
  };
  if (!task)
    return (
      <TaskQueryState error={query.error?.message} retry={query.refetch} />
    );

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
              variant={
                task.publicationState === "PUBLISHED" ? "secondary" : "primary"
              }
              size="sm"
              icon={task.publicationState === "PUBLISHED" ? Pause : Play}
              onClick={() => {
                setConfirmedRevision(task.revision);
                setStatusConfirmOpen(true);
              }}
            >
              {task.publicationState === "PUBLISHED"
                ? "إيقاف المهمة"
                : "تفعيل المهمة"}
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
                  task.publicationState === "PUBLISHED"
                    ? "success"
                    : task.displayStatus === "SCHEDULED"
                      ? "warning"
                      : "neutral"
                }
                size="sm"
              >
                {task.publicationState === "PUBLISHED"
                  ? "نشطة الآن"
                  : task.displayStatus === "SCHEDULED"
                    ? "مجدولة"
                    : "متوقفة / مغلقة"}
              </AdminBadge>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Clock size={14} className="text-slate-400" aria-hidden="true" />
              <span>
                النافذة اليومية: <bdi dir="ltr">12:00 - 18:00</bdi>{" "}
                (Asia/Baghdad)
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
            {}
            <PrivateTaskImage
              assetId={task.illustration?.id ?? null}
              identity={task.id}
              purpose="TASK_ILLUSTRATION"
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
                {task.distinctUnlockedEmployeeCount}
              </span>
            </div>

            <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
              <span className="block text-[11px] text-slate-500">
                إجمالي التسليمات
              </span>
              <span className="font-mono text-lg font-black text-slate-900">
                {task.submissionCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      <TaskCommandFeedback command={command} />
      <TaskCommandFeedback command={codeCommand} />
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
              رموز الفتح المخصصة لهذه المهمة ({task.linkedCodeCount})
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

        {!codesQuery.data && (
          <TaskQueryState
            error={codesQuery.error?.message}
            retry={codesQuery.refetch}
          />
        )}
        {codesQuery.data && (
          <AdminTableShell
            footer={
              <AdminPagination
                currentPage={codesQuery.page}
                totalPages={codesQuery.data.pagination.totalPages}
                totalItems={codesQuery.data.pagination.total}
                pageSize={codesQuery.data.pagination.limit}
                onPageChange={codesQuery.setPage}
              />
            }
          >
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
                    const distinctUsersCount =
                      code.distinctSuccessfulEmployeeCount;
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
                            {code.normalizedText}
                          </Link>
                        </td>

                        <td className="px-4 py-3">
                          <AdminBadge
                            variant={
                              code.state === "ENABLED" ? "success" : "neutral"
                            }
                            size="sm"
                            dot
                          >
                            {code.state === "ENABLED" ? "نشط" : "متوقف"}
                          </AdminBadge>
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-900">
                          {distinctUsersCount} موظف
                        </td>

                        <td className="px-4 py-3 text-slate-500" dir="ltr">
                          {code.createdAt}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {code.creator.fullName}
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
                                setSelectedCode(code);
                              }}
                              className={`inline-flex min-h-[36px] items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${
                                code.state === "ENABLED"
                                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              }`}
                            >
                              {code.state === "ENABLED"
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
        )}
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
            التسليمات الواردة للمهمة ({task.submissionCount})
          </h2>
        </div>

        {!submissionsQuery.data && (
          <TaskQueryState
            error={submissionsQuery.error?.message}
            retry={submissionsQuery.refetch}
          />
        )}
        {submissionsQuery.data && (
          <AdminTableShell
            footer={
              <AdminPagination
                currentPage={submissionsQuery.page}
                totalPages={submissionsQuery.data.pagination.totalPages}
                totalItems={submissionsQuery.data.pagination.total}
                pageSize={submissionsQuery.data.pagination.limit}
                onPageChange={submissionsQuery.setPage}
              />
            }
          >
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
                          href={`/admin/employees/${sub.employee.id}`}
                          className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {sub.employee.fullName}
                        </Link>
                      </td>

                      <td
                        className="px-4 py-3 font-mono font-bold text-emerald-700"
                        dir="ltr"
                      >
                        +{sub.reward} USDT
                      </td>

                      <td className="px-4 py-3 text-slate-500" dir="ltr">
                        {sub.submittedAt}
                      </td>

                      <td className="px-4 py-3">
                        <AdminBadge
                          variant={
                            sub.status === "APPROVED"
                              ? "success"
                              : sub.status === "REJECTED"
                                ? "danger"
                                : "warning"
                          }
                          size="sm"
                        >
                          {sub.status === "APPROVED"
                            ? "معتمد"
                            : sub.status === "REJECTED"
                              ? "مرفوض"
                              : "قيد المراجعة"}
                        </AdminBadge>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        <Link
                          href={`/admin/submissions?submission=${sub.id}`}
                          className="hover:underline"
                        >
                          عرض قرار التدقيق
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

      {selectedCode && (
        <AdminConfirmDialog
          isOpen
          title="تأكيد تغيير حالة الرمز"
          description={selectedCode.normalizedText}
          variant="warning"
          isLoading={codeCommand.isPending}
          confirmDisabled={!codeCommand.allowed || !!codeCommand.retained}
          error={codeCommand.error?.message ?? null}
          onConfirm={confirmCode}
          onClose={() => {
            setSelectedCode(null);
          }}
        />
      )}
      {/* Confirm Task Status Toggle Dialog */}
      <AdminConfirmDialog
        isOpen={statusConfirmOpen}
        title={
          task.publicationState === "PUBLISHED"
            ? `إيقاف المهمة: ${task.title}`
            : `تفعيل المهمة: ${task.title}`
        }
        description={
          task.publicationState === "PUBLISHED"
            ? "سيؤدي إيقاف المهمة إلى حجبها عن الموظفين ومنع رفع أي تسليمات جديدة عليها فوراً."
            : "سيتم تفعيل المهمة وإتاحتها لجميع الموظفين المؤهلين لتنفيذها وتقديم الإثباتات."
        }
        confirmLabel={
          task.publicationState === "PUBLISHED"
            ? "تأكيد الإيقاف"
            : "تأكيد التفعيل"
        }
        variant={
          task.publicationState === "PUBLISHED" ? "destructive" : "primary"
        }

        isLoading={command.isPending}
        confirmDisabled={
          !command.allowed ||
          !!command.retained ||
          task.revision !== confirmedRevision
        }
        error={
          command.error?.message ??
          (task.revision !== confirmedRevision
            ? "تغيرت المهمة؛ أغلق التأكيد وراجع البيانات الحالية."
            : null)
        }
        onConfirm={confirmTask}
        onClose={() => {
          setStatusConfirmOpen(false);
        }}
      />
    </div>
  );
}
