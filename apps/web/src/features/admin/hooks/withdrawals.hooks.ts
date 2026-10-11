"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminWithdrawalFilter } from "@template/contracts";
import {
  useWithdrawalRead,
  useWithdrawalList,
  refreshWithdrawalQueries,
} from "@/shared/query/financial-query";
import { safeApiError } from "@/services/api/safe-error";
import {
  adminWithdrawalsApi,
  type AdminWithdrawalRequest,
} from "../api/withdrawals.api";

const active = (row: AdminWithdrawalRequest) =>
  ["SCHEDULED", "SIGNING", "SIGNED", "SUBMITTED", "UNKNOWN"].includes(
    row.state,
  );
export function useAdminWithdrawalHistory(
  filters: Omit<AdminWithdrawalFilter, "page" | "limit"> = {},
) {
  return useWithdrawalList({
    domain: "admin-history",
    role: "ADMIN",
    filters,
    read: (_scope, selection, signal) =>
      adminWithdrawalsApi.history(selection, signal),
    pending: (page) => page.items.some(active),
  });
}
export function useAdminWithdrawalDetail(target: string | null) {
  const query = useWithdrawalRead<AdminWithdrawalRequest>({
    domain: "admin-detail",
    role: "ADMIN",
    selection: [target],
    enabled: target !== null,
    read: (_scope, signal) => {
      if (target === null) throw safeApiError("request", "NOT_FOUND", 404);
      return adminWithdrawalsApi.detail(target, signal);
    },
    pending: active,
  });
  const client = useQueryClient();
  useEffect(() => {
    if (query.allowed && query.data)
      refreshWithdrawalQueries(client, query.scope, query.data);
  }, [client, query.allowed, query.scope, query.data]);
  return query;
}
