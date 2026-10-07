import { z } from "zod";
import {
  taskCodeCreateSchema,
  taskCodeStatusSchema,
} from "@template/contracts";
import type { DatabaseClient } from "@template/database";
import { AppError, NotFoundException } from "../../core/errors/index.js";
import { TaskCommandService } from "../tasks/task-command.service.js";
import { lockPublishedTask } from "../tasks/task-publication.service.js";
import type {
  TaskActorIdentity,
  TaskClock,
} from "../tasks/task-transaction.js";
import { taskCodeDetail } from "./task-codes.mapper.js";
import { isTaskUniqueConflict } from "../tasks/task-unique-conflict.js";

export class TaskCodesService {
  private readonly commands: TaskCommandService;
  constructor(
    private readonly database: DatabaseClient,
    clock: TaskClock,
  ) {
    this.commands = new TaskCommandService(database, clock);
  }

  async create(identity: TaskActorIdentity, body: unknown) {
    const payload = taskCodeCreateSchema.parse(body);
    return this.commands
      .executeResult(
        { kind: "CODE_CREATE", targetId: null, payload },
        identity,
        {
          lock: async (transaction) => {
            await lockPublishedTask(transaction, payload.taskId);
            await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`p05.code:${payload.code}`},0))`;
          },
          commit: async (transaction, { now }) => {
            if (
              (await transaction.task.findUnique({
                where: { id: payload.taskId },
                select: { id: true },
              })) === null
            )
              throw new NotFoundException();
            if (
              (await transaction.taskCode.findUnique({
                where: { normalizedText: payload.code },
                select: { id: true },
              })) !== null
            )
              throw new AppError(
                "Code already exists.",
                409,
                "CODE_ALREADY_EXISTS",
              );
            const code = await transaction.taskCode.create({
              data: {
                taskId: payload.taskId,
                normalizedText: payload.code,
                state: payload.state,
                description: payload.description ?? null,
                createdAt: now,
                updatedAt: now,
                createdByUserId: identity.userId,
                updatedByUserId: identity.userId,
              },
            });
            return {
              taskId: code.taskId,
              codeId: code.id,
              outcome: await taskCodeDetail(transaction, code.id, now),
              afterSnapshot: { state: code.state, version: code.version },
            };
          },
        },
      )
      .catch((error: unknown) => {
        if (isTaskUniqueConflict(error, "normalizedText"))
          throw new AppError(
            "Code already exists.",
            409,
            "CODE_ALREADY_EXISTS",
          );
        throw error;
      });
  }

  async status(identity: TaskActorIdentity, codeId: string, body: unknown) {
    z.uuid().parse(codeId);
    const payload = taskCodeStatusSchema.parse(body);
    // Task association is immutable; this lookup determines the required task-then-code lock order only.
    const target = await this.database.taskCode.findUnique({
      where: { id: codeId },
      select: { taskId: true },
    });
    if (target === null) throw new NotFoundException();
    return this.commands.executeResult(
      { kind: "CODE_STATUS", targetId: codeId, payload },
      identity,
      {
        lock: async (transaction) => {
          await lockPublishedTask(transaction, target.taskId);
          await transaction.$queryRaw`SELECT id FROM task_codes WHERE id=${codeId}::uuid FOR UPDATE`;
        },
        commit: async (transaction, { now }) => {
          const before = await transaction.taskCode.findUniqueOrThrow({
            where: { id: codeId },
          });
          if (before.version !== payload.expectedCodeVersion)
            throw new AppError(
              "Code version changed.",
              409,
              "CODE_VERSION_CONFLICT",
            );
          const code = await transaction.taskCode.update({
            where: { id: codeId },
            data: {
              state: payload.state,
              version: { increment: 1 },
              updatedAt: now,
              updatedByUserId: identity.userId,
            },
          });
          return {
            taskId: code.taskId,
            codeId: code.id,
            outcome: await taskCodeDetail(transaction, code.id, now),
            beforeSnapshot: { state: before.state, version: before.version },
            afterSnapshot: { state: code.state, version: code.version },
          };
        },
      },
    );
  }
}
