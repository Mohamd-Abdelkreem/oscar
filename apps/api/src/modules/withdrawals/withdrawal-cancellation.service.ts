import type { Prisma, WithdrawalRequest } from "@template/database";
import type {
  LedgerContext,
  TransactionLedger,
} from "../ledger/ledger.types.js";
import { LedgerError } from "../ledger/ledger.errors.js";
import { WithdrawalError } from "./withdrawals.errors.js";

export async function lockWithdrawalRequest(
  transaction: Prisma.TransactionClient,
  request: Pick<WithdrawalRequest, "id" | "destinationId" | "quoteId">,
) {
  await transaction.$queryRaw`SELECT id FROM withdrawal_destinations WHERE id=${request.destinationId}::uuid FOR SHARE`;
  await transaction.$queryRaw`SELECT id FROM withdrawal_quotes WHERE id=${request.quoteId}::uuid FOR SHARE`;
  await transaction.$queryRaw`SELECT id FROM withdrawal_requests WHERE id=${request.id}::uuid FOR UPDATE`;
  return transaction.withdrawalRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
}

export function withdrawalReleaseContext(
  actorId: string,
  walletId: string,
  clock: () => Date,
): LedgerContext {
  const guard: LedgerContext["mutate"] = async (scope) => {
    if (
      scope.actor.type !== "USER" ||
      scope.actor.userId !== actorId ||
      scope.actorAccount?.role !== "ADMIN" ||
      scope.intent.kind !== "RELEASE" ||
      scope.intent.businessNamespace !== "p08.withdrawal.release" ||
      scope.wallet.id !== walletId
    )
      throw new LedgerError("LEDGER_FORBIDDEN");
    const request = await scope.transaction.withdrawalRequest.findUnique({
      where: { id: scope.intent.businessKey },
    });
    if (
      request === null ||
      request.walletId !== walletId ||
      request.reservationId !== scope.intent.reservationId
    )
      throw new LedgerError("LEDGER_FORBIDDEN");
  };
  return {
    actor: { type: "USER", userId: actorId },
    walletIds: [walletId],
    clock,
    observe: guard,
    mutate: guard,
    releaseSafety: async (scope) => {
      await guard(scope);
      const request =
        await scope.transaction.withdrawalRequest.findUniqueOrThrow({
          where: { id: scope.intent.businessKey },
        });
      if (
        request.state !== "SCHEDULED" ||
        scope.allocation.state !== "ACTIVE" ||
        scope.allocation.grossUnits !== request.grossUnits ||
        scope.allocation.nonReferralUnits !== request.nonReferralUnits ||
        scope.allocation.referralUnits !== request.referralUnits
      )
        throw new WithdrawalError("WITHDRAWAL_STATE_CONFLICT");
    },
  };
}

// Call only after admission/users/wallet/allocations/session/domain locks, using the outer ledger client.
export async function cancelScheduledWithdrawal(
  transaction: Prisma.TransactionClient,
  ledger: TransactionLedger,
  request: WithdrawalRequest,
  action: {
    actorUserId: string;
    kind: "REJECT" | "RESTRICTION_CANCEL" | "FUTURE_DESTINATION_CANCEL";
    intentHash: string;
    reason: string;
    requestKey?: string;
    now: Date;
  },
): Promise<boolean> {
  if (request.state !== "SCHEDULED") return false;
  if (request.version === 2147483647)
    throw new WithdrawalError("WITHDRAWAL_VERSION_CONFLICT");
  const state = action.kind === "REJECT" ? "REJECTED" : "CANCELLED";
  await ledger.releaseReservation(
    {
      kind: "RELEASE",
      walletId: request.walletId,
      reservationId: request.reservationId,
      businessNamespace: "p08.withdrawal.release",
      businessKey: request.id,
    },
    async (_domain, operation) => {
      await transaction.withdrawalRequest.update({
        where: { id: request.id },
        data: {
          state,
          version: { increment: 1 },
          finalizedAt: action.now,
          releaseOperationId: operation.operationId,
        },
      });
      await transaction.withdrawalAction.create({
        data: {
          requestId: request.id,
          actorUserId: action.actorUserId,
          actorScope: `user:${action.actorUserId}`,
          kind: action.kind,
          intentHash: action.intentHash,
          reason: action.reason,
          confirmed: true,
          ...(action.requestKey === undefined
            ? {}
            : { requestKey: action.requestKey }),
          expectedVersion: request.version,
          committedVersion: request.version + 1,
          occurredAt: action.now,
          beforeState: request.state,
          afterState: state,
          beforeDueAt: request.dueAt,
          afterDueAt: request.dueAt,
          beforeScheduleVersion: request.scheduleVersion,
          afterScheduleVersion: request.scheduleVersion,
          financialOperationId: operation.operationId,
        },
      });
    },
  );
  return true;
}
