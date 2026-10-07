"use client";

import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { useState } from "react";
import type { EmployeeTaskDay } from "@template/contracts";
import { useEmployeeTaskCommand } from "../../hooks/tasks.hooks";
import { employeeTasksApi } from "../../api/tasks.api";
import { getApiError, safeApiError } from "@/services/api/safe-error";

interface TaskCodeGateProps {
  readonly day: EmployeeTaskDay;
}
export function TaskCodeGate({ day }: TaskCodeGateProps) {
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const command = useEmployeeTaskCommand({
    kind: "TASK_UNLOCK",
    targetId: day.task?.id ?? null,
  });
  const isSubmitting = command.isPending;
  const handleSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (
      !day.canUnlock ||
      !day.task ||
      !code.trim() ||
      !command.allowed ||
      command.retained ||
      command.isPending
    )
      return;
    try {
      const outcome = await command.execute((commandId) =>
        employeeTasksApi.unlock(day.task?.id ?? "", {
          commandId,
          expectedTaskRevision: day.task?.revision,
          code,
        }),
      );
      if (outcome?.state !== "OBSERVED")
        throw safeApiError("uncertain", "COMMAND_UNRESOLVED");
      setCode("");
      setFeedback({ success: true, message: "تم فتح المهمة." });
    } catch (failure: unknown) {
      setFeedback({ success: false, message: getApiError(failure).message });
    }
  };
  const resolve = async (action: "observe" | "cancel") => {
    try {
      await command[action]();
      setFeedback({
        success: false,
        message: "راجع حالة الطلب المحفوظة قبل المحاولة مجدداً.",
      });
    } catch (failure: unknown) {
      setFeedback({ success: false, message: getApiError(failure).message });
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

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="mt-5 space-y-4"
      >
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
          disabled={
            !code.trim() ||
            isSubmitting ||
            !day.canUnlock ||
            !command.allowed ||
            command.retained !== null
          }
          className="emp-btn emp-btn--primary emp-btn--full min-h-[48px] text-sm font-bold sm:text-base"
        >
          {isSubmitting ? "جارٍ التحقق..." : "فتح المهمة"}
        </button>

        {command.retained && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void resolve("observe");
              }}
              className="emp-btn emp-btn--outline"
            >
              التحقق من الطلب
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void resolve("cancel");
              }}
              className="emp-btn emp-btn--outline"
            >
              إلغاء الطلب غير المؤكد
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
