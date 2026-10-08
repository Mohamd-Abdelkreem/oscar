import {
  depositAddressDataSchema,
  depositHistoryDataSchema,
  depositHistoryQuerySchema,
  depositProvisionRequestSchema,
  type DepositHistoryQuery,
} from "@template/contracts";
import { apiClient, parseApiResponse } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";

export const depositsApi = {
  address: (signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>("/deposits/me/address", {
          ...(signal === undefined ? {} : { signal }),
        }),
      depositAddressDataSchema,
    ),
  provision: async () => {
    const runtime = getSessionRuntime();
    const scope = runtime.scope();
    const response = await apiClient.post<unknown>(
      "/deposits/me/address",
      financialInput(depositProvisionRequestSchema, {}),
    );
    if (!runtime.isCurrentCheck(scope))
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    const assignment = parseApiResponse(
      response,
      depositAddressDataSchema,
      response.status === 200 ? 200 : 202,
    ).data;
    if ((assignment.state === "READY") !== (response.status === 200))
      throw safeApiError("contract", "CONTRACT_ERROR");
    return assignment;
  },
  history: async (query: DepositHistoryQuery, signal?: AbortSignal) => {
    const params = financialInput(depositHistoryQuerySchema, query);
    const schema = depositHistoryDataSchema.refine((page) =>
      page.items.every(
        (row) =>
          (params.kind === undefined || row.kind === params.kind) &&
          (params.from === undefined || row.recordedAt >= params.from) &&
          (params.to === undefined || row.recordedAt <= params.to),
      ),
    );
    return financialPage(
      () =>
        apiClient.get<unknown>("/deposits/me/history", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      schema,
      params,
    );
  },
};
