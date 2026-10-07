import { z } from "zod";
import {
  taskCreateSchema,
  taskEditSchema,
  taskStatusSchema,
} from "@template/contracts";
import type { Prisma, DatabaseClient, Task } from "@template/database";
import { AppError, NotFoundException } from "../../core/errors/index.js";
import { lockImageAsset } from "../proofs/proof-authority.js";
import type { ProofReadService } from "../proofs/proof-read.service.js";
import { TaskCommandService } from "./task-command.service.js";
import type { TaskActorIdentity, TaskClock } from "./task-transaction.js";
import { adminTaskDetail } from "./tasks.mapper.js";
import { isTaskUniqueConflict } from "./task-unique-conflict.js";

export async function lockPublishedTask(
  transaction: Prisma.TransactionClient,
  taskId: string,
) {
  await transaction.$queryRaw`SELECT id FROM tasks WHERE id=${taskId}::uuid FOR UPDATE`;
}
function taskSnapshot(task: Task): Prisma.InputJsonObject {
  return {
    publicationDate: task.publicationDate.toISOString().slice(0, 10),
    publicationState: task.publicationState,
    revision: task.revision,
    title: task.title,
    description: task.description,
    targetUrl: task.targetUrl,
    platform: task.platform,
    isCodeRequired: task.isCodeRequired,
    illustrationAssetId: task.illustrationAssetId,
  };
}
async function lockPublicationDate(
  transaction: Prisma.TransactionClient,
  date: string,
) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`p05.task-date:${date}`},0))`;
}

export class TaskPublicationService {
  private readonly commands: TaskCommandService;
  constructor(
    database: DatabaseClient,
    clock: TaskClock,
    private readonly reads?: ProofReadService,
  ) {
    this.commands = new TaskCommandService(database, clock, reads);
  }

  async create(identity: TaskActorIdentity, body: unknown) {
    const payload = taskCreateSchema.parse(body);
    await this.prepareIllustration(identity, {
      kind: "TASK_CREATE",
      commandId: payload.commandId,
      assetId: payload.illustrationAssetId,
    });
    return this.commands
      .executeResult(
        { kind: "TASK_CREATE", targetId: null, payload },
        identity,
        {
          lock: async (transaction) => {
            await lockPublicationDate(transaction, payload.publicationDate);
            if (payload.illustrationAssetId !== null)
              await lockImageAsset(transaction, payload.illustrationAssetId);
          },
          commit: async (transaction, { now }) => {
            await this.assertDateFree(transaction, payload.publicationDate);
            await this.assertIllustration(
              transaction,
              payload.illustrationAssetId,
            );
            const task = await transaction.task.create({
              data: {
                title: payload.title,
                description: payload.description,
                targetUrl: payload.targetUrl,
                platform: payload.platform,
                publicationDate: new Date(
                  `${payload.publicationDate}T00:00:00Z`,
                ),
                publicationState: payload.publicationState,
                isCodeRequired: payload.isCodeRequired,
                illustrationAssetId: payload.illustrationAssetId,
                illustrationPurpose:
                  payload.illustrationAssetId === null
                    ? null
                    : "TASK_ILLUSTRATION",
                createdAt: now,
                updatedAt: now,
                createdByUserId: identity.userId,
                updatedByUserId: identity.userId,
              },
            });
            return {
              taskId: task.id,
              outcome: await adminTaskDetail(transaction, task.id, now),
              afterSnapshot: taskSnapshot(task),
            };
          },
        },
      )
      .catch((error: unknown) => {
        if (isTaskUniqueConflict(error, "publicationDate"))
          throw new AppError(
            "Publication date is occupied.",
            409,
            "TASK_DATE_OCCUPIED",
          );
        throw error;
      });
  }

  async edit(identity: TaskActorIdentity, taskId: string, body: unknown) {
    z.uuid().parse(taskId);
    const payload = taskEditSchema.parse(body);
    if (payload.illustrationAssetId !== undefined)
      await this.prepareIllustration(identity, {
        kind: "TASK_EDIT",
        commandId: payload.commandId,
        assetId: payload.illustrationAssetId,
      });
    return this.commands
      .executeResult(
        { kind: "TASK_EDIT", targetId: taskId, payload },
        identity,
        {
          lock: async (transaction) => {
            await lockPublishedTask(transaction, taskId);
            if (payload.publicationDate !== undefined)
              await lockPublicationDate(transaction, payload.publicationDate);
            if (payload.illustrationAssetId)
              await lockImageAsset(transaction, payload.illustrationAssetId);
          },
          commit: async (transaction, { now }) => {
            const before = await this.currentTask(
              transaction,
              taskId,
              payload.expectedTaskRevision,
            );
            if (
              payload.publicationDate !== undefined &&
              payload.publicationDate !==
                before.publicationDate.toISOString().slice(0, 10)
            ) {
              if (before.firstParticipationAt !== null)
                throw new AppError(
                  "A participated date cannot move.",
                  409,
                  "TASK_DATE_LOCKED",
                );
              await this.assertDateFree(transaction, payload.publicationDate);
            }
            if (payload.illustrationAssetId !== undefined)
              await this.assertIllustration(
                transaction,
                payload.illustrationAssetId,
              );
            const after = await transaction.task.update({
              where: { id: taskId },
              data: {
                title: payload.title ?? before.title,
                description: payload.description ?? before.description,
                targetUrl: payload.targetUrl ?? before.targetUrl,
                platform: payload.platform ?? before.platform,
                isCodeRequired: payload.isCodeRequired ?? before.isCodeRequired,
                publicationState:
                  payload.publicationState ?? before.publicationState,
                illustrationAssetId:
                  payload.illustrationAssetId === undefined
                    ? before.illustrationAssetId
                    : payload.illustrationAssetId,
                ...(payload.publicationDate === undefined
                  ? {}
                  : {
                      publicationDate: new Date(
                        `${payload.publicationDate}T00:00:00Z`,
                      ),
                    }),
                ...(payload.illustrationAssetId === undefined
                  ? {}
                  : {
                      illustrationPurpose:
                        payload.illustrationAssetId === null
                          ? null
                          : "TASK_ILLUSTRATION",
                    }),
                revision: { increment: 1 },
                updatedAt: now,
                updatedByUserId: identity.userId,
              },
            });
            return {
              taskId,
              outcome: await adminTaskDetail(transaction, taskId, now),
              beforeSnapshot: taskSnapshot(before),
              afterSnapshot: taskSnapshot(after),
            };
          },
        },
      )
      .catch((error: unknown) => {
        if (isTaskUniqueConflict(error, "publicationDate"))
          throw new AppError(
            "Publication date is occupied.",
            409,
            "TASK_DATE_OCCUPIED",
          );
        throw error;
      });
  }

  async status(identity: TaskActorIdentity, taskId: string, body: unknown) {
    z.uuid().parse(taskId);
    const payload = taskStatusSchema.parse(body);
    return this.commands.executeResult(
      { kind: "TASK_STATUS", targetId: taskId, payload },
      identity,
      {
        lock: (transaction) => lockPublishedTask(transaction, taskId),
        commit: async (transaction, { now }) => {
          const before = await this.currentTask(
            transaction,
            taskId,
            payload.expectedTaskRevision,
          );
          const after = await transaction.task.update({
            where: { id: taskId },
            data: {
              publicationState: payload.publicationState,
              revision: { increment: 1 },
              updatedAt: now,
              updatedByUserId: identity.userId,
            },
          });
          return {
            taskId,
            outcome: await adminTaskDetail(transaction, taskId, now),
            beforeSnapshot: taskSnapshot(before),
            afterSnapshot: taskSnapshot(after),
          };
        },
      },
    );
  }

  private async currentTask(
    transaction: Prisma.TransactionClient,
    taskId: string,
    revision: number,
  ) {
    const task = await transaction.task.findUnique({ where: { id: taskId } });
    if (task === null) throw new NotFoundException();
    if (task.revision !== revision)
      throw new AppError(
        "Task revision changed.",
        409,
        "TASK_REVISION_CONFLICT",
      );
    return task;
  }
  private async assertDateFree(
    transaction: Prisma.TransactionClient,
    date: string,
  ) {
    if (
      await transaction.task.findUnique({
        where: { publicationDate: new Date(`${date}T00:00:00Z`) },
        select: { id: true },
      })
    )
      throw new AppError(
        "Publication date is occupied.",
        409,
        "TASK_DATE_OCCUPIED",
      );
  }
  private async assertIllustration(
    transaction: Prisma.TransactionClient,
    assetId: string | null,
  ) {
    if (assetId === null) return;
    const ready = await transaction.imageAsset.findFirst({
      where: { id: assetId, purpose: "TASK_ILLUSTRATION", state: "READY" },
      select: { id: true },
    });
    if (ready === null)
      throw new AppError(
        "A ready task illustration is required.",
        409,
        "ASSET_NOT_READY",
      );
  }

  private async prepareIllustration(
    identity: TaskActorIdentity,
    attachment: {
      kind: "TASK_CREATE" | "TASK_EDIT";
      commandId: string;
      assetId: string | null;
    },
  ) {
    if (attachment.assetId === null) return;
    // Resolve an existing receipt before file I/O; replay never reattaches and cancelled keys stay fenced.
    const existing = await this.commands.observe(
      { kind: attachment.kind, commandId: attachment.commandId },
      identity,
    );
    if (existing.state === "CANCELLED")
      throw new AppError(
        "The command key was cancelled.",
        409,
        "COMMAND_CANCELLED",
      );
    if (existing.state === "OBSERVED") return;
    if (this.reads === undefined)
      throw new AppError(
        "Private image storage is unavailable.",
        503,
        "STORAGE_UNAVAILABLE",
      );
    const asset = await this.reads.metadata(
      identity,
      "TASK_ILLUSTRATION",
      attachment.assetId,
    );
    if (asset.availability !== "PRESENT")
      throw new AppError(
        "A retained illustration file is unavailable.",
        503,
        "STORAGE_UNAVAILABLE",
      );
  }
}
