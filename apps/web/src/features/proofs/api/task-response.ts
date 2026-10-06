import { z } from "zod";
import { apiClient, parseApiResponse } from "@/services/api/api-client";
import { financialInput } from "@/services/api/financial-response";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";

export const taskResourceId = (raw: unknown) => financialInput(z.uuid(), raw);
export async function taskWrite<T>(options: {
  path: string;
  method: "post" | "patch";
  body: unknown;
  schema: z.ZodType<T>;
  creation?: true;
}): Promise<T> {
  const runtime = getSessionRuntime();
  const scope = runtime.scope();
  const response = await apiClient.request<unknown>({
    url: options.path,
    method: options.method,
    data: options.body,
  });
  if (!runtime.isCurrentCheck(scope))
    throw safeApiError("obsolete", "OBSOLETE_SCOPE");
  if (response.status !== 200 && !(options.creation && response.status === 201))
    throw safeApiError("contract", "CONTRACT_ERROR");
  return parseApiResponse(response, options.schema, response.status).data;
}
