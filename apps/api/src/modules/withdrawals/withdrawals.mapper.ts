import {
  withdrawalDestinationSchema,
  withdrawalRequestSchema,
  type WithdrawalDestination as DestinationProjection,
} from "@template/contracts";
import type { WithdrawalDestination, Prisma } from "@template/database";
import { z } from "zod";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { WITHDRAWAL_CALENDAR } from "./withdrawal-quote.service.js";
import { payoutSettlementTerms } from "./withdrawal-settlement.service.js";

export const withdrawalReadInclude = {
  attempt: {
    select: {
      id: true,
      transactionId: true,
      tokenContract: true,
      source: true,
      finalBlockNumber: true,
      finalBlockId: true,
    },
  },
  actions: { orderBy: [{ committedVersion: "desc" }], take: 100 },
} satisfies Prisma.WithdrawalRequestInclude;
type SavedWithdrawal = Prisma.WithdrawalRequestGetPayload<{
  include: typeof withdrawalReadInclude;
}>;

export function mapWithdrawalRequest(request: SavedWithdrawal, now: Date) {
  const remaining = new BusinessClock(() => now).remainingCountedMilliseconds(
    now.toISOString(),
    request.dueAt.toISOString(),
  );
  const hoursMillionths = (remaining * 1000000n) / 3600000n;
  const fraction = (hoursMillionths % 1000000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/u, "");
  const sourceAllocation = {
    nonReferral: formatUsdtAmount(request.nonReferralUnits),
    referral: formatUsdtAmount(request.referralUnits),
    gross: formatUsdtAmount(request.grossUnits),
  };
  return withdrawalRequestSchema.parse({
    ...z.record(z.string(), z.unknown()).parse(request.eligibilitySnapshot),
    id: request.id,
    quoteId: request.quoteId,
    acceptedAt: request.acceptedAt.toISOString(),
    version: request.version,
    scheduleVersion: request.scheduleVersion,
    state: request.state,
    gross: formatUsdtAmount(request.grossUnits),
    feeBps: request.feeBps,
    fee: formatUsdtAmount(request.feeUnits),
    net: formatUsdtAmount(request.netUnits),
    network: request.network,
    recipient: request.recipient,
    addressVersion: request.addressVersion,
    sourceAllocation,
    calendar: WITHDRAWAL_CALENDAR,
    originalDueAt: request.originalDueAt.toISOString(),
    dueAt: request.dueAt.toISOString(),
    dispatchAt: request.dispatchAt.toISOString(),
    serverNow: now.toISOString(),
    remainingCountedMilliseconds: remaining.toString(),
    remainingCountedHours: `${(hoursMillionths / 1000000n).toString()}${fraction === "" ? "" : `.${fraction}`}`,
    actions: request.actions.map((action) => ({
      id: action.id,
      kind: action.kind,
      occurredAt: action.occurredAt.toISOString(),
      actorUserId: action.actorUserId,
      reason: action.reason,
      committedVersion: action.committedVersion,
      dueAt: action.afterDueAt.toISOString(),
      scheduleVersion: action.afterScheduleVersion,
    })),
    finalizedAt: request.finalizedAt?.toISOString() ?? null,
    transactionId: request.attempt?.transactionId ?? null,
    blocker: request.blocker,
    settlement:
      request.state === "COMPLETED" && request.attempt !== null
        ? payoutSettlementTerms(request, request.attempt)
        : null,
    release:
      request.releaseOperationId === null
        ? null
        : {
            gross: formatUsdtAmount(request.grossUnits),
            sourceAllocation,
            chargedFee: "0",
            releasedAt: request.finalizedAt?.toISOString(),
          },
  });
}

export function mapWithdrawalDestination(
  destination: WithdrawalDestination | null,
  now: Date,
): DestinationProjection {
  const serverNow = now.toISOString();
  if (destination === null) return { state: "UNSET", serverNow };
  if (destination.address !== null)
    return withdrawalDestinationSchema.parse({
      state: "CONFIRMED",
      serverNow,
      network: destination.network,
      address: destination.address,
      addressVersion: destination.addressVersion,
      confirmedAt: destination.confirmedAt?.toISOString(),
    });
  return withdrawalDestinationSchema.parse({
    state: "PENDING",
    serverNow,
    network: destination.network,
    address: destination.pendingAddress,
    version: destination.version,
    issuedAt: destination.issuedAt?.toISOString(),
    expiresAt: destination.expiresAt?.toISOString(),
    nextIssuanceAt: destination.nextIssuanceAt?.toISOString(),
    proofStatus:
      destination.expiresAt !== null && now >= destination.expiresAt
        ? "EXPIRED"
        : "PENDING",
    deliveryStatus: destination.deliveryStatus,
  });
}
