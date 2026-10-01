"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Lock,
  RefreshCw,
  Send,
} from "lucide-react";
import { useState } from "react";
import { FINANCIAL_RULES } from "../../constants/branding";
import { useEmployeeState } from "../../context/employee-state.context";
import type { TaskStatus } from "../../types/employee.types";
import { Button, ButtonLink } from "../common/button";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";
import { ScreenshotUpload } from "./screenshot-upload";

interface TaskCardProps {
  readonly currentScenario?: TaskStatus | undefined;
}

export function TaskCard({ currentScenario }: TaskCardProps) {
  const {
    task,
    currentPackage,
    submitTask,
    replaceTaskScreenshot,
  } = useEmployeeState();

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const effectiveStatus = currentScenario || task.status;

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!screenshotUrl) {
      setFeedback({ success: false, message: "يرجى إرفاق لقطة شاشة لإثبات إنجاز المهمة." });
      return;
    }
    if (!acknowledged) {
      setFeedback({ success: false, message: "يرجى الإقرار بصحة التنفيذ وعدم تكرار لقطة الشاشة." });
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const res = submitTask(screenshotUrl);
      setFeedback(res);
      setIsSubmitting(false);
    }, 400);
  };

  const handleReplaceScreenshot = () => {
    if (!screenshotUrl) {
      setFeedback({ success: false, message: "يرجى اختيار لقطة شاشة جديدة للاستبدال." });
      return;
    }
    const res = replaceTaskScreenshot(screenshotUrl);
    setFeedback(res);
  };

  // Free user state
  if (currentPackage.id === "FREE" || effectiveStatus === "free") {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
          <Lock size={24} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">لا يوجد منصب نشط للمهام</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            حسابك حالياً في الحساب المجاني. المهام اليومية ومكافآتها تتطلب تفعيل أحد مناصب أوسكار المعتمدة (مثل منصب S1 أو O1).
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <ButtonLink
            href="/employee/packages"
            variant="primary"
            size="default"
            icon={Layers}
          >
            استعراض وتفعيل منصب الآن
          </ButtonLink>
        </div>
      </div>
    );
  }

  // Before window state
  if (effectiveStatus === "before_window") {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{task.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              نافذة المهمة: {FINANCIAL_RULES.taskTimeWindow.start} - {FINANCIAL_RULES.taskTimeWindow.end} ({FINANCIAL_RULES.taskTimeWindow.timezoneLabel})
            </p>
          </div>
          <StatusBadge status="pending" label="قبل موعد النافذة" />
        </div>

        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-md text-amber-900 flex items-start gap-3">
          <Clock size={20} className="shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
          <div className="text-sm space-y-1">
            <p className="font-bold">تبدأ فترة تنفيذ المهمة عند الساعة 12:00 ظهراً</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              يتاح للموظفين إرسال لقطات الشاشة وتأكيد الإنجاز حصرياً خلال فترة النافذة المحددة يومياً بين 12:00 و 18:00 بتوقيت بغداد.
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm pt-2 text-slate-600">
          <span>المكافأة المقررة للمهمة:</span>
          <MoneyAmount amount={task.rewardAmount} size="md" color="positive" />
        </div>
      </div>
    );
  }

  // Closed / missed state
  if (effectiveStatus === "closed") {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
          <Clock size={24} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">انتهت فترة تنفيذ مهمة اليوم</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            نافذة أداء المهمة تنتهي يومياً عند الساعة 18:00 بتوقيت بغداد. عدم إنجاز المهمة اليوم يعني عدم صرف المكافأة الخاصة بها لهذا اليوم، دون المساس برصيدك الحالي.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          تفتح النافذة القادمة غداً عند الساعة 12:00 ظهراً.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {currentPackage.name}
            </span>
            <span className="text-xs text-slate-500">
              النافذة: {FINANCIAL_RULES.taskTimeWindow.start} - {FINANCIAL_RULES.taskTimeWindow.end}
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
              <StatusBadge status="approved" label="تم الاعتماد وصرف المكافأة" />
            )}
            {effectiveStatus === "rejected" && (
              <StatusBadge status="rejected" label="مرفوضة من الإدارة" />
            )}
          </div>
        </div>

        <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
          {task.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          {task.description}
        </p>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-xs sm:text-sm">
          <span className="text-slate-500 font-medium">مكافأة إتمام المهمة:</span>
          <MoneyAmount amount={task.rewardAmount} size="lg" color="positive" showSign />
        </div>
      </div>

      {/* Task Image Preview & External action */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.previewImageUrl}
            alt="نموذج توضيحي لتنفيذ المهمة"
            className="w-full max-h-48 object-cover"
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-600 font-medium">{task.platform}</span>
          <a
            href={task.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-300 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            <span>الانتقال لرابط الشريك</span>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Rejection Notice if rejected */}
      {effectiveStatus === "rejected" && (
        <div className="m-4 sm:m-5 p-3.5 bg-rose-50 border border-rose-200 rounded-md text-rose-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-sm text-rose-800">
            <AlertCircle size={16} aria-hidden="true" />
            <span>سبب رفض المهمة من قبل فريق التدقيق:</span>
          </div>
          <p className="text-xs text-rose-700">
            {task.rejectionReason ?? "لقطة الشاشة المرفقة غير مطابقة للشروط المطلوبة."}
          </p>
          <p className="text-[11px] text-rose-600 pt-1">
            تم عكس مكافأة المهمة وإلغاؤها من الرصيد لعدم صحة التوثيق.
          </p>
        </div>
      )}

      {/* Instructions list */}
      <div className="p-4 sm:p-5 border-b border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          خطوات التنفيذ المعتمدة:
        </h3>
        <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
          {task.instructions.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Upload and Submission Section */}
      <div className="p-4 sm:p-5 space-y-4">
        {effectiveStatus === "submitted" ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-md text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>تم إرسال مهمة اليوم بنجاح ({task.submittedAt ?? "اليوم"})</span>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                أضيفت المكافأة ({task.rewardAmount.toFixed(2)} USDT) إلى رصيدك وهي قيد المراجعة التدقيقية. يمكنك استبدال لقطة الشاشة أدناه في حال رغبت بتعديل التوثيق دون تغيير المكافأة.
              </p>
            </div>

            <ScreenshotUpload
              initialPreview={task.submittedScreenshot || "/employee/task-preview.svg"}
              onFileSelected={(url) => {
                setScreenshotUrl(url);
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
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-900 space-y-1 text-center">
            <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-1" aria-hidden="true" />
            <p className="font-bold text-sm">تم اعتماد المهمة وصرف المكافأة نهائياً</p>
            <p className="text-xs text-emerald-700">
              تم التحقق من لقطة الشاشة وصحة التقييم بنجاح.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <ScreenshotUpload
              onFileSelected={(url) => {
                setScreenshotUrl(url);
              }}
            />

            {/* Fraud acknowledgment checkbox */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => {
                    setAcknowledged(e.target.checked);
                  }}
                  className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 shrink-0"
                  id="task-acknowledgment"
                  required
                />
                <span className="text-xs text-slate-700 leading-relaxed font-medium">
                  أقر بأنني قمت بتنفيذ المهمة والتفاعل بشكل فعلي وموضوعي، وأتحمل كامل المسؤولية عن صحة لقطة الشاشة المرفقة، وأعلم أن تقديم لقطات مكررة أو غير صحيحة يعرض الحساب لإلغاء المكافأة وتطبيق الإجراءات الإدارية.
                </span>
              </label>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-md text-xs font-medium flex items-center gap-2 ${
                  feedback.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
                role="alert"
              >
                {feedback.success ? (
                  <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
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
              disabled={!screenshotUrl || !acknowledged}
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
