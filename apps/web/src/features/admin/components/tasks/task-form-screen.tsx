"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminImageUpload } from "../common/admin-image-upload";
import { AdminPageHeader } from "../common/admin-page-header";
import { useAdminState } from "../../context/admin-state.context";
import type { AdminTask, AdminTaskState } from "../../types/admin.types";

interface TaskFormScreenProps {
  readonly initialTask?: AdminTask;
  readonly taskId?: string;
  readonly isEdit?: boolean;
}

// Function-size exception: these fields share one controlled task form and submit
// boundary. Revisit when a field group gains separate state or reusable behavior.
export function TaskFormScreen({
  initialTask: propInitialTask,
  taskId,
  isEdit = false,
}: TaskFormScreenProps) {
  const scheduleTimeout = useManagedTimeout();
  const router = useRouter();
  const { tasks, createTask, updateTask } = useAdminState();

  const initialTask =
    propInitialTask ??
    (taskId ? tasks.find((t) => t.id === taskId) : undefined);

  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(
    initialTask?.description ?? "",
  );
  const [targetUrl, setTargetUrl] = useState(
    initialTask?.targetUrl ?? "https://partner.example.com/task-link",
  );
  const [platform, setPlatform] = useState(
    initialTask?.platform ?? "منصة التقييم المعتمدة أوسكار",
  );
  const [previewImageUrl, setPreviewImageUrl] = useState(
    initialTask?.previewImageUrl ?? "/employee/task-preview.svg",
  );
  const [windowStart, setWindowStart] = useState(
    initialTask?.windowStart ?? "12:00",
  );
  const [windowEnd, setWindowEnd] = useState(initialTask?.windowEnd ?? "18:00");
  const [timezone] = useState(initialTask?.timezone ?? "Asia/Baghdad");
  const [rewardAmount] = useState(
    initialTask?.rewardAmount.toString() ?? "2.00",
  );
  const [status, setStatus] = useState<AdminTaskState>(
    initialTask?.status ?? "active",
  );
  const [isCodeRequired, setIsCodeRequired] = useState(
    initialTask?.isCodeRequired ?? true,
  );
  const [startDate, setStartDate] = useState(
    initialTask?.startDate ?? "2026-10-01",
  );
  const [endDate, setEndDate] = useState(initialTask?.endDate ?? "2026-10-01");

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (
      !title.trim() ||
      !description.trim() ||
      !targetUrl.trim() ||
      !platform.trim()
    ) {
      setError("يرجى تعبئة جميع الحقول المطلوبة.");
      return;
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      setError("يرجى إدخال رابط صالح يبدأ بـ http:// أو https://.");
      return;
    }

    if (windowStart >= windowEnd) {
      setError("وقت بداية النافذة يجب أن يسبق وقت نهايتها.");
      return;
    }

    const reward = parseFloat(rewardAmount);
    if (isNaN(reward) || reward < 0) {
      setError("يرجى إدخال مبلغ مكافأة صحيح.");
      return;
    }

    setIsSubmitting(true);

    if (isEdit && initialTask) {
      updateTask(initialTask.id, {
        title: title.trim(),
        description: description.trim(),
        targetUrl: targetUrl.trim(),
        platform: platform.trim(),
        previewImageUrl,
        windowStart,
        windowEnd,
        rewardAmount: reward,
        status,
        isCodeRequired,
        startDate,
        endDate,
      });

      setSuccessMessage("تم حفظ تعديلات المهمة بنجاح.");
      scheduleTimeout(() => {
        router.push("/admin/tasks");
      }, 700);
    } else {
      const res = createTask({
        title: title.trim(),
        description: description.trim(),
        targetUrl: targetUrl.trim(),
        platform: platform.trim(),
        previewImageUrl,
        windowStart,
        windowEnd,
        timezone,
        rewardAmount: reward,
        status,
        isCodeRequired,
        startDate,
        endDate,
      });

      if (res.success && res.task) {
        setSuccessMessage("تم إنشاء المهمة اليومية بنجاح.");
        const targetTaskId = res.task.id;
        scheduleTimeout(() => {
          router.push(`/admin/tasks/${targetTaskId}` as Route);
        }, 700);
      }
    }
  };

  const pageTitle =
    isEdit && initialTask
      ? `تعديل المهمة: ${initialTask.title}`
      : "إنشاء مهمة يومية جديدة";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={pageTitle}
        description="تحديد بيانات المهمة، الرابط المستهدف، النافذة الزمنية، وسياسة رموز الفتح"
        breadcrumbs={[
          { label: "المهام", href: "/admin/tasks" },
          { label: isEdit ? "تعديل المهمة" : "مهمة جديدة" },
        ]}
      />

      {error && (
        <div
          className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800"
          role="alert"
        >
          <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800"
          role="alert"
        >
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Form Fields */}
          <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
            <div>
              <label
                htmlFor="task-title"
                className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                عنوان المهمة <span className="text-rose-600">*</span>
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
                placeholder="مثال: مراجعة جودة محتوى وتقييم تطبيق الشريك"
                className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 sm:text-sm"
                required
              />
            </div>

            <div>
              <label
                htmlFor="task-description"
                className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                وصف المهمة وتوجيهات التنفيذ{" "}
                <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="task-description"
                rows={4}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
                placeholder="تفاصيل التفاعل المطلوب والخطوات الواجب على الموظف اتباعها..."
                className="w-full rounded-md border border-slate-300 p-2.5 text-xs leading-relaxed text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 sm:text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="task-platform"
                  className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
                >
                  المنصة / التطبيق المستهدف{" "}
                  <span className="text-rose-600">*</span>
                </label>
                <input
                  id="task-platform"
                  type="text"
                  value={platform}
                  onChange={(e) => {
                    setPlatform(e.target.value);
                  }}
                  placeholder="مثال: منصة التقييم المعتمدة أوسكار"
                  className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="task-url"
                  className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
                >
                  الرابط الخارجي (URL) <span className="text-rose-600">*</span>
                </label>
                <input
                  id="task-url"
                  type="url"
                  dir="ltr"
                  value={targetUrl}
                  onChange={(e) => {
                    setTargetUrl(e.target.value);
                  }}
                  placeholder="https://..."
                  className="w-full rounded-md border border-slate-300 p-2.5 font-mono text-xs text-slate-900 sm:text-sm"
                  required
                />
              </div>
            </div>

            <AdminImageUpload
              initialImageUrl={previewImageUrl}
              label="صورة المعاينة التوضيحية للمهمة"
              onImageSelected={(url) => {
                setPreviewImageUrl(url);
              }}
            />
          </div>

          {/* Schedule & Rules Sidebar Card */}
          <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900">
              التوقيت والسياسات المعتمدة
            </h2>

            {/* Time Window */}
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/50 p-3.5">
              <span className="block text-xs font-bold text-slate-700">
                نافذة التنفيذ اليومية (الافتراضي 12:00 - 18:00)
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="window-start"
                    className="mb-1 block text-[11px] text-slate-500"
                  >
                    من الساعة:
                  </label>
                  <input
                    id="window-start"
                    type="time"
                    value={windowStart}
                    onChange={(e) => {
                      setWindowStart(e.target.value);
                    }}
                    className="w-full rounded border border-slate-300 p-1.5 font-mono text-xs"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="window-end"
                    className="mb-1 block text-[11px] text-slate-500"
                  >
                    إلى الساعة:
                  </label>
                  <input
                    id="window-end"
                    type="time"
                    value={windowEnd}
                    onChange={(e) => {
                      setWindowEnd(e.target.value);
                    }}
                    className="w-full rounded border border-slate-300 p-1.5 font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-500">
                المنطقة الزمنية المعتمدة:{" "}
                <bdi className="font-bold text-slate-700">{timezone}</bdi>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-600">
                  تاريخ البدء:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                  }}
                  className="w-full rounded border border-slate-300 p-1.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-600">
                  تاريخ الانتهاء:
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                  }}
                  className="w-full rounded border border-slate-300 p-1.5 font-mono text-xs"
                />
              </div>
            </div>

            {/* Task Status */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                حالة المهمة:
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as AdminTaskState);
                }}
                className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
              >
                <option value="active">نشطة (مفتوحة أثناء النافذة)</option>
                <option value="scheduled">مجدولة لموعد لاحق</option>
                <option value="paused">متوقفة مؤقتاً</option>
                <option value="closed">مغلقة / منتهية</option>
              </select>
            </div>

            {/* Code Requirement Toggle */}
            <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isCodeRequired}
                  onChange={(e) => {
                    setIsCodeRequired(e.target.checked);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <div>
                  <span className="block text-xs font-bold text-emerald-950">
                    رمز فتح المهمة إلزامي
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-emerald-800">
                    عند التفعيل، لا يمكن للموظف الوصول لتفاصيل المهمة ورفع لقطة
                    الشاشة دون إدخال رمز فتح نشط مخصص لهذه المهمة.
                  </span>
                </div>
              </label>
            </div>

            {/* Submission Policy Notice (Section 7) */}
            <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <span className="block font-bold text-slate-800">
                سياسة التوثيق المعتمدة:
              </span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                وفق سياسة أوسكار المعتمدة، فإن رفع لقطة الشاشة وتفعيل الإقرار
                الإلزامي شرطان أساسيان لتأكيد إرسال أي مهمة يومية.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 rounded-lg border-t border-slate-200 bg-white p-4">
          <AdminButton href="/admin/tasks" variant="outline" size="default">
            إلغاء
          </AdminButton>
          <AdminButton
            type="submit"
            variant="primary"
            size="default"
            loading={isSubmitting}
            icon={Save}
          >
            {isEdit ? "حفظ التعديلات" : "إنشاء المهمة"}
          </AdminButton>
        </div>
      </form>
    </div>
  );
}
