import {
  submissionDetailSchema,
  submissionSummarySchema,
  taskContentSnapshotSchema,
  adminSubmissionDetailSchema,
} from "@template/contracts";
import type {
  Prisma,
  SubmissionEvidence,
  ImageAsset,
} from "@template/database";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { mapAcceptedImage } from "../proofs/proofs.mapper.js";

export const submissionInclude = {
  evidence: { orderBy: { version: "desc" }, take: 1, include: { asset: true } },
  finalReview: {
    include: { actor: { select: { id: true, fullName: true, email: true } } },
  },
  employee: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.TaskSubmissionInclude;
export type SubmissionRow = Prisma.TaskSubmissionGetPayload<{
  include: typeof submissionInclude;
}>;
export function mapAdminSubmissionDetail(submission: SubmissionRow) {
  const review = submission.finalReview;
  return adminSubmissionDetailSchema.parse({
    submission: mapSubmissionDetail(submission, false),
    employee: submission.employee,
    review:
      review === null ? null : { reason: review.reason, actor: review.actor },
  });
}
export function mapSubmissionSummary(submission: SubmissionRow) {
  return submissionSummarySchema.parse({
    id: submission.id,
    taskId: submission.taskId,
    businessDate: submission.businessDate.toISOString().slice(0, 10),
    taskTitle: taskContentSnapshotSchema.parse(submission.capturedTaskContent)
      .title,
    reward: formatUsdtAmount(submission.rewardUnits),
    submittedAt: submission.submittedAt.toISOString(),
    status: submission.status,
    version: submission.version,
    currentEvidenceVersion: submission.currentEvidenceVersion,
  });
}
export function mapEvidence(
  evidence: SubmissionEvidence & { asset: ImageAsset },
) {
  return {
    id: evidence.id,
    version: evidence.version,
    assetId: evidence.assetId,
    acceptedAt: evidence.acceptedAt.toISOString(),
    asset: mapAcceptedImage(evidence.asset, "STORAGE_UNAVAILABLE"),
  };
}
export function mapSubmissionDetail(
  submission: SubmissionRow,
  canReplace: boolean,
) {
  const evidence = submission.evidence[0];
  if (
    evidence === undefined ||
    evidence.version !== submission.currentEvidenceVersion
  )
    throw new TypeError("Current evidence is missing.");
  const review = submission.finalReview;
  return submissionDetailSchema.parse({
    ...mapSubmissionSummary(submission),
    snapshot: {
      taskId: submission.taskId,
      businessDate: submission.businessDate.toISOString().slice(0, 10),
      capturedTaskRevision: submission.capturedTaskRevision,
      capturedTaskContent: submission.capturedTaskContent,
      subscriptionId: submission.subscriptionId,
      capturedSubscriptionTerms: submission.capturedSubscriptionTerms,
      reward: formatUsdtAmount(submission.rewardUnits),
      declaredExecuted: submission.executionDeclared,
      submittedAt: submission.submittedAt.toISOString(),
      deadlineAt: submission.deadlineAt.toISOString(),
    },
    evidence: mapEvidence(evidence),
    finalDecision:
      review === null
        ? null
        : {
            decision: review.decision === "APPROVED" ? "APPROVE" : "REJECT",
            reason: review.reason,
            decidedAt: review.decidedAt.toISOString(),
            reviewedSubmissionVersion: review.submissionVersion,
            reviewedEvidenceVersion: review.evidenceVersion,
          },
    canReplace,
  });
}
