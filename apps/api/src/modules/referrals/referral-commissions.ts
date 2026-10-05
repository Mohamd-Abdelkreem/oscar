import type { DatabaseClient, Prisma } from "@template/database";
import {
  formatUsdtAmount,
  percentageUnits,
} from "../../core/financial/money.js";
import { LedgerError } from "../ledger/ledger.errors.js";
import type { TransactionLedger } from "../ledger/ledger.types.js";
import { currentSubscription } from "../subscriptions/subscriptions.service.js";
import { isEffectiveSubscription } from "../subscriptions/subscriptions.mapper.js";

export type ReferralParticipant = Readonly<{
  userId: string;
  walletId: string | null;
  level: number;
}>;

export async function resolveReferralParticipants(
  database: DatabaseClient,
  buyerId: string,
): Promise<ReferralParticipant[]> {
  const participants: ReferralParticipant[] = [];
  let child = await database.user.findUniqueOrThrow({
    where: { id: buyerId },
    select: { sponsorUserId: true },
  });
  for (let level = 1; level <= 5 && child.sponsorUserId !== null; level += 1) {
    const ancestor = await database.user.findUniqueOrThrow({
      where: { id: child.sponsorUserId },
      select: {
        id: true,
        sponsorUserId: true,
        wallet: { select: { id: true } },
      },
    });
    participants.push({
      userId: ancestor.id,
      walletId: ancestor.wallet?.id ?? null,
      level,
    });
    child = ancestor;
  }
  return participants;
}

export async function awardReferralCommissions(input: {
  transaction: Prisma.TransactionClient;
  ledger: TransactionLedger;
  participants: readonly ReferralParticipant[];
  purchaseId: string;
  baseUnits: bigint;
  rates: readonly number[];
  now: Date;
}) {
  const { transaction, ledger, purchaseId, baseUnits, rates, now } = input;
  for (const participant of input.participants) {
    const user = await transaction.user.findUniqueOrThrow({
      where: { id: participant.userId },
    });
    const subscription = await currentSubscription(transaction, user.id);
    const skippedReason =
      user.status === "BANNED"
        ? "BANNED"
        : user.status !== "ACTIVE" ||
            user.role !== "USER" ||
            user.emailVerifiedAt === null
          ? "ACCOUNT_UNAVAILABLE"
          : subscription === null
            ? "FREE"
            : !isEffectiveSubscription(subscription, now)
              ? "EXPIRED"
              : null;
    const rateBps = rates[participant.level - 1];
    if (rateBps === undefined) throw new LedgerError("LEDGER_INTERNAL");
    if (skippedReason === null && participant.walletId === null)
      throw new LedgerError("LEDGER_INTERNAL");
    const awardUnits =
      skippedReason === null ? percentageUnits(baseUnits, rateBps) : 0n;
    const decision = {
      purchaseId,
      recipientUserId: user.id,
      level: participant.level,
      rateBps,
      commissionBaseUnits: baseUnits,
      awardUnits,
      recipientSubscriptionId: subscription?.id ?? null,
      occurredAt: now,
      eligibilitySnapshot: {
        role: user.role,
        status: user.status,
        accountVersion: user.accountVersion,
        emailVerified: user.emailVerifiedAt !== null,
        subscriptionId: subscription?.id ?? null,
        packageVersion: subscription?.packageVersion ?? null,
        expiresAt: subscription?.expiresAt.toISOString() ?? null,
        effectivePaid: isEffectiveSubscription(subscription, now),
      },
    };
    if (skippedReason !== null) {
      await transaction.referralDecision.create({
        data: { ...decision, decision: "SKIPPED", skippedReason },
      });
    } else if (awardUnits === 0n) {
      const zeroReason =
        baseUnits === 0n
          ? "ZERO_BASE"
          : rateBps === 0
            ? "ZERO_RATE"
            : "FLOORED_ZERO";
      await transaction.referralDecision.create({
        data: { ...decision, decision: "ELIGIBLE_ZERO", zeroReason },
      });
    } else {
      if (participant.walletId === null)
        throw new LedgerError("LEDGER_INTERNAL");
      await ledger.credit(
        {
          kind: "CREDIT",
          walletId: participant.walletId,
          businessNamespace: "p04.referral",
          businessKey: `${purchaseId}:${user.id}:${String(participant.level)}`,
          amount: formatUsdtAmount(awardUnits),
          source: "REFERRAL",
          origin: "REFERRAL_COMMISSION",
        },
        async (creditTransaction, operation) => {
          await creditTransaction.referralDecision.create({
            data: {
              ...decision,
              decision: "AWARDED",
              creditOperationId: operation.operationId,
            },
          });
        },
      );
    }
  }
}
