import {
  adminSubmissionListQuerySchema,
  adminSubmissionPageSchema,
  adminSubmissionDetailSchema,
  evidencePageSchema,
  boundedPageQuerySchema,
  submissionReviewSchema,
} from "@template/contracts";
import { apiClient } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";
import { taskResourceId, taskWrite } from "@/features/proofs/api/task-response";

export const adminTaskSubmissionsApi = {
  list: async (raw: unknown, signal?: AbortSignal) => {
    const params = financialInput(adminSubmissionListQuerySchema, raw);
    return financialPage(
      () =>
        apiClient.get<unknown>("/admin/task-submissions", {
          params,
          ...(signal ? { signal } : {}),
        }),
      adminSubmissionPageSchema,
      params,
    );
  },
  detail: async (submissionId: string, signal?: AbortSignal) => {
    const id = taskResourceId(submissionId);
    return financialRead(
      () =>
        apiClient.get<unknown>(`/admin/task-submissions/${id}`, {
          ...(signal ? { signal } : {}),
        }),
      adminSubmissionDetailSchema.refine(
        (detail) => detail.submission.id === id,
      ),
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
        apiClient.get<unknown>(`/admin/task-submissions/${id}/evidence`, {
          params,
          ...(signal ? { signal } : {}),
        }),
      evidencePageSchema,
      params,
    );
  },
  review: async (submissionId: string, raw: unknown) => {
    const id = taskResourceId(submissionId);
    const body = financialInput(submissionReviewSchema, raw);
    return taskWrite({
      path: `/admin/task-submissions/${id}/review`,
      method: "post",
      body,
      schema: adminSubmissionDetailSchema.refine(
        (detail) =>
          detail.submission.id === id &&
          detail.submission.finalDecision?.decision === body.decision,
      ),
    });
  },
};
