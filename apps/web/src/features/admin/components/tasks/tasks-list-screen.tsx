"use client";

import { Edit, Eye, Pause, Play, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminSelect } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";
import type { AdminTask, AdminTaskState } from "../../types/admin.types";

export function TasksListScreen() {
  const { tasks, codes, codeUsages, submissions, toggleTaskStatus } =
    useAdminState();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusConfirmTask, setStatusConfirmTask] = useState<AdminTask | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !t.platform.toLowerCase().includes(q) &&
          !t.id.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      if (statusFilter !== "all" && t.status !== statusFilter) {
        return false;
      }

      if (platformFilter !== "all" && !t.platform.includes(platformFilter)) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, statusFilter, platformFilter]);

  const stateBadgeMap: Record<
    AdminTaskState,
    { label: string; variant: "success" | "warning" | "neutral" | "danger" }
  > = {
    active: { label: "نشطة حالياً", variant: "success" },
    scheduled: { label: "مجدولة", variant: "warning" },
    paused: { label: "متوقفة", variant: "neutral" },
    closed: { label: "منتهية/مغلقة", variant: "neutral" },
  };

  const statusOptions = [
    { value: "all", label: "كل حالات المهام" },
    { value: "active", label: "نشطة حالياً" },
    { value: "scheduled", label: "مجدولة" },
    { value: "paused", label: "متوقفة مؤقتاً" },
    { value: "closed", label: "مغلقة ومنتهية" },
  ];

  const platformOptions = [
    { value: "all", label: "كل المنصات المتاحة" },
    { value: "Google Maps", label: "Google Maps" },
    { value: "Trustpilot", label: "Trustpilot" },
    { value: "YouTube", label: "YouTube" },
    { value: "App Store", label: "App Store" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إدارة المهام اليومية"
        description="استعراض وتعديل المهام اليومية، نافذة التنفيذ الزمنية، شروط الرموز، ونسب الإنجاز"
        breadcrumbs={[{ label: "المهام" }]}
        action={
          <AdminButton href="/admin/tasks/new" variant="primary" icon={Plus}>
            إنشاء مهمة جديدة
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
          <div>
            <AdminInput
              icon={Search}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              placeholder="بحث بعنوان المهمة أو المنصة..."
              aria-label="بحث في المهام"
            />
          </div>

          <div>
            <AdminSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={statusOptions}
              aria-label="تصفية حسب حالة المهمة"
            />
          </div>

          <div>
            <AdminSelect
              value={platformFilter}
              onValueChange={setPlatformFilter}
              options={platformOptions}
              aria-label="تصفية حسب المنصة"
            />
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      <AdminTableShell>
        {filteredTasks.length === 0 ? (
          <AdminEmptyState
            title="لم يتم العثور على أي مهمة"
            description="لا توجد مهام تطابق معايير البحث الحالية."
          />
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">المهمة والمنصة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">نافذة التنفيذ</th>
                <th className="px-4 py-3">رمز الفتح</th>
                <th className="px-4 py-3">الرموز المرتبطة</th>
                <th className="px-4 py-3">مرات الفتح</th>
                <th className="px-4 py-3">التسليمات</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.map((task) => {
                const stateMeta = stateBadgeMap[task.status];
                const linkedCodesCount = codes.filter(
                  (c) => c.taskId === task.id,
                ).length;
                const distinctUnlocks = new Set(
                  codeUsages
                    .filter((u) => u.taskId === task.id)
                    .map((u) => u.employeeId),
                ).size;
                const taskSubmissions = submissions.filter(
                  (s) => s.taskId === task.id,
                );
                const approvedCount = taskSubmissions.filter(
                  (s) => s.status === "approved",
                ).length;

                return (
                  <tr key={task.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <Link
                          href={`/admin/tasks/${task.id}`}
                          className="block text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {task.title}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{task.platform}</span>
                          <span>&bull;</span>
                          <bdi dir="ltr" className="font-mono text-slate-400">
                            {task.id}
                          </bdi>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <AdminBadge variant={stateMeta.variant} size="sm">
                        {stateMeta.label}
                      </AdminBadge>
                    </td>

                    <td
                      className="px-4 py-3 font-mono whitespace-nowrap text-slate-700"
                      dir="ltr"
                    >
                      {task.windowStart} - {task.windowEnd}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {task.isCodeRequired ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          إلزامي
                        </span>
                      ) : (
                        <span className="text-slate-400">غير مطلوب</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/codes?task=${task.id}`}
                        className="font-bold text-slate-800 hover:text-emerald-700 hover:underline"
                      >
                        {linkedCodesCount} رمز
                      </Link>
                    </td>

                    <td className="px-4 py-3 font-bold whitespace-nowrap text-slate-900">
                      {distinctUnlocks} مستخدم
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-slate-900">
                        {taskSubmissions.length}
                      </span>{" "}
                      <span className="text-[11px] text-slate-500">
                        ({approvedCount} معتمد)
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <AdminButton
                          href={`/admin/tasks/${task.id}`}
                          variant="outline"
                          size="sm"
                          icon={Eye}
                        >
                          تفاصيل
                        </AdminButton>

                        <AdminButton
                          href={`/admin/tasks/${task.id}/edit`}
                          variant="outline"
                          size="sm"
                          icon={Edit}
                        >
                          تعديل
                        </AdminButton>

                        <AdminButton
                          variant={
                            task.status === "active" ? "secondary" : "primary"
                          }
                          size="sm"
                          icon={task.status === "active" ? Pause : Play}
                          onClick={() => {
                            setStatusConfirmTask(task);
                          }}
                        >
                          {task.status === "active" ? "إيقاف" : "تفعيل"}
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

      {/* Confirm Task Status Toggle Dialog */}
      {statusConfirmTask && (
        <AdminConfirmDialog
          isOpen={true}
          title={
            statusConfirmTask.status === "active"
              ? `إيقاف المهمة: ${statusConfirmTask.title}`
              : `تفعيل المهمة: ${statusConfirmTask.title}`
          }
          description={
            statusConfirmTask.status === "active"
              ? "سيؤدي إيقاف المهمة إلى حجبها عن الموظفين ومنع رفع أي تسليمات جديدة عليها فوراً."
              : "سيتم تفعيل المهمة وإتاحتها لجميع الموظفين المؤهلين لتنفيذها وتقديم الإثباتات."
          }
          confirmLabel={
            statusConfirmTask.status === "active"
              ? "تأكيد الإيقاف"
              : "تأكيد التفعيل"
          }
          variant={
            statusConfirmTask.status === "active" ? "destructive" : "primary"
          }

          onConfirm={() => {
            toggleTaskStatus(statusConfirmTask.id);
            setFeedback(
              statusConfirmTask.status === "active"
                ? `تم إيقاف المهمة "${statusConfirmTask.title}" بنجاح.`
                : `تم تفعيل المهمة "${statusConfirmTask.title}" بنجاح.`,
            );
            setStatusConfirmTask(null);
          }}
          onClose={() => {
            setStatusConfirmTask(null);
          }}
        />
      )}
    </div>
  );
}
