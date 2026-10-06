import {
  taskCreateSchema,
  taskEditSchema,
  taskStatusSchema,
  taskListQuerySchema,
  adminTaskDetailSchema,
  adminTaskPageSchema,
} from "@template/contracts";
import { apiClient } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";
import { taskResourceId, taskWrite } from "@/features/proofs/api/task-response";

export const adminTasksApi = {
  list: async (raw: unknown, signal?: AbortSignal) => {
    const params = financialInput(taskListQuerySchema, raw);
    return financialPage(
      () =>
        apiClient.get<unknown>("/admin/tasks", {
          params,
          ...(signal ? { signal } : {}),
        }),
      adminTaskPageSchema,
      params,
    );
  },
  detail: async (taskId: string, signal?: AbortSignal) => {
    const id = taskResourceId(taskId);
    return financialRead(
      () =>
        apiClient.get<unknown>(`/admin/tasks/${id}`, {
          ...(signal ? { signal } : {}),
        }),
      adminTaskDetailSchema.refine((task) => task.id === id),
    );
  },
  create: async (raw: unknown) =>
    taskWrite({
      path: "/admin/tasks",
      method: "post",
      body: financialInput(taskCreateSchema, raw),
      schema: adminTaskDetailSchema,
      creation: true,
    }),
  edit: async (taskId: string, raw: unknown) => {
    const id = taskResourceId(taskId);
    return taskWrite({
      path: `/admin/tasks/${id}`,
      method: "patch",
      body: financialInput(taskEditSchema, raw),
      schema: adminTaskDetailSchema.refine((task) => task.id === id),
    });
  },
  status: async (taskId: string, raw: unknown) => {
    const id = taskResourceId(taskId);
    return taskWrite({
      path: `/admin/tasks/${id}/status`,
      method: "patch",
      body: financialInput(taskStatusSchema, raw),
      schema: adminTaskDetailSchema.refine((task) => task.id === id),
    });
  },
};
