import { z } from "zod";
import {
  businessDateSchema,
  financialInstantSchema,
} from "../financial/financial.schema.ts";
import {
  boundedPageQueryShape,
  boundedSearchSchema,
  financialPageSchema,
  safePageOffset,
} from "../http/http.schema.ts";
import { safeCountSchema } from "../packages/package.schema.ts";
import { illustrationAssetSchema } from "../proofs/proofs.schema.ts";
import { submissionDetailSchema } from "../task-submissions/task-submissions.schema.ts";
import {
  currentTaskEntitlementSchema,
  taskContentShape,
  taskDisplayStatusSchema,
  taskExpectedRevisionSchema,
  taskPublicationDateSchema,
  taskPublicationStateSchema,
  taskRevisionSchema,
  taskWindowSchema,
} from "./task-content.schema.ts";

const editableTaskShape = {
  ...taskContentShape,
  publicationDate: taskPublicationDateSchema,
  publicationState: taskPublicationStateSchema,
  isCodeRequired: z.boolean(),
  illustrationAssetId: z.uuid().nullable(),
};
export const taskCreateSchema = z.strictObject({
  commandId: z.uuid(),
  confirmed: z.literal(true),
  ...editableTaskShape,
});
export const taskEditSchema = z
  .strictObject({
    commandId: z.uuid(),
    confirmed: z.literal(true),
    expectedTaskRevision: taskExpectedRevisionSchema,
    ...z.object(editableTaskShape).partial().shape,
  })
  .refine(
    (intent) =>
      Object.keys(editableTaskShape).some((key) => Object.hasOwn(intent, key)),
    "At least one edit required.",
  );
export const taskStatusSchema = z.strictObject({
  commandId: z.uuid(),
  confirmed: z.literal(true),
  expectedTaskRevision: taskExpectedRevisionSchema,
  publicationState: taskPublicationStateSchema,
});
export const taskListQuerySchema = z
  .strictObject({
    ...boundedPageQueryShape,
    search: boundedSearchSchema.optional(),
    publicationState: taskPublicationStateSchema.optional(),
    displayStatus: taskDisplayStatusSchema.optional(),
    platform: taskContentShape.platform.optional(),
    dateFrom: businessDateSchema.optional(),
    dateTo: businessDateSchema.optional(),
  })
  .refine(safePageOffset)
  .refine(
    (query) =>
      !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo,
    "Invalid date range.",
  );
export const employeeTaskSchema = z.strictObject({
  id: z.uuid(),
  revision: taskRevisionSchema,
  publicationDate: taskPublicationDateSchema,
  ...taskContentShape,
  isCodeRequired: z.boolean(),
  illustration: illustrationAssetSchema.nullable(),
});
export const taskUnlockSchema = z.strictObject({
  id: z.uuid(),
  taskId: z.uuid(),
  businessDate: taskPublicationDateSchema,
  unlockedAt: financialInstantSchema,
});
export const taskUnavailableReasonSchema = z.enum([
  "UPCOMING",
  "CLOSED",
  "HOLIDAY",
  "NO_TASK",
  "PAUSED",
  "FREE",
  "EXPIRED",
  "TASK_RESTRICTED",
  "CODE_REQUIRED",
  "DAILY_CLAIM_EXISTS",
  "SUBMISSION_FINAL",
]);
export const employeeTaskDaySchema = z
  .strictObject({
    serverNow: financialInstantSchema,
    businessDate: businessDateSchema,
    window: taskWindowSchema,
    calendarState: z.enum(["UPCOMING", "OPEN", "CLOSED", "HOLIDAY"]),
    workEligibility: z.enum(["ELIGIBLE", "FREE", "EXPIRED", "TASK_RESTRICTED"]),
    opportunityState: z.enum(["PUBLISHED", "PAUSED", "CLOSED", "NO_TASK"]),
    task: employeeTaskSchema.nullable(),
    unlock: taskUnlockSchema.nullable(),
    submission: submissionDetailSchema.nullable(),
    currentEntitlement: currentTaskEntitlementSchema,
    canUnlock: z.boolean(),
    canSubmit: z.boolean(),
    canReplace: z.boolean(),
    unavailableReason: taskUnavailableReasonSchema.nullable(),
  })
  .superRefine((day, context) => {
    const open =
      day.calendarState === "OPEN" &&
      day.opportunityState === "PUBLISHED" &&
      day.workEligibility === "ELIGIBLE" &&
      day.task !== null;
    if (
      (day.task !== null && day.task.publicationDate !== day.businessDate) ||
      (day.opportunityState === "NO_TASK" && day.task !== null) ||
      (day.calendarState === "HOLIDAY" && day.task !== null) ||
      ((day.canUnlock || day.canSubmit) &&
        (!open || day.submission !== null)) ||
      (day.canUnlock && (!day.task?.isCodeRequired || day.unlock !== null)) ||
      (day.canSubmit && day.task?.isCodeRequired && day.unlock === null) ||
      (day.canReplace && day.submission?.canReplace !== true) ||
      (day.unlock !== null &&
        (day.unlock.taskId !== day.task?.id ||
          day.unlock.businessDate !== day.businessDate))
    )
      context.addIssue({ code: "custom", message: "Inconsistent task day." });
  });
export const adminTaskSummarySchema = employeeTaskSchema.extend({
  window: taskWindowSchema,
  publicationState: taskPublicationStateSchema,
  displayStatus: taskDisplayStatusSchema,
  linkedCodeCount: safeCountSchema,
  distinctUnlockedEmployeeCount: safeCountSchema,
  submissionCount: safeCountSchema,
  approvedSubmissionCount: safeCountSchema,
});
export const adminTaskDetailSchema = adminTaskSummarySchema
  .extend({
    firstParticipationAt: financialInstantSchema.nullable(),
    dateEditable: z.boolean(),
    createdAt: financialInstantSchema,
    updatedAt: financialInstantSchema,
  })
  .refine(
    (task) => task.dateEditable === (task.firstParticipationAt === null),
    "Invalid date editing permission.",
  );
export const adminTaskPageSchema = financialPageSchema(adminTaskSummarySchema);
export type EmployeeTaskDay = z.infer<typeof employeeTaskDaySchema>;
export type AdminTaskDetail = z.infer<typeof adminTaskDetailSchema>;
export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskEdit = z.infer<typeof taskEditSchema>;
