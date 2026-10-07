import { randomUUID } from "node:crypto";
import {
  Prisma,
  type DatabaseClient,
  type TreasurySweep,
} from "@template/database";
import { z } from "zod";
import { parseUsdtAmount } from "../../core/financial/money.js";
import { AppError } from "../../core/errors/app.error.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import { changeDispatchPause } from "../custody/runtime-control.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import {
  assertCurrentPolicy,
  intentHash,
  policySnapshot,
  sweepIntentSchema,
  treasuryCommandSchema,
  type SweepIntent,
  type TreasuryConfig,
} from "./treasury.intent.js";

export function storedIntent(sweep: TreasurySweep): SweepIntent {
  const intent = sweepIntentSchema.parse({
    id: sweep.id,
    assignmentId: sweep.assignmentId,
    network: sweep.network,
    tokenContract: sweep.tokenContract,
    source: sweep.source,
    treasury: sweep.treasury,
    amountUnits: String(sweep.amountUnits),
    policySnapshot: sweep.policySnapshot,
    operatorIdentity: sweep.operatorIdentity,
    reason: sweep.reason,
    createdAt: sweep.createdAt.toISOString(),
  });
  if (intentHash(intent) !== sweep.payloadHash) throw new TreasuryPolicyError();
  return intent;
}
export async function treasuryAuthority(
  transaction: Prisma.TransactionClient,
  role: "p06_signer" | "p06_recovery_operator",
): Promise<void> {
  const rows = await transaction.$queryRaw<
    { permitted: boolean; owner: boolean }[]
  >(
    Prisma.sql`SELECT p06_role_member(${role}) AS permitted, EXISTS (SELECT 1 FROM pg_class WHERE oid='financial_runtime_control'::regclass AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owner`,
  );
  if (rows[0]?.permitted !== true || rows[0].owner)
    throw new AppError(
      "Protected treasury authority required.",
      403,
      "TREASURY_AUTHORITY_DENIED",
    );
}
export class TreasuryService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly config: TreasuryConfig,
    private readonly operatorIdentity: string,
  ) {
    z.string().trim().min(1).max(160).parse(operatorIdentity);
  }
  async create(input: unknown) {
    const command = treasuryCommandSchema.parse(input);
    if (command.operation !== "CREATE") throw new TreasuryPolicyError();
    return this.database.$transaction(async (transaction) => {
      await treasuryAuthority(transaction, "p06_recovery_operator");
      await transaction.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock_shared(606033::bigint)`,
      );
      const control =
        await transaction.financialRuntimeControl.findUniqueOrThrow({
          where: { id: 1 },
        });
      if (control.financialWritesFenced)
        throw new AppError(
          "Financial recovery admission is closed.",
          409,
          "FINANCIAL_WRITES_FENCED",
        );
      await transaction.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${command.assignmentId},606026))`,
      );
      const assignment =
        await transaction.depositAddressAssignment.findUniqueOrThrow({
          where: { id: command.assignmentId },
        });
      if (
        assignment.state !== "READY" ||
        assignment.address === null ||
        assignment.network !== this.config.network
      )
        throw new TreasuryPolicyError();
      if (
        (await transaction.depositAddressAssignment.count({
          where: { address: this.config.treasury },
        })) !== 0
      )
        throw new TreasuryPolicyError();
      const prior = await transaction.treasurySweep.findUnique({
        where: { id: command.operationId },
      });
      const intent = sweepIntentSchema.parse({
        id: command.operationId,
        assignmentId: assignment.id,
        network: this.config.network,
        tokenContract: this.config.token.contract,
        source: assignment.address,
        treasury: this.config.treasury,
        amountUnits: String(parseUsdtAmount(command.amount)),
        policySnapshot: policySnapshot(this.config),
        operatorIdentity: this.operatorIdentity,
        reason: command.reason,
        createdAt: (prior?.createdAt ?? new Date()).toISOString(),
      });
      assertCurrentPolicy(intent, this.config);
      const payloadHash = intentHash(intent);
      if (prior !== null) {
        if (prior.payloadHash !== payloadHash) throw new TreasuryPolicyError();
        return prior;
      }
      return transaction.treasurySweep.create({
        data: {
          ...intent,
          amountUnits: BigInt(intent.amountUnits),
          createdAt: new Date(intent.createdAt),
          payloadHash,
        },
      });
    });
  }
  async status(id: string) {
    return this.database.$transaction(async (transaction) => {
      await treasuryAuthority(transaction, "p06_recovery_operator");
      return transaction.treasurySweep.findUniqueOrThrow({
        where: { id: z.uuid().parse(id) },
      });
    });
  }
  async pause(input: unknown): Promise<void> {
    const command = treasuryCommandSchema.parse(input);
    if (command.operation !== "PAUSE") throw new TreasuryPolicyError();
    await this.database.$transaction((transaction) =>
      treasuryAuthority(transaction, "p06_recovery_operator"),
    );
    await changeDispatchPause(this.database, {
      action: command.action,
      reason: command.reason,
      operatorIdentity: this.operatorIdentity,
    });
  }
}
export async function reserveSweepAttempt(
  database: DatabaseClient,
  admission: FinancialRuntimeAdmission,
  id: string,
  config: TreasuryConfig,
) {
  return database.$transaction(async (transaction) => {
    await treasuryAuthority(transaction, "p06_signer");
    await admission.assertDispatchAdmission(transaction);
    await transaction.$queryRaw(
      Prisma.sql`SELECT id FROM treasury_sweeps WHERE id=${id}::uuid FOR UPDATE`,
    );
    const sweep = await transaction.treasurySweep.findUniqueOrThrow({
      where: { id },
    });
    const intent = storedIntent(sweep);
    assertCurrentPolicy(intent, config);
    if (
      (await transaction.depositAddressAssignment.count({
        where: { address: config.treasury },
      })) !== 0
    )
      throw new TreasuryPolicyError();
    if (sweep.currentAttemptId !== null)
      return transaction.transferAttempt.findUniqueOrThrow({
        where: { id: sweep.currentAttemptId },
      });
    if (!["REQUESTED", "WAITING_RESOURCES"].includes(sweep.state))
      throw new TreasuryPolicyError();
    const attempt = await transaction.transferAttempt.create({
      data: {
        id: randomUUID(),
        sweepId: id,
        intentHash: sweep.payloadHash,
        network: sweep.network,
        tokenContract: sweep.tokenContract,
        source: sweep.source,
        treasury: sweep.treasury,
        amountUnits: sweep.amountUnits,
      },
    });
    await transaction.treasurySweep.update({
      where: { id },
      data: {
        currentAttemptId: attempt.id,
        state: "SIGNING",
        claimedAt: new Date(),
        lastErrorCode: null,
        version: { increment: 1 },
      },
    });
    return attempt;
  });
}
