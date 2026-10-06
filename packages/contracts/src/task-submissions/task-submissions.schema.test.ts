import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  adminSubmissionListQuerySchema,
  evidenceDetailSchema,
  finalDecisionSchema,
  submissionCreateSchema,
  submissionReviewSchema,
  submissionStatusCountsSchema,
} from "./task-submissions.schema.ts";

describe("accepted work and review intent", () => {
  it("requires affirmative declaration and rejects client entitlement", () => {
    const intent = {
      commandId: randomUUID(),
      taskId: randomUUID(),
      expectedTaskRevision: 1,
      proofAssetId: randomUUID(),
      declaredExecuted: true,
    };
    expect(submissionCreateSchema.safeParse(intent).success).toBe(true);
    for (const forged of [
      { ...intent, declaredExecuted: "true" },
      { ...intent, declaredExecuted: false },
      { ...intent, reward: "2" },
      { ...intent, subscriptionId: randomUUID() },
    ])
      expect(submissionCreateSchema.safeParse(forged).success).toBe(false);
  });
  it("binds both reviewed versions and reasoned confirmation", () => {
    const review = {
      commandId: randomUUID(),
      confirmed: true,
      expectedSubmissionVersion: 1,
      expectedEvidenceVersion: 2,
      decision: "APPROVE",
      reason: "Verified evidence",
    };
    expect(submissionReviewSchema.safeParse(review).success).toBe(true);
    for (const invalid of [
      { ...review, reason: " " },
      { ...review, expectedEvidenceVersion: undefined },
      { ...review, confirmed: "true" },
      { ...review, decision: "APPROVED" },
      { ...review, actor: randomUUID() },
    ])
      expect(submissionReviewSchema.safeParse(invalid).success).toBe(false);
  });
  it("rejects mismatched and private nested asset projections", () => {
    const assetId = randomUUID();
    const evidence = {
      id: randomUUID(),
      version: 1,
      assetId,
      acceptedAt: "2026-10-05T09:00:00Z",
      asset: {
        id: assetId,
        purpose: "PROOF",
        uploadedAt: "2026-10-05T08:59:00Z",
        width: 1,
        height: 1,
        byteCount: 50,
        contentType: "image/png",
        availability: "PRESENT",
      },
    };
    expect(evidenceDetailSchema.safeParse(evidence).success).toBe(true);
    expect(
      evidenceDetailSchema.safeParse({ ...evidence, assetId: randomUUID() })
        .success,
    ).toBe(false);
    expect(
      evidenceDetailSchema.safeParse({
        ...evidence,
        asset: { ...evidence.asset, storageKey: "private" },
      }).success,
    ).toBe(false);
  });
  it("bounds list semantics and checks whole-set status totals", () => {
    expect(adminSubmissionListQuerySchema.parse({ limit: "10" })).toEqual({
      page: 1,
      limit: 10,
    });
    expect(
      adminSubmissionListQuerySchema.safeParse({ status: "FINAL" }).success,
    ).toBe(false);
    expect(
      submissionStatusCountsSchema.safeParse({
        all: 5,
        pending: 2,
        approved: 2,
        rejected: 1,
      }).success,
    ).toBe(true);
    expect(
      submissionStatusCountsSchema.safeParse({
        all: 4,
        pending: 2,
        approved: 2,
        rejected: 1,
      }).success,
    ).toBe(false);
  });
});

it("keeps old immutable review receipts readable and validates bounded current reasons", () => {
  const receipt = {
    decision: "REJECT",
    decidedAt: "2026-10-05T09:00:00.000Z",
    reviewedSubmissionVersion: 1,
    reviewedEvidenceVersion: 1,
  };
  expect(finalDecisionSchema.safeParse(receipt).success).toBe(true);
  expect(
    finalDecisionSchema.parse({ ...receipt, reason: "Saved rejection reason" })
      .reason,
  ).toBe("Saved rejection reason");
  expect(
    finalDecisionSchema.safeParse({ ...receipt, reason: "x".repeat(501) })
      .success,
  ).toBe(false);
});
