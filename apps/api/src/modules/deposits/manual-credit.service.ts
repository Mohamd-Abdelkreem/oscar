import {
  manualCreditBodySchema,
  manualCreditParamsSchema,
  financialRequestKeySchema,
  type ManualCreditBody,
} from "@template/contracts";
import type { DatabaseClient, Prisma } from "@template/database";
import type { FinancialOperationResult } from "@template/contracts";
import { AppError } from "../../core/errors/app.error.js";
import { ValidationException } from "../../core/errors/index.js";
import { parseUsdtAmount } from "../../core/financial/money.js";
import {
  readSessionAuthority,
  runIdentityTransaction,
} from "../auth/session-authority.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { LedgerError } from "../ledger/ledger.errors.js";
import type {
  LedgerContext,
  LedgerGuardScope,
} from "../ledger/ledger.types.js";
import { depositOperationSelect, mapManualOutcome } from "./deposits.mapper.js";
import {
  checkOperation,
  operationEvidence,
  type LedgerDiscrepancy,
} from "../ledger/ledger-reconciliation.evidence.js";

type Identity = { userId: string; sessionId: string };

async function validateGrantEvidence(
  transaction: Prisma.TransactionClient,
  actionId: string,
) {
  const operation = await transaction.financialOperation.findUnique({
    where: {
      kind_businessNamespace_businessKey: {
        kind: "CREDIT",
        businessNamespace: "p06.manual-credit",
        businessKey: actionId,
      },
    },
    include: operationEvidence,
  });
  if (operation === null) return;
  const faults: LedgerDiscrepancy[] = [];
  checkOperation(operation, (fault) => faults.push(fault));
  if (faults.length > 0)
    throw new AppError(
      "Deposit evidence is unresolved.",
      409,
      "DEPOSIT_UNRESOLVED",
    );
}
async function persistManualCredit(
  transaction: Prisma.TransactionClient,
  input: {
    identity: Identity;
    body: ManualCreditBody;
    walletId: string;
    outcome: FinancialOperationResult;
  },
) {
  const { identity, body, walletId, outcome } = input;
  const operation = await transaction.financialOperation.findUniqueOrThrow({
    where: { id: outcome.operationId },
    select: { intentHash: true },
  });
  await transaction.manualCredit.create({
    data: {
      id: body.actionId,
      walletId,
      employeeId: body.employeeId,
      actorUserId: identity.userId,
      amountUnits: parseUsdtAmount(body.amount),
      source: "NON_REFERRAL",
      confirmed: true,
      reason: body.reason,
      referenceKind: body.reference.kind,
      externalReference:
        body.reference.kind === "EXTERNAL" ? body.reference.value : null,
      referenceOperationId:
        body.reference.kind === "LEDGER_OPERATION"
          ? body.reference.operationId
          : null,
      payloadHash: operation.intentHash,
      financialOperationId: outcome.operationId,
      recordedAt: new Date(outcome.recordedAt),
    },
  });
}
export class ManualCreditService {
  private readonly ledger: LedgerService;
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date,
    admission?: FinancialRuntimeAdmission,
  ) {
    this.ledger = new LedgerService(
      database,
      { businessNamespaces: ["p06.manual-credit"], processIds: [] },
      admission,
    );
  }
  private context(
    identity: Identity,
    walletId: string,
    body: ManualCreditBody,
  ): LedgerContext {
    const guard = async (scope: LedgerGuardScope) => {
      await readSessionAuthority(
        scope.transaction,
        identity,
        new Date(),
        "ADMIN",
      );
      await validateGrantEvidence(scope.transaction, body.actionId);
      const target = await scope.transaction.user.findUnique({
        where: { id: body.employeeId },
        select: { role: true },
      });
      if (
        target?.role !== "USER" ||
        scope.wallet.ownerUserId !== body.employeeId
      )
        throw new AppError(
          "Deposit target is unavailable.",
          404,
          "DEPOSIT_NOT_FOUND",
        );
      if (body.reference.kind === "LEDGER_OPERATION") {
        const reference = await scope.transaction.financialOperation.findFirst({
          where: { id: body.reference.operationId, walletId },
          select: { id: true },
        });
        if (reference === null)
          throw new AppError(
            "Administrative reference is invalid.",
            400,
            "MANUAL_CREDIT_REFERENCE_INVALID",
          );
      }
    };
    return {
      actor: { type: "USER", userId: identity.userId },
      walletIds: [walletId],
      authorityUserIds: [body.employeeId],
      clock: this.clock,
      observe: guard,
      mutate: guard,
    };
  }
  async create(identity: Identity, rawBody: unknown, rawKey: unknown) {
    const body = manualCreditBodySchema.parse(rawBody);
    const key = financialRequestKeySchema.safeParse(rawKey);
    if (!key.success)
      throw new ValidationException([
        {
          field: "headers.idempotency-key",
          message: "A valid financial request key is required.",
        },
      ]);
    const wallet = await this.database.wallet.findUnique({
      where: { ownerUserId: body.employeeId },
      select: { id: true },
    });
    if (wallet === null)
      throw new AppError(
        "Deposit target is unavailable.",
        404,
        "DEPOSIT_NOT_FOUND",
      );
    try {
      const reply = await this.ledger.execute(
        {
          kind: "CREDIT",
          walletId: wallet.id,
          businessNamespace: "p06.manual-credit",
          businessKey: body.actionId,
          requestKey: key.data,
          source: "NON_REFERRAL",
          origin: "ADMIN_ADJUSTMENT",
          amount: body.amount,
          grant: {
            actionId: body.actionId,
            confirmed: body.confirmed,
            reason: body.reason,
            reference: body.reference,
            actorUserId: identity.userId,
          },
        },
        this.context(identity, wallet.id, body),
        (transaction, outcome) =>
          persistManualCredit(transaction, {
            identity,
            body,
            walletId: wallet.id,
            outcome,
          }),
      );
      const operation =
        await this.database.financialOperation.findUniqueOrThrow({
          where: { id: reply.result.operationId },
          select: depositOperationSelect,
        });
      return mapManualOutcome(operation, reply.replayed);
    } catch (failure) {
      if (!(failure instanceof LedgerError)) throw failure;
      if (failure.cause instanceof AppError) throw failure.cause;
      if (failure.code === "LEDGER_IDENTITY_CONFLICT")
        throw new AppError(
          "Manual credit intent conflicts.",
          409,
          "MANUAL_CREDIT_CONFLICT",
        );
      if (failure.code === "LEDGER_AMOUNT_BOUNDS")
        throw new AppError(
          "Financial amount exceeds supported bounds.",
          409,
          "FINANCIAL_AMOUNT_OVERFLOW",
        );
      if (failure.code === "LEDGER_UNRESOLVED")
        throw new AppError(
          "Deposit evidence is unresolved.",
          409,
          "DEPOSIT_UNRESOLVED",
        );
      throw failure;
    }
  }
  async outcome(identity: Identity, rawActionId: unknown) {
    const { actionId } = manualCreditParamsSchema.parse({
      actionId: rawActionId,
    });
    return runIdentityTransaction(
      this.database,
      { userIds: [identity.userId], adminPopulation: false },
      async (transaction, now) => {
        await readSessionAuthority(transaction, identity, now, "ADMIN");
        await validateGrantEvidence(transaction, actionId);
        const operation = await transaction.financialOperation.findFirst({
          where: { manualCredit: { id: actionId } },
          select: depositOperationSelect,
        });
        if (operation === null)
          throw new AppError(
            "Deposit outcome is unavailable.",
            404,
            "DEPOSIT_NOT_FOUND",
          );
        return mapManualOutcome(operation, true);
      },
    );
  }
}
