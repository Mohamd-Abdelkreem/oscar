import { z } from "zod";
import {
  adminTaskPageSchema,
  adminTaskDetailSchema,
  taskListQuerySchema,
} from "@template/contracts";
import {
  Prisma,
  type DatabaseClient,
  type ImageAsset,
} from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { buildPaginationMeta } from "../../core/pagination/pagination.js";
import type { ProofReadService } from "../proofs/proof-read.service.js";
import { mapAcceptedImage } from "../proofs/proofs.mapper.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import {
  mapAdminTask,
  taskDetailSelect,
  mapAdminTaskSummary,
} from "./tasks.mapper.js";
import type { TaskActorIdentity, TaskClock } from "./task-transaction.js";

function displayPredicate(status: string, now: Date): Prisma.TaskWhereInput {
  const calendar = new BusinessClock(() => now).taskCalendar(now.toISOString());
  const date = new Date(`${calendar.businessDate}T00:00:00Z`);
  const closedDate: Prisma.TaskWhereInput = {
    publicationDate:
      calendar.calendarState === "CLOSED" ? { lte: date } : { lt: date },
  };
  const closed: Prisma.TaskWhereInput = {
    OR: [{ publicationState: "CLOSED" }, closedDate],
  };
  if (status === "CLOSED") return closed;
  if (status === "PAUSED") return { publicationState: "PAUSED", NOT: closed };
  if (status === "ACTIVE")
    return calendar.calendarState === "OPEN"
      ? { publicationState: "PUBLISHED", publicationDate: date }
      : { id: { in: [] } };
  return {
    publicationState: "PUBLISHED",
    publicationDate:
      calendar.calendarState === "UPCOMING" ? { gte: date } : { gt: date },
  };
}

export class TasksService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: TaskClock,
    private readonly reads?: ProofReadService,
  ) {}

  async detail(identity: TaskActorIdentity, taskId: string) {
    z.uuid().parse(taskId);
    const snapshot = await this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, "ADMIN");
        const task = await transaction.task.findUniqueOrThrow({
          where: { id: taskId },
          select: taskDetailSelect,
        });
        const approved = await transaction.taskSubmission.count({
          where: { taskId, status: "APPROVED" },
        });
        return { task, approved, now };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return adminTaskDetailSchema.parse({
      ...mapAdminTask(snapshot.task, snapshot.now, snapshot.approved),
      illustration: await this.illustration(snapshot.task.illustration),
    });
  }

  async list(identity: TaskActorIdentity, rawQuery: unknown) {
    const query = taskListQuerySchema.parse(rawQuery);
    const page = await this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, "ADMIN");
        const search = query.search;
        const where: Prisma.TaskWhereInput = {
          AND: [
            ...(query.publicationState === undefined
              ? []
              : [{ publicationState: query.publicationState }]),
            ...(query.platform === undefined
              ? []
              : [{ platform: query.platform }]),
            ...(query.displayStatus === undefined
              ? []
              : [displayPredicate(query.displayStatus, now)]),
            ...(query.dateFrom === undefined
              ? []
              : [{ publicationDate: { gte: new Date(query.dateFrom) } }]),
            ...(query.dateTo === undefined
              ? []
              : [{ publicationDate: { lte: new Date(query.dateTo) } }]),
            ...(search
              ? [
                  {
                    OR: [
                      {
                        title: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        platform: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                      ...(z.uuid().safeParse(search).success
                        ? [{ id: search }]
                        : []),
                    ],
                  },
                ]
              : []),
          ],
        };
        const tasks = await transaction.task.findMany({
          where,
          select: taskDetailSelect,
          orderBy: [{ publicationDate: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        const total = await transaction.task.count({ where });
        const approved = await transaction.taskSubmission.groupBy({
          by: ["taskId"],
          where: {
            taskId: { in: tasks.map((task) => task.id) },
            status: "APPROVED",
          },
          _count: { _all: true },
        });
        const counts = new Map(
          approved.map((group) => [group.taskId, group._count._all]),
        );
        return {
          tasks,
          counts,
          now,
          pagination: buildPaginationMeta({
            page: query.page,
            limit: query.limit,
            total,
          }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const items = await Promise.all(
      page.tasks.map(async (task) => ({
        ...mapAdminTaskSummary(task, page.now, page.counts.get(task.id) ?? 0),
        illustration: await this.illustration(task.illustration),
      })),
    );
    return adminTaskPageSchema.parse({ pagination: page.pagination, items });
  }

  private async illustration(asset: ImageAsset | null) {
    if (asset === null) return null;
    const availability =
      this.reads === undefined
        ? "STORAGE_UNAVAILABLE"
        : await this.reads.availability(asset);
    return mapAcceptedImage(asset, availability);
  }
}
