"use client";
import type { LedgerFilter } from "@template/contracts";
import { safeApiError } from "@/services/api/safe-error";
import {
  useFinancialRead,
  useFinancialList,
} from "@/shared/query/financial-query";
import { walletApi } from "../api/wallet.api";

export const useWallet = () =>
  useFinancialRead({
    domain: "wallet",
    role: "USER",
    selection: [],
    read: (scope, signal) => {
      if (scope.accountId === null)
        throw safeApiError("denied", "FORBIDDEN", 403);
      return walletApi.wallet(scope.accountId, signal);
    },
  });
export const useWalletLedger = (
  filters: Omit<LedgerFilter, "page" | "limit"> = {},
) =>
  useFinancialList({
    domain: "ledger",
    role: "USER",
    filters,
    read: (_scope, query, signal) => walletApi.ledger(query, signal),
  });
export const useWalletDetail = (operationId: string | null) =>
  useFinancialRead({
    domain: "ledger-detail",
    role: "USER",
    selection: [operationId],
    enabled: operationId !== null,
    read: (_scope, signal) => {
      if (operationId === null) throw safeApiError("request", "NOT_FOUND", 404);
      return walletApi.detail(operationId, signal);
    },
  });
