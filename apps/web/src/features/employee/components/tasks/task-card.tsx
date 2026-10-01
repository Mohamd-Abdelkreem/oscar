"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Send,
} from "lucide-react";
import { useState } from "react";
import { FINANCIAL_RULES } from "../../constants/branding";
import { useEmployeeState } from "../../context/employee-state.context";
import { useTaskSubmission } from "../../hooks/use-task-submission";
import { useTaskCodeGate } from "@/features/admin/hooks/use-task-code-gate";
import { Button } from "../common/button";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";
import { ScreenshotUpload } from "./screenshot-upload";
import { TaskAvailabilityCard } from "./task-availability-card";
import { TaskCodeGate } from "./task-code-gate";

interface TaskCardProps {
  readonly currentScenario?: string | undefined;
}

export function TaskCard({ currentScenario }: TaskCardProps) {
  const { user, task, currentPackage } = useEmployeeState();
  const { isTaskUnlocked, unlockTaskWithCode } = useTaskCodeGate(task.id, user.id);
  const [unlockedLocally, setUnlockedLocally] = useState(false);
  const {
    screenshotFile,
    setScreenshotFile,
    acknowledged,
    setAcknowledged,
    isSubmitting,
    feedback,
    handleSubmit,
    handleReplaceScreenshot,
  } = useTaskSubmission();
  const effectiveStatus = currentScenario || task.status;

  if (currentPackage.id === "FREE" || effectiveStatus === "free") {
    return <TaskAvailabilityCard status="free" task={task} />;
  }
  if (effectiveStatus === "before_window" || effectiveStatus === "closed") {
    return <TaskAvailabilityCard status={effectiveStatus} task={task} />;
  }

  // Code Gate: If task requires unlock code and is not yet unlocked
  const unlocked =
    !task.isCodeRequired ||
    unlockedLocally ||
    isTaskUnlocked;

  if (!unlocked) {
    return (
      <TaskCodeGate
        taskId={task.id}
        unlockFn={unlockTaskWithCode}
        onUnlocked={() => { setUnlockedLocally(true); }}
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              {currentPackage.name}
            </span>
            <span className="text-xs text-slate-500">
              النافذة: {FINANCIAL_RULES.taskTimeWindow.start} -{" "}
              {FINANCIAL_RULES.taskTimeWindow.end}
            </span>
          </div>

          <div>
            {effectiveStatus === "open" && (
              <StatusBadge status="active" label="النافذة مفتوحة الآن" />
            )}
            {effectiveStatus === "submitted" && (
              <StatusBadge status="pending" label="قيد التدقيق والمراجعة" />
            )}
            {effectiveStatus === "approved" && (
              <StatusBadge
                status="approved"
                label="تم الاعتماد وصرف المكافأة"
              />
            )}
            {effectiveStatus === "rejected" && (
              <StatusBadge status="rejected" label="مرفوضة من الإدارة" />
            )}
          </div>
        </div>

        <h2 className="mb-1 text-base font-bold text-slate-900 sm:text-lg">
          {task.title}
        </h2>
        <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
          {task.description}
        </p>

        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-xs sm:text-sm">
          <span className="font-medium text-slate-500">
            مكافأة إتمام المهمة:
          </span>
          <MoneyAmount
            amount={task.rewardAmount}
            size="lg"
            color="positive"
            showSign
          />
        </div>
      </div>

      {/* Task Image Preview & External action */}
      <div className="border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.previewImageUrl}
            alt="نموذج توضيحي لتنفيذ المهمة"
            className="max-h-48 w-full object-cover"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">
            {task.platform}
          </span>
          <a
            href={task.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 hover:text-emerald-950 focus-visible:outline-2 focus-visible:outline-emerald-600 sm:text-sm"
          >
            <span>الانتقال لرابط الشريك</span>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Rejection Notice if rejected */}
      {effectiveStatus === "rejected" && (
        <div className="m-4 space-y-1 rounded-md border border-rose-200 bg-rose-50 p-3.5 text-rose-900 sm:m-5">
          <div className="flex items-center gap-1.5 text-sm font-bold text-rose-800">
            <AlertCircle size={16} aria-hidden="true" />
            <span>سبب رفض المهمة من قبل فريق التدقيق:</span>
          </div>
          <p className="text-xs text-rose-700">
            {task.rejectionReason ??
              "لقطة الشاشة المرفقة غير مطابقة للشروط المطلوبة."}
          </p>
          <p className="pt-1 text-[11px] text-rose-600">
            تم عكس مكافأة المهمة وإلغاؤها من الرصيد لعدم صحة التوثيق.
          </p>
        </div>
      )}

      {/* Instructions list */}
      <div className="border-b border-slate-200 p-4 sm:p-5">
        <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
          خطوات التنفيذ المعتمدة:
        </h3>
        <ol className="space-y-2 text-xs text-slate-700 sm:text-sm">
          {task.instructions.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Upload and Submission Section */}
      <div className="space-y-4 p-4 sm:p-5">
        {effectiveStatus === "submitted" ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-900">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>
                  تم إرسال مهمة اليوم بنجاح ({task.submittedAt ?? "اليوم"})
                </span>
              </div>
              <p className="text-xs leading-relaxed text-emerald-700">
                أضيفت المكافأة ({task.rewardAmount.toFixed(2)} USDT) إلى رصيدك
                وهي قيد المراجعة التدقيقية. يمكنك استبدال لقطة الشاشة أدناه في
                حال رغبت بتعديل التوثيق دون تغيير المكافأة.
              </p>
            </div>

            <ScreenshotUpload
              initialPreview={
                task.submittedScreenshot || "/employee/task-preview.svg"
              }
              onFileSelected={(file) => {
                setScreenshotFile(file);
              }}
            />

            <Button
              variant="outline"
              fullWidth
              size="default"
              icon={RefreshCw}
              onClick={handleReplaceScreenshot}
            >
              تحديث لقطة الشاشة المرفقة
            </Button>
          </div>
        ) : effectiveStatus === "approved" ? (
          <div className="space-y-1 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-center text-emerald-900">
            <CheckCircle2
              size={24}
              className="mx-auto mb-1 text-emerald-600"
              aria-hidden="true"
            />
            <p className="text-sm font-bold">
              تم اعتماد المهمة وصرف المكافأة نهائياً
            </p>
            <p className="text-xs text-emerald-700">
              تم التحقق من لقطة الشاشة وصحة التقييم بنجاح.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <ScreenshotUpload
              onFileSelected={(file) => {
                setScreenshotFile(file);
              }}
            />

            {/* Fraud acknowledgment checkbox */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => {
                    setAcknowledged(e.target.checked);
                  }}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  id="task-acknowledgment"
                  required
                />
                <span className="text-xs leading-relaxed font-medium text-slate-700">
                  أقر بأنني قمت بتنفيذ المهمة والتفاعل بشكل فعلي وموضوعي، وأتحمل
                  كامل المسؤولية عن صحة لقطة الشاشة المرفقة، وأعلم أن تقديم
                  لقطات مكررة أو غير صحيحة يعرض الحساب لإلغاء المكافأة وتطبيق
                  الإجراءات الإدارية.
                </span>
              </label>
            </div>

            {feedback && (
              <div
                className={`flex items-center gap-2 rounded-md p-3 text-xs font-medium ${
                  feedback.success
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-rose-200 bg-rose-50 text-rose-800"
                }`}
                role="alert"
              >
                {feedback.success ? (
                  <CheckCircle2
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="default"
              fullWidth
              loading={isSubmitting}
              disabled={!screenshotFile || !acknowledged}
              icon={Send}
            >
              تأكيد وإرسال المهمة للاعتماد
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
