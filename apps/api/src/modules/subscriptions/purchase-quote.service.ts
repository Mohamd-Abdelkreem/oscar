import { createHash } from "node:crypto";
import {
  purchaseQuoteBodySchema,
  purchaseQuoteSchema,
  quoteOutcomeSchema,
} from "@template/contracts";
import {
  Prisma,
  type DatabaseClient,
  type PurchaseQuote,
  type Package,
  type Subscription,
} from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { NotFoundException } from "../../core/errors/index.js";
import { formatUsdtAmount } from "../../core/financial/money.js";
import {
  lockIdentityUsers,
  readSessionAuthority,
} from "../auth/session-authority.js";
import {
  mapPackageTerms,
  savedTermColumns,
} from "../packages/packages.mapper.js";
import {
  mapPurchase,
  isEffectiveSubscription,
  purchaseOutcomeInclude,
} from "./subscriptions.mapper.js";
import {
  currentSubscription,
  type SubscriptionIdentity,
} from "./subscriptions.service.js";
import { PurchaseError } from "./subscriptions.errors.js";

export const referralRates = (settings: {
  level1Bps: number;
  level2Bps: number;
  level3Bps: number;
  level4Bps: number;
  level5Bps: number;
}) => [
  settings.level1Bps,
  settings.level2Bps,
  settings.level3Bps,
  settings.level4Bps,
  settings.level5Bps,
];

export function purchaseAction(
  configured: Package,
  previous: Subscription | null,
  now: Date,
) {
  if (!isEffectiveSubscription(previous, now)) return "PURCHASE" as const;
  if (previous === null || configured.tierOrder <= previous.tierOrder)
    throw new PurchaseError("PURCHASE_TRANSITION_DENIED");
  return "UPGRADE" as const;
}

export function mapQuote(quote: PurchaseQuote, now: Date) {
  return purchaseQuoteSchema.parse({
    quoteId: quote.id,
    packageCode: quote.packageCode,
    action: quote.action,
    terms: quote.acceptedTerms,
    quotedAt: quote.createdAt.toISOString(),
    quoteExpiresAt: quote.expiresAt.toISOString(),
    serverNow: now.toISOString(),
    previousSubscriptionId: quote.observedSubscriptionId,
    fullDebit: formatUsdtAmount(quote.fullDebitUnits),
    usableFunds: formatUsdtAmount(quote.usableUnits),
    fundedAllocation: {
      referral: formatUsdtAmount(quote.fundedReferralUnits),
      nonReferral: formatUsdtAmount(quote.fundedNonReferralUnits),
      total: formatUsdtAmount(
        quote.fundedReferralUnits + quote.fundedNonReferralUnits,
      ),
    },
    requiredTopUp: formatUsdtAmount(quote.topUpUnits),
    canPurchase: quote.topUpUnits === 0n,
    blockReason: quote.topUpUnits === 0n ? null : "INSUFFICIENT_FUNDS",
    preview: {
      firstWorkDate: quote.firstWorkDate.toISOString().slice(0, 10),
      finalWorkDate: quote.finalWorkDate.toISOString().slice(0, 10),
      expiresAt: quote.subscriptionExpiresAt.toISOString(),
    },
  });
}

export class PurchaseQuoteService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async create(identity: SubscriptionIdentity, rawBody: unknown) {
    const body = purchaseQuoteBodySchema.parse(rawBody);
    return this.database.$transaction(
      async (transaction) => {
        await lockIdentityUsers(transaction, {
          userIds: [identity.userId],
          adminPopulation: false,
        });
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, "USER");
        const configured = await transaction.package.findUniqueOrThrow({
          where: { code: body.packageCode },
        });
        const settings = await transaction.referralSettings.findUniqueOrThrow({
          where: { id: 1 },
        });
        const previous = await currentSubscription(
          transaction,
          identity.userId,
        );
        const action = purchaseAction(configured, previous, now);
        const wallet = await transaction.wallet.findUniqueOrThrow({
          where: { ownerUserId: identity.userId },
        });
        const latest = await transaction.purchase.findFirst({
          where: { buyerId: identity.userId },
          orderBy: { buyerSequence: "desc" },
        });
        const usable =
          wallet.availableReferralUnits + wallet.availableNonReferralUnits;
        const funded =
          usable < configured.priceUnits ? usable : configured.priceUnits;
        const referral =
          wallet.availableReferralUnits < funded
            ? wallet.availableReferralUnits
            : funded;
        const term = new BusinessClock(this.clock).subscriptionTerm(
          now.toISOString(),
          configured.countedWorkDates,
        );
        const quote = await transaction.purchaseQuote.create({
          data: {
            ...savedTermColumns(configured),
            buyerId: identity.userId,
            createdAt: now,
            expiresAt: new Date(now.getTime() + 600000),
            referralSettingsVersion: settings.version,
            savedRatesBps: referralRates(settings),
            expectedBuyerPurchaseSequence: latest?.buyerSequence ?? 0n,
            observedSubscriptionId: previous?.id ?? null,
            action,
            availableReferralUnits: wallet.availableReferralUnits,
            reservedReferralUnits: wallet.reservedReferralUnits,
            availableNonReferralUnits: wallet.availableNonReferralUnits,
            reservedNonReferralUnits: wallet.reservedNonReferralUnits,
            fullDebitUnits: configured.priceUnits,
            usableUnits: usable,
            topUpUnits: configured.priceUnits - funded,
            fundedReferralUnits: referral,
            fundedNonReferralUnits: funded - referral,
            firstWorkDate: new Date(`${term.firstWorkDate}T00:00:00Z`),
            finalWorkDate: new Date(`${term.finalWorkDate}T00:00:00Z`),
            subscriptionExpiresAt: new Date(term.expiresAt),
            intentHash: createHash("sha256")
              .update(
                JSON.stringify([
                  identity.userId,
                  mapPackageTerms(configured),
                  action,
                  previous?.id ?? null,
                  (latest?.buyerSequence ?? 0n).toString(),
                ]),
              )
              .digest("hex"),
          },
        });
        return mapQuote(quote, now);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  async outcome(identity: SubscriptionIdentity, quoteId: string) {
    return this.database.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SET LOCAL lock_timeout = '5s'`;
        await lockIdentityUsers(transaction, {
          userIds: [identity.userId],
          adminPopulation: false,
        });
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, "USER");
        const quote = await transaction.purchaseQuote.findFirst({
          where: { id: quoteId, buyerId: identity.userId },
        });
        if (quote === null) throw new NotFoundException();
        const purchase = await transaction.purchase.findUnique({
          where: { quoteId },
          include: purchaseOutcomeInclude,
        });
        return quoteOutcomeSchema.parse(
          purchase === null
            ? {
                status:
                  now < quote.expiresAt
                    ? "NOT_OBSERVED"
                    : "EXPIRED_UNCOMMITTED",
                quoteId,
                quote: mapQuote(quote, now),
                serverNow: now.toISOString(),
              }
            : {
                status: "COMMITTED",
                quoteId,
                purchase: mapPurchase(purchase),
                serverNow: now.toISOString(),
              },
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }
}
