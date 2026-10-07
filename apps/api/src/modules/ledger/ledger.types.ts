import {
  financialRequestKeySchema,
  fundSourceSchema,
  positiveUsdtAmountSchema,
  walletComponentsSchema,
  manualCreditGrantSchema,
  type FinancialOperationResult,
  type FundSource,
} from "@template/contracts";
import type {
  Prisma,
  User,
  Wallet,
  ReservationAllocation,
} from "@template/database";
import { z } from "zod";

const BUSINESS_KEY_MAX_LENGTH = 256;
const BUSINESS_NAMESPACE_MAX_LENGTH = 64;
const CORRECTION_REASON_MAX_LENGTH = 500;
const correctionFields = {
  source: fundSourceSchema,
  direction: z.enum(["CREDIT", "DEBIT"]),
  reason: z
    .string()
    .min(1)
    .max(CORRECTION_REASON_MAX_LENGTH)
    .refine((reason) => reason.trim().length > 0),
  referenceOperationId: z.uuid(),
};
const SUPPORTED_FUND_SOURCE_COUNT = fundSourceSchema.options.length;
export const eligibleFundSourcesSchema = z
  .array(fundSourceSchema)
  .min(1)
  .max(SUPPORTED_FUND_SOURCE_COUNT)
  .refine((sources) => new Set(sources).size === sources.length);
const identityFields = {
  walletId: z.uuid(),
  businessNamespace: z
    .string()
    .trim()
    .min(1)
    .max(BUSINESS_NAMESPACE_MAX_LENGTH),
  businessKey: z
    .string()
    .min(1)
    .max(BUSINESS_KEY_MAX_LENGTH)
    .refine((key) => key.trim().length > 0),
  requestKey: financialRequestKeySchema.optional(),
};
const creditIntentSchema = z
  .object({
    ...identityFields,
    kind: z.literal("CREDIT"),
    amount: positiveUsdtAmountSchema,
    source: fundSourceSchema,
    origin: z.enum([
      "DEPOSIT",
      "TASK_REWARD",
      "REFERRAL_COMMISSION",
      "ADMIN_ADJUSTMENT",
    ]),
    grant: manualCreditGrantSchema
      .extend({ actorUserId: z.uuid() })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (intent) =>
      (intent.origin === "REFERRAL_COMMISSION") ===
      (intent.source === "REFERRAL"),
  )
  .refine((intent) =>
    intent.origin === "ADMIN_ADJUSTMENT"
      ? intent.source === "NON_REFERRAL" &&
        intent.grant !== undefined &&
        intent.businessNamespace === "p06.manual-credit" &&
        intent.businessKey === intent.grant.actionId
      : intent.grant === undefined,
  );
export const ledgerIntentSchema = z.discriminatedUnion("kind", [
  creditIntentSchema,
  z
    .object({
      ...identityFields,
      kind: z.literal("CORRECTION"),
      amount: positiveUsdtAmountSchema,
      ...correctionFields,
    })
    .strict(),
  z
    .object({
      ...identityFields,
      kind: z.literal("PURCHASE_DEBIT"),
      amount: positiveUsdtAmountSchema,
    })
    .strict(),
  z
    .object({
      ...identityFields,
      kind: z.literal("RESERVE"),
      amount: positiveUsdtAmountSchema,
      reservationId: z.uuid(),
    })
    .strict(),
  z
    .object({
      ...identityFields,
      kind: z.literal("RELEASE"),
      reservationId: z.uuid(),
    })
    .strict(),
]);
export type LedgerIntent = z.infer<typeof ledgerIntentSchema>;
export type CreditIntent = Extract<LedgerIntent, { kind: "CREDIT" }>;
export type PurchaseDebitIntent = Extract<
  LedgerIntent,
  { kind: "PURCHASE_DEBIT" }
>;
export type ReservationIntent = Extract<LedgerIntent, { kind: "RESERVE" }>;
export type ReleaseIntent = Extract<LedgerIntent, { kind: "RELEASE" }>;
export type CorrectionIntent = Extract<LedgerIntent, { kind: "CORRECTION" }>;

export const acceptedTermsSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("CREDIT"),
      walletBefore: walletComponentsSchema,
      source: fundSourceSchema,
      grant: manualCreditGrantSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("PURCHASE_DEBIT"),
      walletBefore: walletComponentsSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("RESERVE"),
      walletBefore: walletComponentsSchema,
      reservationId: z.uuid(),
      eligibleSources: eligibleFundSourcesSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("RELEASE"),
      walletBefore: walletComponentsSchema,
      reservationId: z.uuid(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("CORRECTION"),
      walletBefore: walletComponentsSchema,
      ...correctionFields,
    })
    .strict(),
]);
export type AcceptedTerms = z.infer<typeof acceptedTermsSchema>;
export type LedgerActor =
  { type: "USER"; userId: string } | { type: "PROCESS"; processId: string };
export type LedgerGuardScope = {
  transaction: Prisma.TransactionClient;
  wallet: Readonly<Wallet>;
  actor: LedgerActor;
  actorAccount: Readonly<User> | null;
  intent: LedgerIntent;
};
export type LedgerContext = {
  actor: LedgerActor;
  walletIds: readonly string[];
  authorityUserIds?: readonly string[];
  clock: () => Date;
  observe: (scope: LedgerGuardScope) => Promise<void>;
  mutate: (scope: LedgerGuardScope) => Promise<void>;
  eligibleSources?: (scope: LedgerGuardScope) => Promise<readonly FundSource[]>;
  releaseSafety?: (
    scope: LedgerGuardScope & { allocation: Readonly<ReservationAllocation> },
  ) => Promise<void>;
};
export type LedgerPolicy = {
  businessNamespaces: readonly string[];
  processIds: readonly string[];
};
export type LedgerObservationScope = Omit<LedgerGuardScope, "intent">;
export type LedgerObservationContext = {
  actor: LedgerActor;
  observe: (scope: LedgerObservationScope) => Promise<void>;
};
export type LedgerReply = {
  result: FinancialOperationResult;
  replayed: boolean;
};
export type LedgerDomainWrite = (
  transaction: Prisma.TransactionClient,
  operation: FinancialOperationResult,
) => Promise<void>;
export type TransactionLedger = {
  correctAvailable: (
    intent: CorrectionIntent,
    domainWrite?: LedgerDomainWrite,
  ) => Promise<LedgerReply>;
  credit: (
    intent: CreditIntent,
    domainWrite?: LedgerDomainWrite,
  ) => Promise<LedgerReply>;
  debitForPurchase: (
    intent: PurchaseDebitIntent,
    domainWrite?: LedgerDomainWrite,
  ) => Promise<LedgerReply>;
  reserveForWithdrawal: (
    intent: ReservationIntent,
    domainWrite?: LedgerDomainWrite,
  ) => Promise<LedgerReply>;
  releaseReservation: (
    intent: ReleaseIntent,
    domainWrite?: LedgerDomainWrite,
  ) => Promise<LedgerReply>;
};
