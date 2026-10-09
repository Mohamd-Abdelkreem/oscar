import { z } from "zod";

import {
  aggregateUsdtAmountSchema,
  canonicalAmountUnits,
  financialInstantSchema,
  fundSourceSchema,
  positiveUsdtAmountSchema,
  signedAggregateUsdtDeltaSchema,
  signedUsdtDeltaSchema,
  usdtAmountSchema,
  walletComponentsSchema,
} from "../financial/financial.schema.ts";
import {
  boundedPageQueryShape,
  boundedSearchSchema,
  financialPageSchema,
  nonEmptyBoundedString,
  safePageOffset,
} from "../http/http.schema.ts";
import {
  packageTermsSchema,
  safeCountSchema,
} from "../packages/package.schema.ts";
import { membershipSchema } from "../subscriptions/subscription.schema.ts";
import { withdrawalSettlementTermsSchema } from "../withdrawals/withdrawal.schema.ts";

export const employeeFinancialIdentitySchema = z
  .object({
    id: z.uuid(),
    fullName: nonEmptyBoundedString(150),
    email: z.email().max(320),
  })
  .strict();
const units = (amount: string): bigint => {
  const sign = amount.startsWith("-") ? -1n : 1n;
  return sign * canonicalAmountUnits(sign < 0n ? amount.slice(1) : amount);
};
export const withdrawalFundsSchema = z
  .object({
    eligibleNonReferral: usdtAmountSchema,
    eligibleReferral: usdtAmountSchema,
    total: usdtAmountSchema,
    lockedReferral: usdtAmountSchema,
  })
  .strict();
const walletViewShape = {
  employeeId: z.uuid(),
  serverNow: financialInstantSchema,
  walletComponents: walletComponentsSchema,
  membership: membershipSchema,
  purchaseEligibleAmount: usdtAmountSchema,
  withdrawalFunds: withdrawalFundsSchema,
  restrictions: z
    .object({
      accountUnavailable: z.boolean(),
      withdrawalsBlocked: z.boolean(),
    })
    .strict(),
  withdrawalExecutionReady: z.literal(false),
};
const validWalletView = (
  view: z.infer<z.ZodObject<typeof walletViewShape>>,
): boolean => {
  const wallet = view.walletComponents,
    funds = view.withdrawalFunds;
  if (
    ![
      wallet.availableReferral,
      wallet.availableNonReferral,
      view.purchaseEligibleAmount,
      funds.eligibleNonReferral,
      funds.eligibleReferral,
      funds.total,
      funds.lockedReferral,
    ].every((amount) => usdtAmountSchema.safeParse(amount).success)
  )
    return false;
  return (
    view.employeeId === view.membership.employeeId &&
    view.serverNow === view.membership.serverNow &&
    units(view.purchaseEligibleAmount) ===
      units(wallet.availableReferral) + units(wallet.availableNonReferral) &&
    funds.eligibleNonReferral === wallet.availableNonReferral &&
    funds.eligibleReferral ===
      (view.membership.effective === "PAID" ? wallet.availableReferral : "0") &&
    funds.lockedReferral ===
      (view.membership.effective === "PAID" ? "0" : wallet.availableReferral) &&
    units(funds.total) ===
      units(funds.eligibleReferral) + units(funds.eligibleNonReferral)
  );
};
export const walletViewSchema = z
  .object(walletViewShape)
  .strict()
  .refine(
    validWalletView,
    "Wallet eligibility must preserve sources and membership.",
  );
export const adminWalletViewSchema = z
  .object({ ...walletViewShape, employee: employeeFinancialIdentitySchema })
  .strict()
  .refine(
    (view) => validWalletView(view) && view.employee.id === view.employeeId,
    "Admin wallet owner must agree.",
  );
export const financialOperationKindSchema = z.enum([
  "CREDIT",
  "PURCHASE_DEBIT",
  "CORRECTION",
  "RESERVE",
  "RELEASE",
  "SETTLE",
]);
export const financialOriginSchema = z.enum([
  "DEPOSIT",
  "TASK_REWARD",
  "REFERRAL_COMMISSION",
  "PACKAGE_PURCHASE",
  "WITHDRAWAL_RESERVATION",
  "RESERVATION_RELEASE",
  "ADMIN_ADJUSTMENT",
  "WITHDRAWAL_SETTLEMENT",
]);
export const ledgerDirectionSchema = z.enum(["CREDIT", "DEBIT", "NEUTRAL"]);
const ledgerFilterShape = {
  ...boundedPageQueryShape,
  kind: financialOperationKindSchema.optional(),
  origin: financialOriginSchema.optional(),
  source: fundSourceSchema.optional(),
  direction: ledgerDirectionSchema.optional(),
  from: financialInstantSchema.optional(),
  to: financialInstantSchema.optional(),
};
export const validFinancialFilter = (filter: {
  page: number;
  limit: number;
  from?: string | undefined;
  to?: string | undefined;
}): boolean =>
  safePageOffset(filter) &&
  (filter.from === undefined ||
    filter.to === undefined ||
    filter.from <= filter.to);
export const ledgerFilterSchema = z
  .object(ledgerFilterShape)
  .strict()
  .refine(validFinancialFilter, "Invalid page or date range.");
export const adminLedgerFilterSchema = z
  .object({
    ...ledgerFilterShape,
    employeeId: z.uuid().optional(),
    q: boundedSearchSchema.optional(),
  })
  .strict()
  .refine(validFinancialFilter, "Invalid page or date range.");
export const sourceMovementSchema = z
  .object({
    source: fundSourceSchema,
    availableDelta: signedUsdtDeltaSchema,
    reservedDelta: signedUsdtDeltaSchema,
  })
  .strict();
const ledgerRowShape = {
  operationId: z.uuid(),
  recordedAt: financialInstantSchema,
  kind: financialOperationKindSchema,
  origin: financialOriginSchema,
  direction: ledgerDirectionSchema,
  magnitude: positiveUsdtAmountSchema,
  signedOwnershipDelta: signedUsdtDeltaSchema,
  sourceMovements: z.array(sourceMovementSchema).min(1).max(2),
  referenceLabel: nonEmptyBoundedString(256),
};
const validLedgerRow = (
  row: z.infer<z.ZodObject<typeof ledgerRowShape>>,
): boolean => {
  if (
    !signedUsdtDeltaSchema.safeParse(row.signedOwnershipDelta).success ||
    !positiveUsdtAmountSchema.safeParse(row.magnitude).success ||
    !row.sourceMovements.every(
      (movement) => sourceMovementSchema.safeParse(movement).success,
    )
  )
    return false;
  const delta = units(row.signedOwnershipDelta);
  const neutral = row.kind === "RESERVE" || row.kind === "RELEASE";
  return (
    new Set(row.sourceMovements.map((movement) => movement.source)).size ===
      row.sourceMovements.length &&
    (neutral
      ? delta === 0n && row.direction === "NEUTRAL"
      : delta !== 0n &&
        (delta > 0n ? row.direction === "CREDIT" : row.direction === "DEBIT") &&
        (delta < 0n ? -delta : delta) === units(row.magnitude))
  );
};
export const ledgerRowSchema = z
  .object(ledgerRowShape)
  .strict()
  .refine(
    validLedgerRow,
    "Ledger direction must agree with ownership movement.",
  );
const detailShape = {
  ...ledgerRowShape,
  savedTerms: packageTermsSchema.nullable(),
  withdrawalTerms: withdrawalSettlementTermsSchema.nullable().default(null),
};
const fullMovementsAgree = (
  row: z.infer<z.ZodObject<typeof ledgerRowShape>>,
): boolean =>
  validLedgerRow(row) &&
  row.sourceMovements.reduce(
    (sum, movement) =>
      sum + units(movement.availableDelta) + units(movement.reservedDelta),
    0n,
  ) === units(row.signedOwnershipDelta);
const settlementDetailAgrees = (
  row: z.infer<z.ZodObject<typeof detailShape>>,
): boolean => {
  const terms = row.withdrawalTerms;
  if (row.kind !== "SETTLE") return terms === null;
  if (
    terms === null ||
    row.origin !== "WITHDRAWAL_SETTLEMENT" ||
    row.savedTerms !== null ||
    row.magnitude !== terms.gross ||
    units(row.signedOwnershipDelta) !== -units(terms.gross)
  )
    return false;
  return row.sourceMovements.every(
    (posting) =>
      units(posting.availableDelta) === 0n &&
      units(posting.reservedDelta) ===
        -units(
          posting.source === "NON_REFERRAL"
            ? terms.sourceAllocation.nonReferral
            : terms.sourceAllocation.referral,
        ),
  );
};
export const employeeLedgerDetailSchema = z
  .object(detailShape)
  .strict()
  .refine(
    settlementDetailAgrees,
    "Settlement detail must preserve original gross sources.",
  )
  .refine(
    fullMovementsAgree,
    "Full source movements must equal ownership delta.",
  );
export const adminLedgerRowSchema = z
  .object({ ...ledgerRowShape, employee: employeeFinancialIdentitySchema })
  .strict()
  .refine(validLedgerRow, "Invalid ledger direction.");
export const adminLedgerDetailSchema = z
  .object({
    ...detailShape,
    employee: employeeFinancialIdentitySchema,
    actor: employeeFinancialIdentitySchema.nullable(),
    correction: z
      .object({
        reason: nonEmptyBoundedString(500),
        referenceOperationId: z.uuid(),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .refine(
    settlementDetailAgrees,
    "Settlement detail must preserve original gross sources.",
  )
  .refine(
    fullMovementsAgree,
    "Full source movements must equal ownership delta.",
  );
export const operationSummarySchema = z
  .object({
    scope: z.literal("FILTERED_OPERATIONS"),
    credits: aggregateUsdtAmountSchema,
    debits: aggregateUsdtAmountSchema,
    net: signedAggregateUsdtDeltaSchema,
  })
  .strict()
  .refine(
    (summary) =>
      [summary.credits, summary.debits].every(
        (amount) => aggregateUsdtAmountSchema.safeParse(amount).success,
      ) &&
      signedAggregateUsdtDeltaSchema.safeParse(summary.net).success &&
      units(summary.credits) - units(summary.debits) === units(summary.net),
    "Summary net must equal credits minus debits.",
  );
export const ledgerPageSchema = financialPageSchema(ledgerRowSchema).safeExtend(
  { summary: operationSummarySchema, serverNow: financialInstantSchema },
);
export const aggregateWalletTotalsSchema = z
  .object({
    available: aggregateUsdtAmountSchema,
    reserved: aggregateUsdtAmountSchema,
    referral: aggregateUsdtAmountSchema,
    nonReferral: aggregateUsdtAmountSchema,
    owned: aggregateUsdtAmountSchema,
  })
  .strict()
  .refine(
    (totals) =>
      Object.values(totals).every(
        (amount) => aggregateUsdtAmountSchema.safeParse(amount).success,
      ) &&
      units(totals.available) + units(totals.reserved) ===
        units(totals.owned) &&
      units(totals.referral) + units(totals.nonReferral) ===
        units(totals.owned),
    "Aggregate wallet ownership must reconcile.",
  );
export const adminFinancePageSchema = financialPageSchema(
  adminLedgerRowSchema,
).safeExtend({
  summary: operationSummarySchema.safeExtend({
    neutralOperationsCount: safeCountSchema,
  }),
  serverNow: financialInstantSchema,
  walletTotalsScope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("ALL_EMPLOYEES") }).strict(),
    z.object({ kind: z.literal("EMPLOYEE"), employeeId: z.uuid() }).strict(),
  ]),
  walletTotals: aggregateWalletTotalsSchema,
});

export type WalletView = z.infer<typeof walletViewSchema>;
export type AdminWalletView = z.infer<typeof adminWalletViewSchema>;
export type LedgerFilter = z.infer<typeof ledgerFilterSchema>;
export type AdminLedgerFilter = z.infer<typeof adminLedgerFilterSchema>;
export type LedgerRow = z.infer<typeof ledgerRowSchema>;
export type EmployeeLedgerDetail = z.infer<typeof employeeLedgerDetailSchema>;
export type AdminLedgerDetail = z.infer<typeof adminLedgerDetailSchema>;
export type LedgerPage = z.infer<typeof ledgerPageSchema>;
export type AdminFinancePage = z.infer<typeof adminFinancePageSchema>;
