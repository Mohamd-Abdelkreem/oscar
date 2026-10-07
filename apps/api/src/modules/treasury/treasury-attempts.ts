import { randomUUID } from "node:crypto";
import {
  Prisma,
  type DatabaseClient,
  type TransferAttempt,
} from "@template/database";
import { z } from "zod";
import type { CustodyKeyStorage } from "../../infrastructure/custody/key-storage.js";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import type { RecoveryEnvelope } from "../../infrastructure/custody/encrypted-envelope.js";
import type { SshRecoveryStore } from "../../infrastructure/custody/recovery-store.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import type { TronProvider } from "../../infrastructure/tron/tron-provider.js";
import {
  assertSweepTransaction,
  signSweepTransaction,
  sweepTransactionSchema,
  TreasuryPolicyError,
} from "../../infrastructure/tron/tron-signer.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import {
  assertCurrentPolicy,
  intentHash,
  sweepIntentSchema,
  type TreasuryConfig,
  type SweepIntent,
} from "./treasury.intent.js";
import {
  reserveSweepAttempt,
  storedIntent,
  treasuryAuthority,
} from "./treasury.service.js";
import type { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";

export const signedAttemptSchema = z
  .object({
    attemptId: z.uuid(),
    intent: sweepIntentSchema,
    signedAt: z.iso.datetime(),
    transaction: sweepTransactionSchema,
  })
  .strict();
export const broadcastIntentSchema = z
  .object({
    signed: signedAttemptSchema,
    broadcastIntentId: z.uuid(),
    admittedAt: z.iso.datetime(),
    floor: z
      .object({
        number: z.number().int().nonnegative(),
        id: z.string().regex(/^[0-9a-f]{64}$/u),
        timestamp: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
type TreasuryStores = Readonly<{
  keys: CustodyKeyStorage;
  archive: Pick<SshRecoveryStore, "get" | "put" | "list">;
}>;
export type TreasuryProvider = Pick<
  TronProvider,
  | "block"
  | "solidifiedFloor"
  | "sweepAccount"
  | "resources"
  | "chainParameters"
  | "tokenBalance"
  | "estimateSweep"
  | "buildSweep"
  | "broadcastSweep"
>;
const safeUnits = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export class TreasuryAttempts {
  private readonly stores: TreasuryStores;
  private readonly provider: TreasuryProvider;
  private readonly clock: () => Date;
  private readonly signals: RuntimeSignals | undefined;
  constructor(
    private readonly database: DatabaseClient,
    private readonly admission: FinancialRuntimeAdmission,
    private readonly config: TreasuryConfig,
    dependencies: Readonly<{
      stores: TreasuryStores;
      provider: TreasuryProvider;
      clock?: () => Date;
      signals?: RuntimeSignals;
    }>,
  ) {
    this.stores = dependencies.stores;
    this.provider = dependencies.provider;
    this.clock = dependencies.clock ?? (() => new Date());
    this.signals = dependencies.signals;
  }
  private async checkResources(attempt: TransferAttempt): Promise<void> {
    try {
      await this.resources(attempt.source, attempt.amountUnits);
      this.signals?.observe("RESOURCE_SHORTFALL", false, {
        processKind: "SIGNER",
        attemptId: attempt.id,
      });
    } catch (failure) {
      this.signals?.observe("RESOURCE_SHORTFALL", true, {
        processKind: "SIGNER",
        attemptId: attempt.id,
        code:
          failure instanceof TreasuryPolicyError
            ? failure.code
            : "TREASURY_RESOURCES_UNAVAILABLE",
      });
      if (failure instanceof z.ZodError)
        throw new TreasuryPolicyError("TREASURY_RESOURCES_UNAVAILABLE");
      throw failure;
    }
  }
  private async retained(
    id: string,
    type: RecoveryEnvelope["type"],
    requireArchive = false,
  ) {
    const local = await this.stores.keys.readRecord(id);
    let remote: RecoveryEnvelope | null = null;
    try {
      remote = (await this.stores.archive.get(id, 1)).envelope;
    } catch (failure) {
      if (
        !(failure instanceof CustodyStorageError) ||
        failure.code !== "RECOVERY_NOT_FOUND"
      )
        throw failure;
    }
    if (requireArchive && remote === null) throw new TreasuryPolicyError();
    if (
      local !== null &&
      remote !== null &&
      envelopeDigest(local) !== envelopeDigest(remote)
    )
      throw new TreasuryPolicyError();
    const retained = local ?? remote;
    if (retained !== null) {
      if (retained.type !== type) throw new TreasuryPolicyError();
      await this.stores.keys.storeRecord(retained);
    }
    return retained;
  }
  private async recoveredSourceKey(intent: SweepIntent) {
    const assignment =
      await this.database.depositAddressAssignment.findUniqueOrThrow({
        where: { id: intent.assignmentId },
      });
    if (assignment.keyVersion === null) throw new TreasuryPolicyError();
    const keyEnvelope = await this.stores.keys.read(
      assignment.keyRecordId,
      assignment.keyVersion,
    );
    if (
      keyEnvelope === null ||
      envelopeDigest(keyEnvelope) !== assignment.keyEnvelopeDigest
    )
      throw new TreasuryPolicyError();
    const key = this.stores.keys.decrypt(keyEnvelope);
    if (
      key.assignmentId !== assignment.id ||
      key.employeeId !== assignment.employeeId ||
      key.walletId !== assignment.walletId ||
      key.address !== intent.source ||
      key.network !== intent.network
    )
      throw new TreasuryPolicyError();
    return key;
  }
  private async allowedSignedTransaction(
    intent: SweepIntent,
    privateKey: string,
  ) {
    const unsigned = await this.provider.buildSweep(
      intent.source,
      intent.treasury,
      BigInt(intent.amountUnits),
      this.config.energyFeeLimitSun,
    );
    const returned = await signSweepTransaction(
      unsigned,
      { ...intent, amountUnits: BigInt(intent.amountUnits) },
      {
        now: this.clock().getTime(),
        maximumFeeSun: this.config.energyFeeLimitSun,
      },
      privateKey,
    );
    return returned;
  }
  private async buildSignedEnvelope(
    attempt: TransferAttempt,
    intent: SweepIntent,
  ) {
    await this.checkResources(attempt);
    const key = await this.recoveredSourceKey(intent);
    const returned = await this.allowedSignedTransaction(
      intent,
      key.privateKey,
    );
    const snapshot = signedAttemptSchema.parse({
      attemptId: attempt.id,
      intent,
      signedAt: this.clock().toISOString(),
      transaction: returned,
    });
    return this.stores.keys.storeRecord(
      this.stores.keys.sealRecord("SIGNED_ATTEMPT", attempt.id, snapshot),
    );
  }
  private async acknowledgeSignedRecord(
    attempt: TransferAttempt,
    envelope: RecoveryEnvelope,
  ): Promise<TransferAttempt> {
    const sealed = this.validateSigned(envelope, attempt);
    const acknowledgement = await this.stores.archive.put(envelope);
    const digest = envelopeDigest(envelope);
    return this.database.$transaction(async (transaction) => {
      await treasuryAuthority(transaction, "p06_signer");
      await this.admission.assertMutationAdmission(transaction);
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM transfer_attempts WHERE id=${attempt.id}::uuid FOR UPDATE`,
      );
      const current = await transaction.transferAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      if (current.transactionId !== null) {
        if (
          current.transactionId !== sealed.transaction.txID ||
          current.envelopeDigest !== digest
        )
          throw new TreasuryPolicyError();
        return current;
      }
      const updated = await transaction.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          transactionId: sealed.transaction.txID,
          expiration: BigInt(sealed.transaction.raw_data.expiration),
          signedAt: new Date(sealed.signedAt),
          envelopeId: attempt.id,
          envelopeDigest: digest,
          recoveryAckId: acknowledgement.ackId,
          recoveryDigest: digest,
          recoveryAcknowledgedAt: new Date(acknowledgement.acknowledgedAt),
          state: "SIGNED",
          version: { increment: 1 },
        },
      });
      await transaction.treasurySweep.update({
        where: { id: attempt.sweepId },
        data: { state: "SIGNED", version: { increment: 1 } },
      });
      return updated;
    });
  }
  async sign(id: string): Promise<TransferAttempt> {
    const attempt = await reserveSweepAttempt(
      this.database,
      this.admission,
      id,
      this.config,
    );
    if (!["SIGNING", "SIGNED"].includes(attempt.state)) return attempt;
    const intent = storedIntent(
      await this.database.treasurySweep.findUniqueOrThrow({ where: { id } }),
    );
    let envelope = await this.retained(
      attempt.id,
      "SIGNED_ATTEMPT",
      attempt.transactionId !== null,
    );
    if (envelope === null) {
      if (attempt.transactionId !== null) throw new TreasuryPolicyError();
      envelope = await this.buildSignedEnvelope(attempt, intent);
    }
    return this.acknowledgeSignedRecord(attempt, envelope);
  }
  validateSigned(envelope: RecoveryEnvelope, attempt: TransferAttempt) {
    const sealed = signedAttemptSchema.parse(
      this.stores.keys.openRecord(envelope),
    );
    if (
      sealed.attemptId !== attempt.id ||
      intentHash(sealed.intent) !== attempt.intentHash ||
      envelope.objectId !== attempt.id
    )
      throw new TreasuryPolicyError();
    assertCurrentPolicy(sealed.intent, this.config);
    assertSweepTransaction(
      sealed.transaction,
      { ...sealed.intent, amountUnits: BigInt(sealed.intent.amountUnits) },
      {
        now: this.clock().getTime(),
        maximumFeeSun: this.config.energyFeeLimitSun,
        signed: true,
        historical: true,
      },
    );
    return sealed;
  }
  async resources(source: string, amountUnits: bigint): Promise<void> {
    await this.provider.solidifiedFloor();
    const [accountInput, resourceInput, parameterInput, balance, energy] =
      await Promise.all([
        this.provider.sweepAccount(source),
        this.provider.resources(source),
        this.provider.chainParameters(),
        this.provider.tokenBalance(source),
        this.provider.estimateSweep(source, this.config.treasury, amountUnits),
      ]);
    const account = z
      .object({
        address: z.literal(source),
        balance: safeUnits,
        owner_permission: z.object({
          threshold: z.literal(1),
          keys: z
            .array(
              z.object({ address: z.literal(source), weight: z.literal(1) }),
            )
            .length(1),
        }),
      })
      .parse(accountInput);
    const resources = z
      .object({
        EnergyLimit: safeUnits.default(0),
        EnergyUsed: safeUnits.default(0),
      })
      .parse(resourceInput);
    const parameters = z
      .object({
        chainParameter: z
          .array(
            z.object({
              key: z.string(),
              value: z
                .number()
                .int()
                .min(Number.MIN_SAFE_INTEGER)
                .max(Number.MAX_SAFE_INTEGER)
                .optional(),
            }),
          )
          .max(200),
      })
      .parse(parameterInput).chainParameter;
    const energyPrice = parameters.find((p) => p.key === "getEnergyFee")?.value;
    const bandwidthPrice = parameters.find(
      (p) => p.key === "getTransactionFee",
    )?.value;
    if (
      energyPrice === undefined ||
      bandwidthPrice === undefined ||
      energyPrice <= 0 ||
      bandwidthPrice <= 0
    )
      throw new TreasuryPolicyError("TREASURY_RESOURCES_UNAVAILABLE");
    // Reserve the largest permitted raw payload, protobuf framing, one signature and result bytes.
    const companyBudget =
      this.config.energyFeeLimitSun +
      (8192n + 3n + 65n + 3n + 64n) * BigInt(bandwidthPrice);
    const paidEnergy =
      BigInt(
        Math.max(
          0,
          safeUnits.positive().parse(energy) -
            Math.max(0, resources.EnergyLimit - resources.EnergyUsed),
        ),
      ) * BigInt(energyPrice);
    if (
      balance < amountUnits ||
      paidEnergy > this.config.energyFeeLimitSun ||
      companyBudget > this.config.maximumCompanyCostSun ||
      BigInt(account.balance) < companyBudget
    )
      throw new TreasuryPolicyError("TREASURY_RESOURCE_SHORTFALL");
  }
  private assertBroadcastable(attempt: TransferAttempt): void {
    if (
      !["SIGNED", "SUBMITTED", "UNKNOWN"].includes(attempt.state) ||
      attempt.expiration === null ||
      attempt.expiration <= BigInt(this.clock().getTime()) ||
      attempt.attemptCount >= this.config.maximumAttempts
    )
      throw new TreasuryPolicyError();
  }
  private async admitBroadcast(
    attempt: TransferAttempt,
    floor: Awaited<ReturnType<TreasuryProvider["solidifiedFloor"]>>,
  ): Promise<TransferAttempt> {
    return this.database.$transaction(async (transaction) => {
      await treasuryAuthority(transaction, "p06_signer");
      await this.admission.assertDispatchAdmission(transaction);
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM transfer_attempts WHERE id=${attempt.id}::uuid FOR UPDATE`,
      );
      const current = await transaction.transferAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      const sweep = await transaction.treasurySweep.findUniqueOrThrow({
        where: { id: attempt.sweepId },
      });
      assertCurrentPolicy(storedIntent(sweep), this.config);
      this.assertBroadcastable(current);
      return transaction.transferAttempt.update({
        where: { id: current.id },
        data: {
          ...(current.broadcastIntentId === null
            ? {
                broadcastIntentId: randomUUID(),
                broadcastAdmittedAt: this.clock(),
                observationBlockNumber: BigInt(floor.number),
                observationTimestamp: BigInt(floor.timestamp),
              }
            : {}),
          attemptCount: { increment: 1 },
          state: "UNKNOWN",
          version: { increment: 1 },
          nextAttemptAt: new Date(this.clock().getTime() + 300000),
        },
      });
    });
  }
  private admittedBroadcastContext(attempt: TransferAttempt) {
    if (
      attempt.broadcastIntentId === null ||
      attempt.broadcastAdmittedAt === null ||
      attempt.observationBlockNumber === null ||
      attempt.observationTimestamp === null
    )
      throw new TreasuryPolicyError();
    return {
      id: attempt.broadcastIntentId,
      admittedAt: attempt.broadcastAdmittedAt,
      blockNumber: attempt.observationBlockNumber,
      timestamp: attempt.observationTimestamp,
    };
  }
  private assertBroadcastIntent(
    intent: z.infer<typeof broadcastIntentSchema>,
    recorded: ReturnType<TreasuryAttempts["admittedBroadcastContext"]>,
    signed: z.infer<typeof signedAttemptSchema>,
  ): void {
    if (
      intent.broadcastIntentId !== recorded.id ||
      JSON.stringify(intent.signed) !== JSON.stringify(signed) ||
      intent.admittedAt !== recorded.admittedAt.toISOString() ||
      BigInt(intent.floor.number) !== recorded.blockNumber ||
      BigInt(intent.floor.timestamp) !== recorded.timestamp
    )
      throw new TreasuryPolicyError();
  }
  private async acknowledgeBroadcast(
    attempt: TransferAttempt,
    signed: z.infer<typeof signedAttemptSchema>,
  ): Promise<void> {
    const recorded = this.admittedBroadcastContext(attempt);
    let broadcast = await this.retained(recorded.id, "BROADCAST_INTENT");
    if (broadcast === null) {
      const originalFloor = await this.provider.block(
        Number(recorded.blockNumber),
      );
      if (BigInt(originalFloor.timestamp) !== recorded.timestamp)
        throw new TreasuryPolicyError();
      broadcast = await this.stores.keys.storeRecord(
        this.stores.keys.sealRecord(
          "BROADCAST_INTENT",
          recorded.id,
          broadcastIntentSchema.parse({
            signed,
            broadcastIntentId: recorded.id,
            admittedAt: recorded.admittedAt.toISOString(),
            floor: originalFloor,
          }),
        ),
      );
    }
    const intent = broadcastIntentSchema.parse(
      this.stores.keys.openRecord(broadcast),
    );
    this.assertBroadcastIntent(intent, recorded, signed);
    await this.stores.archive.put(broadcast);
  }
  private async recordBroadcastOutcome(
    attempt: TransferAttempt,
    state: "SUBMITTED" | "UNKNOWN",
  ): Promise<TransferAttempt> {
    return this.database.$transaction(async (transaction) => {
      await treasuryAuthority(transaction, "p06_signer");
      const updated = await transaction.transferAttempt.updateMany({
        where: { id: attempt.id, state: "UNKNOWN" },
        data: {
          state: state,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 0)
        await transaction.treasurySweep.update({
          where: { id: attempt.sweepId },
          data: {
            state: state,
            version: { increment: 1 },
          },
        });
      return transaction.transferAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
    });
  }
  private async sendAdmittedTransaction(
    attempt: TransferAttempt,
    signed: z.infer<typeof signedAttemptSchema>,
  ): Promise<TransferAttempt> {
    if (signed.transaction.raw_data.expiration <= this.clock().getTime())
      return attempt;
    let submitted = false;
    try {
      submitted = await this.provider.broadcastSweep(signed.transaction);
    } catch {
      /* A possibly sent object retains UNKNOWN regardless of transport failure. */
    }
    this.signals?.observe("UNRESOLVED_ATTEMPT", !submitted, {
      processKind: "SIGNER",
      attemptId: attempt.id,
      code: "TREASURY_BROADCAST_UNCERTAIN",
    });
    return this.recordBroadcastOutcome(
      attempt,
      submitted ? "SUBMITTED" : "UNKNOWN",
    );
  }
  async broadcast(id: string): Promise<TransferAttempt> {
    const reserved = await this.database.transferAttempt.findUniqueOrThrow({
      where: { sweepId: id },
    });
    this.assertBroadcastable(reserved);
    const envelope = await this.retained(reserved.id, "SIGNED_ATTEMPT", true);
    if (
      envelope === null ||
      envelopeDigest(envelope) !== reserved.envelopeDigest
    )
      throw new TreasuryPolicyError();
    const signed = this.validateSigned(envelope, reserved);
    await this.checkResources(reserved);
    const admitted = await this.admitBroadcast(
      reserved,
      await this.provider.solidifiedFloor(),
    );
    await this.acknowledgeBroadcast(admitted, signed);
    return this.sendAdmittedTransaction(admitted, signed);
  }
}
