import { z } from "zod";
import {
  adminWithdrawalRequestSchema,
  adminWithdrawalHistorySchema,
  adminWithdrawalFilterSchema,
  adminWithdrawalActionOutcomeQuerySchema,
  adminWithdrawalActionOutcomeSchema,
  withdrawalCommandResultSchema,
  withdrawalExtensionBodySchema,
  withdrawalRejectionBodySchema,
  withdrawalRequestKeySchema,
  type AdminWithdrawalFilter,
} from "@template/contracts";
import { apiClient, parseApiResponse } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";

export type WithdrawalExtension = z.infer<typeof withdrawalExtensionBodySchema>;
export type WithdrawalRejection = z.infer<typeof withdrawalRejectionBodySchema>;
export type WithdrawalActionQuery = z.infer<
  typeof adminWithdrawalActionOutcomeQuerySchema
>;
export type AdminWithdrawalRequest = z.infer<
  typeof adminWithdrawalRequestSchema
>;
export type WithdrawalActionOutcome = z.infer<
  typeof adminWithdrawalActionOutcomeSchema
>;
const id = (raw: string) => financialInput(z.uuid(), raw);
const options = (signal?: AbortSignal) =>
  signal === undefined ? {} : { signal };
async function command(intent: {
  target: string;
  kind: "EXTEND" | "REJECT";
  body: WithdrawalExtension | WithdrawalRejection;
  key: string;
}) {
  const target = id(intent.target);
  const body = financialInput(
    intent.kind === "EXTEND"
      ? withdrawalExtensionBodySchema
      : withdrawalRejectionBodySchema,
    intent.body,
  );
  const key = financialInput(withdrawalRequestKeySchema, intent.key);
  const runtime = getSessionRuntime(),
    scope = runtime.scope();
  const response = await apiClient.post<unknown>(
    `/admin/withdrawals/${target}/${intent.kind === "EXTEND" ? "extensions" : "rejections"}`,
    body,
    { headers: { "Idempotency-Key": key } },
  );
  if (!runtime.isCurrentCheck(scope))
    throw safeApiError("obsolete", "OBSOLETE_SCOPE");
  try {
    return parseApiResponse(
      response,
      withdrawalCommandResultSchema.refine(
        (saved) =>
          saved.withdrawal.id === target &&
          saved.withdrawal.version >= body.expectedVersion + 1 &&
          (saved.replayed ||
            (saved.withdrawal.version === body.expectedVersion + 1 &&
              saved.withdrawal.state ===
                (intent.kind === "EXTEND" ? "SCHEDULED" : "REJECTED"))),
      ),
      200,
    ).data;
  } catch {
    throw safeApiError("uncertain", "CONTRACT_ERROR");
  }
}
export const adminWithdrawalsApi = {
  detail: (target: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>(
          `/admin/withdrawals/${id(target)}`,
          options(signal),
        ),
      adminWithdrawalRequestSchema.refine((saved) => saved.id === target),
    ),
  history: async (query: AdminWithdrawalFilter, signal?: AbortSignal) => {
    const params = financialInput(adminWithdrawalFilterSchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>("/admin/withdrawals", {
          params,
          ...options(signal),
        }),
      adminWithdrawalHistorySchema.refine((page) =>
        page.items.every(
          (row) =>
            (params.state === undefined || row.state === params.state) &&
            (params.employeeId === undefined ||
              row.employee.id === params.employeeId),
        ),
      ),
      params,
    );
  },
  outcome: (
    target: string,
    query: WithdrawalActionQuery,
    signal?: AbortSignal,
  ) => {
    const params = financialInput(
      adminWithdrawalActionOutcomeQuerySchema,
      query,
    );
    const actorId = getSessionRuntime().scope().accountId;
    return financialRead(
      () =>
        apiClient.get<unknown>(
          `/admin/withdrawals/${id(target)}/actions/outcome`,
          { params, ...options(signal) },
        ),
      adminWithdrawalActionOutcomeSchema.refine(
        (saved) =>
          saved.withdrawalId === target &&
          saved.kind === params.kind &&
          saved.requestKey === params.requestKey &&
          saved.expectedVersion === params.expectedVersion &&
          (saved.status !== "COMMITTED" ||
            saved.action.actorUserId === actorId),
      ),
    );
  },
  extend: (target: string, body: WithdrawalExtension, key: string) =>
    command({ target, body, key, kind: "EXTEND" }),
  reject: (target: string, body: WithdrawalRejection, key: string) =>
    command({ target, body, key, kind: "REJECT" }),
};
