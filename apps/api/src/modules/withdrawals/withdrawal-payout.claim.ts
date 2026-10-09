import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WithdrawalAttempt } from "@template/database";
import { TronProviderError } from "../../infrastructure/tron/tron-provider.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import { recordPayoutAction } from "./withdrawal-payout.transaction.js";
import {
  assertPayoutPolicy,
  payoutIntentSchema,
  payoutIntentHash,
  payoutPolicy,
} from "./withdrawal-payout.intent.js";
import { checkPayoutResources } from "./withdrawal-payout.resources.js";
import {
  assertPayoutDispatchable,
  type PayoutExecution,
} from "./withdrawal-payout.execution.js";

export class PayoutClaim {
  constructor(private readonly context: PayoutExecution) {}
  async candidates(limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new TreasuryPolicyError();
    const rows = await this.context.database.withdrawalRequest.findMany({
      where: {
        state: "SCHEDULED",
        dispatchAt: { lte: new Date() },
        OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: new Date() } }],
      },
      select: { id: true },
      orderBy: [{ dispatchAt: "asc" }, { id: "asc" }],
      take: limit,
    });
    return rows.map((row) => row.id);
  }
  private async blocked(requestId: string, blocker: string) {
    return this.context.transactions.mutate(requestId, async (scope) => {
      if (
        ["COMPLETED", "FAILED", "REJECTED", "CANCELLED"].includes(
          scope.request.state,
        )
      )
        return;
      const nextCheckAt = new Date(
        Math.max(
          scope.now.getTime() + 30000,
          scope.request.nextCheckAt?.getTime() ?? 0,
          scope.attempt?.nextCheckAt.getTime() ?? 0,
        ),
      );
      await scope.transaction.withdrawalRequest.update({
        where: { id: requestId },
        data: { blocker, nextCheckAt },
      });
      if (scope.attempt !== null)
        await scope.transaction.withdrawalAttempt.update({
          where: { id: scope.attempt.id },
          data: { blocker, nextCheckAt, version: { increment: 1 } },
        });
    });
  }
  async claim(requestId: string): Promise<WithdrawalAttempt | null> {
    const reference =
      await this.context.database.withdrawalRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
    const existing = await this.context.database.withdrawalAttempt.findUnique({
      where: { withdrawalId: requestId },
    });
    if (existing !== null) return existing;
    let floor;
    try {
      floor = await checkPayoutResources(
        this.context.provider,
        this.context.config,
        reference.recipient,
        reference.netUnits,
      );
    } catch (error) {
      if (
        error instanceof TreasuryPolicyError &&
        ![
          "LIQUIDITY_SHORTFALL",
          "RESOURCE_SHORTFALL",
          "PROVIDER_UNAVAILABLE",
        ].includes(error.code)
      )
        throw error;
      if (
        !(error instanceof TronProviderError) &&
        !(error instanceof TreasuryPolicyError) &&
        !(error instanceof z.ZodError)
      )
        throw error;
      const blocker =
        error instanceof TreasuryPolicyError &&
        ["LIQUIDITY_SHORTFALL", "RESOURCE_SHORTFALL"].includes(error.code)
          ? error.code
          : "PROVIDER_UNAVAILABLE";
      await this.blocked(requestId, blocker);
      return null;
    }
    return this.context.transactions.dispatch(requestId, async (scope) => {
      if (scope.attempt !== null) return scope.attempt;
      if (
        scope.request.state !== "SCHEDULED" ||
        (scope.request.nextCheckAt !== null &&
          scope.request.nextCheckAt > scope.now)
      )
        return null;
      await assertPayoutDispatchable(scope);
      const occupied = await scope.transaction.withdrawalAttempt.findFirst({
        where: {
          network: scope.key.network,
          tokenContract: scope.key.tokenContract,
          source: scope.key.source,
          state: { notIn: ["CONFIRMED_SUCCESS", "CHAIN_FAILED"] },
        },
      });
      if (
        occupied !== null ||
        BigInt(floor.number) < scope.key.lastFinalBlockNumber
      ) {
        await scope.transaction.withdrawalRequest.update({
          where: { id: requestId },
          data: {
            blocker:
              occupied !== null ? "TREASURY_BUSY" : "PROVIDER_UNAVAILABLE",
            nextCheckAt: new Date(scope.now.getTime() + 30000),
          },
        });
        return null;
      }
      const intent = payoutIntentSchema.parse({
        operation: "WITHDRAWAL_PAYOUT",
        requestId,
        attemptId: randomUUID(),
        employeeId: scope.request.employeeId,
        walletId: scope.request.walletId,
        reservationId: scope.request.reservationId,
        treasuryKeyId: scope.key.id,
        network: scope.request.network,
        tokenContract: scope.key.tokenContract,
        source: scope.key.source,
        recipient: scope.request.recipient,
        addressVersion: scope.request.addressVersion,
        netUnits: String(scope.request.netUnits),
        termsHash: scope.request.termsHash,
        policy: payoutPolicy(this.context.config),
      });
      assertPayoutPolicy(intent, this.context.config);
      const after = await scope.transaction.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          state: "SIGNING",
          blocker: null,
          nextCheckAt: null,
          version: { increment: 1 },
        },
      });
      const attempt = await scope.transaction.withdrawalAttempt.create({
        data: {
          id: intent.attemptId,
          withdrawalId: requestId,
          employeeId: intent.employeeId,
          walletId: intent.walletId,
          treasuryKeyId: intent.treasuryKeyId,
          network: intent.network,
          tokenContract: intent.tokenContract,
          source: intent.source,
          recipient: intent.recipient,
          addressVersion: intent.addressVersion,
          grossUnits: scope.request.grossUnits,
          feeUnits: scope.request.feeUnits,
          netUnits: scope.request.netUnits,
          termsHash: intent.termsHash,
          intentHash: payoutIntentHash(intent),
          policySnapshot: intent.policy,
          initialFloorNumber: BigInt(floor.number),
          initialFloorId: floor.id,
          nextCheckAt: scope.now,
          createdAt: scope.now,
        },
      });
      await recordPayoutAction({ ...scope, attempt }, "CLAIM", after);
      return attempt;
    });
  }
}
