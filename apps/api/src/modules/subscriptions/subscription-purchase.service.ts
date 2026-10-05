import {
  confirmedPurchaseBodySchema,
  financialRequestKeySchema,
  purchaseCommandResultSchema,
  type FinancialOperationResult,
} from "@template/contracts";
import type { DatabaseClient, PurchaseQuote, Prisma } from "@template/database";
import { NotFoundException } from "../../core/errors/index.js";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { AuthSessionService } from "../auth/auth-session.service.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import { LedgerError } from "../ledger/ledger.errors.js";
import { LedgerService } from "../ledger/ledger.service.js";
import type {
  LedgerContext,
  LedgerGuardScope,
  TransactionLedger,
  PurchaseDebitIntent,
} from "../ledger/ledger.types.js";
import {
  awardReferralCommissions,
  resolveReferralParticipants,
  type ReferralParticipant,
} from "../referrals/referral-commissions.js";
import { mapPurchase, purchaseOutcomeInclude } from "./subscriptions.mapper.js";
import { PurchaseError } from "./subscriptions.errors.js";
import type { SubscriptionIdentity } from "./subscriptions.service.js";
import {
  readFreshPurchase,
  type FreshPurchase,
} from "./purchase-validation.js";

type PurchaseAttempt = {
  identity: SubscriptionIdentity;
  quote: PurchaseQuote;
  walletId: string;
  participants: readonly ReferralParticipant[];
  requestKey: string | undefined;
};

function purchaseLedgerGuard(attempt: PurchaseAttempt) {
  return (scope: LedgerGuardScope): Promise<void> => {
    const buyerDebit =
      scope.intent.kind === "PURCHASE_DEBIT" &&
      scope.wallet.id === attempt.walletId &&
      scope.intent.businessNamespace === "p04.purchase" &&
      scope.intent.businessKey === attempt.quote.id;
    const ancestorCredit =
      scope.intent.kind === "CREDIT" &&
      scope.intent.businessNamespace === "p04.referral" &&
      attempt.participants.some(
        (ancestor) => ancestor.walletId === scope.wallet.id,
      );
    if (
      (!buyerDebit && !ancestorCredit) ||
      scope.actor.type !== "USER" ||
      scope.actor.userId !== attempt.identity.userId
    )
      throw new LedgerError("LEDGER_FORBIDDEN");
    return Promise.resolve();
  };
}

export class SubscriptionPurchaseService {
  private readonly ledger: LedgerService;
  private readonly sessions = new AuthSessionService();
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.ledger = new LedgerService(database, {
      businessNamespaces: ["p04.purchase", "p04.referral"],
      processIds: [],
    });
  }

  async purchase(
    identity: SubscriptionIdentity,
    rawBody: unknown,
    rawKey?: string,
  ) {
    const body = confirmedPurchaseBodySchema.parse(rawBody);
    const requestKey =
      rawKey === undefined
        ? undefined
        : financialRequestKeySchema.parse(rawKey);
    const quote = await this.database.purchaseQuote.findFirst({
      where: { id: body.quoteId, buyerId: identity.userId },
    });
    if (quote === null) throw new NotFoundException();
    const wallet = await this.database.wallet.findUniqueOrThrow({
      where: { ownerUserId: identity.userId },
    });
    const participants = await resolveReferralParticipants(
      this.database,
      identity.userId,
    );
    const attempt: PurchaseAttempt = {
      identity,
      quote,
      walletId: wallet.id,
      participants,
      requestKey,
    };
    return this.runAttempt(attempt);
  }

  private async runAttempt(attempt: PurchaseAttempt) {
    // Each retry captures its event instant after the compatible participant/session/configuration locks.
    let eventTime: Date | undefined;
    const guard = purchaseLedgerGuard(attempt);
    const context: LedgerContext = {
      actor: { type: "USER", userId: attempt.identity.userId },
      walletIds: [
        attempt.walletId,
        ...attempt.participants.flatMap((ancestor) =>
          ancestor.walletId === null ? [] : [ancestor.walletId],
        ),
      ],
      authorityUserIds: attempt.participants.map((ancestor) => ancestor.userId),
      clock: () => {
        if (eventTime === undefined) throw new LedgerError("LEDGER_INTERNAL");
        return eventTime;
      },
      observe: guard,
      mutate: guard,
    };
    return this.ledger.runInTransaction(
      context,
      async (transaction, ledger) => {
        await this.sessions.lockSessions(transaction, attempt.identity.userId);
        await transaction.$queryRaw`SELECT code FROM packages WHERE code=${attempt.quote.packageCode} FOR UPDATE`;
        await transaction.$queryRaw`SELECT id FROM referral_settings WHERE id=1 FOR UPDATE`;
        eventTime = this.clock();
        await readSessionAuthority(
          transaction,
          attempt.identity,
          eventTime,
          "USER",
        );
        return this.commitOrReplay({
          transaction,
          ledger,
          attempt,
          now: eventTime,
        });
      },
    );
  }

  private async commitOrReplay(input: {
    transaction: Prisma.TransactionClient;
    ledger: TransactionLedger;
    attempt: PurchaseAttempt;
    now: Date;
  }) {
    const { transaction, ledger, attempt, now } = input;
    const existing = await transaction.purchase.findUnique({
      where: { quoteId: attempt.quote.id },
      include: purchaseOutcomeInclude,
    });
    const debit: PurchaseDebitIntent = {
      kind: "PURCHASE_DEBIT",
      walletId: attempt.walletId,
      businessNamespace: "p04.purchase",
      businessKey: attempt.quote.id,
      amount: formatUsdtAmount(
        existing?.fullDebitUnits ?? attempt.quote.fullDebitUnits,
      ),
      ...(attempt.requestKey === undefined
        ? {}
        : { requestKey: attempt.requestKey }),
    };
    if (existing !== null) {
      const reply = await ledger.debitForPurchase(debit);
      if (!reply.replayed) throw new LedgerError("LEDGER_INTERNAL");
      return purchaseCommandResultSchema.parse({
        purchase: mapPurchase(existing),
        replayed: true,
      });
    }
    const fresh = await readFreshPurchase({
      transaction,
      quote: attempt.quote,
      walletId: attempt.walletId,
      now,
    });
    await ledger.debitForPurchase(debit, (debitTransaction, operation) =>
      this.createPurchasedTerm({
        transaction: debitTransaction,
        quote: attempt.quote,
        fresh,
        now,
        operation,
      }),
    );
    const purchase = await transaction.purchase.findUniqueOrThrow({
      where: { quoteId: attempt.quote.id },
      include: purchaseOutcomeInclude,
    });
    await awardReferralCommissions({
      transaction,
      ledger,
      participants: attempt.participants,
      purchaseId: purchase.id,
      baseUnits: fresh.base,
      rates: fresh.rates,
      now,
    });
    return purchaseCommandResultSchema.parse({
      purchase: mapPurchase(purchase),
      replayed: false,
    });
  }

  private async createPurchasedTerm(input: {
    transaction: Prisma.TransactionClient;
    quote: PurchaseQuote;
    fresh: FreshPurchase;
    now: Date;
    operation: FinancialOperationResult;
  }) {
    const { transaction, quote, fresh, now, operation } = input;
    const purchase = await transaction.purchase.create({
      data: {
        ...fresh.terms,
        quoteId: quote.id,
        buyerId: quote.buyerId,
        buyerSequence: quote.expectedBuyerPurchaseSequence + 1n,
        action: fresh.action,
        previousSubscriptionId: fresh.previous?.id ?? null,
        debitOperationId: operation.operationId,
        purchasedAt: now,
        fullDebitUnits: quote.fullDebitUnits,
        sourceReferralUnits: quote.fundedReferralUnits,
        sourceNonReferralUnits: quote.fundedNonReferralUnits,
        commissionBaseUnits: fresh.base,
        referralSettingsVersion: fresh.referralSettingsVersion,
        savedRatesBps: fresh.rates,
      },
    });
    await this.replaceSubscription({
      transaction,
      fresh,
      purchaseId: purchase.id,
      now,
    });
    await transaction.subscription.create({
      data: {
        ...fresh.terms,
        ownerUserId: quote.buyerId,
        purchaseId: purchase.id,
        activationAt: now,
        firstWorkDate: quote.firstWorkDate,
        finalWorkDate: quote.finalWorkDate,
        expiresAt: quote.subscriptionExpiresAt,
      },
    });
  }

  private async replaceSubscription(input: {
    transaction: Prisma.TransactionClient;
    fresh: FreshPurchase;
    purchaseId: string;
    now: Date;
  }) {
    const { transaction, fresh, purchaseId, now } = input;
    if (fresh.previous === null) return;
    const changed = await transaction.subscription.updateMany({
      where: { id: fresh.previous.id, state: "CURRENT" },
      data:
        fresh.action === "UPGRADE"
          ? {
              state: "REPLACED",
              replacedAt: now,
              replacementPurchaseId: purchaseId,
            }
          : { state: "EXPIRED" },
    });
    if (changed.count !== 1) throw new PurchaseError("PURCHASE_QUOTE_STALE");
  }
}
