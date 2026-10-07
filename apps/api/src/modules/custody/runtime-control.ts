import { randomUUID } from "node:crypto";
import {
  Prisma,
  type DatabaseClient,
  type FinancialProcessKind,
} from "@template/database";
import { z } from "zod";
import { AppError } from "../../core/errors/app.error.js";
import type { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";

const ADMISSION_LOCK = 606033n;
const referenceSchema = z.string().regex(/^[A-Za-z0-9._:-]{1,256}$/u);
const operatorSchema = z.string().trim().min(1).max(160);
const reasonSchema = z.string().trim().min(1).max(500);
const recoveryEvidenceSchema = z
  .object({
    financialHistoryReference: referenceSchema,
    assignmentInventoryReference: referenceSchema,
    attemptInventoryReference: referenceSchema,
    reconciliationReference: referenceSchema,
    reconciliationCutoff: z.date(),
    financialHistoryRecoveredThrough: z.date(),
  })
  .strict();
export type RecoveryAdmissionEvidence = z.infer<typeof recoveryEvidenceSchema>;

function fenced(): never {
  throw new AppError(
    "Financial recovery admission is closed.",
    409,
    "FINANCIAL_WRITES_FENCED",
  );
}

type LockedControl = {
  generation: bigint;
  financial_writes_fenced: boolean;
  new_dispatch_paused: boolean;
};
async function sharedControl(
  transaction: Prisma.TransactionClient,
): Promise<LockedControl> {
  await transaction.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock_shared(${ADMISSION_LOCK}::bigint)`,
  );
  const rows = await transaction.$queryRaw<LockedControl[]>(
    Prisma.sql`SELECT generation,financial_writes_fenced,new_dispatch_paused FROM financial_runtime_control WHERE id=1 FOR SHARE`,
  );
  const control = rows[0];
  if (control === undefined || control.financial_writes_fenced) fenced();
  return control;
}

// Only entrypoints construct this object; no restored/client/job/environment UUID is accepted.
export class FinancialRuntimeAdmission {
  readonly bootId = randomUUID();
  private registered = false;
  constructor(
    private readonly database: DatabaseClient,
    readonly processKind: FinancialProcessKind,
  ) {}

  async register(): Promise<void> {
    if (this.registered)
      throw new Error("Financial boot is already registered.");
    await this.database.financialRuntimeAdmission.create({
      data: { bootId: this.bootId, processKind: this.processKind },
    });
    this.registered = true;
  }

  async assertMutationAdmission(
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    await this.admittedControl(transaction);
  }

  async assertDispatchAdmission(
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    const control = await this.admittedControl(transaction);
    if (this.processKind !== "SIGNER" || control.new_dispatch_paused) {
      throw new AppError(
        "New transfer dispatch is paused.",
        409,
        "NEW_DISPATCH_PAUSED",
      );
    }
  }

  private async admittedControl(
    transaction: Prisma.TransactionClient,
  ): Promise<LockedControl> {
    if (!this.registered) fenced();
    const control = await sharedControl(transaction);
    const rows = await transaction.$queryRaw<
      {
        acknowledged_generation: bigint | null;
        process_kind: FinancialProcessKind;
      }[]
    >(
      Prisma.sql`SELECT acknowledged_generation,process_kind FROM financial_runtime_admissions WHERE boot_id=${this.bootId}::uuid FOR SHARE`,
    );
    const boot = rows[0];
    if (
      boot === undefined ||
      boot.process_kind !== this.processKind ||
      boot.acknowledged_generation !== control.generation
    )
      fenced();
    return control;
  }
}

async function exclusiveControl(transaction: Prisma.TransactionClient) {
  await transaction.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(${ADMISSION_LOCK}::bigint)`,
  );
  await transaction.$queryRaw(
    Prisma.sql`SELECT id FROM financial_runtime_control WHERE id=1 FOR UPDATE`,
  );
  return transaction.financialRuntimeControl.findUniqueOrThrow({
    where: { id: 1 },
  });
}

export async function fenceFinancialRuntime(
  database: DatabaseClient,
  authority: {
    operatorIdentity: string;
    reason: string;
    signals?: RuntimeSignals;
  },
): Promise<void> {
  const operatorIdentity = operatorSchema.parse(authority.operatorIdentity);
  const reason = reasonSchema.parse(authority.reason);
  await database.$transaction(async (transaction) => {
    const control = await exclusiveControl(transaction);
    await transaction.financialRuntimeControl.update({
      where: { id: 1 },
      data: {
        generation: control.generation + 1n,
        version: { increment: 1 },
        financialWritesFenced: true,
        newDispatchPaused: true,
        operatorIdentity,
        reason,
        updatedAt: new Date(),
        evidenceReference: null,
        reconciliationCutoff: null,
      },
    });
  });
  authority.signals?.admission("FENCED", { processKind: "RECOVERY_OPERATOR" });
}

// Protected tooling supplies verified inventory/history references; runtime roles cannot approve.
// Full inventory/chain/WAL verification belongs to the recovery workflow, not caller booleans.
export async function acknowledgeFinancialBoot(
  database: DatabaseClient,
  approval: {
    bootId: string;
    additionalBootIds?: readonly string[];
    operatorIdentity: string;
    reason: string;
    evidence: RecoveryAdmissionEvidence;
    expectedGeneration?: bigint;
    expectedFencedVersion?: number;
    signals?: RuntimeSignals;
  },
): Promise<void> {
  const bootId = z.uuid().parse(approval.bootId);
  const bootIds = [
    bootId,
    ...z
      .array(z.uuid())
      .max(63)
      .parse(approval.additionalBootIds ?? []),
  ];
  if (new Set(bootIds).size !== bootIds.length) fenced();
  const operatorIdentity = operatorSchema.parse(approval.operatorIdentity);
  const reason = reasonSchema.parse(approval.reason);
  const evidence = recoveryEvidenceSchema.parse(approval.evidence);
  const now = new Date();
  if (
    evidence.reconciliationCutoff > now ||
    evidence.financialHistoryRecoveredThrough > now ||
    evidence.financialHistoryRecoveredThrough < evidence.reconciliationCutoff
  )
    fenced();
  const evidenceReference = evidence.reconciliationReference;
  await database.$transaction(async (transaction) => {
    const control = await exclusiveControl(transaction);
    if (
      approval.expectedGeneration !== undefined &&
      control.generation !== approval.expectedGeneration
    )
      fenced();
    if (
      approval.expectedFencedVersion !== undefined &&
      (!control.financialWritesFenced ||
        control.version !== approval.expectedFencedVersion)
    )
      fenced();
    for (const selectedBootId of bootIds)
      await transaction.financialRuntimeAdmission.update({
        where: { bootId: selectedBootId },
        data: {
          acknowledgedGeneration: control.generation,
          acknowledgedAt: now,
          operatorIdentity,
          evidenceReference,
        },
      });
    await transaction.financialRuntimeControl.update({
      where: { id: 1 },
      data: {
        financialWritesFenced: false,
        version: { increment: 1 },
        operatorIdentity,
        reason,
        evidenceReference,
        reconciliationCutoff: evidence.reconciliationCutoff,
        updatedAt: now,
      },
    });
  });
  for (const selectedBootId of bootIds)
    approval.signals?.admission("ACKNOWLEDGED", {
      processKind: "RECOVERY_OPERATOR",
      bootId: selectedBootId,
    });
}

export async function changeDispatchPause(
  database: DatabaseClient,
  request: {
    action: "PAUSE" | "RESUME";
    operatorIdentity: string;
    reason: string;
  },
): Promise<void> {
  const operatorIdentity = operatorSchema.parse(request.operatorIdentity);
  const reason = reasonSchema.parse(request.reason);
  const action = z.enum(["PAUSE", "RESUME"]).parse(request.action);
  await database.$transaction(async (transaction) => {
    const control = await exclusiveControl(transaction);
    if (action === "RESUME" && control.financialWritesFenced) fenced();
    await transaction.financialRuntimeControl.update({
      where: { id: 1 },
      data: {
        newDispatchPaused: action === "PAUSE",
        version: { increment: 1 },
        operatorIdentity,
        reason,
        updatedAt: new Date(),
      },
    });
  });
}
