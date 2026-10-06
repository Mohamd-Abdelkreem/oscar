import { z } from "zod";
import { financialInstantSchema } from "../financial/financial.schema.ts";
import {
  taskCodeSummarySchema,
  unlockOutcomeSchema,
} from "../task-codes/task-codes.schema.ts";
import {
  adminSubmissionDetailSchema,
  submissionDetailSchema,
} from "../task-submissions/task-submissions.schema.ts";
import { taskCommandKindSchema } from "./task-command-kind.schema.ts";
import { adminTaskDetailSchema } from "./tasks.schema.ts";

const receiptShape = {
  commandId: z.uuid(),
  targetId: z.uuid(),
  committedAt: financialInstantSchema,
};
export const committedTaskCommandSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      ...receiptShape,
      kind: z.enum(["TASK_CREATE", "TASK_EDIT", "TASK_STATUS"]),
      outcome: adminTaskDetailSchema,
    }),
    z.strictObject({
      ...receiptShape,
      kind: z.enum(["CODE_CREATE", "CODE_STATUS"]),
      outcome: taskCodeSummarySchema,
    }),
    z.strictObject({
      ...receiptShape,
      kind: z.literal("TASK_UNLOCK"),
      outcome: unlockOutcomeSchema,
    }),
    z.strictObject({
      ...receiptShape,
      kind: z.enum(["SUBMISSION_CREATE", "EVIDENCE_REPLACE"]),
      outcome: submissionDetailSchema,
    }),
    z.strictObject({
      ...receiptShape,
      kind: z.literal("FINAL_REVIEW"),
      outcome: adminSubmissionDetailSchema,
    }),
  ])
  .refine((command) => {
    switch (command.kind) {
      case "TASK_UNLOCK":
        return command.targetId === command.outcome.day.task?.id;
      case "FINAL_REVIEW":
        return command.targetId === command.outcome.submission.id;
      default:
        return command.targetId === command.outcome.id;
    }
  }, "Command target mismatch.");
export const commandObservationSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("OBSERVED"),
    command: committedTaskCommandSchema,
  }),
  z.strictObject({
    state: z.literal("CANCELLED"),
    commandId: z.uuid(),
    kind: taskCommandKindSchema,
    cancelledAt: financialInstantSchema,
  }),
  z.strictObject({
    state: z.literal("NOT_OBSERVED"),
    commandId: z.uuid(),
    kind: taskCommandKindSchema,
  }),
]);
export const commandCancellationOutcomeSchema = commandObservationSchema.refine(
  (observation) => observation.state !== "NOT_OBSERVED",
  "Terminal outcome required.",
);
export type CommandObservation = z.infer<typeof commandObservationSchema>;
