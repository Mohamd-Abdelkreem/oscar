import { createHash } from "node:crypto";
import type { CanonicalMovement } from "./tron-receipt.js";

export function canonicalMovementDigest(
  movement: Omit<
    CanonicalMovement,
    "verifiedAt" | "evidenceDigest" | "executionResult" | "finalityPolicy"
  > & { executionResult: string; finalityPolicy: string },
): string {
  const canonical = {
    network: movement.network,
    transactionId: movement.transactionId,
    logIndex: movement.logIndex,
    tokenContract: movement.tokenContract,
    sender: movement.sender,
    recipient: movement.recipient,
    amountUnits: movement.amountUnits.toString(),
    blockNumber: movement.blockNumber.toString(),
    blockId: movement.blockId,
    blockTimestamp: movement.blockTimestamp.toString(),
    executionResult: movement.executionResult,
    finalityPolicy: movement.finalityPolicy,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
