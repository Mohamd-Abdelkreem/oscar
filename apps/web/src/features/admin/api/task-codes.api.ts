import {
  boundedPageQuerySchema,
  taskCodeCreateSchema,
  taskCodeStatusSchema,
  taskCodeListQuerySchema,
  taskCodeUsageQuerySchema,
  taskCodeSummarySchema,
  taskCodePageSchema,
  taskCodeUsagePageSchema,
  taskCodeAuditPageSchema,
} from "@template/contracts";
import { apiClient } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";
import { taskResourceId, taskWrite } from "@/features/proofs/api/task-response";

export const adminTaskCodesApi = {
  list: async (raw: unknown, signal?: AbortSignal) => {
    const params = financialInput(taskCodeListQuerySchema, raw);
    return financialPage(
      () =>
        apiClient.get<unknown>("/admin/task-codes", {
          params,
          ...(signal ? { signal } : {}),
        }),
      taskCodePageSchema,
      params,
    );
  },
  detail: async (codeId: string, signal?: AbortSignal) => {
    const id = taskResourceId(codeId);
    return financialRead(
      () =>
        apiClient.get<unknown>(`/admin/task-codes/${id}`, {
          ...(signal ? { signal } : {}),
        }),
      taskCodeSummarySchema.refine((code) => code.id === id),
    );
  },
  create: async (raw: unknown) => {
    const body = financialInput(taskCodeCreateSchema, raw);
    return taskWrite({
      path: "/admin/task-codes",
      method: "post",
      body,
      creation: true,
      schema: taskCodeSummarySchema.refine(
        (code) =>
          code.task.id === body.taskId && code.normalizedText === body.code,
      ),
    });
  },
  status: async (codeId: string, raw: unknown) => {
    const id = taskResourceId(codeId);
    return taskWrite({
      path: `/admin/task-codes/${id}/status`,
      method: "patch",
      body: financialInput(taskCodeStatusSchema, raw),
      schema: taskCodeSummarySchema.refine((code) => code.id === id),
    });
  },
  usage: async (codeId: string, raw: unknown, signal?: AbortSignal) => {
    const id = taskResourceId(codeId);
    const params = financialInput(taskCodeUsageQuerySchema, raw);
    return financialPage(
      () =>
        apiClient.get<unknown>(`/admin/task-codes/${id}/usages`, {
          params,
          ...(signal ? { signal } : {}),
        }),
      taskCodeUsagePageSchema,
      params,
    );
  },
  audit: async (codeId: string, raw: unknown, signal?: AbortSignal) => {
    const id = taskResourceId(codeId);
    const params = financialInput(boundedPageQuerySchema, raw);
    return financialPage(
      () =>
        apiClient.get<unknown>(`/admin/task-codes/${id}/changes`, {
          params,
          ...(signal ? { signal } : {}),
        }),
      taskCodeAuditPageSchema,
      params,
    );
  },
};
