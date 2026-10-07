import { z } from "zod";
import {
  boundedPageQuerySchema,
  taskCodeListQuerySchema,
  taskCodeUsageQuerySchema,
  taskCodePageSchema,
  taskCodeUsagePageSchema,
  taskCodeAuditPageSchema,
} from "@template/contracts";
import { Prisma, type DatabaseClient } from "@template/database";
import { buildPaginationMeta } from "../../core/pagination/pagination.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import type {
  TaskActorIdentity,
  TaskClock,
} from "../tasks/task-transaction.js";
import {
  mapTaskCode,
  taskCodeDetail,
  taskCodeSelect,
  mapTaskCodeAudit,
  taskCodeAuditSelect,
} from "./task-codes.mapper.js";

const contains = (search: string) => ({
  contains: search,
  mode: "insensitive" as const,
});

export class TaskCodesQueries {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: TaskClock,
  ) {}

  detail(identity: TaskActorIdentity, codeId: string) {
    z.uuid().parse(codeId);
    return this.read(identity, (transaction, now) =>
      taskCodeDetail(transaction, codeId, now),
    );
  }

  list(identity: TaskActorIdentity, rawQuery: unknown) {
    const query = taskCodeListQuerySchema.parse(rawQuery);
    return this.read(identity, async (transaction, now) => {
      const where: Prisma.TaskCodeWhereInput = {
        ...(query.taskId === undefined ? {} : { taskId: query.taskId }),
        ...(query.state === undefined ? {} : { state: query.state }),
        ...(query.search
          ? {
              OR: [
                { normalizedText: contains(query.search) },
                { task: { title: contains(query.search) } },
                { creator: { fullName: contains(query.search) } },
              ],
            }
          : {}),
      };
      const codes = await transaction.taskCode.findMany({
        where,
        select: taskCodeSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      const total = await transaction.taskCode.count({ where });
      return taskCodePageSchema.parse({
        items: codes.map((code) => mapTaskCode(code, now)),
        pagination: buildPaginationMeta({ ...query, total }),
      });
    });
  }

  usages(identity: TaskActorIdentity, codeId: string, rawQuery: unknown) {
    z.uuid().parse(codeId);
    const query = taskCodeUsageQuerySchema.parse(rawQuery);
    return this.read(identity, async (transaction) => {
      await transaction.taskCode.findUniqueOrThrow({
        where: { id: codeId },
        select: { id: true },
      });
      const where: Prisma.TaskUnlockWhereInput = {
        codeId,
        ...(query.search
          ? {
              employee: {
                OR: [
                  { fullName: contains(query.search) },
                  { email: contains(query.search) },
                  ...(z.uuid().safeParse(query.search).success
                    ? [{ id: query.search }]
                    : []),
                ],
              },
            }
          : {}),
      };
      const usages = await transaction.taskUnlock.findMany({
        where,
        select: {
          id: true,
          taskId: true,
          businessDate: true,
          unlockedAt: true,
          employeeId: true,
          employee: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ unlockedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      const total = await transaction.taskUnlock.count({ where });
      const submissions = await transaction.taskSubmission.findMany({
        where: {
          OR: usages.map((usage) => ({
            employeeId: usage.employeeId,
            businessDate: usage.businessDate,
          })),
        },
        select: { employeeId: true, businessDate: true, status: true },
      });
      const statuses = new Map(
        submissions.map((submission) => [
          `${submission.employeeId}:${submission.businessDate.toISOString()}`,
          submission.status,
        ]),
      );
      return taskCodeUsagePageSchema.parse({
        items: usages.map((usage) => ({
          id: usage.id,
          employee: usage.employee,
          taskId: usage.taskId,
          businessDate: usage.businessDate.toISOString().slice(0, 10),
          unlockedAt: usage.unlockedAt.toISOString(),
          submissionStatus:
            statuses.get(
              `${usage.employeeId}:${usage.businessDate.toISOString()}`,
            ) ?? null,
        })),
        pagination: buildPaginationMeta({ ...query, total }),
      });
    });
  }

  changes(identity: TaskActorIdentity, codeId: string, rawQuery: unknown) {
    z.uuid().parse(codeId);
    const query = boundedPageQuerySchema.parse(rawQuery);
    return this.read(identity, async (transaction) => {
      await transaction.taskCode.findUniqueOrThrow({
        where: { id: codeId },
        select: { id: true },
      });
      const where: Prisma.TaskCommandRecordWhereInput = {
        codeId,
        terminalState: "COMMITTED",
        kind: { in: ["CODE_CREATE", "CODE_STATUS"] },
      };
      const commands = await transaction.taskCommandRecord.findMany({
        where,
        select: taskCodeAuditSelect,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      const total = await transaction.taskCommandRecord.count({ where });
      return taskCodeAuditPageSchema.parse({
        items: commands.map(mapTaskCodeAudit),
        pagination: buildPaginationMeta({ ...query, total }),
      });
    });
  }

  private read<T>(
    identity: TaskActorIdentity,
    query: (transaction: Prisma.TransactionClient, now: Date) => Promise<T>,
  ) {
    return this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, "ADMIN");
        return query(transaction, now);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
