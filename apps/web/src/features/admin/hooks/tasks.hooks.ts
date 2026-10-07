"use client";
import type { z } from "zod";
import type { taskListQuerySchema } from "@template/contracts";
import { useTaskRead, useTaskList } from "@/shared/query/financial-query";
import { useTaskCommand } from "@/features/proofs/hooks/use-task-command";
import type { TaskOperation } from "@/features/proofs/task-command-runtime";
import { adminTasksApi } from "../api/tasks.api";

export const useAdminTasks = (
  filters: Omit<z.input<typeof taskListQuerySchema>, "page" | "limit"> = {},
) =>
  useTaskList({
    domain: "admin-tasks",
    role: "ADMIN",
    filters,
    read: (_scope, query, signal) => adminTasksApi.list(query, signal),
  });
export const useAdminTask = (id: string | null) =>
  useTaskRead({
    domain: "admin-task",
    role: "ADMIN",
    selection: [id],
    enabled: id !== null,
    read: (_scope, signal) => adminTasksApi.detail(id ?? "", signal),
  });
export const useAdminTaskCommand = (operation: TaskOperation) =>
  useTaskCommand("ADMIN", operation);
