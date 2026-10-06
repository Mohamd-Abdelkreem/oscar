"use client";
import type { z } from "zod";
import type { adminSubmissionListQuerySchema } from "@template/contracts";
import { useTaskRead, useTaskList } from "@/shared/query/financial-query";
import { adminTaskSubmissionsApi } from "../api/task-submissions.api";

export const useAdminTaskSubmissions = (
  filters: Omit<
    z.input<typeof adminSubmissionListQuerySchema>,
    "page" | "limit"
  > = {},
) =>
  useTaskList({
    domain: "admin-submissions",
    role: "ADMIN",
    filters,
    read: (_scope, query, signal) =>
      adminTaskSubmissionsApi.list(query, signal),
  });
export const useAdminTaskSubmission = (id: string | null) =>
  useTaskRead<Awaited<ReturnType<typeof adminTaskSubmissionsApi.detail>>>({
    domain: "admin-submission",
    pending: (detail) => detail.submission.status === "PENDING",
    role: "ADMIN",
    selection: [id],
    enabled: id !== null,
    read: (_scope, signal) => adminTaskSubmissionsApi.detail(id ?? "", signal),
  });
export const useAdminSubmissionEvidence = (
  id: string | null,
  evidenceVersion: number | null,
) =>
  useTaskList({
    domain: "admin-evidence",
    role: "ADMIN",
    resource: id,
    filters: { evidenceVersion },
    read: (_scope, query, signal) =>
      adminTaskSubmissionsApi.evidence(
        id ?? "",
        { page: query.page, limit: query.limit },
        signal,
      ),
  });
