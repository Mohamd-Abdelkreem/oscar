import { withdrawalSettlementTermsSchema } from "@template/contracts";
import type { WithdrawalAttempt, WithdrawalRequest } from "@template/database";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import type { PayoutFinancialTransactions } from "./withdrawal-payout.transaction.js";
import { recordPayoutAction } from "./withdrawal-payout.transaction.js";
import {
  assertVerifiedPayout,
  type VerifiedPayout,
} from "./withdrawal-reconciliation.evidence.js";
import { storedPayoutIntent } from "./withdrawal-payout.intent.js";

export function payoutSettlementTerms(
  request: WithdrawalRequest,
  attempt: Pick<
    WithdrawalAttempt,
    | "id"
    | "transactionId"
    | "tokenContract"
    | "source"
    | "finalBlockNumber"
    | "finalBlockId"
  >,
) {
  if (
    attempt.finalBlockNumber === null ||
    attempt.finalBlockId === null ||
    attempt.transactionId === null
  )
    throw new TreasuryPolicyError("PAYOUT_FINALITY_MISSING");
  return withdrawalSettlementTermsSchema.parse({
    withdrawalId: request.id,
    attemptId: attempt.id,
    network: request.network,
    tokenContract: attempt.tokenContract,
    source: attempt.source,
    recipient: request.recipient,
    addressVersion: request.addressVersion,
    gross: formatUsdtAmount(request.grossUnits),
    feeBps: request.feeBps,
    fee: formatUsdtAmount(request.feeUnits),
    net: formatUsdtAmount(request.netUnits),
    sourceAllocation: {
      nonReferral: formatUsdtAmount(request.nonReferralUnits),
      referral: formatUsdtAmount(request.referralUnits),
      gross: formatUsdtAmount(request.grossUnits),
    },
    transactionId: attempt.transactionId,
    blockNumber: String(attempt.finalBlockNumber),
    blockId: attempt.finalBlockId,
  });
}
function matchEvidence(
  request: WithdrawalRequest,
  attempt: WithdrawalAttempt,
  evidence: VerifiedPayout,
) {
  const intent = storedPayoutIntent(request, attempt);
  if (
    evidence.intentHash !== attempt.intentHash ||
    evidence.transactionId !== attempt.transactionId ||
    evidence.network !== intent.network ||
    evidence.tokenContract !== intent.tokenContract ||
    evidence.source !== intent.source ||
    evidence.recipient !== intent.recipient ||
    evidence.amountUnits !== intent.netUnits
  )
    throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
}
export class WithdrawalSettlementService {
  constructor(private readonly transactions: PayoutFinancialTransactions) {}
  settle(requestId: string, evidence: VerifiedPayout) {
    assertVerifiedPayout(evidence);
    if (evidence.outcome !== "CONFIRMED_SUCCESS")
      throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
    return this.transactions.mutate(
      requestId,
      async (scope) => {
        const { request, attempt, transaction, ledger, now, key } = scope;
        if (attempt === null)
          throw new TreasuryPolicyError("PAYOUT_IDENTITY_MISSING");
        matchEvidence(request, attempt, evidence);
        if (request.state === "COMPLETED") {
          if (
            attempt.state !== "CONFIRMED_SUCCESS" ||
            attempt.finalBlockId !== evidence.blockId ||
            attempt.finalBlockNumber !== BigInt(evidence.blockNumber)
          )
            throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
          return request;
        }
        if (
          !["SIGNED", "SUBMITTED", "UNKNOWN"].includes(request.state) ||
          attempt.broadcastAckId === null ||
          BigInt(evidence.blockNumber) < key.lastFinalBlockNumber
        )
          throw new TreasuryPolicyError("PAYOUT_STATE_CONFLICT");
        const terms = payoutSettlementTerms(request, {
          ...attempt,
          finalBlockNumber: BigInt(evidence.blockNumber),
          finalBlockId: evidence.blockId,
        });
        await ledger.settleReservation(
          {
            kind: "SETTLE",
            walletId: request.walletId,
            businessNamespace: "p08.withdrawal.settle",
            businessKey: request.id,
            reservationId: request.reservationId,
            withdrawalTerms: terms,
          },
          async (_tx, operation) => {
            await transaction.withdrawalAttempt.update({
              where: { id: attempt.id },
              data: {
                state: "CONFIRMED_SUCCESS",
                finalEvidence: evidence,
                finalBlockNumber: BigInt(evidence.blockNumber),
                finalBlockId: evidence.blockId,
                finalizedAt: now,
                blocker: null,
                version: { increment: 1 },
              },
            });
            if (BigInt(evidence.blockNumber) > key.lastFinalBlockNumber)
              await transaction.treasuryPayoutKey.update({
                where: { id: key.id },
                data: { lastFinalBlockNumber: BigInt(evidence.blockNumber) },
              });
            const after = await transaction.withdrawalRequest.update({
              where: { id: request.id },
              data: {
                state: "COMPLETED",
                settlementOperationId: operation.operationId,
                finalizedAt: now,
                blocker: null,
                version: { increment: 1 },
              },
            });
            await recordPayoutAction(
              scope,
              "COMPLETE",
              after,
              operation.operationId,
            );
          },
        );
        return transaction.withdrawalRequest.findUniqueOrThrow({
          where: { id: request.id },
        });
      },
      {
        settlementSafety: ({ intent, allocation }) => {
          if (
            intent.kind !== "SETTLE" ||
            allocation.id !== intent.reservationId ||
            allocation.walletId !== intent.walletId ||
            formatUsdtAmount(allocation.grossUnits) !==
              intent.withdrawalTerms.gross ||
            formatUsdtAmount(allocation.nonReferralUnits) !==
              intent.withdrawalTerms.sourceAllocation.nonReferral ||
            formatUsdtAmount(allocation.referralUnits) !==
              intent.withdrawalTerms.sourceAllocation.referral
          )
            throw new TreasuryPolicyError("PAYOUT_ALLOCATION_CONFLICT");
          return Promise.resolve();
        },
      },
    );
  }
  fail(requestId: string, evidence: VerifiedPayout) {
    assertVerifiedPayout(evidence);
    if (evidence.outcome !== "CHAIN_FAILED")
      throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
    return this.transactions.mutate(
      requestId,
      async (scope) => {
        const { request, attempt, transaction, ledger, now, key } = scope;
        if (attempt === null)
          throw new TreasuryPolicyError("PAYOUT_IDENTITY_MISSING");
        matchEvidence(request, attempt, evidence);
        if (request.state === "FAILED") {
          if (
            attempt.state !== "CHAIN_FAILED" ||
            attempt.finalBlockId !== evidence.blockId ||
            attempt.finalBlockNumber !== BigInt(evidence.blockNumber)
          )
            throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
          return request;
        }
        if (
          !["SIGNED", "SUBMITTED", "UNKNOWN"].includes(request.state) ||
          attempt.broadcastAckId === null ||
          BigInt(evidence.blockNumber) < key.lastFinalBlockNumber
        )
          throw new TreasuryPolicyError("PAYOUT_STATE_CONFLICT");
        await ledger.releaseReservation(
          {
            kind: "RELEASE",
            walletId: request.walletId,
            businessNamespace: "p08.withdrawal.release",
            businessKey: request.id,
            reservationId: request.reservationId,
          },
          async (_tx, operation) => {
            await transaction.withdrawalAttempt.update({
              where: { id: attempt.id },
              data: {
                state: "CHAIN_FAILED",
                finalEvidence: evidence,
                finalBlockNumber: BigInt(evidence.blockNumber),
                finalBlockId: evidence.blockId,
                finalizedAt: now,
                blocker: null,
                version: { increment: 1 },
              },
            });
            if (BigInt(evidence.blockNumber) > key.lastFinalBlockNumber)
              await transaction.treasuryPayoutKey.update({
                where: { id: key.id },
                data: { lastFinalBlockNumber: BigInt(evidence.blockNumber) },
              });
            const after = await transaction.withdrawalRequest.update({
              where: { id: request.id },
              data: {
                state: "FAILED",
                releaseOperationId: operation.operationId,
                finalizedAt: now,
                blocker: null,
                version: { increment: 1 },
              },
            });
            await recordPayoutAction(
              scope,
              "SAFE_FAIL",
              after,
              operation.operationId,
            );
          },
        );
        return transaction.withdrawalRequest.findUniqueOrThrow({
          where: { id: request.id },
        });
      },
      {
        releaseSafety: async ({ intent, allocation, transaction }) => {
          const request = await transaction.withdrawalRequest.findUniqueOrThrow(
            {
              where: { id: requestId },
            },
          );
          if (
            intent.kind !== "RELEASE" ||
            intent.businessKey !== request.id ||
            allocation.state !== "ACTIVE" ||
            allocation.id !== request.reservationId ||
            allocation.grossUnits !== request.grossUnits ||
            allocation.nonReferralUnits !== request.nonReferralUnits ||
            allocation.referralUnits !== request.referralUnits
          )
            throw new TreasuryPolicyError("PAYOUT_ALLOCATION_CONFLICT");
        },
      },
    );
  }
}
