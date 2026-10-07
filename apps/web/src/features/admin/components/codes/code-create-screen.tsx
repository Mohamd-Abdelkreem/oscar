"use client";

import { taskCodeCreateSchema, normalizeTaskCode } from "@template/contracts";
import {
  useAdminTasks,
  useAdminTask,
  useAdminTaskCommand,
} from "../../hooks/tasks.hooks";
import { adminTaskCodesApi } from "../../api/task-codes.api";
import { getApiError } from "@/services/api/safe-error";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { TaskCommandFeedback } from "../common/task-command-feedback";
import { TaskQueryState } from "../common/task-query-state";

import { AlertCircle, CheckCircle2, KeyRound, Sparkles } from "lucide-react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminPageHeader } from "../common/admin-page-header";

export function CodeCreateScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTaskId = searchParams.get("taskId");

  const options = useAdminTasks();
  const tasks = options.data?.items ?? [];

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    defaultTaskId ?? "",
  );
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"active" | "paused">("active");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const selected = useAdminTask(selectedTaskId || null);
  const command = useAdminTaskCommand({
    kind: "CODE_CREATE",
    targetId: selectedTaskId || null,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isSubmitting = command.isPending;
  const blocked = !command.allowed || !!command.retained || isSubmitting;

  // A generated value remains an uncommitted draft.
  const handleGenerateCode = () => {
    const randomHex = crypto.randomUUID().slice(0, 8).toUpperCase();
    const generated = `OSCAR-${randomHex}-2026`;
    setCode(generated);
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (blocked) return;
    setError(null);

    if (!selectedTaskId) {
      setError("يرجى اختيار المهمة المرتبطة بالرمز.");
      return;
    }

    if (!code.trim()) {
      setError("يرجى إدخال الرمز أو توليده تلقائياً.");
      return;
    }

    const parsed = taskCodeCreateSchema.safeParse({
      commandId: crypto.randomUUID(),
      confirmed: true,
      taskId: selectedTaskId,
      code,
      state: status === "active" ? "ENABLED" : "PAUSED",
      description: description.trim() || null,
    });
    if (!parsed.success || !selected.data) {
      setError("يرجى مراجعة الرمز واختيار مهمة متاحة.");
      return;
    }
    setCode(parsed.data.code);
    setConfirmOpen(true);
  };
  const save = async () => {
    const task = selected.data;
    if (blocked || !task) return false;
    try {
      const result = await command.execute((commandId) =>
        adminTaskCodesApi.create({
          commandId,
          confirmed: true,
          taskId: task.id,
          code: normalizeTaskCode(code),
          state: status === "active" ? "ENABLED" : "PAUSED",
          description: description.trim() || null,
        }),
      );
      if (result?.state !== "OBSERVED" || result.command.kind !== "CODE_CREATE")
        return false;
      setSuccessMessage("تم إنشاء رمز فتح المهمة بنجاح.");
      router.push(("/admin/codes/" + result.command.outcome.id) as Route);
      return true;
    } catch (failure: unknown) {
      setError(getApiError(failure).message);
      return false;
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

      <TaskCommandFeedback command={command} />
      {!options.data && (
        <TaskQueryState
          error={options.error?.message}
          retry={options.refetch}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={blocked} className="contents">
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
                <option value="">اختر المهمة</option>
                {selected.data &&
                  !tasks.some((t) => t.id === selected.data?.id) && (
                    <option value={selected.data.id}>
                      {selected.data.title}
                    </option>
                  )}
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} ({task.platform})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                يرتبط الرمز حصرياً بمهمة واحدة، ولا يمكن استخدامه لفتح مهمة
                أخرى.
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
              disabled={blocked || !selected.data}
              icon={KeyRound}
            >
              حفظ وإنشاء الرمز
            </AdminButton>
          </div>
        </fieldset>
      </form>
      {options.data && (
        <div className="flex gap-2">
          <AdminButton
            variant="outline"
            disabled={options.page <= 1}
            onClick={() => {
              options.setPage(options.page - 1);
            }}
          >
            السابق
          </AdminButton>
          <AdminButton
            variant="outline"
            disabled={!options.data.pagination.hasNextPage}
            onClick={() => {
              options.setPage(options.page + 1);
            }}
          >
            التالي
          </AdminButton>
        </div>
      )}
      <AdminConfirmDialog
        isOpen={confirmOpen}
        title="تأكيد إنشاء الرمز"
        description={
          normalizeTaskCode(code) +
          " — " +
          (selected.data?.title ?? "") +
          " — " +
          (status === "active" ? "نشط" : "متوقف")
        }
        variant="primary"
        isLoading={isSubmitting}
        confirmDisabled={blocked || !selected.data}
        error={error ?? command.error?.message ?? null}
        onConfirm={save}
        onClose={() => {
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}
