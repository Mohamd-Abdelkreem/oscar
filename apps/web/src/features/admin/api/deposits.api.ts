import {
  adminDepositHistoryDataSchema,
  adminDepositHistoryQuerySchema,
  type AdminDepositHistoryQuery,
  manualCreditTargetsDataSchema,
  manualCreditTargetsQuerySchema,
  manualCreditBodySchema,
  manualCreditOutcomeSchema,
  manualCreditParamsSchema,
  type ManualCreditTargetsQuery,
  type ManualCreditBody,
} from "@template/contracts";
import { apiClient, parseApiResponse } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { matchesManualCreditIntent } from "../utils/manual-credit-command-runtime";
import {
  financialInput,
  financialPage,
  financialRead,
} from "@/services/api/financial-response";

export const depositsApi = {
  targets: async (query: ManualCreditTargetsQuery, signal?: AbortSignal) => {
    const params = financialInput(manualCreditTargetsQuerySchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>("/admin/employees/manual-credit-targets", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      manualCreditTargetsDataSchema,
      params,
    );
  },
  grant: async (raw: ManualCreditBody) => {
    const body = financialInput(manualCreditBodySchema, raw);
    const runtime = getSessionRuntime();
    const scope = runtime.scope();
    const response = await apiClient.post<unknown>(
      "/admin/deposits/manual-credits",
      body,
      { headers: { "Idempotency-Key": body.actionId } },
    );
    if (!runtime.isCurrentCheck(scope))
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    if (response.status !== 200 && response.status !== 201)
      throw safeApiError("uncertain", "CONTRACT_ERROR");
    const result = parseApiResponse(
      response,
      manualCreditOutcomeSchema,
      response.status,
    ).data;
    if (
      result.replayed !== (response.status === 200) ||
      result.actor.id !== scope.accountId ||
      !matchesManualCreditIntent(body, result)
    )
      throw safeApiError("uncertain", "CONTRACT_ERROR");
    return result;
  },
  outcome: async (actionId: string, signal?: AbortSignal) => {
    financialInput(manualCreditParamsSchema, { actionId });
    const actor = getSessionRuntime().scope().accountId;
    return financialRead(
      () =>
        apiClient.get<unknown>(`/admin/deposits/manual-credits/${actionId}`, {
          ...(signal === undefined ? {} : { signal }),
        }),
      manualCreditOutcomeSchema.refine(
        (result) => result.actionId === actionId && result.actor.id === actor,
      ),
    );
  },
  history: async (query: AdminDepositHistoryQuery, signal?: AbortSignal) => {
    const params = financialInput(adminDepositHistoryQuerySchema, query);
    const schema = adminDepositHistoryDataSchema.refine((page) =>
      page.items.every(
        (row) =>
          (params.kind === undefined || row.kind === params.kind) &&
          (params.employeeId === undefined ||
            row.employee.id === params.employeeId) &&
          (params.from === undefined || row.recordedAt >= params.from) &&
          (params.to === undefined || row.recordedAt <= params.to) &&
          (params.transactionId === undefined ||
            (row.kind === "CHAIN_DEPOSIT" &&
              row.transactionId === params.transactionId)),
      ),
    );
    return financialPage(
      () =>
        apiClient.get<unknown>("/admin/deposits", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      schema,
      params,
    );
  },
};
