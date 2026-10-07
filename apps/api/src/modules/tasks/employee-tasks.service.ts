import {
  employeeTaskDaySchema,
  packageTermsSchema,
  proofAssetSchema,
  illustrationAssetSchema,
  type EmployeeTaskDay,
} from "@template/contracts";
import { Prisma, type DatabaseClient, type Task } from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { AppError } from "../../core/errors/app.error.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import { currentSubscription } from "../subscriptions/subscriptions.service.js";
import { isEffectiveSubscription } from "../subscriptions/subscriptions.mapper.js";
import type { ProofReadService } from "../proofs/proof-read.service.js";
import { mapAcceptedImage } from "../proofs/proofs.mapper.js";
import {
  mapSubmissionDetail,
  submissionInclude,
} from "../task-submissions/task-submissions.mapper.js";
import type { TaskActorIdentity, TaskClock } from "./task-transaction.js";

export async function employeeWork(
  transaction: Prisma.TransactionClient,
  identity: TaskActorIdentity,
  now: Date,
) {
  const actor = await readSessionAuthority(transaction, identity, now, "USER");
  const subscription = await currentSubscription(transaction, identity.userId);
  const previous =
    subscription === null
      ? await transaction.subscription.findFirst({
          where: { ownerUserId: identity.userId },
          select: { id: true },
          orderBy: [{ activationAt: "desc" }, { id: "desc" }],
        })
      : null;
  const effective = isEffectiveSubscription(subscription, now);
  const eligibility = actor.tasksBlocked
    ? "TASK_RESTRICTED"
    : effective
      ? "ELIGIBLE"
      : subscription === null && previous === null
        ? "FREE"
        : "EXPIRED";
  return { actor, subscription, effective, eligibility } as const;
}
export async function requireEmployeeWork(
  transaction: Prisma.TransactionClient,
  identity: TaskActorIdentity,
  now: Date,
) {
  const work = await employeeWork(transaction, identity, now);
  if (work.eligibility !== "ELIGIBLE" || work.subscription === null)
    throw new AppError(
      "Task work is unavailable.",
      403,
      "TASK_ELIGIBILITY_DENIED",
    );
  return work.subscription;
}
export function requireCurrentTask(
  task: Task | null,
  revision: number,
  now: Date,
) {
  if (task === null) throw new AppError("Task not found.", 404, "NOT_FOUND");
  const calendar = new BusinessClock(() => now).taskCalendar(now.toISOString());
  if (calendar.calendarState !== "OPEN")
    throw new AppError("Task window is closed.", 409, "TASK_WINDOW_CLOSED");
  if (
    task.publicationDate.toISOString().slice(0, 10) !== calendar.businessDate ||
    task.publicationState !== "PUBLISHED"
  )
    throw new AppError("Task is unavailable.", 409, "TASK_UNAVAILABLE");
  if (task.revision !== revision)
    throw new AppError(
      "Refresh the current task.",
      409,
      "TASK_REVISION_CONFLICT",
    );
  return { task, calendar };
}

export class EmployeeTasksService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: TaskClock,
    private readonly reads?: ProofReadService,
  ) {}
  async today(identity: TaskActorIdentity) {
    const day = await this.database.$transaction(
      (transaction) =>
        this.dayInTransaction(transaction, identity, this.clock()),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return this.refresh(day, identity);
  }
  async dayInTransaction(
    transaction: Prisma.TransactionClient,
    identity: TaskActorIdentity,
    now: Date,
  ): Promise<EmployeeTaskDay> {
    const work = await employeeWork(transaction, identity, now);
    const calendar = new BusinessClock(() => now).taskCalendar(
      now.toISOString(),
    );
    const date = new Date(`${calendar.businessDate}T00:00:00Z`);
    const task =
      calendar.calendarState === "HOLIDAY"
        ? null
        : await transaction.task.findUnique({
            where: { publicationDate: date },
            include: { illustration: true },
          });
    const submission = await transaction.taskSubmission.findUnique({
      where: {
        employeeId_businessDate: {
          employeeId: identity.userId,
          businessDate: date,
        },
      },
      include: submissionInclude,
    });
    const unlock =
      task === null
        ? null
        : await transaction.taskUnlock.findUnique({
            where: {
              employeeId_taskId_businessDate: {
                employeeId: identity.userId,
                taskId: task.id,
                businessDate: date,
              },
            },
          });
    const canReplace =
      submission !== null &&
      submission.status === "PENDING" &&
      work.eligibility === "ELIGIBLE" &&
      now < submission.deadlineAt;
    const open =
      calendar.calendarState === "OPEN" &&
      work.eligibility === "ELIGIBLE" &&
      task?.publicationState === "PUBLISHED" &&
      submission === null;
    const terms =
      work.effective && work.subscription !== null
        ? packageTermsSchema.parse(work.subscription.acceptedTerms)
        : null;
    const opportunityState = task === null ? "NO_TASK" : task.publicationState;
    const canSubmit = open && (!task.isCodeRequired || unlock !== null);
    return employeeTaskDaySchema.parse({
      serverNow: now.toISOString(),
      ...calendar,
      workEligibility: work.eligibility,
      opportunityState,
      task:
        task === null
          ? null
          : {
              id: task.id,
              revision: task.revision,
              publicationDate: calendar.businessDate,
              title: task.title,
              description: task.description,
              targetUrl: task.targetUrl,
              platform: task.platform,
              isCodeRequired: task.isCodeRequired,
              illustration:
                task.illustration === null
                  ? null
                  : mapAcceptedImage(task.illustration, "STORAGE_UNAVAILABLE"),
            },
      unlock:
        unlock === null
          ? null
          : {
              id: unlock.id,
              taskId: unlock.taskId,
              businessDate: calendar.businessDate,
              unlockedAt: unlock.unlockedAt.toISOString(),
            },
      submission:
        submission === null
          ? null
          : mapSubmissionDetail(submission, canReplace),
      currentEntitlement:
        terms === null
          ? {
              effective: false,
              packageCode: null,
              packageLabel: null,
              dailyReward: null,
            }
          : {
              effective: true,
              packageCode: terms.code,
              packageLabel: terms.code,
              dailyReward: terms.dailyReward,
            },
      canUnlock: open && task.isCodeRequired && unlock === null,
      canSubmit,
      canReplace,
      unavailableReason:
        submission !== null
          ? submission.status === "PENDING"
            ? "DAILY_CLAIM_EXISTS"
            : "SUBMISSION_FINAL"
          : work.eligibility !== "ELIGIBLE"
            ? work.eligibility
            : calendar.calendarState !== "OPEN"
              ? calendar.calendarState
              : task === null
                ? "NO_TASK"
                : task.publicationState !== "PUBLISHED"
                  ? task.publicationState
                  : !canSubmit
                    ? "CODE_REQUIRED"
                    : null,
    });
  }
  async refresh(day: EmployeeTaskDay, identity: TaskActorIdentity) {
    if (this.reads === undefined) return day;
    if (day.submission !== null)
      day.submission.evidence.asset = proofAssetSchema.parse(
        await this.reads.metadata(
          identity,
          "PROOF",
          day.submission.evidence.assetId,
        ),
      );
    if (
      day.task?.illustration &&
      day.workEligibility === "ELIGIBLE" &&
      day.opportunityState === "PUBLISHED"
    )
      day.task.illustration = illustrationAssetSchema.parse(
        await this.reads.metadata(
          identity,
          "TASK_ILLUSTRATION",
          day.task.illustration.id,
        ),
      );
    return employeeTaskDaySchema.parse(day);
  }
}
