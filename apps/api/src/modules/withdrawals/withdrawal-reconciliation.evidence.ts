import type { WithdrawalAttempt, WithdrawalRequest } from "@template/database";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { TronProvider } from "../../infrastructure/tron/tron-provider.js";
import { decodeCanonicalReceipt } from "../../infrastructure/tron/tron-receipt.js";
import { assertTransferTransaction } from "../../infrastructure/tron/tron-signer.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import { storedPayoutIntent } from "./withdrawal-payout.intent.js";

export type VerifiedPayout = Readonly<{
  transactionId: string;
  network: string;
  tokenContract: string;
  source: string;
  recipient: string;
  amountUnits: string;
  blockId: string;
  blockNumber: string;
  intentHash: string;
  outcome: "CONFIRMED_SUCCESS" | "CHAIN_FAILED";
  evidenceDigest: string;
}>;
const verified = new WeakSet<VerifiedPayout>();
export function assertVerifiedPayout(evidence: VerifiedPayout): void {
  if (!verified.has(evidence))
    throw new TreasuryPolicyError("PAYOUT_EVIDENCE_UNVERIFIED");
}
export type PayoutObservationProvider = Pick<
  TronProvider,
  | "verifyIdentity"
  | "solidifiedFloor"
  | "transaction"
  | "transactionInfo"
  | "transactionBlock"
  | "block"
>;

// Only independently fetched canonical receipt evidence enters the settlement capability set.
export async function verifyOriginalPayout(input: {
  provider: PayoutObservationProvider;
  request: WithdrawalRequest;
  attempt: WithdrawalAttempt;
  retainedSigned: unknown;
  now: Date;
}): Promise<VerifiedPayout> {
  const { provider, request, attempt, now } = input;
  const intent = storedPayoutIntent(request, attempt);
  if (
    attempt.transactionId === null ||
    attempt.signedDigest === null ||
    attempt.broadcastAckId === null
  )
    throw new TreasuryPolicyError("PAYOUT_IDENTITY_MISSING");
  const movement = {
    source: intent.source,
    recipient: intent.recipient,
    tokenContract: intent.tokenContract,
    amountUnits: BigInt(intent.netUnits),
  };
  const policy = {
    now: now.getTime(),
    maximumFeeSun: BigInt(intent.policy.energyFeeLimitSun),
    signed: true,
    historical: true,
  };
  const original = assertTransferTransaction(
    input.retainedSigned,
    movement,
    policy,
  );
  if (original.txID !== attempt.transactionId)
    throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
  await provider.verifyIdentity({
    network: intent.network,
    token: { symbol: "USDT", decimals: 6, contract: intent.tokenContract },
  });
  const solidified = await provider.solidifiedFloor();
  const transaction = await provider.transaction(original.txID);
  const observed = assertTransferTransaction(
    {
      txID: transaction["txID"],
      raw_data_hex: transaction["raw_data_hex"],
      raw_data: transaction["raw_data"],
      visible: transaction["visible"],
      signature: transaction["signature"],
    },
    movement,
    policy,
  );
  const originalSignature = original.signature?.[0];
  const observedSignature = observed.signature?.[0];
  if (
    observed.raw_data_hex !== original.raw_data_hex ||
    originalSignature === undefined ||
    observedSignature === undefined ||
    !Buffer.from(observedSignature, "hex").equals(
      Buffer.from(originalSignature, "hex"),
    )
  )
    throw new TreasuryPolicyError("PAYOUT_IDENTITY_CONFLICT");
  const info = await provider.transactionInfo(original.txID);
  const number = info["blockNumber"];
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0)
    throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
  const block = await provider.transactionBlock(number);
  const canonical = await provider.block(number);
  if (
    canonical.id !== block.id ||
    canonical.timestamp !== block.timestamp ||
    BigInt(number) < attempt.initialFloorNumber
  )
    throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
  const disposition = z
    .object({
      ret: z.array(z.object({ contractRet: z.string() })).length(1),
    })
    .parse(transaction).ret[0]?.contractRet;
  const receipt = z
    .object({
      id: z.literal(original.txID),
      blockNumber: z.literal(number),
      blockTimeStamp: z.literal(block.timestamp),
      blockID: z
        .string()
        .regex(/^[0-9a-f]{64}$/u)
        .optional(),
      receipt: z.object({ result: z.string() }),
      result: z.string().optional(),
      log: z.array(z.unknown()).max(10000),
    })
    .parse(info);
  if (
    block.number !== number ||
    !block.transactionIds.includes(original.txID) ||
    (receipt.blockID !== undefined && receipt.blockID !== block.id) ||
    number > solidified.number ||
    block.timestamp > solidified.timestamp ||
    (number === solidified.number &&
      (block.id !== solidified.id || block.timestamp !== solidified.timestamp))
  )
    throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
  if (receipt.receipt.result !== "SUCCESS") {
    if (
      !["REVERT", "OUT_OF_ENERGY", "OUT_OF_TIME", "FAILED"].includes(
        receipt.receipt.result,
      ) ||
      disposition !== receipt.receipt.result ||
      (receipt.result !== undefined &&
        receipt.result !== receipt.receipt.result &&
        receipt.result !== "FAILED") ||
      receipt.log.length !== 0
    )
      throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
    const failure: VerifiedPayout = Object.freeze({
      transactionId: original.txID,
      network: intent.network,
      tokenContract: intent.tokenContract,
      source: intent.source,
      recipient: intent.recipient,
      amountUnits: intent.netUnits,
      blockId: block.id,
      blockNumber: String(number),
      intentHash: attempt.intentHash,
      outcome: "CHAIN_FAILED",
      evidenceDigest: createHash("sha256")
        .update(
          JSON.stringify({
            transactionId: original.txID,
            intentHash: attempt.intentHash,
            blockId: block.id,
            blockNumber: number,
            result: receipt.receipt.result,
          }),
        )
        .digest("hex"),
    });
    verified.add(failure);
    return failure;
  }
  const transfers = decodeCanonicalReceipt({
    transactionId: original.txID,
    transaction,
    info,
    block,
    solidified,
    network: intent.network,
    tokenContract: intent.tokenContract,
    verifiedAt: now,
  });
  const transfer = transfers[0];
  if (
    transfers.length !== 1 ||
    transfer === undefined ||
    transfer.sender !== intent.source ||
    transfer.recipient !== intent.recipient ||
    transfer.amountUnits !== BigInt(intent.netUnits)
  )
    throw new TreasuryPolicyError("PAYOUT_EVIDENCE_CONFLICT");
  const evidence: VerifiedPayout = Object.freeze({
    transactionId: original.txID,
    network: intent.network,
    tokenContract: intent.tokenContract,
    source: intent.source,
    recipient: intent.recipient,
    amountUnits: intent.netUnits,
    blockId: transfer.blockId,
    blockNumber: String(transfer.blockNumber),
    intentHash: attempt.intentHash,
    outcome: "CONFIRMED_SUCCESS",
    evidenceDigest: transfer.evidenceDigest,
  });
  verified.add(evidence);
  return evidence;
}
