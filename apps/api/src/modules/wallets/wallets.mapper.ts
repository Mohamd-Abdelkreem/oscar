import {
  walletViewSchema,
  membershipSchema,
  packageTermsSchema,
  ledgerRowSchema,
  adminLedgerRowSchema,
  employeeLedgerDetailSchema,
  adminLedgerDetailSchema,
} from "@template/contracts";
import type { Prisma } from "@template/database";
import {
  formatUsdtAmount,
  formatSignedUsdtDelta,
} from "../../core/financial/money.js";
import {
  subscriptionViewSelect,
  isEffectiveSubscription,
  mapSubscription,
} from "../subscriptions/subscriptions.mapper.js";
import { mapWalletComponents } from "../ledger/ledger.mapper.js";

export const financialIdentitySelect = {
  id: true,
  fullName: true,
  email: true,
} as const satisfies Prisma.UserSelect;
export const walletOwnerSelect = {
  ...financialIdentitySelect,
  status: true,
  emailVerifiedAt: true,
  withdrawalsBlocked: true,
  wallet: {
    select: {
      availableReferralUnits: true,
      reservedReferralUnits: true,
      availableNonReferralUnits: true,
      reservedNonReferralUnits: true,
    },
  },
  subscriptions: {
    where: { state: "CURRENT" },
    select: subscriptionViewSelect,
  },
} as const satisfies Prisma.UserSelect;
type WalletOwner = Prisma.UserGetPayload<{ select: typeof walletOwnerSelect }>;
export function mapWallet(owner: WalletOwner, now: Date) {
  const wallet = owner.wallet;
  if (wallet === null) throw new Error("Employee wallet is missing.");
  const subscription = owner.subscriptions[0] ?? null;
  const paid = isEffectiveSubscription(subscription, now);
  const available =
    wallet.availableReferralUnits + wallet.availableNonReferralUnits;
  return walletViewSchema.parse({
    employeeId: owner.id,
    serverNow: now.toISOString(),
    walletComponents: mapWalletComponents(wallet),
    membership: membershipSchema.parse({
      employeeId: owner.id,
      serverNow: now.toISOString(),
      effective: paid ? "PAID" : "FREE",
      subscription:
        subscription === null ? null : mapSubscription(subscription),
    }),
    purchaseEligibleAmount: formatUsdtAmount(available),
    withdrawalFunds: {
      eligibleNonReferral: formatUsdtAmount(wallet.availableNonReferralUnits),
      eligibleReferral: paid
        ? formatUsdtAmount(wallet.availableReferralUnits)
        : "0",
      total: formatUsdtAmount(
        wallet.availableNonReferralUnits +
          (paid ? wallet.availableReferralUnits : 0n),
      ),
      lockedReferral: paid
        ? "0"
        : formatUsdtAmount(wallet.availableReferralUnits),
    },
    restrictions: {
      accountUnavailable:
        owner.status !== "ACTIVE" || owner.emailVerifiedAt === null,
      withdrawalsBlocked: owner.withdrawalsBlocked,
    },
    withdrawalExecutionReady: false,
  });
}
export const operationViewSelect = {
  id: true,
  createdAt: true,
  kind: true,
  origin: true,
  magnitudeUnits: true,
  postings: {
    select: {
      source: true,
      availableDeltaUnits: true,
      reservedDeltaUnits: true,
    },
    orderBy: { source: "asc" },
  },
  wallet: { select: { owner: { select: financialIdentitySelect } } },
} as const satisfies Prisma.FinancialOperationSelect;
export const operationDetailSelect = {
  ...operationViewSelect,
  packagePurchase: { select: { acceptedTerms: true } },
  referralDecision: {
    select: { purchase: { select: { acceptedTerms: true } } },
  },
  actor: { select: financialIdentitySelect },
  audit: { select: { reason: true, referenceOperationId: true } },
} as const satisfies Prisma.FinancialOperationSelect;
type OperationView = Prisma.FinancialOperationGetPayload<{
  select: typeof operationViewSelect;
}>;
type OperationDetail = Prisma.FinancialOperationGetPayload<{
  select: typeof operationDetailSelect;
}>;
export function mapLedgerRow(operation: OperationView) {
  const delta = operation.postings.reduce(
    (sum, posting) =>
      sum + posting.availableDeltaUnits + posting.reservedDeltaUnits,
    0n,
  );
  return ledgerRowSchema.parse({
    operationId: operation.id,
    recordedAt: operation.createdAt.toISOString(),
    kind: operation.kind,
    origin: operation.origin,
    direction: delta > 0n ? "CREDIT" : delta < 0n ? "DEBIT" : "NEUTRAL",
    magnitude: formatUsdtAmount(operation.magnitudeUnits),
    signedOwnershipDelta: formatSignedUsdtDelta(delta),
    sourceMovements: operation.postings.map((posting) => ({
      source: posting.source,
      availableDelta: formatSignedUsdtDelta(posting.availableDeltaUnits),
      reservedDelta: formatSignedUsdtDelta(posting.reservedDeltaUnits),
    })),
    referenceLabel: operation.id,
  });
}
export const mapAdminLedgerRow = (operation: OperationView) =>
  adminLedgerRowSchema.parse({
    ...mapLedgerRow(operation),
    employee: operation.wallet.owner,
  });
export function mapLedgerDetail(operation: OperationDetail) {
  const terms =
    operation.packagePurchase?.acceptedTerms ??
    operation.referralDecision?.purchase.acceptedTerms;
  return employeeLedgerDetailSchema.parse({
    ...mapLedgerRow(operation),
    savedTerms: terms === undefined ? null : packageTermsSchema.parse(terms),
  });
}
export function mapAdminLedgerDetail(operation: OperationDetail) {
  const audit = operation.audit;
  if (
    operation.kind === "CORRECTION" &&
    (audit?.reason === null ||
      audit?.reason === undefined ||
      audit.referenceOperationId === null)
  )
    throw new Error("Correction audit is missing.");
  return adminLedgerDetailSchema.parse({
    ...mapLedgerDetail(operation),
    employee: operation.wallet.owner,
    actor: operation.actor,
    correction:
      operation.kind === "CORRECTION"
        ? {
            reason: audit?.reason,
            referenceOperationId: audit?.referenceOperationId,
          }
        : null,
  });
}
