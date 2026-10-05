import {
  packageTermsSchema,
  purchaseResultSchema,
  subscriptionSchema,
} from "@template/contracts";
import type {
  Purchase,
  Subscription,
  FinancialOperation,
  Prisma,
} from "@template/database";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { mapRecordedOutcome } from "../ledger/ledger.mapper.js";

export const subscriptionViewSelect = {
  id: true,
  purchaseId: true,
  acceptedTerms: true,
  activationAt: true,
  firstWorkDate: true,
  finalWorkDate: true,
  expiresAt: true,
  state: true,
} as const satisfies Prisma.SubscriptionSelect;
type SubscriptionView = Prisma.SubscriptionGetPayload<{
  select: typeof subscriptionViewSelect;
}>;

export const isEffectiveSubscription = (
  subscription: Pick<
    Subscription,
    "state" | "activationAt" | "expiresAt"
  > | null,
  now: Date,
): boolean =>
  subscription !== null &&
  subscription.state === "CURRENT" &&
  subscription.activationAt <= now &&
  now < subscription.expiresAt;

const savedSubscription = (subscription: SubscriptionView) => ({
  id: subscription.id,
  purchaseId: subscription.purchaseId,
  terms: packageTermsSchema.parse(subscription.acceptedTerms),
  activationAt: subscription.activationAt.toISOString(),
  firstWorkDate: subscription.firstWorkDate.toISOString().slice(0, 10),
  finalWorkDate: subscription.finalWorkDate.toISOString().slice(0, 10),
  expiresAt: subscription.expiresAt.toISOString(),
});

export const mapSubscription = (subscription: SubscriptionView) =>
  subscriptionSchema.parse({
    ...savedSubscription(subscription),
    state: subscription.state,
  });

export function mapPurchase(
  purchase: Purchase & {
    subscription: Subscription | null;
    debitOperation: FinancialOperation;
  },
) {
  if (purchase.subscription === null)
    throw new Error("Purchase subscription is missing.");
  return purchaseResultSchema.parse({
    purchaseId: purchase.id,
    quoteId: purchase.quoteId,
    action: purchase.action,
    purchasedAt: purchase.purchasedAt.toISOString(),
    packageCode: purchase.packageCode,
    fullDebit: formatUsdtAmount(purchase.fullDebitUnits),
    sourceAllocation: {
      referral: formatUsdtAmount(purchase.sourceReferralUnits),
      nonReferral: formatUsdtAmount(purchase.sourceNonReferralUnits),
      gross: formatUsdtAmount(purchase.fullDebitUnits),
    },
    commissionBase: formatUsdtAmount(purchase.commissionBaseUnits),
    subscriptionAtPurchase: {
      ...savedSubscription(purchase.subscription),
      stateAtPurchase: "CURRENT",
    },
    walletAfter: mapRecordedOutcome(purchase.debitOperation.outcome)
      .walletAfter,
  });
}

export const purchaseOutcomeInclude = {
  subscription: true,
  debitOperation: true,
} as const;
