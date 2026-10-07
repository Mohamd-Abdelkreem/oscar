import { z } from "zod";
import type { SweepTransaction } from "../../infrastructure/tron/tron-signer.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";

function protobufLengthBytes(length: number): number {
  let bytes = 1;
  while (length >= 128) {
    length = Math.floor(length / 128);
    bytes++;
  }
  return bytes;
}
export function actualSweepBandwidth(
  transaction: SweepTransaction,
  receipt: { net_usage: number; net_fee: number },
): bigint {
  if (receipt.net_usage > 0 && receipt.net_fee === 0)
    return BigInt(receipt.net_usage);
  if (
    receipt.net_usage !== 0 ||
    receipt.net_fee === 0 ||
    transaction.signature?.length !== 1
  )
    throw new TreasuryPolicyError();
  const rawBytes = transaction.raw_data_hex.length / 2;
  const signatureBytes = transaction.signature[0]?.length === 130 ? 65 : 0;
  if (signatureBytes === 0) throw new TreasuryPolicyError();
  // java-tron clears ret, serializes the signed transaction and reserves 64 result bytes.
  return BigInt(
    1 +
      protobufLengthBytes(rawBytes) +
      rawBytes +
      1 +
      protobufLengthBytes(signatureBytes) +
      signatureBytes +
      64,
  );
}

const evidenceUnits = z.string().regex(/^(?:0|[1-9]\d{0,18})$/u);
const evidenceHash = z.string().regex(/^[0-9a-f]{64}$/u);
const evidenceSchema = z
  .object({
    transactionId: evidenceHash,
    blockId: evidenceHash,
    blockNumber: evidenceUnits,
    blockTimestamp: evidenceUnits,
    result: z.enum([
      "SUCCESS",
      "REVERT",
      "OUT_OF_ENERGY",
      "OUT_OF_TIME",
      "FAILED",
    ]),
    tokenContract: z.string(),
    source: z.string(),
    treasury: z.string(),
    amountUnits: evidenceUnits,
    feeSun: evidenceUnits,
    energyUnits: evidenceUnits,
    bandwidthUnits: evidenceUnits,
  })
  .strict();
export function sameSweepEvidence(left: unknown, right: unknown): boolean {
  const stored = evidenceSchema.safeParse(left);
  const observed = evidenceSchema.safeParse(right);
  return (
    stored.success &&
    observed.success &&
    JSON.stringify(stored.data) === JSON.stringify(observed.data)
  );
}
