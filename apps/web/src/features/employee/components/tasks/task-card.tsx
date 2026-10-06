"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Send,
} from "lucide-react";
import type { EmployeeTaskDay, SubmissionDetail } from "@template/contracts";
import { usePrivateProof } from "@/features/proofs/hooks/use-private-proof";
import { FINANCIAL_RULES } from "../../constants/branding";
import { useTaskSubmission } from "../../hooks/use-task-submission";
import { Button } from "../common/button";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";
import { ScreenshotUpload } from "./screenshot-upload";
import { TaskAvailabilityCard } from "./task-availability-card";
import { TaskCodeGate } from "./task-code-gate";

interface TaskCardProps {
  readonly day?: EmployeeTaskDay;
  readonly savedSubmission?: SubmissionDetail;
}
export function TaskCard({ day, savedSubmission }: TaskCardProps) {
  const submission = savedSubmission ?? day?.submission ?? null;
  const workflow = useTaskSubmission(day ?? null, submission);
  const {
    screenshotFile,
    setScreenshotFile,
    acknowledged,
    setAcknowledged,
    isSubmitting,
    feedback,
    handleSubmit,
    handleReplaceScreenshot,
  } = workflow;
  const proof = usePrivateProof({
    purpose: "PROOF",
    assetId: submission?.evidence.assetId ?? null,
    evidenceIdentity: submission
      ? submission.id + ":" + String(submission.currentEvidenceVersion)
      : "",
    role: "USER",
    open: submission !== null,
  });
  const illustration = usePrivateProof({
    purpose: "TASK_ILLUSTRATION",
    assetId: submission ? null : (day?.task?.illustration?.id ?? null),
    evidenceIdentity: day?.task?.id ?? "",
    role: "USER",
    open: submission === null,
  });
  if (!submission && day && !day.canSubmit && !day.canUnlock)
    return <TaskAvailabilityCard day={day} />;
  if (!submission && day?.canUnlock) return <TaskCodeGate day={day} />;
  const content = submission?.snapshot.capturedTaskContent ?? day?.task;
  if (!content) return null;
  const task = {
    ...content,
    rewardAmount: submission?.reward ?? day?.currentEntitlement.dailyReward,
    submittedAt: submission?.submittedAt,
    instructions: content.description.split("\n").filter(Boolean),
  };
  const packageLabel =
    submission?.snapshot.capturedSubscriptionTerms.code ??
    day?.currentEntitlement.packageLabel;
  const effectiveStatus =
    submission?.status === "PENDING"
      ? "submitted"
      : submission?.status === "APPROVED"
        ? "approved"
        : submission?.status === "REJECTED"
          ? "rejected"
          : "open";
  const disabled = isSubmitting || workflow.unresolved || !workflow.allowed;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              {packageLabel}
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
          {task.rewardAmount && (
            <MoneyAmount
              amount={task.rewardAmount}
              size="lg"
              color="positive"
              showSign
            />
          )}
        </div>
      </div>

      {/* Task Image Preview & External action */}
      <div className="border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
        {illustration.url && (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={illustration.url}
              alt="نموذج توضيحي لتنفيذ المهمة"
              className="max-h-48 w-full object-cover"
            />
          </div>
        )}
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
            {submission?.finalDecision?.reason ?? "تم رفض المهمة نهائياً."}
          </p>
          <p className="pt-1 text-[11px] text-rose-600">
            لم تُصرف مكافأة هذه المهمة، ولا يُخصم شيء من رصيدك.
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
                المكافأة ({task.rewardAmount} USDT) قيد المراجعة، ولا تُضاف إلى
                الرصيد قبل الاعتماد النهائي. يمكنك استبدال لقطة الشاشة أدناه في
                حال رغبت بتعديل التوثيق دون تغيير المكافأة.
              </p>
            </div>

            <ScreenshotUpload
              initialPreview={proof.url ?? undefined}
              disabled={disabled || !submission?.canReplace}
              onFileSelected={(file) => {
                setScreenshotFile(file);
              }}
            />

            <Button
              variant="outline"
              fullWidth
              size="default"
              icon={RefreshCw}
              disabled={disabled || !screenshotFile || !submission?.canReplace}
              onClick={() => {
                void handleReplaceScreenshot();
              }}
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
        ) : effectiveStatus === "rejected" ? null : (
          <form
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="space-y-4"
          >
            <ScreenshotUpload
              disabled={disabled || !day?.canSubmit}
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

            <Button
              type="submit"
              variant="primary"
              size="default"
              fullWidth
              loading={isSubmitting}
              disabled={
                disabled || !screenshotFile || !acknowledged || !day?.canSubmit
              }
              icon={Send}
            >
              تأكيد وإرسال المهمة للاعتماد
            </Button>
          </form>
        )}
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
              <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
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
        {submission && (
          <div className="text-xs text-slate-500" role="status">
            الإقرار بالتنفيذ محفوظ.{" "}
            {proof.availability === "REMOVED"
              ? "حُذفت الصورة بعد انتهاء مدة الاحتفاظ."
              : proof.availability === "STORAGE_UNAVAILABLE" || proof.error
                ? "الصورة غير متاحة حالياً."
                : proof.isPending
                  ? "جارٍ تحميل الصورة..."
                  : ""}
          </div>
        )}
        {submission && effectiveStatus !== "submitted" && proof.url && (
          <ScreenshotUpload
            initialPreview={proof.url}
            onFileSelected={() => {}}
            disabled
          />
        )}
        {workflow.unresolved && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                void workflow.observe();
              }}
            >
              التحقق من الطلب
            </Button>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                void workflow.cancel();
              }}
            >
              إلغاء الطلب غير المؤكد
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
