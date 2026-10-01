"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import { AlertCircle, CheckCircle2, KeyRound, Sparkles } from "lucide-react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminPageHeader } from "../common/admin-page-header";
import { useAdminState } from "../../context/admin-state.context";

export function CodeCreateScreen() {
  const scheduleTimeout = useManagedTimeout();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTaskId = searchParams.get("taskId");

  const { tasks, createCode } = useAdminState();

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    defaultTaskId ?? tasks[0]?.id ?? "",
  );
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"active" | "paused">("active");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper generator for random readable uppercase mock code
  const handleGenerateCode = () => {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generated = `OSCAR-${randomHex}-2026`;
    setCode(generated);
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedTaskId) {
      setError("يرجى اختيار المهمة المرتبطة بالرمز.");
      return;
    }

    if (!code.trim()) {
      setError("يرجى إدخال الرمز أو توليده تلقائياً.");
      return;
    }

    setIsSubmitting(true);

    const res = createCode({
      code: code.trim(),
      taskId: selectedTaskId,
      status,
      description: description.trim() || undefined,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.message);
    } else {
      setSuccessMessage("تم إنشاء رمز فتح المهمة بنجاح.");
      const targetCodeId = res.code ? res.code.id : "";
      scheduleTimeout(() => {
        if (targetCodeId) {
          router.push(`/admin/codes/${targetCodeId}` as Route);
        } else {
          router.push("/admin/codes");
        }
      }, 700);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إنشاء رمز فتح مهمة جديد"
        description="ربط الرمز بمهمة محددة وتحديد حالته الأولية ليتمكن الموظفون من فتح المهمة وتنفيذها"
        breadcrumbs={[
          { label: "رموز المهام", href: "/admin/codes" },
          { label: "إنشاء رمز جديد" },
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
        <div className="max-w-2xl space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          {/* 1. Task Selection */}
          <div>
            <label
              htmlFor="select-task"
              className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
            >
              المهمة المرتبطة بالرمز <span className="text-rose-600">*</span>
            </label>
            <select
              id="select-task"
              value={selectedTaskId}
              onChange={(e) => {
                setSelectedTaskId(e.target.value);
              }}
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 sm:text-sm"
              required
            >
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} ({task.platform})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              يرتبط الرمز حصرياً بمهمة واحدة، ولا يمكن استخدامه لفتح مهمة أخرى.
            </p>
          </div>

          {/* 2. Code Input with Generator Button */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="code-input"
                className="text-xs font-bold text-slate-700 sm:text-sm"
              >
                الرمز (Code) <span className="text-rose-600">*</span>
              </label>

              <button
                type="button"
                onClick={handleGenerateCode}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                <Sparkles size={13} aria-hidden="true" />
                <span>توليد رمز تلقائي</span>
              </button>
            </div>

            <input
              id="code-input"
              type="text"
              dir="ltr"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
              }}
              placeholder="مثال: OSCAR-TASK-2026"
              className="w-full rounded-md border border-slate-300 p-2.5 font-mono text-sm tracking-wider text-slate-900 uppercase placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              قاعدة التوحيد القياسي: يتم تحويل كافة الرموز تلقائياً إلى حروف
              كبيرة مع حذف المسافات الزائدة (Trim & Uppercase).
            </p>
          </div>

          {/* 3. Status */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm">
              الحالة التشغيلية الأولية:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  name="code-status"
                  value="active"
                  checked={status === "active"}
                  onChange={() => {
                    setStatus("active");
                  }}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-900">
                    نشط (متاح للاستخدام فوراً)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    يسمح للموظفين بفتح المهمة بنجاح
                  </span>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  name="code-status"
                  value="paused"
                  checked={status === "paused"}
                  onChange={() => {
                    setStatus("paused");
                  }}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-900">
                    متوقف مؤقتاً
                  </span>
                  <span className="text-[11px] text-slate-500">
                    محظور الفتح لحين التفعيل لاحقاً
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 4. Description / Note */}
          <div>
            <label
              htmlFor="code-desc"
              className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
            >
              وصف أو ملاحظة إدارية (اختياري)
            </label>
            <textarea
              id="code-desc"
              rows={2}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              placeholder="مثال: رمز موجه لموظفي باقات O1 و O2..."
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 sm:text-sm"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex max-w-2xl items-center justify-end gap-3 rounded-lg border-t border-slate-200 bg-white p-4">
          <AdminButton href="/admin/codes" variant="outline" size="default">
            إلغاء
          </AdminButton>
          <AdminButton
            type="submit"
            variant="primary"
            size="default"
            loading={isSubmitting}
            icon={KeyRound}
          >
            حفظ وإنشاء الرمز
          </AdminButton>
        </div>
      </form>
    </div>
  );
}
