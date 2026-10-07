import { z } from "zod";
import {
  taskUnlockRequestSchema,
  unlockOutcomeSchema,
} from "@template/contracts";
import type { DatabaseClient } from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import { TaskCommandService } from "../tasks/task-command.service.js";
import { lockPublishedTask } from "../tasks/task-publication.service.js";
import {
  EmployeeTasksService,
  requireEmployeeWork,
  requireCurrentTask,
} from "../tasks/employee-tasks.service.js";
import type {
  TaskActorIdentity,
  TaskClock,
} from "../tasks/task-transaction.js";
import type { ProofReadService } from "../proofs/proof-read.service.js";

export class TaskUnlockService {
  private readonly commands: TaskCommandService;
  private readonly days: EmployeeTasksService;
  constructor(
    database: DatabaseClient,
    clock: TaskClock,
    reads?: ProofReadService,
  ) {
    this.commands = new TaskCommandService(database, clock, reads);
    this.days = new EmployeeTasksService(database, clock, reads);
  }
  async unlock(identity: TaskActorIdentity, taskId: string, body: unknown) {
    z.uuid().parse(taskId);
    const payload = taskUnlockRequestSchema.parse(body);
    return this.commands.executeResult(
      { kind: "TASK_UNLOCK", targetId: taskId, payload },
      identity,
      {
        lock: async (transaction) => {
          await lockPublishedTask(transaction, taskId);
          await transaction.$queryRaw`SELECT id FROM task_codes WHERE task_id=${taskId}::uuid AND normalized_text=${payload.code} FOR UPDATE`;
        },
        commit: async (transaction, { now }) => {
          await requireEmployeeWork(transaction, identity, now);
          const candidate = await transaction.task.findUnique({
            where: { id: taskId },
          });
          const { task } = requireCurrentTask(
            candidate,
            payload.expectedTaskRevision,
            now,
          );
          if (!task.isCodeRequired)
            throw new AppError(
              "This task does not require a code.",
              409,
              "TASK_UNAVAILABLE",
            );
          const daily = await transaction.taskSubmission.findUnique({
            where: {
              employeeId_businessDate: {
                employeeId: identity.userId,
                businessDate: task.publicationDate,
              },
            },
            select: { id: true },
          });
          if (daily !== null)
            throw new AppError(
              "The date is already claimed.",
              409,
              "DAILY_CLAIM_EXISTS",
            );
          const existing = await transaction.taskUnlock.findUnique({
            where: {
              employeeId_taskId_businessDate: {
                employeeId: identity.userId,
                taskId,
                businessDate: task.publicationDate,
              },
            },
          });
          if (existing === null) {
            const code = await transaction.taskCode.findFirst({
              where: { taskId, normalizedText: payload.code, state: "ENABLED" },
            });
            if (code === null)
              throw new AppError(
                "Code is unavailable.",
                409,
                "TASK_UNAVAILABLE",
              );
            if (task.firstParticipationAt === null)
              await transaction.task.update({
                where: { id: taskId },
                data: { firstParticipationAt: now },
              });
            await transaction.taskUnlock.create({
              data: {
                employeeId: identity.userId,
                taskId,
                codeId: code.id,
                businessDate: task.publicationDate,
                unlockedAt: now,
              },
            });
            return {
              taskId,
              codeId: code.id,
              outcome: unlockOutcomeSchema.parse({
                day: await this.days.dayInTransaction(
                  transaction,
                  identity,
                  now,
                ),
              }),
            };
          }
          return {
            taskId,
            codeId: existing.codeId,
            outcome: unlockOutcomeSchema.parse({
              day: await this.days.dayInTransaction(transaction, identity, now),
            }),
          };
        },
      },
    );
  }
}
