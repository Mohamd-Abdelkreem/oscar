import { createHash } from "node:crypto";
import { TronWeb } from "tronweb";
import { z } from "zod";
import { MAX_USDT_AMOUNT } from "@template/contracts";
import { parseUsdtAmount } from "../../core/financial/money.js";
import type { TronNetworkName } from "../../core/config/tron.config.js";
import { canonicalMovementDigest } from "./tron-receipt.evidence.js";

const hash = z.string().regex(/^[0-9a-f]{64}$/u);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hex = z.string().regex(/^(?:[0-9a-fA-F]{2})+$/u);
const logSchema = z.object({
  address: z.string().regex(/^[0-9a-fA-F]{40}$/u),
  topics: z.array(z.string().regex(/^[0-9a-fA-F]{64}$/u)).max(4),
  data: z.string().regex(/^(?:[0-9a-fA-F]{2})*$/u),
});
const transactionSchema = z.object({
  txID: hash,
  raw_data_hex: hex,
  raw_data: z.object({
    contract: z
      .array(
        z.object({
          type: z.string(),
          parameter: z.object({ value: z.record(z.string(), z.unknown()) }),
        }),
      )
      .min(1),
  }),
  ret: z.array(z.object({ contractRet: z.string() })).min(1),
});
const infoSchema = z.object({
  id: hash,
  blockNumber: integer,
  blockTimeStamp: integer,
  receipt: z.object({ result: z.string() }),
  result: z.string().optional(),
  blockID: hash.optional(),
  log: z.array(logSchema).max(10000),
});
const boundarySchema = z.object({
  transactionId: hash,
  transaction: transactionSchema,
  info: infoSchema,
  block: z.object({
    number: integer,
    timestamp: integer,
    id: hash,
    transactionIds: z.array(hash),
  }),
  solidified: z.object({ number: integer, timestamp: integer, id: hash }),
  network: z.enum(["TRON_MAINNET", "TRON_SHASTA", "TRON_NILE"]),
  tokenContract: z
    .string()
    .refine(
      (address) =>
        /^T[1-9A-HJ-NP-Za-km-z]{33}$/u.test(address) &&
        TronWeb.isAddress(address),
    ),
  verifiedAt: z.date(),
});
export const TRANSFER_TOPIC =
  "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MAX_UNITS = parseUsdtAmount(MAX_USDT_AMOUNT);
export type TronReceiptFailure =
  | "DEPOSIT_MALFORMED"
  | "DEPOSIT_UNFINALIZED"
  | "DEPOSIT_EVIDENCE_CONFLICT"
  | "DEPOSIT_INELIGIBLE"
  | "DEPOSIT_AMOUNT_BOUNDS";
export class TronReceiptError extends Error {
  constructor(readonly code: TronReceiptFailure) {
    super(code);
  }
}
export type CanonicalMovement = Readonly<{
  network: TronNetworkName;
  transactionId: string;
  logIndex: number;
  tokenContract: string;
  sender: string;
  recipient: string;
  amountUnits: bigint;
  blockNumber: bigint;
  blockId: string;
  blockTimestamp: bigint;
  executionResult: "SUCCESS";
  finalityPolicy: "SOLIDIFIED_CANONICAL_SUCCESS";
  verifiedAt: Date;
  evidenceDigest: string;
}>;
type ReceiptBoundary = z.infer<typeof boundarySchema>;
function assertCanonicalSuccess(evidence: ReceiptBoundary) {
  const { transaction, info, block, solidified, transactionId } = evidence;
  const computedId = createHash("sha256")
    .update(Buffer.from(transaction.raw_data_hex, "hex"))
    .digest("hex");
  if (
    transaction.txID !== transactionId ||
    info.id !== transactionId ||
    computedId !== transactionId ||
    !block.transactionIds.includes(transactionId) ||
    info.blockNumber !== block.number ||
    info.blockTimeStamp !== block.timestamp ||
    (info.blockID !== undefined && info.blockID !== block.id)
  )
    throw new TronReceiptError("DEPOSIT_EVIDENCE_CONFLICT");
  if (
    block.number > solidified.number ||
    block.timestamp > solidified.timestamp
  )
    throw new TronReceiptError("DEPOSIT_UNFINALIZED");
  if (
    block.number === solidified.number &&
    (block.id !== solidified.id || block.timestamp !== solidified.timestamp)
  )
    throw new TronReceiptError("DEPOSIT_EVIDENCE_CONFLICT");
  if (
    info.receipt.result !== "SUCCESS" ||
    (info.result !== undefined && info.result !== "SUCCESS") ||
    transaction.ret.length !== transaction.raw_data.contract.length ||
    transaction.ret.some((ret) => ret.contractRet !== "SUCCESS")
  )
    throw new TronReceiptError("DEPOSIT_INELIGIBLE");
  if (
    !transaction.raw_data.contract.some(
      (contract) => contract.type === "TriggerSmartContract",
    )
  )
    throw new TronReceiptError("DEPOSIT_INELIGIBLE");
}
function topicAddress(topic: string): string {
  if (!/^0{24}[0-9a-fA-F]{40}$/u.test(topic))
    throw new TronReceiptError("DEPOSIT_MALFORMED");
  return TronWeb.address.fromHex(`41${topic.slice(24)}`);
}
function decodeTransfer(
  log: z.infer<typeof logSchema>,
  logIndex: number,
  evidence: ReceiptBoundary,
): CanonicalMovement | null {
  if (
    log.address.toLowerCase() !==
      TronWeb.address.toHex(evidence.tokenContract).slice(2).toLowerCase() ||
    log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC
  )
    return null;
  const [, senderTopic, recipientTopic] = log.topics;
  if (
    log.topics.length !== 3 ||
    senderTopic === undefined ||
    recipientTopic === undefined ||
    !/^[0-9a-fA-F]{64}$/u.test(log.data)
  )
    throw new TronReceiptError("DEPOSIT_MALFORMED");
  const amountUnits = BigInt(`0x${log.data}`);
  if (amountUnits === 0n || amountUnits > MAX_UNITS)
    throw new TronReceiptError("DEPOSIT_AMOUNT_BOUNDS");
  const canonical = {
    network: evidence.network,
    transactionId: evidence.transactionId,
    logIndex,
    tokenContract: evidence.tokenContract,
    sender: topicAddress(senderTopic),
    recipient: topicAddress(recipientTopic),
    amountUnits,
    blockNumber: BigInt(evidence.block.number),
    blockId: evidence.block.id,
    blockTimestamp: BigInt(evidence.block.timestamp),
    executionResult: "SUCCESS" as const,
    finalityPolicy: "SOLIDIFIED_CANONICAL_SUCCESS" as const,
  };
  // Verification time changes on replay; the consequential canonical evidence must not.
  const evidenceDigest = canonicalMovementDigest(canonical);
  return Object.freeze({
    ...canonical,
    verifiedAt: new Date(evidence.verifiedAt),
    evidenceDigest,
  });
}
export function decodeCanonicalReceipt(raw: unknown): CanonicalMovement[] {
  const parsed = boundarySchema.safeParse(raw);
  if (!parsed.success) throw new TronReceiptError("DEPOSIT_MALFORMED");
  assertCanonicalSuccess(parsed.data);
  const movements: CanonicalMovement[] = [];
  // Empty, unrelated, one and multiple logs retain their positions before filtering.
  for (const [logIndex, log] of parsed.data.info.log.entries()) {
    const movement = decodeTransfer(log, logIndex, parsed.data);
    if (movement !== null) movements.push(movement);
  }
  return movements;
}
