import { z } from "zod";

import {
  businessDateSchema,
  canonicalAmountUnits as units,
  financialInstantSchema,
  positiveUsdtAmountSchema,
  sourceAllocationSchema,
  usdtAmountSchema,
  walletComponentsSchema,
} from "../financial/financial.schema.ts";
import { financialPageSchema } from "../http/http.schema.ts";
import {
  packageCodeSchema,
  packageTermsSchema,
} from "../packages/package.schema.ts";

const subscriptionDatesShape = {
  activationAt: financialInstantSchema,
  firstWorkDate: businessDateSchema,
  finalWorkDate: businessDateSchema,
  expiresAt: financialInstantSchema,
};
const savedSubscriptionShape = {
  id: z.uuid(),
  purchaseId: z.uuid(),
  terms: packageTermsSchema,
  ...subscriptionDatesShape,
};
const validDates = (term: {
  activationAt: string;
  firstWorkDate: string;
  finalWorkDate: string;
  expiresAt: string;
}): boolean =>
  term.firstWorkDate <= term.finalWorkDate &&
  term.activationAt < term.expiresAt;
export const subscriptionSchema = z
  .object({
    ...savedSubscriptionShape,
    state: z.enum(["CURRENT", "REPLACED", "EXPIRED"]),
  })
  .strict()
  .refine(validDates, "Invalid subscription dates.");
export const subscriptionAtPurchaseSchema = z
  .object({ ...savedSubscriptionShape, stateAtPurchase: z.literal("CURRENT") })
  .strict()
  .refine(validDates, "Invalid subscription dates.");
export const membershipSchema = z
  .object({
    employeeId: z.uuid(),
    serverNow: financialInstantSchema,
    effective: z.enum(["FREE", "PAID"]),
    subscription: subscriptionSchema.nullable(),
  })
  .strict()
  .refine((membership) => {
    const term = membership.subscription;
    const active =
      term !== null &&
      term.state === "CURRENT" &&
      term.activationAt <= membership.serverNow &&
      membership.serverNow < term.expiresAt;
    return (membership.effective === "PAID") === active;
  }, "Effective membership must agree with saved term and server time.");
export const fundedAllocationSchema = z
  .object({
    referral: usdtAmountSchema,
    nonReferral: usdtAmountSchema,
    total: usdtAmountSchema,
  })
  .strict()
  .refine((allocation) => {
    if (
      ![allocation.referral, allocation.nonReferral, allocation.total].every(
        (amount) => usdtAmountSchema.safeParse(amount).success,
      )
    )
      return false;
    return (
      units(allocation.referral) + units(allocation.nonReferral) ===
      units(allocation.total)
    );
  }, "Partial funding components must equal total.");
export const purchaseQuoteBodySchema = z
  .object({ packageCode: packageCodeSchema })
  .strict();
export const confirmedPurchaseBodySchema = z
  .object({ quoteId: z.uuid(), confirmed: z.literal(true) })
  .strict();
export const purchaseActionSchema = z.enum(["PURCHASE", "UPGRADE"]);
export const purchaseQuoteSchema = z
  .object({
    quoteId: z.uuid(),
    packageCode: packageCodeSchema,
    action: purchaseActionSchema,
    terms: packageTermsSchema,
    quotedAt: financialInstantSchema,
    quoteExpiresAt: financialInstantSchema,
    serverNow: financialInstantSchema,
    previousSubscriptionId: z.uuid().nullable(),
    fullDebit: positiveUsdtAmountSchema,
    usableFunds: usdtAmountSchema,
    fundedAllocation: fundedAllocationSchema,
    requiredTopUp: usdtAmountSchema,
    canPurchase: z.boolean(),
    blockReason: z
      .enum(["INSUFFICIENT_FUNDS", "PURCHASE_TRANSITION_DENIED"])
      .nullable(),
    preview: z
      .object({
        firstWorkDate: businessDateSchema,
        finalWorkDate: businessDateSchema,
        expiresAt: financialInstantSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((quote, context) => {
    if (
      ![
        quote.fullDebit,
        quote.usableFunds,
        quote.requiredTopUp,
        quote.fundedAllocation.total,
        quote.terms.price,
      ].every((amount) => usdtAmountSchema.safeParse(amount).success)
    )
      return;
    const debit = units(quote.fullDebit),
      usable = units(quote.usableFunds),
      funded = units(quote.fundedAllocation.total);
    if (
      debit !== units(quote.terms.price) ||
      funded !== (debit < usable ? debit : usable) ||
      funded + units(quote.requiredTopUp) !== debit
    )
      context.addIssue({
        code: "custom",
        message: "Partial allocation and top-up must reconcile full price.",
      });
    if (
      quote.packageCode !== quote.terms.code ||
      quote.quotedAt >= quote.quoteExpiresAt ||
      new Date(quote.quoteExpiresAt).getTime() -
        new Date(quote.quotedAt).getTime() !==
        600000 ||
      quote.preview.firstWorkDate > quote.preview.finalWorkDate ||
      quote.canPurchase !== (quote.blockReason === null) ||
      (quote.blockReason === "INSUFFICIENT_FUNDS" &&
        quote.requiredTopUp === "0") ||
      (quote.requiredTopUp !== "0" &&
        quote.blockReason !== "INSUFFICIENT_FUNDS" &&
        quote.blockReason !== "PURCHASE_TRANSITION_DENIED") ||
      (quote.action === "UPGRADE" && quote.previousSubscriptionId === null)
    )
      context.addIssue({
        code: "custom",
        message: "Quote intent, dates or eligibility disagree.",
      });
  });
export const purchaseResultSchema = z
  .object({
    purchaseId: z.uuid(),
    quoteId: z.uuid(),
    action: purchaseActionSchema,
    purchasedAt: financialInstantSchema,
    packageCode: packageCodeSchema,
    fullDebit: positiveUsdtAmountSchema,
    sourceAllocation: sourceAllocationSchema,
    commissionBase: usdtAmountSchema,
    subscriptionAtPurchase: subscriptionAtPurchaseSchema,
    walletAfter: walletComponentsSchema,
  })
  .strict()
  .refine(
    (purchase) =>
      purchase.purchaseId === purchase.subscriptionAtPurchase.purchaseId &&
      purchase.packageCode === purchase.subscriptionAtPurchase.terms.code &&
      purchase.fullDebit === purchase.subscriptionAtPurchase.terms.price &&
      purchase.fullDebit === purchase.sourceAllocation.gross &&
      purchase.purchasedAt === purchase.subscriptionAtPurchase.activationAt &&
      usdtAmountSchema.safeParse(purchase.commissionBase).success &&
      positiveUsdtAmountSchema.safeParse(purchase.fullDebit).success &&
      units(purchase.commissionBase) <= units(purchase.fullDebit) &&
      (purchase.action !== "PURCHASE" ||
        purchase.commissionBase === purchase.fullDebit),
    "Saved purchase identity and amounts must agree.",
  );
export const purchaseCommandResultSchema = z
  .object({ purchase: purchaseResultSchema, replayed: z.boolean() })
  .strict();
export const subscriptionHistorySchema =
  financialPageSchema(subscriptionSchema);
export const purchaseHistorySchema = financialPageSchema(purchaseResultSchema);
export const quoteOutcomeSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("COMMITTED"),
      quoteId: z.uuid(),
      purchase: purchaseResultSchema,
      serverNow: financialInstantSchema,
    })
    .strict()
    .refine(
      (outcome) => outcome.quoteId === outcome.purchase.quoteId,
      "Quote identity must agree.",
    ),
  z
    .object({
      status: z.literal("NOT_OBSERVED"),
      quoteId: z.uuid(),
      quote: purchaseQuoteSchema,
      serverNow: financialInstantSchema,
    })
    .strict()
    .refine(
      (outcome) =>
        outcome.quoteId === outcome.quote.quoteId &&
        outcome.serverNow < outcome.quote.quoteExpiresAt,
      "Live quote identity and time must agree.",
    ),
  z
    .object({
      status: z.literal("EXPIRED_UNCOMMITTED"),
      quoteId: z.uuid(),
      quote: purchaseQuoteSchema,
      serverNow: financialInstantSchema,
    })
    .strict()
    .refine(
      (outcome) =>
        outcome.quoteId === outcome.quote.quoteId &&
        outcome.serverNow >= outcome.quote.quoteExpiresAt,
      "Expired quote identity and time must agree.",
    ),
]);

export type Subscription = z.infer<typeof subscriptionSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type PurchaseQuote = z.infer<typeof purchaseQuoteSchema>;
export type PurchaseResult = z.infer<typeof purchaseResultSchema>;
export type QuoteOutcome = z.infer<typeof quoteOutcomeSchema>;
export type ConfirmedPurchaseBody = z.infer<typeof confirmedPurchaseBodySchema>;
