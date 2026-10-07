import { z } from "zod";
import {
  businessDateSchema,
  financialInstantSchema,
  positiveUsdtAmountSchema,
} from "../financial/financial.schema.ts";
import {
  boundedPageQueryShape,
  boundedSearchSchema,
  financialPageSchema,
  nonEmptyBoundedString,
  safePageOffset,
} from "../http/http.schema.ts";
import {
  configurationVersionSchema,
  packageTermsSchema,
  safeCountSchema,
} from "../packages/package.schema.ts";
import { proofAssetSchema } from "../proofs/proofs.schema.ts";
import {
  taskContentSnapshotSchema,
  taskExpectedRevisionSchema,
  taskPublicationDateSchema,
  taskRevisionSchema,
} from "../tasks/task-content.schema.ts";

export const submissionStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
export const reviewDecisionSchema = z.enum(["APPROVE", "REJECT"]);
export const submissionCreateSchema = z.strictObject({
  commandId: z.uuid(),
  taskId: z.uuid(),
  expectedTaskRevision: taskExpectedRevisionSchema,
  proofAssetId: z.uuid(),
  declaredExecuted: z.literal(true),
});
export const evidenceReplaceSchema = z.strictObject({
  commandId: z.uuid(),
  expectedSubmissionVersion: taskExpectedRevisionSchema,
  proofAssetId: z.uuid(),
});
export const submissionReviewSchema = z.strictObject({
  commandId: z.uuid(),
  confirmed: z.literal(true),
  expectedSubmissionVersion: taskExpectedRevisionSchema,
  expectedEvidenceVersion: configurationVersionSchema,
  decision: reviewDecisionSchema,
  reason: nonEmptyBoundedString(500),
});
export const submissionSnapshotSchema = z
  .strictObject({
    taskId: z.uuid(),
    businessDate: taskPublicationDateSchema,
    capturedTaskRevision: taskRevisionSchema,
    capturedTaskContent: taskContentSnapshotSchema,
    subscriptionId: z.uuid(),
    capturedSubscriptionTerms: packageTermsSchema,
    reward: positiveUsdtAmountSchema,
    declaredExecuted: z.literal(true),
    submittedAt: financialInstantSchema,
    deadlineAt: financialInstantSchema,
  })
  .refine(
    (snapshot) =>
      snapshot.reward === snapshot.capturedSubscriptionTerms.dailyReward,
    "Reward must match captured terms.",
  );
export const evidenceReferenceSchema = z.strictObject({
  id: z.uuid(),
  version: configurationVersionSchema,
  assetId: z.uuid(),
  acceptedAt: financialInstantSchema,
});
export const submissionSummarySchema = z.strictObject({
  id: z.uuid(),
  taskId: z.uuid(),
  businessDate: taskPublicationDateSchema,
  taskTitle: nonEmptyBoundedString(150),
  reward: positiveUsdtAmountSchema,
  submittedAt: financialInstantSchema,
  status: submissionStatusSchema,
  version: configurationVersionSchema,
  currentEvidenceVersion: configurationVersionSchema,
});
export const safeTaskEmployeeSchema = z.strictObject({
  id: z.uuid(),
  fullName: nonEmptyBoundedString(150),
  email: z.email().max(320),
});
export const finalDecisionSchema = z.strictObject({
  decision: reviewDecisionSchema,
  reason: nonEmptyBoundedString(500).optional(),
  decidedAt: financialInstantSchema,
  reviewedSubmissionVersion: configurationVersionSchema,
  reviewedEvidenceVersion: configurationVersionSchema,
});
export const evidenceDetailSchema = evidenceReferenceSchema
  .extend({ asset: proofAssetSchema })
  .refine(
    (evidence) => evidence.assetId === evidence.asset.id,
    "Evidence identity mismatch.",
  );
export const submissionDetailSchema = submissionSummarySchema
  .extend({
    snapshot: submissionSnapshotSchema,
    evidence: evidenceDetailSchema,
    finalDecision: finalDecisionSchema.nullable(),
    canReplace: z.boolean(),
  })
  .superRefine((submission, context) => {
    const snapshot = submission.snapshot;
    const expectedDecision =
      submission.status === "APPROVED" ? "APPROVE" : "REJECT";
    if (
      submission.taskId !== snapshot.taskId ||
      submission.businessDate !== snapshot.businessDate ||
      submission.reward !== snapshot.reward ||
      submission.taskTitle !== snapshot.capturedTaskContent.title ||
      submission.submittedAt !== snapshot.submittedAt ||
      submission.currentEvidenceVersion !== submission.evidence.version ||
      (submission.status === "PENDING"
        ? submission.finalDecision !== null
        : submission.finalDecision?.decision !== expectedDecision) ||
      (submission.status !== "PENDING" && submission.canReplace)
    )
      context.addIssue({
        code: "custom",
        message: "Inconsistent accepted submission.",
      });
  });
export const adminSubmissionSummarySchema = submissionSummarySchema.extend({
  employee: safeTaskEmployeeSchema,
  evidence: evidenceDetailSchema,
});
export const adminSubmissionDetailSchema = z.strictObject({
  submission: submissionDetailSchema,
  employee: safeTaskEmployeeSchema,
  review: z
    .strictObject({
      reason: nonEmptyBoundedString(500),
      actor: safeTaskEmployeeSchema,
    })
    .nullable(),
});
export const submissionListQuerySchema = z
  .strictObject({
    ...boundedPageQueryShape,
    status: submissionStatusSchema.optional(),
  })
  .refine(safePageOffset);
export const adminSubmissionListQuerySchema = z
  .strictObject({
    ...boundedPageQueryShape,
    search: boundedSearchSchema.optional(),
    taskId: z.uuid().optional(),
    employeeId: z.uuid().optional(),
    status: submissionStatusSchema.optional(),
    dateFrom: businessDateSchema.optional(),
    dateTo: businessDateSchema.optional(),
  })
  .refine(safePageOffset)
  .refine(
    (query) =>
      !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo,
    "Invalid date range.",
  );
export const submissionStatusCountsSchema = z
  .strictObject({
    all: safeCountSchema,
    pending: safeCountSchema,
    approved: safeCountSchema,
    rejected: safeCountSchema,
  })
  .refine(
    (counts) =>
      counts.all === counts.pending + counts.approved + counts.rejected,
    "Invalid status totals.",
  );
export const submissionPageSchema = financialPageSchema(
  submissionSummarySchema,
);
export const evidencePageSchema = financialPageSchema(evidenceDetailSchema);
export const adminSubmissionPageSchema = financialPageSchema(
  adminSubmissionSummarySchema,
).safeExtend({ statusCounts: submissionStatusCountsSchema });
export type SubmissionDetail = z.infer<typeof submissionDetailSchema>;
export type SubmissionCreate = z.infer<typeof submissionCreateSchema>;
export type SubmissionReview = z.infer<typeof submissionReviewSchema>;
export type EvidenceReplace = z.infer<typeof evidenceReplaceSchema>;
