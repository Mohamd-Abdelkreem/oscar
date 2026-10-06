"use client";
import type { z } from "zod";
import type { taskCodeListQuerySchema } from "@template/contracts";
import { useTaskRead, useTaskList } from "@/shared/query/financial-query";
import { adminTaskCodesApi } from "../api/task-codes.api";

export const useAdminTaskCodes = (
  filters: Omit<z.input<typeof taskCodeListQuerySchema>, "page" | "limit"> = {},
) =>
  useTaskList({
    domain: "admin-codes",
    role: "ADMIN",
    limit: 10,
    filters,
    read: (_scope, query, signal) => adminTaskCodesApi.list(query, signal),
  });
export const useAdminTaskCode = (id: string | null) =>
  useTaskRead({
    domain: "admin-code",
    role: "ADMIN",
    selection: [id],
    enabled: id !== null,
    read: (_scope, signal) => adminTaskCodesApi.detail(id ?? "", signal),
  });
export const useAdminCodeUsage = (id: string | null, search?: string) =>
  useTaskList({
    domain: "admin-code-usage",
    role: "ADMIN",
    resource: id,
    filters: search ? { search } : {},
    read: (_scope, query, signal) =>
      adminTaskCodesApi.usage(id ?? "", query, signal),
  });
export const useAdminCodeAudit = (id: string | null) =>
  useTaskList({
    domain: "admin-code-audit",
    role: "ADMIN",
    resource: id,
    filters: {},
    read: (_scope, query, signal) =>
      adminTaskCodesApi.audit(id ?? "", query, signal),
  });
