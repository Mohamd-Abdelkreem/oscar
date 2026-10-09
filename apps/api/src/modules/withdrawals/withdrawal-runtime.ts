import type { DatabaseClient } from "@template/database";
import { z } from "zod";
import { AppError } from "../../core/errors/app.error.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import type { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";
import { TronProviderError } from "../../infrastructure/tron/tron-provider.js";
import { TronReceiptError } from "../../infrastructure/tron/tron-receipt.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import type { WithdrawalAttempts } from "./withdrawal-attempts.js";
import type { WithdrawalSignerConfig } from "../../core/config/withdrawal.config.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import type { WithdrawalRecovery } from "./withdrawal-recovery.js";
import { LedgerError } from "../ledger/ledger.errors.js";

const blockers = [
  "LIQUIDITY_SHORTFALL",
  "RESOURCE_SHORTFALL",
  "PROVIDER_UNAVAILABLE",
  "RECOVERY_UNAVAILABLE",
  "EVIDENCE_CONFLICT",
  "UNRESOLVED_ATTEMPT",
  "DISPATCH_PAUSED",
] as const;
type Blocker = (typeof blockers)[number];

function failureBlocker(failure: unknown): Blocker {
  if (
    failure instanceof LedgerError &&
    failure.code === "LEDGER_INTERNAL" &&
    failure.cause instanceof TreasuryPolicyError
  )
    return failureBlocker(failure.cause);
  if (failure instanceof z.ZodError) return "EVIDENCE_CONFLICT";
  if (failure instanceof TronReceiptError)
    return failure.code === "DEPOSIT_UNFINALIZED"
      ? "UNRESOLVED_ATTEMPT"
      : "EVIDENCE_CONFLICT";
  if (failure instanceof CustodyStorageError)
    return failure.code === "CUSTODY_EVIDENCE_CONFLICT"
      ? "EVIDENCE_CONFLICT"
      : "RECOVERY_UNAVAILABLE";
  if (failure instanceof TronProviderError)
    return failure.code === "TRON_UNFINALIZED"
      ? "UNRESOLVED_ATTEMPT"
      : failure.code === "TRON_IDENTITY_CONFLICT"
        ? "EVIDENCE_CONFLICT"
        : "PROVIDER_UNAVAILABLE";
  if (failure instanceof AppError && failure.code === "NEW_DISPATCH_PAUSED")
    return "DISPATCH_PAUSED";
  if (failure instanceof TreasuryPolicyError) {
    const known = blockers.find((blocker) => blocker === failure.code);
    if (known !== undefined) return known;
    if (failure.code === "PAYOUT_NOT_DISPATCHABLE") return "DISPATCH_PAUSED";
    return "EVIDENCE_CONFLICT";
  }
  throw failure;
}

function observeBlockers(
  signals: RuntimeSignals,
  requestId: string,
  active: readonly Blocker[],
) {
  for (const event of blockers) {
    const blocked = active.includes(event);
    signals.observe(event, blocked, {
      processKind: "SIGNER",
      withdrawalId: requestId,
      ...(blocked ? { code: event } : {}),
    });
  }
}

// Blocker retries use admitted original-request locks and never change money, bytes or the source lane.
export async function runWithdrawalOperation(input: {
  database: DatabaseClient;
  attempts: WithdrawalAttempts;
  signals: RuntimeSignals;
  requestId: string;
  operation: () => Promise<unknown>;
}): Promise<void> {
  try {
    await input.operation();
  } catch (failure) {
    if (
      failure instanceof AppError &&
      failure.code === "FINANCIAL_WRITES_FENCED"
    ) {
      input.signals.observe("RUNTIME_ADMISSION", true, {
        processKind: "SIGNER",
        code: "FINANCIAL_WRITES_FENCED",
      });
      return;
    }
    const blocker = failureBlocker(failure);
    await input.attempts.transactions.mutate(input.requestId, async (scope) => {
      if (
        ["COMPLETED", "FAILED", "CANCELLED", "REJECTED"].includes(
          scope.request.state,
        )
      )
        return;
      const nextCheckAt = new Date(
        Math.max(
          scope.now.getTime() + 30000,
          scope.request.nextCheckAt?.getTime() ?? 0,
          scope.attempt?.nextCheckAt.getTime() ?? 0,
        ),
      );
      await scope.transaction.withdrawalRequest.update({
        where: { id: input.requestId },
        data: { blocker, nextCheckAt },
      });
      if (scope.attempt !== null)
        await scope.transaction.withdrawalAttempt.update({
          where: { id: scope.attempt.id },
          data: { blocker, nextCheckAt, version: { increment: 1 } },
        });
    });
  }
  const request = await input.database.withdrawalRequest.findUniqueOrThrow({
    where: { id: input.requestId },
    select: { state: true, blocker: true },
  });
  const active = ["COMPLETED", "FAILED", "CANCELLED", "REJECTED"].includes(
    request.state,
  )
    ? []
    : blockers.filter(
        (blocker) =>
          blocker === request.blocker ||
          (blocker === "UNRESOLVED_ATTEMPT" && request.state === "UNKNOWN"),
      );
  observeBlockers(input.signals, input.requestId, active);
}

export class WithdrawalPayoutRuntime {
  private lastScan = -Infinity;
  private lastRepair = -Infinity;
  private inventoryReady = false;
  constructor(
    private readonly context: {
      database: DatabaseClient;
      admission: FinancialRuntimeAdmission;
      attempts: WithdrawalAttempts;
      recovery: WithdrawalRecovery;
      archive: Parameters<WithdrawalRecovery["assertInventory"]>[0];
      treasuryKeyId: string;
      config: WithdrawalSignerConfig;
      signals: RuntimeSignals;
      clock: () => Date;
    },
  ) {}

  async tick(stopping: () => boolean): Promise<void> {
    try {
      await this.scan(stopping);
    } catch (failure) {
      if (
        failure instanceof AppError &&
        failure.code === "FINANCIAL_WRITES_FENCED"
      ) {
        this.context.signals.observe("RUNTIME_ADMISSION", true, {
          processKind: "SIGNER",
          code: "FINANCIAL_WRITES_FENCED",
        });
        return;
      }
      this.context.signals.observe(failureBlocker(failure), true, {
        processKind: "SIGNER",
      });
    }
  }

  private async scan(stopping: () => boolean): Promise<void> {
    const now = this.context.clock();
    if (
      stopping() ||
      now.getTime() - this.lastScan < this.context.config.scanIntervalMs
    )
      return;
    this.lastScan = now.getTime();
    await this.observePending(now);
    const repair =
      now.getTime() - this.lastRepair >= this.context.config.repairIntervalMs;
    if (repair) {
      this.lastRepair = now.getTime();
      this.inventoryReady = false;
      try {
        await this.context.recovery.assertInventory(this.context.archive);
        this.inventoryReady = true;
        this.context.signals.observe("RECOVERY_UNAVAILABLE", false, {
          processKind: "SIGNER",
        });
        this.context.signals.observe("EVIDENCE_CONFLICT", false, {
          processKind: "SIGNER",
        });
      } catch (failure) {
        this.context.signals.observe(failureBlocker(failure), true, {
          processKind: "SIGNER",
        });
        return;
      }
    }
    if (!this.inventoryReady || stopping()) return;
    await this.context.database.$transaction((transaction) =>
      this.context.admission.assertMutationAdmission(transaction),
    );
    await this.reconcileRetained(now, stopping);
    if (stopping()) return;
    const due = await this.context.database.withdrawalRequest.findMany({
      where: {
        state: "SCHEDULED",
        dispatchAt: { lte: now },
        AND: [
          { OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }] },
          ...(repair ? [] : [{ nextCheckAt: { not: null } }]),
        ],
      },
      orderBy: [{ dispatchAt: "asc" }, { id: "asc" }],
      take: this.context.config.batchSize,
      select: { id: true },
    });
    for (const request of due) {
      if (stopping()) break;
      await this.dispatchOriginal(request.id, stopping);
    }
  }

  private async reconcileRetained(now: Date, stopping: () => boolean) {
    const pending = await this.context.database.withdrawalAttempt.findMany({
      where: {
        treasuryKeyId: this.context.treasuryKeyId,
        state: { notIn: ["CONFIRMED_SUCCESS", "CHAIN_FAILED"] },
        nextCheckAt: { lte: now },
      },
      orderBy: [{ nextCheckAt: "asc" }, { id: "asc" }],
      take: this.context.config.batchSize,
    });
    for (const attempt of pending) {
      if (stopping()) break;
      if (attempt.broadcastAckId === null)
        await this.dispatchOriginal(attempt.withdrawalId, stopping);
      else
        await runWithdrawalOperation({
          ...this.context,
          requestId: attempt.withdrawalId,
          operation: () =>
            this.context.attempts.broadcast(attempt.withdrawalId),
        });
    }
  }

  private async observePending(now: Date) {
    // Saved dispatch time survives restarts and backoff; this read grants no send authority.
    const oldest = await this.context.database.withdrawalRequest.findFirst({
      where: {
        state: {
          in: ["SCHEDULED", "SIGNING", "SIGNED", "SUBMITTED", "UNKNOWN"],
        },
        dispatchAt: { lte: now },
      },
      orderBy: [{ dispatchAt: "asc" }, { id: "asc" }],
      select: { dispatchAt: true },
    });
    const ageMs =
      oldest === null
        ? 0
        : Math.min(
            Number.MAX_SAFE_INTEGER,
            now.getTime() - oldest.dispatchAt.getTime(),
          );
    this.context.signals.observe(
      "PENDING_WORK",
      oldest !== null && ageMs >= this.context.config.pendingAlertAfterMs,
      {
        processKind: "SIGNER",
        ...(oldest === null ? {} : { ageMs }),
      },
    );
  }

  private async dispatchOriginal(requestId: string, stopping: () => boolean) {
    await runWithdrawalOperation({
      ...this.context,
      requestId,
      operation: async () => {
        const signed = await this.context.attempts.sign(requestId);
        if (signed !== null && signed.signedRecordId !== null && !stopping())
          await this.context.attempts.broadcast(requestId);
      },
    });
  }
}
