import { z } from "zod";
import { financialInstantSchema } from "../financial/financial.schema.ts";
import {
  boundedPageQueryShape,
  boundedSearchSchema,
  financialPageSchema,
  nonEmptyBoundedString,
  safePageOffset,
} from "../http/http.schema.ts";
import { safeCountSchema } from "../packages/package.schema.ts";
import {
  safeTaskEmployeeSchema,
  submissionStatusSchema,
} from "../task-submissions/task-submissions.schema.ts";
import {
  taskExpectedRevisionSchema,
  taskPublicationDateSchema,
  taskRevisionSchema,
  taskWindowSchema,
} from "../tasks/task-content.schema.ts";
import { employeeTaskDaySchema } from "../tasks/tasks.schema.ts";

export const normalizeTaskCode = (code: string): string =>
  code.trim().toUpperCase();
export const taskCodeTextSchema = z
  .string()
  .transform(normalizeTaskCode)
  .pipe(
    z
      .string()
      .min(1)
      .max(64)
      .refine(
        (code) => !/[\p{Cc}\p{Cs}]/u.test(code),
        "Code contains controls or invalid Unicode.",
      ),
  );
export const normalizedTaskCodeSchema = z.string().refine((code) => {
  const normalized = taskCodeTextSchema.safeParse(code);
  return normalized.success && normalized.data === code;
}, "Stored code must already be normalized.");
export const taskCodeStateSchema = z.enum(["ENABLED", "PAUSED"]);
export const taskCodeCreateSchema = z.strictObject({
  commandId: z.uuid(),
  confirmed: z.literal(true),
  taskId: z.uuid(),
  code: taskCodeTextSchema,
  state: taskCodeStateSchema,
  description: z.string().max(500).nullable().optional(),
});
export const taskCodeStatusSchema = z.strictObject({
  commandId: z.uuid(),
  confirmed: z.literal(true),
  expectedCodeVersion: taskExpectedRevisionSchema,
  state: taskCodeStateSchema,
});
export const taskUnlockRequestSchema = z.strictObject({
  commandId: z.uuid(),
  expectedTaskRevision: taskExpectedRevisionSchema,
  code: taskCodeTextSchema,
});
export const taskCodeListQuerySchema = z
  .strictObject({
    ...boundedPageQueryShape,
    search: boundedSearchSchema.optional(),
    taskId: z.uuid().optional(),
    state: taskCodeStateSchema.optional(),
  })
  .refine(safePageOffset);
export const taskCodeUsageQuerySchema = z
  .strictObject({
    ...boundedPageQueryShape,
    search: boundedSearchSchema.optional(),
  })
  .refine(safePageOffset);
export const taskCodeUsageSchema = z.strictObject({
  id: z.uuid(),
  employee: safeTaskEmployeeSchema,
  taskId: z.uuid(),
  businessDate: taskPublicationDateSchema,
  unlockedAt: financialInstantSchema,
  submissionStatus: submissionStatusSchema.nullable(),
});
export const taskCodeSummarySchema = z.strictObject({
  id: z.uuid(),
  normalizedText: normalizedTaskCodeSchema,
  state: taskCodeStateSchema,
  version: taskRevisionSchema,
  description: z.string().max(500).nullable(),
  createdAt: financialInstantSchema,
  updatedAt: financialInstantSchema,
  creator: safeTaskEmployeeSchema,
  task: z.strictObject({
    id: z.uuid(),
    title: nonEmptyBoundedString(150),
    platform: nonEmptyBoundedString(80),
    window: taskWindowSchema,
  }),
  distinctSuccessfulEmployeeCount: safeCountSchema,
  successfulUsageCount: safeCountSchema,
});
export const taskCodeAuditSchema = z.strictObject({
  id: z.uuid(),
  action: z.enum(["CODE_CREATE", "CODE_STATUS"]),
  actor: safeTaskEmployeeSchema,
  occurredAt: financialInstantSchema,
  before: z
    .strictObject({ state: taskCodeStateSchema, version: taskRevisionSchema })
    .nullable(),
  after: z.strictObject({
    state: taskCodeStateSchema,
    version: taskRevisionSchema,
  }),
});
export const taskCodePageSchema = financialPageSchema(taskCodeSummarySchema);
export const taskCodeUsagePageSchema = financialPageSchema(taskCodeUsageSchema);
export const taskCodeAuditPageSchema = financialPageSchema(taskCodeAuditSchema);
export const unlockOutcomeSchema = z
  .strictObject({ day: employeeTaskDaySchema })
  .refine(
    (outcome) => outcome.day.unlock !== null,
    "Accepted unlock required.",
  );
export type TaskCodeCreate = z.infer<typeof taskCodeCreateSchema>;
export type TaskCodeStatus = z.infer<typeof taskCodeStatusSchema>;
export type UnlockOutcome = z.infer<typeof unlockOutcomeSchema>;
