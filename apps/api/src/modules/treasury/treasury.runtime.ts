import type { DatabaseClient } from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import { TronProviderError } from "../../infrastructure/tron/tron-provider.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import type { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";

export function readDueTreasurySweeps(database: DatabaseClient, now: Date) {
  return database.treasurySweep.findMany({
    where: {
      state: { in: ["REQUESTED", "WAITING_RESOURCES", "SIGNING", "SIGNED"] },
      nextAttemptAt: { lte: now },
      OR: [
        { attempt: { is: null } },
        { attempt: { is: { nextAttemptAt: { lte: now } } } },
      ],
    },
    take: 20,
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}

// A waiting/paused source must not starve observations or independent sources.
export async function runTreasuryOperation(
  request: Readonly<{
    database: DatabaseClient;
    sweepId: string;
    signals: RuntimeSignals;
    operation: () => Promise<void>;
    clock?: () => Date;
  }>,
): Promise<void> {
  try {
    await request.operation();
  } catch (failure) {
    if (
      !(failure instanceof AppError) &&
      !(failure instanceof TreasuryPolicyError) &&
      !(failure instanceof TronProviderError) &&
      !(failure instanceof CustodyStorageError)
    )
      throw failure;
    const attempt = await request.database.transferAttempt.findUnique({
      where: { sweepId: request.sweepId },
    });
    const conflict =
      failure.code === "TREASURY_POLICY_CONFLICT" ||
      failure.code === "CUSTODY_EVIDENCE_CONFLICT" ||
      failure.code === "TRON_IDENTITY_CONFLICT";
    const nextAttemptAt = new Date(
      (request.clock?.() ?? new Date()).getTime() + 300000,
    );
    if (attempt === null) {
      const sweep = await request.database.treasurySweep.findUniqueOrThrow({
        where: { id: request.sweepId },
      });
      await request.database.treasurySweep.updateMany({
        where: {
          id: sweep.id,
          currentAttemptId: null,
          state: { in: ["REQUESTED", "WAITING_RESOURCES"] },
        },
        data: {
          nextAttemptAt,
          lastErrorCode: failure.code,
          version: { increment: 1 },
        },
      });
      if (conflict)
        request.signals.observe("EVIDENCE_CONFLICT", true, {
          processKind: "SIGNER",
          assignmentId: sweep.assignmentId,
          code: failure.code,
        });
      return;
    }
    if (conflict)
      request.signals.observe("EVIDENCE_CONFLICT", true, {
        processKind: "SIGNER",
        attemptId: attempt.id,
        code: failure.code,
      });
    await request.database.transferAttempt.updateMany({
      where: {
        id: attempt.id,
        state: { in: ["SIGNING", "SIGNED", "SUBMITTED", "UNKNOWN"] },
      },
      data: {
        nextAttemptAt,
        lastErrorCode: failure.code,
        version: { increment: 1 },
      },
    });
  }
}
