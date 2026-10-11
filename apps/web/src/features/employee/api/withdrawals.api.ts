import { z } from "zod";
import {
  withdrawalStatusSchema,
  withdrawalDestinationSchema,
  withdrawalQuoteSchema,
  withdrawalRequestSchema,
  withdrawalHistorySchema,
  withdrawalQuoteOutcomeSchema,
  withdrawalCommandResultSchema,
  withdrawalQuoteBodySchema,
  withdrawalAcceptBodySchema,
  withdrawalDestinationBodySchema,
  withdrawalResendBodySchema,
  withdrawalConsumeBodySchema,
  withdrawalFilterSchema,
  withdrawalRequestKeySchema,
  type WithdrawalFilter,
} from "@template/contracts";
import { apiClient, parseApiResponse } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";

const id = (raw: string) => financialInput(z.uuid(), raw);
const options = (signal?: AbortSignal) =>
  signal === undefined ? {} : { signal };
async function post<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  status: number,
) {
  const runtime = getSessionRuntime(),
    scope = runtime.scope();
  const response = await apiClient.post<unknown>(path, body);
  if (!runtime.isCurrentCheck(scope))
    throw safeApiError("obsolete", "OBSOLETE_SCOPE");
  return parseApiResponse(response, schema, status).data;
}
export const withdrawalsApi = {
  status: (signal?: AbortSignal) =>
    financialRead(
      () => apiClient.get<unknown>("/withdrawals/me", options(signal)),
      withdrawalStatusSchema,
    ),
  destination: (signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>("/withdrawals/me/destination", options(signal)),
      withdrawalDestinationSchema,
    ),
  detail: (withdrawalId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>(
          `/withdrawals/${id(withdrawalId)}`,
          options(signal),
        ),
      withdrawalRequestSchema.refine((row) => row.id === withdrawalId),
    ),
  outcome: (quoteId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>(
          `/withdrawals/quotes/${id(quoteId)}/outcome`,
          options(signal),
        ),
      withdrawalQuoteOutcomeSchema.refine((row) => row.quoteId === quoteId),
    ),
  history: async (query: WithdrawalFilter, signal?: AbortSignal) => {
    const params = financialInput(withdrawalFilterSchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>("/withdrawals", { params, ...options(signal) }),
      withdrawalHistorySchema.refine((page) =>
        page.items.every(
          (row) => params.state === undefined || row.state === params.state,
        ),
      ),
      params,
    );
  },
  quote: async (gross: string) =>
    post(
      "/withdrawals/quotes",
      financialInput(withdrawalQuoteBodySchema, { gross }),
      withdrawalQuoteSchema.refine((quote) => quote.gross === gross),
      201,
    ),
  issue: async (address: string) =>
    post(
      "/withdrawals/me/destination/confirmations",
      financialInput(withdrawalDestinationBodySchema, { address }),
      withdrawalDestinationSchema.refine(
        (destination) =>
          destination.state === "PENDING" && destination.address === address,
      ),
      201,
    ),
  resend: async (expectedVersion: number) =>
    post(
      "/withdrawals/me/destination/resend",
      financialInput(withdrawalResendBodySchema, { expectedVersion }),
      withdrawalDestinationSchema.refine(
        (destination) =>
          destination.state === "PENDING" &&
          destination.version === expectedVersion + 1,
      ),
      200,
    ),
  consume: async (token: string) =>
    post(
      "/withdrawals/me/destination/consume",
      financialInput(withdrawalConsumeBodySchema, { token }),
      withdrawalDestinationSchema.refine(
        (destination) => destination.state === "CONFIRMED",
      ),
      200,
    ),
  async accept(quoteId: string, requestKey: string) {
    const body = financialInput(withdrawalAcceptBodySchema, {
      quoteId,
      confirmed: true,
    });
    const key = financialInput(withdrawalRequestKeySchema, requestKey);
    const runtime = getSessionRuntime(),
      scope = runtime.scope();
    const response = await apiClient.post<unknown>("/withdrawals", body, {
      headers: { "Idempotency-Key": key },
    });
    if (!runtime.isCurrentCheck(scope))
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    try {
      return parseApiResponse(
        response,
        withdrawalCommandResultSchema.refine(
          (command) =>
            command.withdrawal.quoteId === quoteId &&
            response.status === (command.replayed ? 200 : 201),
        ),
        response.status,
      ).data;
    } catch {
      throw safeApiError("uncertain", "CONTRACT_ERROR");
    }
  },
};
