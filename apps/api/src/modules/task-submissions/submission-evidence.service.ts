import { z } from "zod";
import { evidenceReplaceSchema } from "@template/contracts";
import type { DatabaseClient } from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import {
  authorizeImageIntake,
  lockImageAsset,
} from "../proofs/proof-authority.js";
import {
  mapSubmissionDetail,
  submissionInclude,
} from "./task-submissions.mapper.js";
import type { ProofReadService } from "../proofs/proof-read.service.js";
import { TaskCommandService } from "../tasks/task-command.service.js";
import type {
  TaskActorIdentity,
  TaskClock,
} from "../tasks/task-transaction.js";

export class SubmissionEvidenceService {
  private readonly commands: TaskCommandService;
  constructor(
    private readonly database: DatabaseClient,
    clock: TaskClock,
    private readonly reads: ProofReadService,
  ) {
    this.commands = new TaskCommandService(database, clock, reads);
  }

  async replace(
    identity: TaskActorIdentity,
    submissionId: string,
    body: unknown,
  ) {
    z.uuid().parse(submissionId);
    const payload = evidenceReplaceSchema.parse(body);
    const observed = await this.commands.observe(
      { kind: "EVIDENCE_REPLACE", commandId: payload.commandId },
      identity,
    );
    const target = await this.database.taskSubmission.findFirst({
      where: { id: submissionId, employeeId: identity.userId },
      select: { taskId: true, status: true },
    });
    if (target === null)
      throw new AppError("Submission not found.", 404, "NOT_FOUND");
    // Final work reaches the locked conflict check even after proof retention removes its bytes.
    // New pending attachments still check live storage outside the retried transaction.
    const metadata =
      observed.state === "NOT_OBSERVED" && target.status === "PENDING"
        ? await this.reads.metadata(identity, "PROOF", payload.proofAssetId)
        : null;
    if (metadata !== null && metadata.availability !== "PRESENT")
      throw new AppError("Proof is unavailable.", 503, "STORAGE_UNAVAILABLE");
    return this.commands.execute(
      { kind: "EVIDENCE_REPLACE", targetId: submissionId, payload },
      identity,
      {
        lock: async (transaction) => {
          await transaction.$queryRaw`SELECT id FROM tasks WHERE id=${target.taskId}::uuid FOR UPDATE`;
          await transaction.$queryRaw`SELECT id FROM task_submissions WHERE id=${submissionId}::uuid FOR UPDATE`;
          await lockImageAsset(transaction, payload.proofAssetId);
        },
        commit: async (transaction, { now }) => {
          await authorizeImageIntake(transaction, identity, "PROOF", () => now);
          const submission = await transaction.taskSubmission.findFirst({
            where: { id: submissionId, employeeId: identity.userId },
          });
          if (submission === null)
            throw new AppError("Submission not found.", 404, "NOT_FOUND");
          if (
            submission.status !== "PENDING" ||
            submission.version !== payload.expectedSubmissionVersion ||
            now >= submission.deadlineAt
          )
            throw new AppError(
              "Evidence replacement conflicts with the current submission.",
              409,
              "EVIDENCE_CONFLICT",
            );
          const asset = await transaction.imageAsset.findFirst({
            where: {
              id: payload.proofAssetId,
              ownerUserId: identity.userId,
              purpose: "PROOF",
              state: "READY",
            },
          });
          if (asset === null)
            throw new AppError("Proof not found.", 404, "NOT_FOUND");
          const evidence = await transaction.submissionEvidence.create({
            data: {
              submissionId,
              employeeId: identity.userId,
              assetId: asset.id,
              assetPurpose: "PROOF",
              acceptedByUserId: identity.userId,
              version: submission.currentEvidenceVersion + 1,
              acceptedAt: now,
            },
          });
          const updated = await transaction.taskSubmission.update({
            where: { id: submissionId },
            data: {
              version: { increment: 1 },
              currentEvidenceVersion: evidence.version,
            },
            include: submissionInclude,
          });
          const outcome = mapSubmissionDetail(updated, true);
          return { taskId: updated.taskId, submissionId, outcome };
        },
      },
    );
  }
}
