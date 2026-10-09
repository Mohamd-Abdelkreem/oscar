import type { CustodyKeyStorage } from "../../infrastructure/custody/key-storage.js";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import type { RecoveryEnvelope } from "../../infrastructure/custody/encrypted-envelope.js";
import type { SshRecoveryStore } from "../../infrastructure/custody/recovery-store.js";
import { validateRecoveryResponse } from "../../infrastructure/custody/recovery-store.protocol.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";

export type PayoutStores = Readonly<{
  keys: CustodyKeyStorage;
  archive: Pick<SshRecoveryStore, "get" | "put">;
}>;
export async function acknowledgePayoutRecord(
  stores: PayoutStores,
  envelope: RecoveryEnvelope,
) {
  const digest = envelopeDigest(envelope);
  const acknowledgement = validateRecoveryResponse(
    { operation: "PUT", envelope, digest },
    await stores.archive.put(envelope),
  );
  const readback = validateRecoveryResponse(
    {
      operation: "GET",
      objectId: envelope.objectId,
      version: envelope.version,
    },
    await stores.archive.get(envelope.objectId, envelope.version),
  );
  if (
    acknowledgement.operation !== "PUT" ||
    readback.operation !== "GET" ||
    readback.type !== envelope.type ||
    readback.digest !== digest
  )
    throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
  return acknowledgement;
}
export async function retainedPayoutRecord(
  stores: PayoutStores,
  id: string,
  type: RecoveryEnvelope["type"],
) {
  const local = await stores.keys.readRecord(id);
  let remote: RecoveryEnvelope | null = null;
  try {
    const response = validateRecoveryResponse(
      { operation: "GET", objectId: id, version: 1 },
      await stores.archive.get(id, 1),
    );
    if (response.operation !== "GET")
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    remote = response.envelope;
  } catch (error) {
    if (
      !(error instanceof CustodyStorageError) ||
      error.code !== "RECOVERY_NOT_FOUND"
    )
      throw error;
  }
  if (
    local !== null &&
    remote !== null &&
    envelopeDigest(local) !== envelopeDigest(remote)
  )
    throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
  const winner = local ?? remote;
  if (winner !== null) {
    if (winner.type !== type || winner.objectId !== id)
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    await stores.keys.storeRecord(winner);
  }
  return winner;
}
