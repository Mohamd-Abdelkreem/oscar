import { adminTaskDetailSchema } from "@template/contracts";
import type { Prisma } from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { mapAcceptedImage } from "../proofs/proofs.mapper.js";

export const taskDetailSelect = {
  id: true,
  publicationDate: true,
  publicationState: true,
  revision: true,
  firstParticipationAt: true,
  title: true,
  description: true,
  targetUrl: true,
  platform: true,
  isCodeRequired: true,
  createdAt: true,
  updatedAt: true,
  illustration: true,
  _count: { select: { codes: true, unlocks: true, submissions: true } },
} satisfies Prisma.TaskSelect;
export type TaskDetailRow = Prisma.TaskGetPayload<{
  select: typeof taskDetailSelect;
}>;
const calendar = new BusinessClock(() => new Date());

export function taskDisplayStatus(
  task: Pick<TaskDetailRow, "publicationDate" | "publicationState">,
  now: Date,
) {
  const window = calendar.taskWindow(
    task.publicationDate.toISOString().slice(0, 10),
    now.toISOString(),
  );
  if (task.publicationState === "CLOSED" || now >= new Date(window.closesAt))
    return "CLOSED";
  if (task.publicationState === "PAUSED") return "PAUSED";
  return now < new Date(window.opensAt) ? "SCHEDULED" : "ACTIVE";
}

export function mapAdminTask(
  task: TaskDetailRow,
  now: Date,
  approvedCount: number,
) {
  const date = task.publicationDate.toISOString().slice(0, 10);
  return adminTaskDetailSchema.parse({
    id: task.id,
    revision: task.revision,
    publicationDate: date,
    title: task.title,
    description: task.description,
    targetUrl: task.targetUrl,
    platform: task.platform,
    isCodeRequired: task.isCodeRequired,
    illustration:
      task.illustration === null
        ? null
        : mapAcceptedImage(task.illustration, "STORAGE_UNAVAILABLE"),
    window: calendar.taskWindow(date, now.toISOString()),
    publicationState: task.publicationState,
    displayStatus: taskDisplayStatus(task, now),
    linkedCodeCount: task._count.codes,
    distinctUnlockedEmployeeCount: task._count.unlocks,
    submissionCount: task._count.submissions,
    approvedSubmissionCount: approvedCount,
    firstParticipationAt: task.firstParticipationAt?.toISOString() ?? null,
    dateEditable: task.firstParticipationAt === null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
}

export async function adminTaskDetail(
  transaction: Prisma.TransactionClient,
  taskId: string,
  now: Date,
) {
  const task = await transaction.task.findUniqueOrThrow({
    where: { id: taskId },
    select: taskDetailSelect,
  });
  const approved = await transaction.taskSubmission.count({
    where: { taskId, status: "APPROVED" },
  });
  return mapAdminTask(task, now, approved);
}

export function mapAdminTaskSummary(
  task: TaskDetailRow,
  now: Date,
  approvedCount: number,
) {
  const {
    firstParticipationAt: _participation,
    dateEditable: _editable,
    createdAt: _created,
    updatedAt: _updated,
    ...summary
  } = mapAdminTask(task, now, approvedCount);
  return summary;
}
