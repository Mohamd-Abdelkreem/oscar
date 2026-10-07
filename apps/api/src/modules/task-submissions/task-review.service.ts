import { z } from "zod";
import {
  submissionReviewSchema,
  type SubmissionReview,
} from "@template/contracts";
import type {
  DatabaseClient,
  Prisma,
  TaskSubmission,
} from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import { LedgerService } from "../ledger/ledger.service.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import type {
  LedgerGuardScope,
  TransactionLedger,
} from "../ledger/ledger.types.js";
import { lockImageAsset } from "../proofs/proof-authority.js";
import type { ProofReadService } from "../proofs/proof-read.service.js";
import { TaskCommandService } from "../tasks/task-command.service.js";
import {
  authorizeTaskActor,
  type TaskActorIdentity,
  type TaskClock,
} from "../tasks/task-transaction.js";
import {
  mapAdminSubmissionDetail,
  submissionInclude,
} from "./task-submissions.mapper.js";

export class TaskReviewService {
  private readonly ledger: LedgerService;
  private readonly commands: TaskCommandService;
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: TaskClock,
    reads?: ProofReadService,
    admission?: FinancialRuntimeAdmission,
  ) {
    this.ledger = new LedgerService(
      database,
      {
        businessNamespaces: ["p05.task-reward"],
        processIds: [],
      },
      admission,
    );
    this.commands = new TaskCommandService(database, clock, reads);
  }

  async review(
    identity: TaskActorIdentity,
    submissionId: string,
    body: unknown,
  ) {
    z.uuid().parse(submissionId);
    const payload = submissionReviewSchema.parse(body);
    await readSessionAuthority(this.database, identity, this.clock(), "ADMIN");
    // Only immutable participant IDs are read before the ledger's sorted locks.
    const target = await this.database.taskSubmission.findUnique({
      where: { id: submissionId },
      select: { employeeId: true, taskId: true },
    });
    if (target === null)
      throw new AppError("Submission not found.", 404, "NOT_FOUND");
    const wallet = await this.database.wallet.findUniqueOrThrow({
      where: { ownerUserId: target.employeeId },
      select: { id: true },
    });
    const requireAdmin = async ({
      transaction,
      wallet: lockedWallet,
    }: LedgerGuardScope) => {
      await authorizeTaskActor(transaction, identity, {
        role: "ADMIN",
        clock: this.clock,
      });
      if (lockedWallet.ownerUserId !== target.employeeId)
        throw new AppError("Wallet authority denied.", 403, "FORBIDDEN");
    };
    await this.ledger.runInTransaction(
      {
        actor: { type: "USER", userId: identity.userId },
        walletIds: [wallet.id],
        clock: this.clock,
        observe: requireAdmin,
        mutate: requireAdmin,
      },
      (transaction, ledger) =>
        this.commands.executeInTransaction(
          transaction,
          {
            identity,
            intent: { kind: "FINAL_REVIEW", targetId: submissionId, payload },
          },
          {
            otherUserIds: [target.employeeId],
            lock: () =>
              this.lockCurrentEvidence(transaction, {
                taskId: target.taskId,
                submissionId,
              }),
            commit: async (_transaction, { now }) => {
              const submission =
                await transaction.taskSubmission.findUniqueOrThrow({
                  where: { id: submissionId },
                });
              this.assertPendingVersions(submission, payload);
              await this.saveDecision({
                transaction,
                ledger,
                submission,
                payload,
                identity,
                now,
                walletId: wallet.id,
              });
              const saved = await transaction.taskSubmission.findUniqueOrThrow({
                where: { id: submissionId },
                include: submissionInclude,
              });
              return {
                taskId: saved.taskId,
                submissionId,
                outcome: mapAdminSubmissionDetail(saved),
                beforeSnapshot: {
                  status: submission.status,
                  version: submission.version,
                  evidenceVersion: submission.currentEvidenceVersion,
                },
                afterSnapshot: {
                  status: saved.status,
                  version: saved.version,
                  evidenceVersion: saved.currentEvidenceVersion,
                },
              };
            },
          },
        ),
    );
    return this.commands.observe(
      { kind: "FINAL_REVIEW", commandId: payload.commandId },
      identity,
    );
  }

  private async lockCurrentEvidence(
    transaction: Prisma.TransactionClient,
    target: { taskId: string; submissionId: string },
  ) {
    await transaction.$queryRaw`SELECT id FROM tasks WHERE id=${target.taskId}::uuid FOR UPDATE`;
    await transaction.$queryRaw`SELECT id FROM task_submissions WHERE id=${target.submissionId}::uuid FOR UPDATE`;
    const current = await transaction.taskSubmission.findUniqueOrThrow({
      where: { id: target.submissionId },
      select: { currentEvidenceVersion: true },
    });
    const evidence = await transaction.submissionEvidence.findUniqueOrThrow({
      where: {
        submissionId_version: {
          submissionId: target.submissionId,
          version: current.currentEvidenceVersion,
        },
      },
      select: { assetId: true },
    });
    // Submission locking freezes the current pointer; only that asset participates in this review.
    await lockImageAsset(transaction, evidence.assetId);
  }

  private assertPendingVersions(
    submission: TaskSubmission,
    payload: SubmissionReview,
  ) {
    if (submission.status !== "PENDING")
      throw new AppError("Submission is final.", 409, "SUBMISSION_FINAL");
    if (submission.version !== payload.expectedSubmissionVersion)
      throw new AppError(
        "Submission version changed.",
        409,
        "SUBMISSION_VERSION_CONFLICT",
      );
    if (submission.currentEvidenceVersion !== payload.expectedEvidenceVersion)
      throw new AppError(
        "Evidence version changed.",
        409,
        "EVIDENCE_VERSION_CONFLICT",
      );
  }

  private async saveDecision(accepted: {
    transaction: Prisma.TransactionClient;
    ledger: TransactionLedger;
    submission: TaskSubmission;
    payload: SubmissionReview;
    identity: TaskActorIdentity;
    now: Date;
    walletId: string;
  }) {
    const {
      transaction,
      ledger,
      submission,
      payload,
      identity,
      now,
      walletId,
    } = accepted;
    const credit =
      payload.decision === "APPROVE"
        ? await ledger.credit({
            kind: "CREDIT",
            walletId,
            businessNamespace: "p05.task-reward",
            businessKey: submission.id,
            amount: formatUsdtAmount(submission.rewardUnits),
            source: "NON_REFERRAL",
            origin: "TASK_REWARD",
          })
        : null;
    const decision = payload.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await transaction.finalReview.create({
      data: {
        submissionId: submission.id,
        employeeId: submission.employeeId,
        decision,
        submissionVersion: submission.version,
        evidenceVersion: submission.currentEvidenceVersion,
        actorUserId: identity.userId,
        decidedAt: now,
        reason: payload.reason,
        walletId: credit === null ? null : walletId,
        approvalOperationId: credit?.result.operationId ?? null,
      },
    });
    await transaction.taskSubmission.update({
      where: { id: submission.id },
      data: { status: decision, version: { increment: 1 } },
    });
  }
}
