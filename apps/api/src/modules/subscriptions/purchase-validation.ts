import type { Prisma, PurchaseQuote, Wallet } from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { currentSubscription } from "./subscriptions.service.js";
import { purchaseAction, referralRates } from "./purchase-quote.service.js";
import { PurchaseError } from "./subscriptions.errors.js";
import { savedTermColumns } from "../packages/packages.mapper.js";

function assertWalletSnapshot(quote: PurchaseQuote, wallet: Wallet) {
  const unchanged =
    quote.availableReferralUnits === wallet.availableReferralUnits &&
    quote.reservedReferralUnits === wallet.reservedReferralUnits &&
    quote.availableNonReferralUnits === wallet.availableNonReferralUnits &&
    quote.reservedNonReferralUnits === wallet.reservedNonReferralUnits;
  if (!unchanged) throw new PurchaseError("PURCHASE_QUOTE_STALE");
}

export async function readFreshPurchase(input: {
  transaction: Prisma.TransactionClient;
  quote: PurchaseQuote;
  walletId: string;
  now: Date;
}) {
  const { transaction, quote, now } = input;
  const configured = await transaction.package.findUniqueOrThrow({
    where: { code: quote.packageCode },
  });
  const settings = await transaction.referralSettings.findUniqueOrThrow({
    where: { id: 1 },
  });
  const previous = await currentSubscription(transaction, quote.buyerId);
  const latest = await transaction.purchase.findFirst({
    where: { buyerId: quote.buyerId },
    orderBy: { buyerSequence: "desc" },
  });
  if (
    now >= quote.expiresAt ||
    configured.version !== quote.packageVersion ||
    settings.version !== quote.referralSettingsVersion
  )
    throw new PurchaseError("PURCHASE_QUOTE_STALE");
  if (
    (latest?.buyerSequence ?? 0n) !== quote.expectedBuyerPurchaseSequence ||
    (previous?.id ?? null) !== quote.observedSubscriptionId
  )
    throw new PurchaseError("PURCHASE_QUOTE_STALE");
  const wallet = await transaction.wallet.findUniqueOrThrow({
    where: { id: input.walletId },
  });
  assertWalletSnapshot(quote, wallet);
  const term = new BusinessClock(() => now).subscriptionTerm(
    now.toISOString(),
    configured.countedWorkDates,
  );
  if (
    term.firstWorkDate !== quote.firstWorkDate.toISOString().slice(0, 10) ||
    term.finalWorkDate !== quote.finalWorkDate.toISOString().slice(0, 10) ||
    term.expiresAt !== quote.subscriptionExpiresAt.toISOString()
  )
    throw new PurchaseError("PURCHASE_QUOTE_STALE");
  const action = purchaseAction(configured, previous, now);
  if (action !== quote.action) throw new PurchaseError("PURCHASE_QUOTE_STALE");
  const difference =
    action === "UPGRADE" && previous !== null
      ? configured.priceUnits - previous.priceUnits
      : configured.priceUnits;
  return {
    previous,
    action,
    base: difference > 0n ? difference : 0n,
    terms: savedTermColumns(configured),
    rates: referralRates(settings),
    referralSettingsVersion: settings.version,
  };
}

export type FreshPurchase = Awaited<ReturnType<typeof readFreshPurchase>>;
