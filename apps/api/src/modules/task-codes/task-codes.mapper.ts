import {
  taskCodeSummarySchema,
  taskCodeAuditSchema,
} from "@template/contracts";
import type { Prisma } from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";

export const taskCodeSelect = {
  id: true,
  normalizedText: true,
  state: true,
  version: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { id: true, fullName: true, email: true } },
  task: {
    select: { id: true, title: true, platform: true, publicationDate: true },
  },
  _count: { select: { unlocks: true } },
} satisfies Prisma.TaskCodeSelect;
export const taskCodeAuditSelect = {
  id: true,
  kind: true,
  occurredAt: true,
  beforeSnapshot: true,
  afterSnapshot: true,
  actor: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.TaskCommandRecordSelect;
type CodeRow = Prisma.TaskCodeGetPayload<{ select: typeof taskCodeSelect }>;

export function mapTaskCode(code: CodeRow, now: Date) {
  return taskCodeSummarySchema.parse({
    id: code.id,
    normalizedText: code.normalizedText,
    state: code.state,
    version: code.version,
    description: code.description,
    createdAt: code.createdAt.toISOString(),
    updatedAt: code.updatedAt.toISOString(),
    creator: code.creator,
    task: {
      id: code.task.id,
      title: code.task.title,
      platform: code.task.platform,
      window: new BusinessClock(() => now).taskWindow(
        code.task.publicationDate.toISOString().slice(0, 10),
        now.toISOString(),
      ),
    },
    successfulUsageCount: code._count.unlocks,
    distinctSuccessfulEmployeeCount: code._count.unlocks,
  });
}
export async function taskCodeDetail(
  transaction: Prisma.TransactionClient,
  codeId: string,
  now: Date,
) {
  return mapTaskCode(
    await transaction.taskCode.findUniqueOrThrow({
      where: { id: codeId },
      select: taskCodeSelect,
    }),
    now,
  );
}
export function mapTaskCodeAudit(
  command: Prisma.TaskCommandRecordGetPayload<{
    select: typeof taskCodeAuditSelect;
  }>,
) {
  return taskCodeAuditSchema.parse({
    id: command.id,
    action: command.kind,
    actor: {
      id: command.actor.id,
      fullName: command.actor.fullName,
      email: command.actor.email,
    },
    occurredAt: command.occurredAt.toISOString(),
    before: command.beforeSnapshot,
    after: command.afterSnapshot,
  });
}
