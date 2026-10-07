"use client";

import {
  taskCreateSchema,
  taskEditSchema,
  taskPublicationStateSchema,
  type AdminTaskDetail,
} from "@template/contracts";
import { useAdminTask, useAdminTaskCommand } from "../../hooks/tasks.hooks";
import {
  useTaskEditorDraft,
  type TaskEditorDraft,
} from "../../hooks/use-task-editor-draft";
import { adminTasksApi } from "../../api/tasks.api";
import { taskIllustrationsApi } from "@/features/proofs/api/task-illustrations.api";
import { usePrivateProof } from "@/features/proofs/hooks/use-private-proof";
import { getApiError } from "@/services/api/safe-error";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { TaskCommandFeedback } from "../common/task-command-feedback";
import { TaskQueryState } from "../common/task-query-state";

import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminImageUpload } from "../common/admin-image-upload";
import { AdminPageHeader } from "../common/admin-page-header";

interface TaskFormScreenProps {
  readonly initialTask?: AdminTaskDetail | undefined;
  readonly taskId?: string | undefined;
  readonly isEdit?: boolean;
}

export function TaskFormScreen({
  taskId,
  isEdit = false,
}: TaskFormScreenProps) {
  const query = useAdminTask(isEdit ? (taskId ?? null) : null);
  const identity = JSON.stringify([
    query.scope.epoch,
    query.scope.accountId,
    query.scope.role,
    taskId,
  ]);
  const [retained, setRetained] = useState({
    identity,
    task: query.acceptedData,
  });
  if (
    query.acceptedData &&
    (retained.identity !== identity || retained.task !== query.acceptedData)
  )
    setRetained({ identity, task: query.acceptedData });
  const denied =
    query.error?.statusCode === 401 || query.error?.statusCode === 403;
  const currentTask =
    query.acceptedData ??
    (retained.identity === identity && !denied ? retained.task : undefined);
  if (isEdit && !currentTask)
    return (
      <TaskQueryState error={query.error?.message} retry={query.refetch} />
    );
  return (
    <TaskForm
      key={String(query.scope.epoch) + ":" + (taskId ?? "new")}
      initialTask={currentTask}
      currentReadReady={
        !isEdit || (query.allowed && query.isSuccess && !query.isFetching)
      }
      readError={query.error?.message}
      taskId={taskId}
      isEdit={isEdit}
      refresh={query.refetch}
    />
  );
}
function TaskForm({
  initialTask,
  taskId,
  isEdit = false,
  refresh,
  currentReadReady,
  readError,
}: TaskFormScreenProps & {
  readonly refresh: () => Promise<unknown>;
  readonly currentReadReady: boolean;
  readonly readError: string | undefined;
}) {
  const router = useRouter();
  const command = useAdminTaskCommand({
    kind: isEdit ? "TASK_EDIT" : "TASK_CREATE",
    targetId: isEdit ? (taskId ?? null) : null,
  });
  const upload = useAdminTaskCommand({
    kind: "UPLOAD",
    purpose: "TASK_ILLUSTRATION",
    targetId: taskId ?? null,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [readyFile, setReadyFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewedFacts, setReviewedFacts] = useState<{
    revision: number | null;
    dateEditable: boolean | null;
    intent: TaskEditorDraft;
  } | null>(null);
  const isSubmitting = command.isPending || upload.isPending;
  const { base, draft, updateDraft, replaceWithCurrent, remoteChanged } =
    useTaskEditorDraft(initialTask, {
      selectedImage: imageFile !== null,
      preserveDraft:
        confirmOpen || !!command.retained || !!upload.retained || isSubmitting,
    });
  const savedPreview = usePrivateProof({
    purpose: "TASK_ILLUSTRATION",
    assetId: base?.illustration?.id ?? null,
    evidenceIdentity: base?.id ?? "",
    role: "ADMIN",
    open: true,
  });
  const blocked =
    !currentReadReady ||
    !command.allowed ||
    !upload.allowed ||
    !!command.retained ||
    !!upload.retained ||
    isSubmitting;
  const {
    title,
    description,
    targetUrl,
    platform,
    publicationState: status,
    isCodeRequired,
    publicationDate: startDate,
    illustrationAssetId,
  } = draft;
  const windowStart = "12:00",
    windowEnd = "18:00",
    timezone = "Asia/Baghdad";
  const endDate = startDate;
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const body = () => ({
    title: title.trim(),
    description: description.trim(),
    targetUrl: targetUrl.trim(),
    platform: platform.trim(),
    publicationDate: startDate,
    publicationState: status,
    isCodeRequired,
    illustrationAssetId,
  });
  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (blocked) return;
    if (remoteChanged) {
      setError(
        "تغيرت بيانات المهمة؛ راجع النسخة الحالية وأكد التعديل من جديد.",
      );
      return;
    }
    setError(null);
    const parsed = taskCreateSchema.safeParse({
      commandId: crypto.randomUUID(),
      confirmed: true,
      ...body(),
    });
    if (!parsed.success) {
      setError(
        "يرجى مراجعة الحقول والرابط وتاريخ نشر واحد من الاثنين إلى الجمعة.",
      );
      return;
    }
    setReviewedFacts({
      revision: base?.revision ?? null,
      dateEditable: base?.dateEditable ?? null,
      intent: body(),
    });
    setConfirmOpen(true);
  };
  const save = async () => {
    if (blocked) return false;
    if (!reviewedFacts) return false;
    if (
      isEdit &&
      (!initialTask ||
        remoteChanged ||
        initialTask.revision !== reviewedFacts.revision ||
        initialTask.dateEditable !== reviewedFacts.dateEditable)
    ) {
      setError(
        "تغيرت بيانات المهمة؛ راجع النسخة الحالية وأكد التعديل من جديد.",
      );
      setConfirmOpen(false);
      return false;
    }
    try {
      let assetId = reviewedFacts.intent.illustrationAssetId;
      if (imageFile && readyFile !== imageFile) {
        const ready = await upload.execute((commandId) =>
          taskIllustrationsApi.upload(commandId, imageFile),
        );
        if (ready?.state !== "READY" || ready.purpose !== "TASK_ILLUSTRATION")
          return false;
        assetId = ready.asset.id;
        updateDraft({ illustrationAssetId: assetId });
        setReadyFile(imageFile);
      }
      const intent = {
        ...reviewedFacts.intent,
        illustrationAssetId: assetId,
        confirmed: true,
      };
      const observed = await command.execute((commandId) =>
        isEdit && initialTask
          ? adminTasksApi.edit(
              initialTask.id,
              taskEditSchema.parse({
                ...intent,
                commandId,
                expectedTaskRevision: reviewedFacts.revision,
              }),
            )
          : adminTasksApi.create(
              taskCreateSchema.parse({ ...intent, commandId }),
            ),
      );
      if (
        observed?.state !== "OBSERVED" ||
        (observed.command.kind !== "TASK_CREATE" &&
          observed.command.kind !== "TASK_EDIT")
      )
        return false;
      setSuccessMessage(
        isEdit
          ? "تم حفظ تعديلات المهمة بنجاح."
          : "تم إنشاء المهمة اليومية بنجاح.",
      );
      router.push(("/admin/tasks/" + observed.command.outcome.id) as Route);
      return true;
    } catch (failure: unknown) {
      setError(getApiError(failure).message);
      setConfirmOpen(false);
      await refresh();
      return false;
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

      {readError && <TaskQueryState error={readError} retry={refresh} />}
      {remoteChanged && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800"
        >
          <p>
            تغيرت النسخة الحالية؛ مسودتك محفوظة. تحميل النسخة الحالية يستبدل
            المسودة لتراجعها قبل التأكيد.
          </p>
          <AdminButton
            variant="outline"
            size="sm"
            disabled={blocked || confirmOpen}
            onClick={() => {
              replaceWithCurrent();
              setImageFile(null);
              setReadyFile(null);
              setReviewedFacts(null);
              setError(null);
            }}
          >
            تحميل النسخة الحالية
          </AdminButton>
        </div>
      )}
      <TaskCommandFeedback command={command} />
      <TaskCommandFeedback command={upload} />
      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={blocked} className="contents">
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
                    updateDraft({ title: e.target.value });
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
                    updateDraft({ description: e.target.value });
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
                      updateDraft({ platform: e.target.value });
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
                    الرابط الخارجي (URL){" "}
                    <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="task-url"
                    type="url"
                    dir="ltr"
                    value={targetUrl}
                    onChange={(e) => {
                      updateDraft({ targetUrl: e.target.value });
                    }}
                    placeholder="https://..."
                    className="w-full rounded-md border border-slate-300 p-2.5 font-mono text-xs text-slate-900 sm:text-sm"
                    required
                  />
                </div>
              </div>

              <AdminImageUpload
                key={
                  String(base?.revision ?? "new") +
                  ":" +
                  String(base?.dateEditable)
                }
                initialImageUrl={savedPreview.url ?? undefined}
                disabled={blocked}
                label="صورة المعاينة التوضيحية للمهمة"
                onImageSelected={(file) => {
                  setImageFile(file);
                  setReadyFile(null);
                  if (!file) updateDraft({ illustrationAssetId: null });
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
                  نافذة التنفيذ اليومية الثابتة (12:00 - 18:00)
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
                      readOnly
                      disabled
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
                      readOnly
                      disabled
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
                  <label
                    htmlFor="publication-date"
                    className="mb-1 block font-bold text-slate-600"
                  >
                    تاريخ النشر:
                  </label>
                  <input
                    type="date"
                    id="publication-date"
                    value={startDate}
                    disabled={blocked || (isEdit && !initialTask?.dateEditable)}
                    onChange={(e) => {
                      updateDraft({ publicationDate: e.target.value });
                    }}
                    className="w-full rounded border border-slate-300 p-1.5 font-mono text-xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="publication-date-end"
                    className="mb-1 block font-bold text-slate-600"
                  >
                    نفس تاريخ النشر:
                  </label>
                  <input
                    type="date"
                    id="publication-date-end"
                    value={endDate}
                    readOnly
                    disabled
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
                    updateDraft({
                      publicationState: taskPublicationStateSchema.parse(
                        e.target.value,
                      ),
                    });
                  }}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
                >
                  <option value="PUBLISHED">منشورة (تتاح أثناء النافذة)</option>
                  <option value="PAUSED">متوقفة مؤقتاً</option>
                  <option value="CLOSED">مغلقة</option>
                </select>
              </div>

              {/* Code Requirement Toggle */}
              <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isCodeRequired}
                    onChange={(e) => {
                      updateDraft({ isCodeRequired: e.target.checked });
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <div>
                    <span className="block text-xs font-bold text-emerald-950">
                      رمز فتح المهمة إلزامي
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-emerald-800">
                      عند التفعيل، لا يمكن للموظف الوصول لتفاصيل المهمة ورفع
                      لقطة الشاشة دون إدخال رمز فتح نشط مخصص لهذه المهمة.
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
        </fieldset>
      </form>
      <AdminConfirmDialog
        isOpen={confirmOpen}
        title={isEdit ? "تأكيد تعديل المهمة" : "تأكيد نشر المهمة"}
        description={
          title + " — " + startDate + " — 12:00 - 18:00 Asia/Baghdad"
        }
        variant="primary"
        isLoading={isSubmitting}
        confirmDisabled={blocked}
        error={error}
        onConfirm={save}
        onClose={() => {
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}
