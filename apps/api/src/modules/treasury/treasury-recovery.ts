import {
  Prisma,
  type DatabaseClient,
  type TransferAttempt,
} from "@template/database";
import type { z } from "zod";
import type { CustodyKeyStorage } from "../../infrastructure/custody/key-storage.js";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import type { SshRecoveryStore } from "../../infrastructure/custody/recovery-store.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import {
  signedAttemptSchema,
  broadcastIntentSchema,
} from "./treasury-attempts.js";
import { intentHash, type SweepIntent } from "./treasury.intent.js";
import { storedIntent, treasuryAuthority } from "./treasury.service.js";
import { assertSweepTransaction } from "../../infrastructure/tron/tron-signer.js";

type ArchivedRecord = Awaited<ReturnType<SshRecoveryStore["get"]>>;
type SignedSnapshot = z.infer<typeof signedAttemptSchema>;
type BroadcastSnapshot = z.infer<typeof broadcastIntentSchema>;
export class TreasuryRecovery {
  constructor(
    private readonly database: DatabaseClient,
    private readonly keys: CustodyKeyStorage,
    private readonly archive: Pick<SshRecoveryStore, "list" | "get">,
  ) {}
  private async authenticatedSnapshot(
    archived: Awaited<ReturnType<SshRecoveryStore["get"]>>,
  ) {
    const broadcast =
      archived.type === "BROADCAST_INTENT"
        ? broadcastIntentSchema.parse(this.keys.openRecord(archived.envelope))
        : null;
    const signed =
      broadcast?.signed ??
      signedAttemptSchema.parse(this.keys.openRecord(archived.envelope));
    assertSweepTransaction(
      signed.transaction,
      { ...signed.intent, amountUnits: BigInt(signed.intent.amountUnits) },
      {
        now: Date.now(),
        maximumFeeSun: BigInt(signed.intent.policySnapshot.energyFeeLimitSun),
        signed: true,
        historical: true,
      },
    );
    if (
      archived.objectId !== (broadcast?.broadcastIntentId ?? signed.attemptId)
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    if (broadcast !== null) {
      const original = await this.archive.get(signed.attemptId, 1);
      if (
        original.type !== "SIGNED_ATTEMPT" ||
        JSON.stringify(
          signedAttemptSchema.parse(this.keys.openRecord(original.envelope)),
        ) !== JSON.stringify(signed)
      )
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    }
    return { signed, broadcast };
  }
  async assertInventory(): Promise<void> {
    const seenSigned = new Set<string>();
    const seenBroadcast = new Set<string>();
    for (const type of ["SIGNED_ATTEMPT", "BROADCAST_INTENT"] as const) {
      let cursor: string | undefined;
      do {
        const page = await this.archive.list(cursor, type);
        for (const record of page.records) {
          const archived = await this.archive.get(
            record.objectId,
            record.version,
          );
          if (
            archived.digest !== record.digest ||
            archived.type !== type ||
            record.version !== 1
          )
            throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
          const { signed, broadcast } =
            await this.authenticatedSnapshot(archived);
          const attempt = await this.database.transferAttempt.findUnique({
            where: { id: signed.attemptId },
          });
          const sweep = await this.database.treasurySweep.findUnique({
            where: { id: signed.intent.id },
          });
          if (
            attempt === null ||
            sweep === null ||
            attempt.intentHash !== intentHash(signed.intent) ||
            JSON.stringify(storedIntent(sweep)) !==
              JSON.stringify(signed.intent) ||
            (attempt.transactionId !== null &&
              attempt.transactionId !== signed.transaction.txID) ||
            (broadcast !== null &&
              (attempt.broadcastIntentId !== broadcast.broadcastIntentId ||
                attempt.broadcastAdmittedAt?.toISOString() !==
                  broadcast.admittedAt))
          )
            throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
          if (broadcast === null) seenSigned.add(attempt.id);
          else seenBroadcast.add(broadcast.broadcastIntentId);
        }
        cursor = page.cursor ?? undefined;
      } while (cursor !== undefined);
    }
    await this.assertRecordedInventory(seenSigned, seenBroadcast);
  }
  private async assertRecordedInventory(
    seenSigned: ReadonlySet<string>,
    seenBroadcast: ReadonlySet<string>,
  ): Promise<void> {
    let after: string | undefined;
    for (;;) {
      const attempts = await this.database.transferAttempt.findMany({
        take: 100,
        orderBy: { id: "asc" },
        ...(after === undefined ? {} : { where: { id: { gt: after } } }),
      });
      if (attempts.length === 0) break;
      for (const attempt of attempts)
        if (
          (attempt.transactionId !== null && !seenSigned.has(attempt.id)) ||
          (attempt.broadcastIntentId !== null &&
            !seenBroadcast.has(attempt.broadcastIntentId))
        )
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      after = attempts.at(-1)?.id;
    }
  }
  private async restoreClaim(
    tx: Prisma.TransactionClient,
    intent: SweepIntent,
  ) {
    const payloadHash = intentHash(intent);
    const assignment = await tx.depositAddressAssignment.findUniqueOrThrow({
      where: { id: intent.assignmentId },
    });
    if (
      !["READY", "RECOVERY_ACKED"].includes(assignment.state) ||
      assignment.address !== intent.source ||
      assignment.network !== intent.network
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    let sweep = await tx.treasurySweep.findUnique({
      where: { id: intent.id },
    });
    if (sweep === null)
      sweep = await tx.treasurySweep.create({
        data: {
          ...intent,
          amountUnits: BigInt(intent.amountUnits),
          createdAt: new Date(intent.createdAt),
          payloadHash,
        },
      });
    if (JSON.stringify(storedIntent(sweep)) !== JSON.stringify(intent))
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return sweep;
  }
  private async recoveredAttempt(
    tx: Prisma.TransactionClient,
    signed: SignedSnapshot,
  ) {
    const intent = signed.intent;
    const payloadHash = intentHash(intent);
    let attempt = await tx.transferAttempt.findUnique({
      where: { sweepId: intent.id },
    });
    if (attempt === null)
      attempt = await tx.transferAttempt.create({
        data: {
          id: signed.attemptId,
          sweepId: intent.id,
          intentHash: payloadHash,
          network: intent.network,
          tokenContract: intent.tokenContract,
          source: intent.source,
          treasury: intent.treasury,
          amountUnits: BigInt(intent.amountUnits),
        },
      });
    if (
      attempt.id !== signed.attemptId ||
      attempt.intentHash !== payloadHash ||
      (attempt.transactionId !== null &&
        attempt.transactionId !== signed.transaction.txID)
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return attempt;
  }
  private async retainSigned(
    tx: Prisma.TransactionClient,
    attempt: TransferAttempt,
    archived: ArchivedRecord,
    signed: SignedSnapshot,
  ): Promise<TransferAttempt> {
    if (
      attempt.envelopeDigest !== null &&
      (attempt.envelopeDigest !== envelopeDigest(archived.envelope) ||
        attempt.expiration !== BigInt(signed.transaction.raw_data.expiration) ||
        attempt.signedAt?.toISOString() !== signed.signedAt ||
        attempt.envelopeId !== archived.objectId ||
        attempt.recoveryAckId !== archived.ackId ||
        attempt.recoveryDigest !== archived.digest)
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    if (attempt.transactionId === null)
      return await tx.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          transactionId: signed.transaction.txID,
          expiration: BigInt(signed.transaction.raw_data.expiration),
          signedAt: new Date(signed.signedAt),
          envelopeId: archived.objectId,
          envelopeDigest: archived.digest,
          recoveryAckId: archived.ackId,
          recoveryDigest: archived.digest,
          recoveryAcknowledgedAt: new Date(archived.acknowledgedAt),
          state: "SIGNED",
          version: { increment: 1 },
        },
      });
    return attempt;
  }
  private async retainBroadcast(
    tx: Prisma.TransactionClient,
    attempt: TransferAttempt,
    broadcast: BroadcastSnapshot,
  ): Promise<TransferAttempt> {
    if (
      attempt.broadcastIntentId !== null &&
      (attempt.broadcastIntentId !== broadcast.broadcastIntentId ||
        attempt.broadcastAdmittedAt?.toISOString() !== broadcast.admittedAt ||
        attempt.observationBlockNumber !== BigInt(broadcast.floor.number) ||
        attempt.observationTimestamp !== BigInt(broadcast.floor.timestamp))
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    if (attempt.broadcastIntentId === null)
      return await tx.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          broadcastIntentId: broadcast.broadcastIntentId,
          broadcastAdmittedAt: new Date(broadcast.admittedAt),
          observationBlockNumber: BigInt(broadcast.floor.number),
          observationTimestamp: BigInt(broadcast.floor.timestamp),
          state: "UNKNOWN",
          version: { increment: 1 },
        },
      });
    return attempt;
  }
  private async restoreRecord(
    archived: ArchivedRecord,
    snapshot: { signed: SignedSnapshot; broadcast: BroadcastSnapshot | null },
  ): Promise<void> {
    await this.database.$transaction(async (tx) => {
      await treasuryAuthority(tx, "p06_recovery_operator");
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(606033::bigint)`,
      );
      if (
        !(
          await tx.financialRuntimeControl.findUniqueOrThrow({
            where: { id: 1 },
          })
        ).financialWritesFenced
      )
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      const sweep = await this.restoreClaim(tx, snapshot.signed.intent);
      const reserved = await this.recoveredAttempt(tx, snapshot.signed);
      const attempt =
        snapshot.broadcast === null
          ? await this.retainSigned(tx, reserved, archived, snapshot.signed)
          : await this.retainBroadcast(tx, reserved, snapshot.broadcast);
      await tx.treasurySweep.update({
        where: { id: sweep.id },
        data: {
          currentAttemptId: attempt.id,
          state: attempt.state,
          version: { increment: 1 },
        },
      });
    });
  }
  async restoreInventory(): Promise<number> {
    const seenSigned = new Set<string>();
    const seenBroadcast = new Set<string>();
    // Recover source claims and signed authority before linking possible sends.
    for (const type of ["SIGNED_ATTEMPT", "BROADCAST_INTENT"] as const) {
      let cursor: string | undefined;
      do {
        const page = await this.archive.list(cursor, type);
        for (const record of page.records) {
          const archived = await this.archive.get(
            record.objectId,
            record.version,
          );
          if (
            archived.type !== type ||
            archived.digest !== record.digest ||
            record.version !== 1
          )
            throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
          await this.keys.storeRecord(archived.envelope);
          const { signed, broadcast } =
            await this.authenticatedSnapshot(archived);
          if (
            type === "SIGNED_ATTEMPT" &&
            archived.objectId !== signed.attemptId
          )
            throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
          if (
            broadcast !== null &&
            (archived.objectId !== broadcast.broadcastIntentId ||
              !seenSigned.has(signed.attemptId))
          )
            throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
          await this.restoreRecord(archived, { signed, broadcast });
          if (broadcast === null) seenSigned.add(signed.attemptId);
          else seenBroadcast.add(broadcast.broadcastIntentId);
        }
        cursor = page.cursor ?? undefined;
      } while (cursor !== undefined);
    }
    await this.assertRecordedInventory(seenSigned, seenBroadcast);
    return seenSigned.size;
  }
}
