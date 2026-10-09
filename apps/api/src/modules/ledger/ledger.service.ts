import { createHash, randomUUID } from "node:crypto";

import { financialInstantSchema } from "@template/contracts";
import type {
  DatabaseClient,
  FinancialOperation,
  Prisma,
} from "@template/database";

import { formatUsdtAmount } from "../../core/financial/money.js";
import {
  planNewEffect,
  runAuthorityGuard,
  type PlannedEffect,
} from "./ledger.effects.js";
import { LedgerError } from "./ledger.errors.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import {
  mapRecordedOutcome,
  mapSourceAllocation,
  mapWalletComponents,
} from "./ledger.mapper.js";
import {
  checkActorAccount,
  isIdentityUniqueConflict,
  runLedgerTransaction,
  runLedgerObservation,
  validateLedgerContext,
  type LockedLedgerTransaction,
} from "./ledger.transaction.js";
import {
  acceptedTermsSchema,
  ledgerIntentSchema,
  type LedgerContext,
  type LedgerDomainWrite,
  type LedgerGuardScope,
  type LedgerIntent,
  type LedgerPolicy,
  type LedgerReply,
  type TransactionLedger,
  type LedgerObservationContext,
} from "./ledger.types.js";
import { reconcileWallet } from "./ledger-reconciliation.js";

const HASH_ALGORITHM = "sha256";
const intentFingerprint = (intent: LedgerIntent): string => {
  const consequential = [
    intent.kind,
    intent.walletId,
    intent.businessNamespace,
    intent.businessKey,
  ];
  if (intent.kind !== "RELEASE" && intent.kind !== "SETTLE")
    consequential.push(intent.amount);
  if (intent.kind === "SETTLE")
    consequential.push(JSON.stringify(intent.withdrawalTerms));
  if (intent.kind === "CREDIT")
    consequential.push(intent.source, intent.origin);
  if (intent.kind === "CREDIT" && intent.grant !== undefined)
    consequential.push(JSON.stringify(intent.grant));
  if (intent.kind === "CORRECTION")
    consequential.push(
      intent.source,
      intent.direction,
      intent.reason,
      intent.referenceOperationId,
    );
  if (
    intent.kind === "RESERVE" ||
    intent.kind === "RELEASE" ||
    intent.kind === "SETTLE"
  )
    consequential.push(intent.reservationId);
  return createHash(HASH_ALGORITHM)
    .update(JSON.stringify(consequential))
    .digest("hex");
};
const actorFields = (context: LedgerContext) =>
  context.actor.type === "USER"
    ? {
        actorType: "USER" as const,
        actorUserId: context.actor.userId,
        actorProcessId: null,
      }
    : {
        actorType: "PROCESS" as const,
        actorUserId: null,
        actorProcessId: context.actor.processId,
      };
const actorScope = (context: LedgerContext) =>
  context.actor.type === "USER"
    ? `USER:${context.actor.userId}`
    : `PROCESS:${context.actor.processId}`;

export class LedgerService {
  private readonly policy: LedgerPolicy;
  constructor(
    private readonly database: DatabaseClient,
    policy: LedgerPolicy,
    private readonly admission?: FinancialRuntimeAdmission,
  ) {
    this.policy = {
      businessNamespaces: [...policy.businessNamespaces],
      processIds: [...policy.processIds],
    };
  }

  async reconcileWallet(walletId: unknown, context: LedgerObservationContext) {
    return reconcileWallet(this.database, this.policy, walletId, context);
  }

  async execute(
    rawIntent: unknown,
    rawContext: unknown,
    domainWrite?: LedgerDomainWrite,
  ): Promise<LedgerReply> {
    const context = validateLedgerContext(rawContext, this.policy);
    const intent = this.validateIntent(rawIntent);
    try {
      return await runLedgerTransaction(
        this.database,
        context,
        (locked) => this.apply(intent, context, locked, domainWrite),
        this.admission,
      );
    } catch (error) {
      if (!isIdentityUniqueConflict(error)) throw error;
      const recovered = await this.recoverOperation(intent, context);
      if (recovered === null) throw new LedgerError("LEDGER_UNRESOLVED");
      return recovered;
    }
  }

  async recoverOperation(
    rawIntent: unknown,
    rawContext: unknown,
  ): Promise<LedgerReply | null> {
    const context = validateLedgerContext(rawContext, this.policy);
    const intent = this.validateIntent(rawIntent);
    try {
      return await runLedgerObservation(
        this.database,
        context,
        async (locked) => {
          await this.observationScope(intent, context, locked);
          return this.findReplay(intent, context, locked.transaction);
        },
      );
    } catch (error) {
      if (isIdentityUniqueConflict(error))
        throw new LedgerError("LEDGER_UNRESOLVED");
      throw error;
    }
  }

  async runInTransaction<T>(
    rawContext: LedgerContext,
    work: (
      transaction: Prisma.TransactionClient,
      ledger: TransactionLedger,
    ) => Promise<T>,
  ): Promise<T> {
    const context = validateLedgerContext(rawContext, this.policy);
    try {
      return await runLedgerTransaction(
        this.database,
        context,
        async (locked) => {
          let operationRunning = false;
          let rollbackFailure: { error: unknown } | undefined;
          const apply = async (
            intent: LedgerIntent,
            domainWrite?: LedgerDomainWrite,
          ) => {
            try {
              if (rollbackFailure !== undefined) throw rollbackFailure.error;
              if (operationRunning)
                throw new LedgerError("LEDGER_INVALID_TRANSACTION");
              operationRunning = true;
              return await this.apply(
                this.validateIntent(intent),
                context,
                locked,
                domainWrite,
              );
            } catch (error) {
              rollbackFailure ??= { error };
              throw error;
            } finally {
              operationRunning = false;
            }
          };
          const ledger: TransactionLedger = {
            credit: apply,
            debitForPurchase: apply,
            reserveForWithdrawal: apply,
            releaseReservation: apply,
            correctAvailable: apply,
            settleReservation: apply,
          };
          let result: T;
          try {
            result = await work(locked.transaction, ledger);
          } catch (error) {
            throw rollbackFailure === undefined ? error : rollbackFailure.error;
          }
          if (rollbackFailure !== undefined) throw rollbackFailure.error;
          return result;
        },
        this.admission,
      );
    } catch (error) {
      if (isIdentityUniqueConflict(error))
        throw new LedgerError("LEDGER_IDENTITY_CONFLICT");
      throw error;
    }
  }

  private validateIntent(rawIntent: unknown): LedgerIntent {
    const parsed = ledgerIntentSchema.safeParse(rawIntent);
    if (
      !parsed.success ||
      !this.policy.businessNamespaces.includes(parsed.data.businessNamespace)
    )
      throw new LedgerError("LEDGER_INVALID_INTENT");
    return Object.freeze(parsed.data);
  }

  private async observationScope(
    intent: LedgerIntent,
    context: LedgerContext,
    locked: LockedLedgerTransaction,
  ): Promise<LedgerGuardScope> {
    locked.assertActive();
    const wallet = await locked.wallet(intent.walletId);
    const accounts =
      context.actor.type === "USER"
        ? await locked.transaction.user.findMany({
            where: { id: context.actor.userId },
          })
        : [];
    const actorAccount = checkActorAccount(context, accounts);
    const scope = {
      transaction: locked.transaction,
      wallet: Object.freeze({ ...wallet }),
      actor: Object.freeze({ ...context.actor }),
      actorAccount,
      intent,
    };
    await runAuthorityGuard(() => context.observe(scope));
    return scope;
  }

  private async apply(
    intent: LedgerIntent,
    context: LedgerContext,
    locked: LockedLedgerTransaction,
    domainWrite?: LedgerDomainWrite,
  ): Promise<LedgerReply> {
    const scope = await this.observationScope(intent, context, locked);
    const replay = await this.findReplay(intent, context, locked.transaction);
    if (replay !== null) {
      await this.bindAlias(
        locked.transaction,
        intent,
        context,
        replay.result.operationId,
      );
      return replay;
    }
    await runAuthorityGuard(() => context.mutate(scope));
    const effect = await planNewEffect(intent, context, scope);
    const recordedAt = financialInstantSchema.safeParse(
      context.clock().toISOString(),
    );
    if (!recordedAt.success) throw new LedgerError("LEDGER_INVALID_INTENT");
    const operationId = randomUUID();
    const result = this.newOutcome({
      operationId,
      intent,
      effect,
      recordedAt: recordedAt.data,
    });
    await this.persistEffect({
      transaction: locked.transaction,
      intent,
      context,
      effect,
      result,
    });
    if (domainWrite !== undefined)
      await domainWrite(locked.transaction, result);
    return { result, replayed: false };
  }

  private newOutcome({
    operationId,
    intent,
    effect,
    recordedAt,
  }: {
    operationId: string;
    intent: LedgerIntent;
    effect: PlannedEffect;
    recordedAt: string;
  }) {
    const base = {
      operationId,
      walletId: intent.walletId,
      recordedAt,
      kind: intent.kind,
      amount: formatUsdtAmount(effect.magnitudeUnits),
      walletAfter: mapWalletComponents(effect.after),
    };
    if (
      intent.kind === "RESERVE" ||
      intent.kind === "RELEASE" ||
      intent.kind === "SETTLE"
    ) {
      if (effect.allocation === undefined)
        throw new LedgerError("LEDGER_INTERNAL");
      return mapRecordedOutcome({
        ...base,
        reservation: {
          id: effect.allocation.id,
          allocation: mapSourceAllocation(effect.allocation),
          state:
            intent.kind === "RESERVE"
              ? "ACTIVE"
              : intent.kind === "SETTLE"
                ? "SETTLED"
                : "RELEASED",
        },
      });
    }
    return mapRecordedOutcome(base);
  }

  private async persistEffect({
    transaction,
    intent,
    context,
    effect,
    result,
  }: {
    transaction: Prisma.TransactionClient;
    intent: LedgerIntent;
    context: LedgerContext;
    effect: PlannedEffect;
    result: LedgerReply["result"];
  }): Promise<void> {
    const recordedAt = new Date(result.recordedAt);
    const terms = acceptedTermsSchema.parse(effect.terms);
    await transaction.financialOperation.create({
      data: {
        id: result.operationId,
        walletId: intent.walletId,
        kind: intent.kind,
        businessNamespace: intent.businessNamespace,
        businessKey: intent.businessKey,
        intentHash: intentFingerprint(intent),
        magnitudeUnits: effect.magnitudeUnits,
        origin: effect.origin,
        ...actorFields(context),
        acceptedTerms: terms,
        outcome: result,
        createdAt: recordedAt,
      },
    });
    await transaction.ledgerPosting.createMany({
      data: effect.postings.map((posting) => ({
        ...posting,
        operationId: result.operationId,
        walletId: intent.walletId,
        createdAt: recordedAt,
      })),
    });
    await transaction.wallet.update({
      where: { id: intent.walletId },
      data: effect.after,
    });
    await this.persistAllocation(transaction, intent, effect, result);
    await transaction.auditRecord.create({
      data: {
        operationId: result.operationId,
        ...actorFields(context),
        action: intent.kind,
        ...(intent.kind === "CORRECTION"
          ? {
              reason: intent.reason,
              referenceOperationId: intent.referenceOperationId,
            }
          : {}),
        ...(intent.kind === "CREDIT" && intent.grant !== undefined
          ? {
              reason: intent.grant.reason,
              referenceOperationId:
                intent.grant.reference.kind === "LEDGER_OPERATION"
                  ? intent.grant.reference.operationId
                  : null,
            }
          : {}),
        createdAt: recordedAt,
      },
    });
    await this.bindAlias(transaction, intent, context, result.operationId);
  }

  private async persistAllocation(
    transaction: Prisma.TransactionClient,
    intent: LedgerIntent,
    effect: PlannedEffect,
    result: LedgerReply["result"],
  ): Promise<void> {
    if (
      intent.kind !== "RESERVE" &&
      intent.kind !== "RELEASE" &&
      intent.kind !== "SETTLE"
    )
      return;
    if (effect.allocation === undefined)
      throw new LedgerError("LEDGER_INTERNAL");
    if (intent.kind === "RESERVE") {
      const { id, nonReferralUnits, referralUnits, grossUnits } =
        effect.allocation;
      await transaction.reservationAllocation.create({
        data: {
          id,
          nonReferralUnits,
          referralUnits,
          grossUnits,
          walletId: intent.walletId,
          openingOperationId: result.operationId,
          createdAt: new Date(result.recordedAt),
        },
      });
      return;
    }
    const changed = await transaction.reservationAllocation.updateMany({
      where: {
        id: intent.reservationId,
        walletId: intent.walletId,
        state: "ACTIVE",
      },
      data: {
        ...(intent.kind === "SETTLE"
          ? {
              state: "SETTLED" as const,
              settlementOperationId: result.operationId,
              settledAt: new Date(result.recordedAt),
            }
          : {
              state: "RELEASED" as const,
              releaseOperationId: result.operationId,
              releasedAt: new Date(result.recordedAt),
            }),
      },
    });
    if (changed.count !== 1) throw new LedgerError("LEDGER_RESERVATION_CLOSED");
  }

  private async findReplay(
    intent: LedgerIntent,
    context: LedgerContext,
    transaction: Prisma.TransactionClient,
  ): Promise<LedgerReply | null> {
    const hash = intentFingerprint(intent);
    const business = await transaction.financialOperation.findUnique({
      where: {
        kind_businessNamespace_businessKey: {
          kind: intent.kind,
          businessNamespace: intent.businessNamespace,
          businessKey: intent.businessKey,
        },
      },
    });
    const alias =
      intent.requestKey === undefined
        ? null
        : await transaction.requestIdentity.findUnique({
            where: {
              actorScope_kind_requestKey: {
                actorScope: actorScope(context),
                kind: intent.kind,
                requestKey: intent.requestKey,
              },
            },
            include: { operation: true },
          });
    if (
      alias !== null &&
      (alias.intentHash !== hash ||
        alias.operation.walletId !== intent.walletId ||
        business?.id !== alias.operationId)
    )
      throw new LedgerError("LEDGER_IDENTITY_CONFLICT");
    if (business === null) return null;
    this.assertMatchingOperation(business, intent, hash);
    return { result: mapRecordedOutcome(business.outcome), replayed: true };
  }

  private assertMatchingOperation(
    operation: FinancialOperation,
    intent: LedgerIntent,
    hash: string,
  ): void {
    if (operation.walletId !== intent.walletId || operation.intentHash !== hash)
      throw new LedgerError("LEDGER_IDENTITY_CONFLICT");
    const outcome = mapRecordedOutcome(operation.outcome);
    if (
      outcome.operationId !== operation.id ||
      outcome.walletId !== operation.walletId ||
      outcome.kind !== operation.kind ||
      outcome.amount !== formatUsdtAmount(operation.magnitudeUnits) ||
      outcome.recordedAt !== operation.createdAt.toISOString()
    )
      throw new LedgerError("LEDGER_INTERNAL");
  }

  private async bindAlias(
    transaction: Prisma.TransactionClient,
    intent: LedgerIntent,
    context: LedgerContext,
    operationId: string,
  ): Promise<void> {
    if (intent.requestKey === undefined) return;
    const scope = actorScope(context);
    const existing = await transaction.requestIdentity.findUnique({
      where: {
        actorScope_kind_requestKey: {
          actorScope: scope,
          kind: intent.kind,
          requestKey: intent.requestKey,
        },
      },
    });
    if (existing !== null) {
      if (
        existing.operationId !== operationId ||
        existing.intentHash !== intentFingerprint(intent)
      )
        throw new LedgerError("LEDGER_IDENTITY_CONFLICT");
      return;
    }
    await transaction.requestIdentity.create({
      data: {
        operationId,
        actorScope: scope,
        kind: intent.kind,
        requestKey: intent.requestKey,
        intentHash: intentFingerprint(intent),
      },
    });
  }
}
