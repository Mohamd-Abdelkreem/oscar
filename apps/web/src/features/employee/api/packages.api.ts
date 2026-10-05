import {
  catalogSchema,
  membershipSchema,
  boundedPageQuerySchema,
  subscriptionHistorySchema,
  purchaseHistorySchema,
  purchaseResultSchema,
  purchaseQuoteBodySchema,
  purchaseQuoteSchema,
  confirmedPurchaseBodySchema,
  purchaseCommandResultSchema,
  quoteOutcomeSchema,
  type PackageCode,
  type ConfirmedPurchaseBody,
} from "@template/contracts";
import { z } from "zod";
import { apiClient, parseApiResponse } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";

const id = (raw: string) => financialInput(z.uuid(), raw);
export const packagesApi = {
  catalog: (signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>("/packages", {
          ...(signal === undefined ? {} : { signal }),
        }),
      catalogSchema,
    ),
  membership: (employeeId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>("/subscriptions/me", {
          ...(signal === undefined ? {} : { signal }),
        }),
      membershipSchema.refine(
        (membership) => membership.employeeId === employeeId,
      ),
    ),
  subscriptionHistory: async (
    query: { page: number; limit: number },
    signal?: AbortSignal,
  ) => {
    const params = financialInput(boundedPageQuerySchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>("/subscriptions/me/history", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      subscriptionHistorySchema,
      params,
    );
  },
  history: async (
    query: { page: number; limit: number },
    signal?: AbortSignal,
  ) => {
    const params = financialInput(boundedPageQuerySchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>("/subscriptions/purchases", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      purchaseHistorySchema,
      params,
    );
  },
  detail: async (purchaseId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>(`/subscriptions/purchases/${id(purchaseId)}`, {
          ...(signal === undefined ? {} : { signal }),
        }),
      purchaseResultSchema.refine(
        (purchase) => purchase.purchaseId === purchaseId,
      ),
    ),
  async quote(packageCode: PackageCode) {
    const body = financialInput(purchaseQuoteBodySchema, { packageCode });
    const response = await apiClient.post<unknown>(
      "/subscriptions/purchase-quotes",
      body,
    );
    return parseApiResponse(
      response,
      purchaseQuoteSchema.refine((quote) => quote.packageCode === packageCode),
      201,
    ).data;
  },
  async purchase(body: ConfirmedPurchaseBody) {
    const intent = financialInput(confirmedPurchaseBodySchema, body);
    const response = await apiClient.post<unknown>(
      "/subscriptions/purchases",
      intent,
      { headers: { "Idempotency-Key": intent.quoteId } },
    );
    try {
      const command = parseApiResponse(
        response,
        purchaseCommandResultSchema.refine(
          (command) =>
            command.purchase.quoteId === intent.quoteId &&
            response.status === (command.replayed ? 200 : 201),
        ),
        response.status,
      ).data;
      return command;
    } catch {
      throw safeApiError("uncertain", "CONTRACT_ERROR");
    }
  },
  outcome: (quoteId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>(
          `/subscriptions/purchase-quotes/${id(quoteId)}/outcome`,
          { ...(signal === undefined ? {} : { signal }) },
        ),
      quoteOutcomeSchema.refine((outcome) => outcome.quoteId === quoteId),
    ),
};
