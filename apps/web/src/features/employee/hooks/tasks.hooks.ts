"use client";
import { useApprovedTaskReconciliation } from "@/features/proofs/hooks/use-approved-task-reconciliation";
import { useTaskRead, useTaskList } from "@/shared/query/financial-query";
import { employeeTasksApi } from "../api/tasks.api";
import { useTaskCommand } from "@/features/proofs/hooks/use-task-command";
import type { TaskOperation } from "@/features/proofs/task-command-runtime";
import type { z } from "zod";
import type { submissionListQuerySchema } from "@template/contracts";

export const useTaskToday = () => {
  const query = useTaskRead<Awaited<ReturnType<typeof employeeTasksApi.today>>>(
    {
      domain: "today",
      pending: (day) => day.submission?.status === "PENDING",
      role: "USER",
      selection: [],
      read: (_scope, signal) => employeeTasksApi.today(signal),
    },
  );
  useApprovedTaskReconciliation(
    query.scope,
    query.data?.submission ?? undefined,
  );
  return query;
};
export const useTaskHistory = (
  filters: Omit<
    z.input<typeof submissionListQuerySchema>,
    "page" | "limit"
  > = {},
) =>
  useTaskList({
    domain: "history",
    role: "USER",
    filters,
    read: (_scope, query, signal) => employeeTasksApi.history(query, signal),
  });
export const useOwnSubmission = (id: string | null) => {
  const query = useTaskRead<
    Awaited<ReturnType<typeof employeeTasksApi.detail>>
  >({
    domain: "submission",
    pending: (submission) => submission.status === "PENDING",
    role: "USER",
    selection: [id],
    enabled: id !== null,
    read: (_scope, signal) => employeeTasksApi.detail(id ?? "", signal),
  });
  useApprovedTaskReconciliation(query.scope, query.data);
  return query;
};
export const useOwnEvidence = (id: string | null) =>
  useTaskList({
    domain: "evidence",
    role: "USER",
    filters: {},
    resource: id,
    read: (_scope, query, signal) =>
      employeeTasksApi.evidence(id ?? "", query, signal),
  });
export const useEmployeeTaskCommand = (operation: TaskOperation) =>
  useTaskCommand("USER", operation);
