"use client";

import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { useState } from "react";
import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";
import { useAdminState } from "@/features/admin/context/admin-state.context";
import { useEmployeeState } from "@/features/employee/context/employee-state.context";

interface TaskCodeGateProps {
  readonly taskId: string;
  readonly onUnlocked: () => void;
  readonly unlockFn?: (code: string) => { success: boolean; message: string };
}

export function TaskCodeGate({
  taskId,
  onUnlocked,
  unlockFn,
}: TaskCodeGateProps) {
  const scheduleTimeout = useManagedTimeout();
  const { user } = useEmployeeState();
  const adminState = useAdminState();
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    // Call unlock function
    const result = unlockFn
      ? unlockFn(code)
      : adminState.unlockTaskWithCode(taskId, user.id, code);

    setIsSubmitting(false);
    setFeedback({
      success: result.success,
      message: result.message,
    });

    if (result.success) {
      scheduleTimeout(() => {
        onUnlocked();
      }, 700);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <KeyRound size={22} aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 sm:text-lg">
            رمز فتح المهمة
          </h3>
          <p className="text-xs text-slate-500 sm:text-sm">
            أدخل الرمز المخصص لمهمة اليوم للوصول إلى تفاصيل المهمة ورفع لقطة
            الشاشة
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="task-unlock-code"
            className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
          >
            رمز فتح المهمة
          </label>
          <div className="relative">
            <input
              id="task-unlock-code"
              type="text"
              dir="ltr"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
              }}
              placeholder="مثال: OSCAR-TASK-2026"
              className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-center font-mono text-sm tracking-wider text-slate-900 uppercase placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 sm:text-base"
              required
              autoComplete="off"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            أدخل الرمز المخصص لمهمة اليوم
          </p>
        </div>

        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-md p-3 text-xs font-semibold sm:text-sm ${
              feedback.success
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
            role="alert"
          >
            {feedback.success ? (
              <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!code.trim() || isSubmitting}
          className="emp-btn emp-btn--primary emp-btn--full min-h-[48px] text-sm font-bold sm:text-base"
        >
          {isSubmitting ? "جارٍ التحقق..." : "فتح المهمة"}
        </button>

        <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5 text-center text-xs text-slate-500">
          <span className="font-semibold text-slate-600">
            رمز المعاينة التجريبي اليوم:{" "}
          </span>
          <bdi className="font-mono font-bold text-emerald-700">
            OSCAR-TASK-2026
          </bdi>
        </div>
      </form>
    </div>
  );
}
