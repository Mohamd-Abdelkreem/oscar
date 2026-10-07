import {
  packageTermsSchema,
  submissionCreateSchema,
} from "@template/contracts";
import type { DatabaseClient } from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import { lockImageAsset } from "../proofs/proof-authority.js";
import type { ProofReadService } from "../proofs/proof-read.service.js";
import { TaskCommandService } from "../tasks/task-command.service.js";
import { lockPublishedTask } from "../tasks/task-publication.service.js";
import {
  requireEmployeeWork,
  requireCurrentTask,
} from "../tasks/employee-tasks.service.js";
import type {
  TaskActorIdentity,
  TaskClock,
} from "../tasks/task-transaction.js";
import {
  mapSubmissionDetail,
  submissionInclude,
} from "./task-submissions.mapper.js";

export class TaskSubmissionsService {
  private readonly commands: TaskCommandService;
  constructor(
    database: DatabaseClient,
    clock: TaskClock,
    private readonly reads?: ProofReadService,
  ) {
    this.commands = new TaskCommandService(database, clock, reads);
  }
  async create(identity: TaskActorIdentity, body: unknown) {
    const payload = submissionCreateSchema.parse(body);
    // Accepted replays need no new attachment; current private observations still apply.
    const observed = await this.commands.observe(
      { kind: "SUBMISSION_CREATE", commandId: payload.commandId },
      identity,
    );
    if (observed.state === "NOT_OBSERVED") {
      if (this.reads === undefined)
        throw new AppError(
          "Private storage is unavailable.",
          503,
          "STORAGE_UNAVAILABLE",
        );
      const metadata = await this.reads.metadata(
        identity,
        "PROOF",
        payload.proofAssetId,
      );
      if (metadata.availability !== "PRESENT")
        throw new AppError("Proof is unavailable.", 503, "STORAGE_UNAVAILABLE");
    }
    return this.commands.executeResult(
      { kind: "SUBMISSION_CREATE", targetId: null, payload },
      identity,
      {
        lock: async (transaction) => {
          await lockPublishedTask(transaction, payload.taskId);
          await lockImageAsset(transaction, payload.proofAssetId);
        },
        commit: async (transaction, { now }) => {
          const subscription = await requireEmployeeWork(
            transaction,
            identity,
            now,
          );
          const candidate = await transaction.task.findUnique({
            where: { id: payload.taskId },
          });
          const { task, calendar } = requireCurrentTask(
            candidate,
            payload.expectedTaskRevision,
            now,
          );
          const existing = await transaction.taskSubmission.findUnique({
            where: {
              employeeId_businessDate: {
                employeeId: identity.userId,
                businessDate: task.publicationDate,
              },
            },
            select: { id: true },
          });
          if (existing !== null)
            throw new AppError(
              "The date is already claimed.",
              409,
              "DAILY_CLAIM_EXISTS",
            );
          if (task.isCodeRequired) {
            const unlock = await transaction.taskUnlock.findUnique({
              where: {
                employeeId_taskId_businessDate: {
                  employeeId: identity.userId,
                  taskId: task.id,
                  businessDate: task.publicationDate,
                },
              },
            });
            if (unlock === null)
              throw new AppError(
                "Unlock the task first.",
                409,
                "TASK_UNAVAILABLE",
              );
          }
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
          const terms = packageTermsSchema.parse(subscription.acceptedTerms);
          if (task.firstParticipationAt === null)
            await transaction.task.update({
              where: { id: task.id },
              data: { firstParticipationAt: now },
            });
          const submission = await transaction.taskSubmission.create({
            data: {
              employeeId: identity.userId,
              taskId: task.id,
              businessDate: task.publicationDate,
              capturedTaskRevision: task.revision,
              capturedTaskContent: {
                title: task.title,
                description: task.description,
                targetUrl: task.targetUrl,
                platform: task.platform,
              },
              subscriptionId: subscription.id,
              capturedSubscriptionTerms: terms,
              rewardUnits: subscription.dailyRewardUnits,
              executionDeclared: true,
              submittedAt: now,
              deadlineAt: new Date(calendar.window.closesAt),
              currentEvidenceVersion: 1,
            },
          });
          await transaction.submissionEvidence.create({
            data: {
              submissionId: submission.id,
              employeeId: identity.userId,
              version: 1,
              assetId: asset.id,
              assetPurpose: "PROOF",
              acceptedAt: now,
              acceptedByUserId: identity.userId,
            },
          });
          const saved = await transaction.taskSubmission.findUniqueOrThrow({
            where: { id: submission.id },
            include: submissionInclude,
          });
          return {
            taskId: task.id,
            submissionId: submission.id,
            outcome: mapSubmissionDetail(saved, true),
          };
        },
      },
    );
  }
}
