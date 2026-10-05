import {
  Prisma,
  FundSource,
  FinancialOrigin,
  UserRole,
  type ReservationAllocation,
  type Wallet,
} from "@template/database";

import {
  addUnits,
  parseUsdtAmount,
  subtractUnits,
  totalUnits,
} from "../../core/financial/money.js";
import { LedgerError } from "./ledger.errors.js";
import {
  mapSourceAllocation,
  mapWalletComponents,
  type WalletAmounts,
} from "./ledger.mapper.js";
import type {
  AcceptedTerms,
  LedgerGuardScope,
  LedgerContext,
  LedgerIntent,
} from "./ledger.types.js";
import { eligibleFundSourcesSchema } from "./ledger.types.js";

const PURCHASE_SOURCE_ORDER = [
  FundSource.REFERRAL,
  FundSource.NON_REFERRAL,
] as const;
const WITHDRAWAL_SOURCE_ORDER = [
  FundSource.NON_REFERRAL,
  FundSource.REFERRAL,
] as const;

export type SourceMovement = {
  source: FundSource;
  availableDeltaUnits: bigint;
  reservedDeltaUnits: bigint;
};
export type PlannedEffect = {
  magnitudeUnits: bigint;
  origin: FinancialOrigin;
  terms: AcceptedTerms;
  after: WalletAmounts;
  postings: SourceMovement[];
  allocation?: {
    id: string;
    nonReferralUnits: bigint;
    referralUnits: bigint;
    grossUnits: bigint;
  };
};

export const runAuthorityGuard = async (
  guard: () => Promise<void>,
): Promise<void> => {
  try {
    await guard();
  } catch (error) {
    if (
      error instanceof LedgerError ||
      error instanceof Prisma.PrismaClientKnownRequestError
    )
      throw error;
    throw new LedgerError("LEDGER_INTERNAL", { cause: error });
  }
};

const allocateAvailable = (
  wallet: Wallet,
  magnitude: bigint,
  order: readonly FundSource[],
) => {
  let remaining = magnitude;
  const allocation = {
    nonReferralUnits: 0n,
    referralUnits: 0n,
    grossUnits: magnitude,
  };
  for (const source of order) {
    const available =
      source === FundSource.NON_REFERRAL
        ? wallet.availableNonReferralUnits
        : wallet.availableReferralUnits;
    const consumed = available < remaining ? available : remaining;
    if (source === FundSource.NON_REFERRAL)
      allocation.nonReferralUnits = consumed;
    else allocation.referralUnits = consumed;
    remaining -= consumed;
  }
  if (remaining !== 0n) throw new LedgerError("LEDGER_INSUFFICIENT_FUNDS");
  return allocation;
};

const sourcePostings = (
  allocation: { nonReferralUnits: bigint; referralUnits: bigint },
  movement: "PURCHASE" | "RESERVE" | "RELEASE",
): SourceMovement[] => {
  const sourceAmounts = [
    { source: FundSource.NON_REFERRAL, units: allocation.nonReferralUnits },
    { source: FundSource.REFERRAL, units: allocation.referralUnits },
  ];
  return sourceAmounts
    .filter(({ units }) => units !== 0n)
    .map(({ source, units }) => ({
      source,
      availableDeltaUnits: movement === "RELEASE" ? units : -units,
      reservedDeltaUnits:
        movement === "PURCHASE" ? 0n : movement === "RELEASE" ? -units : units,
    }));
};

const applyDelta = (units: bigint, delta: bigint): bigint =>
  delta < 0n ? subtractUnits(units, -delta) : addUnits(units, delta);
const walletAfter = (
  wallet: Wallet,
  postings: readonly SourceMovement[],
): WalletAmounts => {
  const after: WalletAmounts = {
    availableNonReferralUnits: wallet.availableNonReferralUnits,
    availableReferralUnits: wallet.availableReferralUnits,
    reservedNonReferralUnits: wallet.reservedNonReferralUnits,
    reservedReferralUnits: wallet.reservedReferralUnits,
  };
  try {
    for (const posting of postings) {
      if (posting.source === FundSource.NON_REFERRAL) {
        after.availableNonReferralUnits = applyDelta(
          after.availableNonReferralUnits,
          posting.availableDeltaUnits,
        );
        after.reservedNonReferralUnits = applyDelta(
          after.reservedNonReferralUnits,
          posting.reservedDeltaUnits,
        );
      } else {
        after.availableReferralUnits = applyDelta(
          after.availableReferralUnits,
          posting.availableDeltaUnits,
        );
        after.reservedReferralUnits = applyDelta(
          after.reservedReferralUnits,
          posting.reservedDeltaUnits,
        );
      }
    }
    totalUnits(Object.values(after));
    return after;
  } catch (error) {
    if (error instanceof RangeError)
      throw new LedgerError("LEDGER_AMOUNT_BOUNDS");
    throw error;
  }
};

const eligibleGrant = async (
  context: LedgerContext,
  scope: LedgerGuardScope,
): Promise<FundSource[]> => {
  const getEligibility = context.eligibleSources;
  if (getEligibility === undefined) throw new LedgerError("LEDGER_FORBIDDEN");
  const grant: FundSource[] = [];
  await runAuthorityGuard(async () => {
    const parsed = eligibleFundSourcesSchema.safeParse(
      await getEligibility(scope),
    );
    if (!parsed.success) throw new LedgerError("LEDGER_FORBIDDEN");
    grant.push(...parsed.data);
  });
  return WITHDRAWAL_SOURCE_ORDER.filter((source) => grant.includes(source));
};

export const planNewEffect = async (
  intent: LedgerIntent,
  context: LedgerContext,
  scope: LedgerGuardScope,
): Promise<PlannedEffect> => {
  const walletBefore = mapWalletComponents(scope.wallet);
  if (intent.kind === "RELEASE") return planRelease(intent, context, scope);
  const magnitudeUnits = parseUsdtAmount(intent.amount);
  if (intent.kind === "CREDIT") {
    const postings = [
      {
        source: intent.source,
        availableDeltaUnits: magnitudeUnits,
        reservedDeltaUnits: 0n,
      },
    ];
    return {
      magnitudeUnits,
      origin: intent.origin,
      terms: { kind: intent.kind, walletBefore, source: intent.source },
      postings,
      after: walletAfter(scope.wallet, postings),
    };
  }
  if (intent.kind === "CORRECTION") {
    if (scope.actorAccount?.role !== UserRole.ADMIN)
      throw new LedgerError("LEDGER_FORBIDDEN");
    const reference = await scope.transaction.financialOperation.findFirst({
      where: { id: intent.referenceOperationId, walletId: intent.walletId },
      select: { id: true },
    });
    if (reference === null) throw new LedgerError("LEDGER_FORBIDDEN");
    const available =
      intent.source === FundSource.NON_REFERRAL
        ? scope.wallet.availableNonReferralUnits
        : scope.wallet.availableReferralUnits;
    if (intent.direction === "DEBIT" && magnitudeUnits > available)
      throw new LedgerError("LEDGER_INSUFFICIENT_FUNDS");
    const postings = [
      {
        source: intent.source,
        availableDeltaUnits:
          intent.direction === "CREDIT" ? magnitudeUnits : -magnitudeUnits,
        reservedDeltaUnits: 0n,
      },
    ];
    return {
      magnitudeUnits,
      origin: FinancialOrigin.ADMIN_ADJUSTMENT,
      terms: {
        kind: intent.kind,
        walletBefore,
        source: intent.source,
        direction: intent.direction,
        reason: intent.reason,
        referenceOperationId: intent.referenceOperationId,
      },
      postings,
      after: walletAfter(scope.wallet, postings),
    };
  }
  if (intent.kind === "PURCHASE_DEBIT") {
    const allocation = allocateAvailable(
      scope.wallet,
      magnitudeUnits,
      PURCHASE_SOURCE_ORDER,
    );
    const postings = sourcePostings(allocation, "PURCHASE");
    return {
      magnitudeUnits,
      origin: FinancialOrigin.PACKAGE_PURCHASE,
      terms: { kind: intent.kind, walletBefore },
      postings,
      after: walletAfter(scope.wallet, postings),
    };
  }
  const eligibleSources = await eligibleGrant(context, scope);
  const allocation = {
    id: intent.reservationId,
    ...allocateAvailable(scope.wallet, magnitudeUnits, eligibleSources),
  };
  const postings = sourcePostings(allocation, "RESERVE");
  mapSourceAllocation(allocation);
  return {
    magnitudeUnits,
    origin: FinancialOrigin.WITHDRAWAL_RESERVATION,
    terms: {
      kind: intent.kind,
      walletBefore,
      reservationId: intent.reservationId,
      eligibleSources,
    },
    postings,
    allocation,
    after: walletAfter(scope.wallet, postings),
  };
};

const planRelease = async (
  intent: Extract<LedgerIntent, { kind: "RELEASE" }>,
  context: LedgerContext,
  scope: LedgerGuardScope,
): Promise<PlannedEffect> => {
  const allocation: ReservationAllocation | null =
    await scope.transaction.reservationAllocation.findUnique({
      where: { id: intent.reservationId },
    });
  if (allocation === null || allocation.walletId !== intent.walletId)
    throw new LedgerError("LEDGER_FORBIDDEN");
  if (allocation.state !== "ACTIVE")
    throw new LedgerError("LEDGER_RESERVATION_CLOSED");
  const assertSafeRelease = context.releaseSafety;
  if (assertSafeRelease === undefined)
    throw new LedgerError("LEDGER_FORBIDDEN");
  await runAuthorityGuard(() =>
    assertSafeRelease({
      ...scope,
      allocation: Object.freeze({ ...allocation }),
    }),
  );
  const postings = sourcePostings(allocation, "RELEASE");
  return {
    magnitudeUnits: allocation.grossUnits,
    origin: FinancialOrigin.RESERVATION_RELEASE,
    terms: {
      kind: intent.kind,
      walletBefore: mapWalletComponents(scope.wallet),
      reservationId: allocation.id,
    },
    allocation,
    postings,
    after: walletAfter(scope.wallet, postings),
  };
};
