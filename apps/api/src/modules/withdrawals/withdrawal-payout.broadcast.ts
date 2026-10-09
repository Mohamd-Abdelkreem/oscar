import { randomUUID } from "node:crypto";
import type { WithdrawalAttempt } from "@template/database";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import { TronProviderError } from "../../infrastructure/tron/tron-provider.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import { recordPayoutAction } from "./withdrawal-payout.transaction.js";
import { assertPayoutPolicy } from "./withdrawal-payout.intent.js";
import { checkPayoutResources } from "./withdrawal-payout.resources.js";
import {
  acknowledgePayoutRecord,
  retainedPayoutRecord,
} from "./payout-records.js";
import {
  broadcastPayoutPayload,
  validateBroadcastPayoutRecord,
  retainedSignedPayout,
} from "./withdrawal-payout.records.js";
import {
  assertPayoutDispatchable,
  type PayoutExecution,
} from "./withdrawal-payout.execution.js";

export class PayoutBroadcast {
  constructor(private readonly context: PayoutExecution) {}
  async broadcast(requestId: string) {
    let attempt =
      await this.context.database.withdrawalAttempt.findUniqueOrThrow({
        where: { withdrawalId: requestId },
      });
    if (["CONFIRMED_SUCCESS", "CHAIN_FAILED"].includes(attempt.state))
      return attempt;
    if (attempt.broadcastIntentId !== null) {
      if (attempt.broadcastAckId === null)
        attempt = await this.acknowledgeBroadcast(requestId, attempt);
      try {
        await this.context.reconciliation.observe(requestId);
        return await this.context.database.withdrawalAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        });
      } catch (error) {
        if (
          !(error instanceof TronProviderError) ||
          error.code !== "TRON_UNFINALIZED"
        )
          throw error;
      }
    }
    const request =
      await this.context.database.withdrawalRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
    const { record: signed } = await retainedSignedPayout(
      this.context.stores,
      request,
      attempt,
    );
    assertPayoutPolicy(signed.intent, this.context.config);
    const floor = await checkPayoutResources(
      this.context.provider,
      this.context.config,
      attempt.recipient,
      attempt.netUnits,
    );
    const admitted = await this.context.transactions.dispatch(
      requestId,
      async (scope) => {
        await assertPayoutDispatchable(scope);
        if (
          scope.attempt === null ||
          scope.attempt.signedDigest !== attempt.signedDigest ||
          BigInt(floor.number) < scope.key.lastFinalBlockNumber ||
          scope.attempt.expiration === null ||
          scope.attempt.expiration <= BigInt(scope.now.getTime())
        )
          throw new TreasuryPolicyError("PAYOUT_NOT_DISPATCHABLE");
        if (scope.attempt.broadcastIntentId !== null)
          return { attempt: scope.attempt, created: false };
        const saved = await scope.transaction.withdrawalAttempt.update({
          where: { id: attempt.id },
          data: {
            state: "BROADCAST_INTENT",
            broadcastIntentId: randomUUID(),
            broadcastAdmittedAt: scope.now,
            version: { increment: 1 },
          },
        });
        const after = await scope.transaction.withdrawalRequest.update({
          where: { id: requestId },
          data: { state: "UNKNOWN", version: { increment: 1 } },
        });
        await recordPayoutAction(scope, "BROADCAST_ADMISSION", after);
        return { attempt: saved, created: true };
      },
    );
    attempt = admitted.attempt;
    await this.acknowledgeBroadcast(requestId, attempt, admitted.created);
    let submitted = false;
    try {
      submitted = await this.context.provider.broadcastTransfer(
        signed.transaction,
      );
    } catch (error) {
      if (!(error instanceof TronProviderError)) throw error;
    }
    return this.context.transactions.mutate(requestId, async (scope) => {
      if (scope.attempt === null) throw new TreasuryPolicyError();
      if (["CONFIRMED_SUCCESS", "CHAIN_FAILED"].includes(scope.attempt.state))
        return scope.attempt;
      const state = submitted ? "SUBMITTED" : "UNKNOWN";
      const nextCheckAt = new Date(
        Math.max(
          scope.now.getTime() + 30000,
          scope.request.nextCheckAt?.getTime() ?? 0,
          scope.attempt.nextCheckAt.getTime(),
        ),
      );
      const saved = await scope.transaction.withdrawalAttempt.update({
        where: { id: attempt.id },
        data: {
          state,
          blocker: "UNRESOLVED_ATTEMPT",
          nextCheckAt,
          version: { increment: 1 },
        },
      });
      const after = await scope.transaction.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          state,
          blocker: "UNRESOLVED_ATTEMPT",
          nextCheckAt,
          ...(scope.request.state === state
            ? {}
            : { version: { increment: 1 } }),
        },
      });
      if (scope.request.state !== state)
        await recordPayoutAction(scope, "OBSERVE", after);
      return saved;
    });
  }
  private async acknowledgeBroadcast(
    requestId: string,
    attempt: WithdrawalAttempt,
    created = false,
  ) {
    if (
      attempt.broadcastIntentId === null ||
      attempt.broadcastAdmittedAt === null ||
      attempt.signedDigest === null ||
      attempt.transactionId === null
    )
      throw new TreasuryPolicyError();
    const payload = broadcastPayoutPayload(attempt);
    const stores = this.context.stores;
    // Only the invocation that committed a new admission may create its first file.
    const envelope = created
      ? await stores.keys.obtainRecord(
          stores.keys.sealRecord(
            "PAYOUT_BROADCAST_INTENT",
            attempt.broadcastIntentId,
            payload,
          ),
        )
      : await retainedPayoutRecord(
          stores,
          attempt.broadcastIntentId,
          "PAYOUT_BROADCAST_INTENT",
        );
    if (envelope === null)
      throw new TreasuryPolicyError("RECOVERY_UNAVAILABLE");
    validateBroadcastPayoutRecord(stores, envelope, attempt);
    const ack = await acknowledgePayoutRecord(stores, envelope);
    return this.context.transactions.mutate(requestId, async (scope) => {
      if (
        scope.attempt === null ||
        scope.attempt.broadcastIntentId !== attempt.broadcastIntentId ||
        scope.attempt.signedDigest !== attempt.signedDigest ||
        scope.attempt.transactionId !== attempt.transactionId ||
        ["CONFIRMED_SUCCESS", "CHAIN_FAILED"].includes(scope.attempt.state)
      )
        throw new TreasuryPolicyError();
      if (scope.attempt.broadcastAckId !== null) {
        if (scope.attempt.broadcastDigest !== envelopeDigest(envelope))
          throw new TreasuryPolicyError();
        return scope.attempt;
      }
      return scope.transaction.withdrawalAttempt.update({
        where: { id: attempt.id },
        data: {
          broadcastDigest: envelopeDigest(envelope),
          broadcastAckId: ack.ackId,
          broadcastAcknowledgedAt: new Date(ack.acknowledgedAt),
          version: { increment: 1 },
        },
      });
    });
  }
}
