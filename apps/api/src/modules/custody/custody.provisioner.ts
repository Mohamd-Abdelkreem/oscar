import {
  Prisma,
  type DatabaseClient,
  type DepositAddressAssignment,
} from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import type {
  CustodyKeyStorage,
  KeyBinding,
  KeyEnvelope,
} from "../../infrastructure/custody/key-storage.js";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import type { SshRecoveryStore } from "../../infrastructure/custody/recovery-store.js";
import {
  TronProviderError,
  type TronProvider,
} from "../../infrastructure/tron/tron-provider.js";
import type { FinancialRuntimeAdmission } from "./runtime-control.js";
import type { CustodyMetadata } from "./custody.service.js";

export class CustodyProvisioner {
  constructor(
    private readonly database: DatabaseClient,
    private readonly metadata: CustodyMetadata,
    private readonly admission: FinancialRuntimeAdmission,
    private readonly collaborators: Readonly<{
      keys: CustodyKeyStorage;
      recovery: Pick<SshRecoveryStore, "get" | "put">;
      provider: Pick<TronProvider, "solidifiedFloor">;
    }>,
  ) {}
  async provisionNext(): Promise<string | null> {
    const assignment = await this.claim();
    if (assignment === null) return null;
    try {
      return await this.provision(assignment);
    } catch (failure) {
      if (
        failure instanceof CustodyStorageError ||
        failure instanceof TronProviderError
      ) {
        const reason =
          failure.code === "CUSTODY_EVIDENCE_CONFLICT" ||
          failure.code === "TRON_IDENTITY_CONFLICT"
            ? "EVIDENCE_CONFLICT"
            : failure instanceof TronProviderError
              ? "PROVIDER_UNAVAILABLE"
              : "RECOVERY_UNAVAILABLE";
        await this.database.$transaction(async (transaction) => {
          await this.admission.assertMutationAdmission(transaction);
          await transaction.depositAddressAssignment.updateMany({
            where: {
              id: assignment.id,
              leaseOwner: this.admission.bootId,
              state: { not: "READY" },
            },
            data: {
              leaseOwner: null,
              leaseUntil: null,
              nextAttemptAt: new Date(Date.now() + 1000),
              lastErrorCode: reason,
              version: { increment: 1 },
            },
          });
        });
      }
      throw failure;
    }
  }
  private async provision(
    assignment: DepositAddressAssignment,
  ): Promise<string> {
    const floor =
      assignment.scanBoundaryBlockNumber === null
        ? await this.collaborators.provider.solidifiedFloor()
        : this.savedFloor(assignment);
    let current = assignment;
    if (assignment.scanBoundaryBlockNumber === null)
      current = await this.transition(assignment, {
        scanBoundaryBlockNumber: BigInt(floor.number),
        scanBoundaryBlockId: floor.id,
        scanBoundaryTimestamp: BigInt(floor.timestamp),
      });
    const binding: KeyBinding = {
      assignmentId: current.id,
      employeeId: current.employeeId,
      walletId: current.walletId,
      network: current.network,
      createdAt: current.createdAt.toISOString(),
      floor,
    };
    const envelope = await this.retainedEnvelope(current, binding);
    const payload = this.collaborators.keys.decrypt(envelope);
    this.collaborators.keys.assertBinding(payload, binding);
    const digest = envelopeDigest(envelope);
    if (current.state === "REQUESTED")
      current = await this.transition(current, {
        state: "KEY_STORED",
        address: payload.address,
        keyEnvelopeDigest: digest,
        keyVersion: envelope.version,
      });
    if (
      current.address !== payload.address ||
      current.keyEnvelopeDigest !== digest
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    const ack = await this.collaborators.recovery.put(envelope);
    if (
      ack.objectId !== envelope.objectId ||
      ack.version !== envelope.version ||
      ack.digest !== digest
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    if (current.state === "KEY_STORED")
      current = await this.transition(current, {
        state: "RECOVERY_ACKED",
        recoveryAckId: ack.ackId,
        recoveryDigest: ack.digest,
        recoveryAcknowledgedAt: new Date(ack.acknowledgedAt),
      });
    if (
      current.recoveryAckId !== ack.ackId ||
      current.recoveryDigest !== ack.digest
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    await this.transition(current, {
      state: "READY",
      readyAt: new Date(),
      leaseOwner: null,
      leaseUntil: null,
      lastErrorCode: null,
    });
    return current.id;
  }
  private savedFloor(assignment: DepositAddressAssignment) {
    if (
      assignment.scanBoundaryBlockNumber === null ||
      assignment.scanBoundaryBlockId === null ||
      assignment.scanBoundaryTimestamp === null
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return {
      number: Number(assignment.scanBoundaryBlockNumber),
      id: assignment.scanBoundaryBlockId,
      timestamp: Number(assignment.scanBoundaryTimestamp),
    };
  }
  private async retainedEnvelope(
    assignment: DepositAddressAssignment,
    binding: KeyBinding,
  ): Promise<KeyEnvelope> {
    const version = assignment.keyVersion ?? 1;
    const local = await this.collaborators.keys.read(
      assignment.keyRecordId,
      version,
    );
    if (local !== null) return local;
    try {
      const archived = await this.collaborators.recovery.get(
        assignment.keyRecordId,
        version,
      );
      this.collaborators.keys.assertBinding(
        this.collaborators.keys.decrypt(archived.envelope),
        binding,
      );
      return await this.collaborators.keys.importEnvelope(archived.envelope);
    } catch (failure) {
      if (
        !(failure instanceof CustodyStorageError) ||
        failure.code !== "RECOVERY_NOT_FOUND"
      )
        throw failure;
      if (assignment.state !== "REQUESTED")
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      return (
        await this.collaborators.keys.obtain(assignment.keyRecordId, binding)
      ).envelope;
    }
  }
  private async claim(): Promise<DepositAddressAssignment | null> {
    if (this.admission.processKind !== "SIGNER")
      throw new AppError(
        "Custody requires signer authority.",
        403,
        "FORBIDDEN",
      );
    return this.database.$transaction(async (transaction) => {
      await this.admission.assertMutationAdmission(transaction);
      const rows = await transaction.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM deposit_address_assignments WHERE network=${this.metadata.network}::tron_network AND state<>'READY' AND last_error_code IS DISTINCT FROM 'EVIDENCE_CONFLICT' AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      );
      const claim = rows[0];
      if (claim === undefined) return null;
      return transaction.depositAddressAssignment.update({
        where: { id: claim.id },
        data: {
          leaseOwner: this.admission.bootId,
          leaseUntil: new Date(Date.now() + 60000),
          version: { increment: 1 },
        },
      });
    });
  }
  private async transition(
    assignment: DepositAddressAssignment,
    changes: Prisma.DepositAddressAssignmentUpdateManyMutationInput,
  ): Promise<DepositAddressAssignment> {
    return this.database.$transaction(async (transaction) => {
      await this.admission.assertMutationAdmission(transaction);
      const updated = await transaction.depositAddressAssignment.updateMany({
        where: {
          id: assignment.id,
          version: assignment.version,
          state: assignment.state,
          leaseOwner: this.admission.bootId,
          leaseUntil: { gt: new Date() },
        },
        data: { ...changes, version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new AppError(
          "Custody claim conflicted.",
          409,
          "CUSTODY_CLAIM_CONFLICT",
        );
      return transaction.depositAddressAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      });
    });
  }
}
