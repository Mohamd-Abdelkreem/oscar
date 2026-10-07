import { z } from "zod";
import {
  financialInstantSchema,
  positiveUsdtAmountSchema,
  walletComponentsSchema,
} from "../financial/financial.schema.ts";
import {
  boundedPageQueryShape,
  boundedSearchSchema,
  safePageOffset,
  financialPageSchema,
  successEnvelopeSchema,
  paginatedFinancialEnvelopeSchema,
} from "../http/http.schema.ts";

export const tronNetworkSchema = z.enum([
  "TRON_MAINNET",
  "TRON_SHASTA",
  "TRON_NILE",
]);
export const tronPublicAddressSchema = z
  .string()
  .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/u);
export const depositProvisionRequestSchema = z.object({}).strict();
const metadata = {
  serverNow: financialInstantSchema,
  network: tronNetworkSchema,
  token: z
    .object({
      symbol: z.literal("USDT"),
      contract: tronPublicAddressSchema,
      decimals: z.literal(6),
    })
    .strict(),
};
export const depositDetectionSchema = z
  .object({
    status: z.enum([
      "NOT_STARTED",
      "SCANNING",
      "RETRYING",
      "PAUSED",
      "UNRESOLVED",
    ]),
    lastSuccessfulScanAt: financialInstantSchema.nullable(),
    serverNow: financialInstantSchema,
  })
  .strict();
export const depositAddressDataSchema = z
  .discriminatedUnion("state", [
    z.object({ ...metadata, state: z.literal("UNASSIGNED") }).strict(),
    z
      .object({
        ...metadata,
        state: z.literal("PROVISIONING"),
        assignmentId: z.uuid(),
        readiness: z.enum(["REQUESTED", "KEY_STORED", "RECOVERY_ACKED"]),
      })
      .strict(),
    z
      .object({
        ...metadata,
        state: z.literal("UNAVAILABLE"),
        assignmentId: z.uuid().optional(),
        reasonCode: z.enum([
          "RECOVERY_UNAVAILABLE",
          "EVIDENCE_CONFLICT",
          "PROVIDER_UNAVAILABLE",
        ]),
        retryable: z.boolean(),
      })
      .strict(),
    z
      .object({
        ...metadata,
        state: z.literal("READY"),
        assignmentId: z.uuid(),
        address: tronPublicAddressSchema,
        readyAt: financialInstantSchema,
        activationState: z.enum(["UNKNOWN", "INACTIVE", "ACTIVE"]),
        resourceCheckedAt: financialInstantSchema.nullable().optional(),
        detection: depositDetectionSchema,
      })
      .strict(),
  ])
  .refine(
    (assignment) =>
      assignment.state !== "READY" ||
      assignment.readyAt <= assignment.serverNow,
    "Readiness cannot be in the future.",
  );
export type DepositAddressData = z.infer<typeof depositAddressDataSchema>;

export const depositTransactionIdSchema = z.string().regex(/^[0-9a-f]{64}$/u);
export const manualCreditReferenceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("EXTERNAL"),
      value: z
        .string()
        .trim()
        .min(3)
        .max(256)
        .refine(
          (value) =>
            /[\p{L}\p{N}]/u.test(value) && !/[\p{Cc}\p{Cf}]/u.test(value),
          "Invalid administrative reference.",
        ),
    })
    .strict(),
  z
    .object({ kind: z.literal("LEDGER_OPERATION"), operationId: z.uuid() })
    .strict(),
]);
export const manualCreditReasonSchema = z.string().trim().min(1).max(500);
export const manualCreditGrantSchema = z
  .object({
    actionId: z.uuid(),
    confirmed: z.literal(true),
    reason: manualCreditReasonSchema,
    reference: manualCreditReferenceSchema,
  })
  .strict();
export const manualCreditBodySchema = manualCreditGrantSchema
  .extend({
    employeeId: z.uuid(),
    amount: positiveUsdtAmountSchema,
  })
  .strict();
export const manualCreditParamsSchema = z
  .object({ actionId: z.uuid() })
  .strict();
const historyFilters = {
  ...boundedPageQueryShape,
  kind: z.enum(["CHAIN_DEPOSIT", "MANUAL_CREDIT"]).optional(),
  from: financialInstantSchema.optional(),
  to: financialInstantSchema.optional(),
};
const orderedDates = (query: {
  from?: string | undefined;
  to?: string | undefined;
}) =>
  query.from === undefined || query.to === undefined || query.from <= query.to;
export const depositHistoryQuerySchema = z
  .object(historyFilters)
  .strict()
  .refine(safePageOffset)
  .refine(orderedDates, "Invalid recorded-time range.");
export const adminDepositHistoryQuerySchema = z
  .object({
    ...historyFilters,
    employeeId: z.uuid().optional(),
    q: boundedSearchSchema.optional(),
    transactionId: depositTransactionIdSchema.optional(),
  })
  .strict()
  .refine(safePageOffset)
  .refine(orderedDates, "Invalid recorded-time range.")
  .refine(
    (query) =>
      query.transactionId === undefined || query.kind !== "MANUAL_CREDIT",
    "Transaction filtering requires chain history.",
  );
const historyCommon = {
  id: z.uuid(),
  operationId: z.uuid(),
  amount: positiveUsdtAmountSchema,
  source: z.literal("NON_REFERRAL"),
  recordedAt: financialInstantSchema,
};
const chainFields = {
  ...historyCommon,
  kind: z.literal("CHAIN_DEPOSIT"),
  network: tronNetworkSchema,
  tokenContract: tronPublicAddressSchema,
  transactionId: depositTransactionIdSchema,
  logIndex: z.number().int().nonnegative(),
  address: tronPublicAddressSchema,
  confirmedAt: financialInstantSchema,
  state: z.literal("CONFIRMED"),
};
const manualFields = {
  ...historyCommon,
  kind: z.literal("MANUAL_CREDIT"),
  actionId: z.uuid(),
  state: z.literal("RECORDED"),
};
const identitySchema = z
  .object({ id: z.uuid(), name: z.string().min(1).max(200), email: z.email() })
  .strict();
export const depositHistoryRowSchema = z.discriminatedUnion("kind", [
  z.object(chainFields).strict(),
  z.object(manualFields).strict(),
]);
export const adminDepositHistoryRowSchema = z.discriminatedUnion("kind", [
  z.object({ ...chainFields, employee: identitySchema }).strict(),
  z
    .object({
      ...manualFields,
      employee: identitySchema,
      actor: identitySchema,
      reason: manualCreditReasonSchema,
      reference: manualCreditReferenceSchema,
    })
    .strict(),
]);
export const depositHistoryDataSchema = financialPageSchema(
  depositHistoryRowSchema,
).safeExtend({
  serverNow: financialInstantSchema,
  detection: depositDetectionSchema,
});
export const adminDepositHistoryDataSchema = financialPageSchema(
  adminDepositHistoryRowSchema,
).safeExtend({ serverNow: financialInstantSchema });
export const manualCreditOutcomeSchema = z
  .object({
    actionId: z.uuid(),
    operationId: z.uuid(),
    employeeId: z.uuid(),
    amount: positiveUsdtAmountSchema,
    source: z.literal("NON_REFERRAL"),
    recordedAt: financialInstantSchema,
    state: z.literal("RECORDED"),
    actor: identitySchema,
    reason: manualCreditReasonSchema,
    reference: manualCreditReferenceSchema,
    walletAfter: walletComponentsSchema,
    replayed: z.boolean(),
  })
  .strict();
export const depositAddressEnvelopeSchema = successEnvelopeSchema.safeExtend({
  data: depositAddressDataSchema,
});
export const depositHistoryEnvelopeSchema = paginatedFinancialEnvelopeSchema(
  depositHistoryDataSchema,
);
export const adminDepositHistoryEnvelopeSchema =
  paginatedFinancialEnvelopeSchema(adminDepositHistoryDataSchema);
export const manualCreditEnvelopeSchema = successEnvelopeSchema.safeExtend({
  data: manualCreditOutcomeSchema,
});
export type DepositHistoryQuery = z.infer<typeof depositHistoryQuerySchema>;
export type AdminDepositHistoryQuery = z.infer<
  typeof adminDepositHistoryQuerySchema
>;
export type ManualCreditBody = z.infer<typeof manualCreditBodySchema>;
export type ManualCreditOutcome = z.infer<typeof manualCreditOutcomeSchema>;
export type ManualCreditGrant = z.infer<typeof manualCreditGrantSchema>;
