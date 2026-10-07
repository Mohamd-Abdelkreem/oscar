import { Prisma, type DatabaseClient } from "@template/database";
import type { CustodyKeyStorage } from "../../infrastructure/custody/key-storage.js";
import { envelopeSchema } from "../../infrastructure/custody/key-storage.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import type { SshRecoveryStore } from "../../infrastructure/custody/recovery-store.js";

export class CustodyRecovery {
  constructor(
    private readonly database: DatabaseClient,
    private readonly keys: CustodyKeyStorage,
    private readonly archive: Pick<SshRecoveryStore, "get" | "put" | "list">,
  ) {}
  private async fenced(transaction: Prisma.TransactionClient): Promise<bigint> {
    await transaction.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(606033::bigint)`,
    );
    const rows = await transaction.$queryRaw<
      { generation: bigint; financial_writes_fenced: boolean }[]
    >(
      Prisma.sql`SELECT generation,financial_writes_fenced FROM financial_runtime_control WHERE id=1 FOR UPDATE`,
    );
    const control = rows[0];
    if (control === undefined || !control.financial_writes_fenced)
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return control.generation;
  }
  async restoreInventory(): Promise<{
    assignments: number;
    generation: bigint;
  }> {
    const generation = await this.database.$transaction((transaction) =>
      this.fenced(transaction),
    );
    let cursor: string | undefined;
    let assignments = 0;
    const observed = new Set<string>();
    const observedVersions = new Set<string>();
    do {
      const page = await this.archive.list(cursor);
      for (const record of page.records) {
        const archived = await this.archive.get(
          record.objectId,
          record.version,
        );
        const payload = this.keys.decrypt(archived.envelope);
        if (archived.digest !== record.digest)
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
        await this.keys.importEnvelope(archived.envelope);
        await this.restoreAssignment(archived, generation);
        observedVersions.add(
          `${archived.objectId}.${String(archived.version)}:${archived.digest}`,
        );
        if (!observed.has(payload.assignmentId)) {
          observed.add(payload.assignmentId);
          assignments++;
        }
      }
      cursor = page.cursor ?? undefined;
    } while (cursor !== undefined);
    let after: string | undefined;
    for (;;) {
      const rows = await this.database.depositAddressAssignment.findMany({
        take: 100,
        orderBy: { id: "asc" },
        ...(after === undefined ? {} : { where: { id: { gt: after } } }),
      });
      if (rows.length === 0) break;
      for (const row of rows) {
        if (
          row.address !== null &&
          (row.keyVersion === null ||
            row.keyEnvelopeDigest === null ||
            !observedVersions.has(
              `${row.keyRecordId}.${String(row.keyVersion)}:${row.keyEnvelopeDigest}`,
            ))
        )
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      }
      after = rows.at(-1)?.id;
    }
    await this.database.$transaction(async (transaction) => {
      if ((await this.fenced(transaction)) !== generation)
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    });
    return { assignments, generation };
  }
  private async restoreAssignment(
    archived: Awaited<ReturnType<SshRecoveryStore["get"]>>,
    generation: bigint,
  ): Promise<void> {
    const payload = this.keys.decrypt(archived.envelope);
    await this.database.$transaction(async (transaction) => {
      if ((await this.fenced(transaction)) !== generation)
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      const wallet = await transaction.wallet.findUnique({
        where: { id: payload.walletId },
      });
      const user = await transaction.user.findUnique({
        where: { id: payload.employeeId },
      });
      if (wallet?.ownerUserId !== payload.employeeId || user?.role !== "USER")
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      const existing = await transaction.depositAddressAssignment.findUnique({
        where: { id: payload.assignmentId },
      });
      if (existing !== null) {
        if (
          existing.keyRecordId !== archived.objectId ||
          existing.employeeId !== payload.employeeId ||
          existing.walletId !== payload.walletId ||
          existing.network !== payload.network ||
          existing.createdAt.toISOString() !== payload.createdAt ||
          (existing.address !== null && existing.address !== payload.address) ||
          (existing.scanBoundaryBlockNumber !== null &&
            (existing.scanBoundaryBlockNumber !==
              BigInt(payload.floor.number) ||
              existing.scanBoundaryBlockId !== payload.floor.id ||
              existing.scanBoundaryTimestamp !==
                BigInt(payload.floor.timestamp)))
        )
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
        if (
          existing.keyVersion !== null &&
          existing.keyVersion > archived.version
        )
          return;
        if (
          existing.keyVersion === archived.version &&
          existing.keyEnvelopeDigest !== null &&
          existing.keyEnvelopeDigest !== archived.digest
        )
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      }
      const recovered = {
        state: "RECOVERY_ACKED" as const,
        address: payload.address,
        scanBoundaryBlockNumber: BigInt(payload.floor.number),
        scanBoundaryBlockId: payload.floor.id,
        scanBoundaryTimestamp: BigInt(payload.floor.timestamp),
        keyEnvelopeDigest: archived.digest,
        keyVersion: archived.version,
        recoveryAckId: archived.ackId,
        recoveryDigest: archived.digest,
        recoveryAcknowledgedAt: new Date(archived.acknowledgedAt),
        leaseOwner: null,
        leaseUntil: null,
        lastErrorCode: null,
      };
      if (existing === null)
        await transaction.depositAddressAssignment.create({
          data: {
            id: payload.assignmentId,
            keyRecordId: archived.objectId,
            employeeId: payload.employeeId,
            walletId: payload.walletId,
            network: payload.network,
            createdAt: new Date(payload.createdAt),
            ...recovered,
          },
        });
      else
        await transaction.depositAddressAssignment.update({
          where: { id: existing.id },
          data: {
            ...recovered,
            state: existing.state === "READY" ? "READY" : "RECOVERY_ACKED",
            version: { increment: 1 },
          },
        });
    });
  }
  async rotate(assignmentId: string): Promise<void> {
    const generation = await this.database.$transaction((transaction) =>
      this.fenced(transaction),
    );
    const assignment =
      await this.database.depositAddressAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
      });
    if (assignment.keyVersion === null || assignment.address === null)
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    const original = await this.archive.get(
      assignment.keyRecordId,
      assignment.keyVersion,
    );
    if (original.digest !== assignment.keyEnvelopeDigest)
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    const replacement = await this.keys.rotate(
      envelopeSchema.parse(original.envelope),
    );
    const ack = await this.archive.put(replacement.envelope);
    await this.restoreAssignment(
      { ...ack, operation: "GET", envelope: replacement.envelope },
      generation,
    );
  }
}
