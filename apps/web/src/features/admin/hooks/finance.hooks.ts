"use client";
import type { AdminLedgerFilter } from "@template/contracts";
import { safeApiError } from "@/services/api/safe-error";
import {
  useFinancialRead,
  useFinancialList,
} from "@/shared/query/financial-query";
import { financeApi } from "../api/finance.api";

export const useFinanceLedger = (
  filters: Omit<AdminLedgerFilter, "page" | "limit"> = {},
) =>
  useFinancialList({
    domain: "finance",
    role: "ADMIN",
    filters,
    read: (_scope, query, signal) => financeApi.ledger(query, signal),
  });
export const useFinanceDetail = (operationId: string | null) =>
  useFinancialRead({
    domain: "finance-detail",
    role: "ADMIN",
    selection: [operationId],
    enabled: operationId !== null,
    read: (_scope, signal) => {
      if (operationId === null) throw safeApiError("request", "NOT_FOUND", 404);
      return financeApi.detail(operationId, signal);
    },
  });
