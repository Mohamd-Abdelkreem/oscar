import type { AxiosResponse } from "axios";
import type { z } from "zod";
import { paginatedFinancialEnvelopeSchema } from "@template/contracts";
import { parseApiResponse } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";

export function financialInput<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw safeApiError("request", "VALIDATION_ERROR", 400);
  return parsed.data;
}

export async function financialRead<T>(
  dispatch: () => Promise<AxiosResponse<unknown>>,
  schema: z.ZodType<T>,
): Promise<T> {
  const runtime = getSessionRuntime();
  const scope = runtime.scope();
  const response = await dispatch();
  if (!runtime.isCurrentCheck(scope))
    throw safeApiError("obsolete", "OBSOLETE_SCOPE");
  return parseApiResponse(response, schema, 200).data;
}

export async function financialPage<
  T extends { pagination: { page: number; limit: number } },
>(
  dispatch: () => Promise<AxiosResponse<unknown>>,
  schema: z.ZodType<T>,
  query: { page: number; limit: number },
): Promise<T> {
  const pageSchema = schema.refine(
    (page) =>
      page.pagination.page === query.page &&
      page.pagination.limit === query.limit,
  );
  return financialRead(async () => {
    const response = await dispatch();
    if (
      !paginatedFinancialEnvelopeSchema(pageSchema).safeParse(response.data)
        .success
    )
      throw safeApiError("contract", "CONTRACT_ERROR");
    return response;
  }, pageSchema);
}
