import { z } from "zod";

export const taskCommandKindSchema = z.enum([
  "TASK_CREATE",
  "TASK_EDIT",
  "TASK_STATUS",
  "CODE_CREATE",
  "CODE_STATUS",
  "TASK_UNLOCK",
  "SUBMISSION_CREATE",
  "EVIDENCE_REPLACE",
  "FINAL_REVIEW",
]);
export type TaskCommandKind = z.infer<typeof taskCommandKindSchema>;
export const TASK_COMMAND_ROLES = {
  TASK_CREATE: "ADMIN",
  TASK_EDIT: "ADMIN",
  TASK_STATUS: "ADMIN",
  CODE_CREATE: "ADMIN",
  CODE_STATUS: "ADMIN",
  FINAL_REVIEW: "ADMIN",
  TASK_UNLOCK: "USER",
  SUBMISSION_CREATE: "USER",
  EVIDENCE_REPLACE: "USER",
} as const satisfies Record<TaskCommandKind, "ADMIN" | "USER">;
export const taskCommandIdSchema = z.uuid();
export const taskCommandCancellationSchema = z.strictObject({
  kind: taskCommandKindSchema,
  confirmed: z.literal(true),
});
export const taskCommandQuerySchema = z.strictObject({
  kind: taskCommandKindSchema,
});
