"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import type {
  EmployeeTaskDay,
  SubmissionDetail,
  ProofAsset,
} from "@template/contracts";
import { useEmployeeTaskCommand } from "./tasks.hooks";
import { employeeTasksApi } from "../api/tasks.api";
import { proofsApi } from "@/features/proofs/api/proofs.api";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { getApiError, safeApiError } from "@/services/api/safe-error";

export function useTaskSubmission(
  day: EmployeeTaskDay | null,
  submission: SubmissionDetail | null,
) {
  const taskId = submission?.taskId ?? day?.task?.id ?? null;
  const upload = useEmployeeTaskCommand({
    kind: "UPLOAD",
    purpose: "PROOF",
    targetId: taskId,
  });
  const command = useEmployeeTaskCommand(
    submission
      ? { kind: "EVIDENCE_REPLACE", targetId: submission.id }
      : { kind: "SUBMISSION_CREATE", targetId: taskId },
  );
  const [screenshotFile, selectFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [ready, setReady] = useState<{ file: File; asset: ProofAsset } | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const latest = useRef({ day, submission });
  useLayoutEffect(() => {
    latest.current = { day, submission };
  }, [day, submission]);
  useEffect(
    () =>
      getSessionRuntime().onRetire(() => {
        selectFile(null);
        setReady(null);
        setAcknowledged(false);
        setFeedback(null);
      }),
    [],
  );
  const setScreenshotFile = (file: File | null) => {
    if (
      upload.isPending ||
      command.isPending ||
      upload.retained ||
      command.retained
    )
      return;
    selectFile(file);
    setReady(null);
    setFeedback(null);
  };
  const save = async () => {
    const scope = command.scope;
    try {
      const accepted = latest.current.submission;
      const today = latest.current.day;
      if (
        !command.allowed ||
        !upload.allowed ||
        upload.retained ||
        command.retained ||
        upload.isPending ||
        command.isPending
      )
        throw safeApiError("coordination", "COMMAND_UNRESOLVED");
      if (accepted ? !accepted.canReplace : !today?.canSubmit || !acknowledged)
        throw safeApiError("request", "TASK_UNAVAILABLE", 409);
      if (!screenshotFile)
        throw safeApiError("request", "VALIDATION_ERROR", 400);
      let asset = ready?.file === screenshotFile ? ready.asset : null;
      if (!asset) {
        const result = await upload.execute((commandId) =>
          proofsApi.upload(commandId, screenshotFile),
        );
        if (result?.state !== "READY" || result.purpose !== "PROOF")
          throw safeApiError("uncertain", "UPLOAD_UNRESOLVED");
        asset = result.asset;
        if (!getSessionRuntime().isCurrentCheck(scope))
          throw safeApiError("obsolete", "OBSOLETE_SCOPE");
        setReady({ file: screenshotFile, asset });
      }
      const current = latest.current;
      if (accepted) {
        if (
          current.submission?.id !== accepted.id ||
          !current.submission.canReplace ||
          current.submission.version !== accepted.version
        )
          throw safeApiError("request", "EVIDENCE_CONFLICT", 409);
      } else if (
        !current.day?.canSubmit ||
        current.day.task?.id !== today?.task?.id ||
        current.day.task?.revision !== today?.task?.revision
      ) {
        setAcknowledged(false);
        throw safeApiError("request", "TASK_REVISION_CONFLICT", 409);
      }
      const proofAssetId = asset.id;
      const outcome = await command.execute((commandId) =>
        accepted
          ? employeeTasksApi.replace(accepted.id, {
              commandId,
              expectedSubmissionVersion: accepted.version,
              proofAssetId,
            })
          : employeeTasksApi.submit({
              commandId,
              taskId,
              expectedTaskRevision: today?.task?.revision,
              proofAssetId,
              declaredExecuted: true,
            }),
      );
      if (outcome?.state !== "OBSERVED")
        throw safeApiError("uncertain", "COMMAND_UNRESOLVED");
      setFeedback({
        success: true,
        message: accepted
          ? "تم حفظ الصورة الجديدة."
          : "تم إرسال المهمة للمراجعة. لا تُصرف المكافأة قبل الاعتماد النهائي.",
      });
    } catch (failure: unknown) {
      if (getSessionRuntime().isCurrentCheck(scope))
        setFeedback({ success: false, message: getApiError(failure).message });
    }
  };
  const resolve = async (action: "observe" | "cancel") => {
    const guard = upload.retained ? upload : command;
    try {
      const outcome = await guard[action]();
      setFeedback({
        success: outcome?.state === "OBSERVED",
        message:
          outcome?.state === "OBSERVED" || outcome?.state === "READY"
            ? "تم تأكيد النتيجة المحفوظة. راجع البيانات الحالية."
            : outcome?.state === "CANCELLED" || outcome?.state === "FAILED"
              ? "تم إغلاق الطلب السابق. تحقق من الأهلية قبل محاولة جديدة."
              : "نتيجة الطلب غير مؤكدة. لا تكرره.",
      });
    } catch (failure: unknown) {
      if (getSessionRuntime().isCurrentCheck(guard.scope))
        setFeedback({ success: false, message: getApiError(failure).message });
    }
  };
  return {
    screenshotFile,
    setScreenshotFile,
    acknowledged,
    setAcknowledged,
    feedback,
    isSubmitting: upload.isPending || command.isPending,
    unresolved: upload.retained !== null || command.retained !== null,
    allowed: upload.allowed && command.allowed,
    handleSubmit: (event: Pick<SyntheticEvent, "preventDefault">) => {
      event.preventDefault();
      return save();
    },
    handleReplaceScreenshot: save,
    observe: () => resolve("observe"),
    cancel: () => resolve("cancel"),
  };
}
