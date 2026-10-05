import {
  adminFinancePageSchema,
  adminLedgerFilterSchema,
  adminLedgerDetailSchema,
  adminWalletViewSchema,
  type AdminLedgerFilter,
} from "@template/contracts";
import { z } from "zod";
import { apiClient } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";

export const financeApi = {
  ledger: async (query: AdminLedgerFilter, signal?: AbortSignal) => {
    const params = financialInput(adminLedgerFilterSchema, query);
    const schema = adminFinancePageSchema.refine((page) =>
      params.employeeId === undefined
        ? page.walletTotalsScope.kind === "ALL_EMPLOYEES"
        : page.walletTotalsScope.kind === "EMPLOYEE" &&
          page.walletTotalsScope.employeeId === params.employeeId &&
          page.items.every((row) => row.employee.id === params.employeeId),
    );
    return financialPage(
      () =>
        apiClient.get<unknown>("/admin/finance", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      schema,
      params,
    );
  },
  detail: async (operationId: string, signal?: AbortSignal) => {
    const operation = financialInput(z.uuid(), operationId);
    return financialRead(
      () =>
        apiClient.get<unknown>(`/admin/finance/${operation}`, {
          ...(signal === undefined ? {} : { signal }),
        }),
      adminLedgerDetailSchema.refine(
        (detail) => detail.operationId === operation,
      ),
    );
  },
  wallet: (employeeId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>(
          `/admin/wallets/${financialInput(z.uuid(), employeeId)}`,
          { ...(signal === undefined ? {} : { signal }) },
        ),
      adminWalletViewSchema.refine(
        (wallet) => wallet.employeeId === employeeId,
      ),
    ),
};
