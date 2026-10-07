import {
  employeeTaskDaySchema,
  taskUnlockRequestSchema,
  unlockOutcomeSchema,
  submissionCreateSchema,
  evidenceReplaceSchema,
  submissionDetailSchema,
  submissionListQuerySchema,
  submissionPageSchema,
  evidencePageSchema,
  boundedPageQuerySchema,
} from "@template/contracts";
import { apiClient } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";
import { taskResourceId, taskWrite } from "@/features/proofs/api/task-response";

export const employeeTasksApi = {
  today: async (signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>("/tasks/today", {
          ...(signal ? { signal } : {}),
        }),
      employeeTaskDaySchema,
    ),
  unlock: async (taskId: string, raw: unknown) => {
    const id = taskResourceId(taskId);
    return taskWrite({
      path: `/tasks/${id}/unlock`,
      method: "post",
      body: financialInput(taskUnlockRequestSchema, raw),
      schema: unlockOutcomeSchema.refine(
        (outcome) => outcome.day.task?.id === id,
      ),
    });
  },
  submit: async (raw: unknown) => {
    const body = financialInput(submissionCreateSchema, raw);
    return taskWrite({
      path: "/task-submissions",
      method: "post",
      body,
      creation: true,
      schema: submissionDetailSchema.refine(
        (submission) =>
          submission.taskId === body.taskId &&
          submission.evidence.assetId === body.proofAssetId,
      ),
    });
  },
  replace: async (submissionId: string, raw: unknown) => {
    const id = taskResourceId(submissionId);
    const body = financialInput(evidenceReplaceSchema, raw);
    return taskWrite({
      path: `/task-submissions/${id}/evidence`,
      method: "patch",
      body,
      schema: submissionDetailSchema.refine(
        (submission) =>
          submission.id === id &&
          submission.evidence.assetId === body.proofAssetId,
      ),
    });
  },
  history: async (raw: unknown, signal?: AbortSignal) => {
    const params = financialInput(submissionListQuerySchema, raw);
    return financialPage(
      () =>
        apiClient.get<unknown>("/task-submissions", {
          params,
          ...(signal ? { signal } : {}),
        }),
      submissionPageSchema,
      params,
    );
  },
  detail: async (submissionId: string, signal?: AbortSignal) => {
    const id = taskResourceId(submissionId);
    return financialRead(
      () =>
        apiClient.get<unknown>(`/task-submissions/${id}`, {
          ...(signal ? { signal } : {}),
        }),
      submissionDetailSchema.refine((submission) => submission.id === id),
    );
  },
  evidence: async (
    submissionId: string,
    raw: unknown,
    signal?: AbortSignal,
  ) => {
    const id = taskResourceId(submissionId);
    const params = financialInput(boundedPageQuerySchema, raw);
    return financialPage(
      () =>
        apiClient.get<unknown>(`/task-submissions/${id}/evidence`, {
          params,
          ...(signal ? { signal } : {}),
        }),
      evidencePageSchema,
      params,
    );
  },
};
