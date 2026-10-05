import {
  walletViewSchema,
  ledgerFilterSchema,
  ledgerPageSchema,
  employeeLedgerDetailSchema,
  type LedgerFilter,
} from "@template/contracts";
import { z } from "zod";
import { apiClient } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";

export const walletApi = {
  wallet: (employeeId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>("/wallet/me", {
          ...(signal === undefined ? {} : { signal }),
        }),
      walletViewSchema.refine((wallet) => wallet.employeeId === employeeId),
    ),
  ledger: async (query: LedgerFilter, signal?: AbortSignal) => {
    const params = financialInput(ledgerFilterSchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>("/wallet/me/ledger", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      ledgerPageSchema,
      params,
    );
  },
  detail: async (operationId: string, signal?: AbortSignal) => {
    const operation = financialInput(z.uuid(), operationId);
    return financialRead(
      () =>
        apiClient.get<unknown>(`/wallet/me/ledger/${operation}`, {
          ...(signal === undefined ? {} : { signal }),
        }),
      employeeLedgerDetailSchema.refine(
        (detail) => detail.operationId === operation,
      ),
    );
  },
};
