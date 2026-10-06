import { describe, expect, it } from "vitest";
import { PROOF_RETENTION_MS } from "@template/contracts";
import {
  isProofDeletionEligible,
  type RetentionCandidate,
} from "./proof-retention.js";

const uploadedAt = new Date("2026-10-05T09:00:00.000Z");
const proof: RetentionCandidate = {
  purpose: "PROOF",
  state: "READY",
  uploadedAt,
  hasPendingEvidence: false,
  hasIllustratedTask: false,
};

describe("completed-upload retention", () => {
  it.each([-1, 0, 1])(
    "unattached and final proof age at boundary %i ms",
    (offset) => {
      expect(
        isProofDeletionEligible(
          proof,
          new Date(uploadedAt.getTime() + PROOF_RETENTION_MS + offset),
        ),
      ).toBe(offset >= 0);
    },
  );

  it("preserves proof with any pending evidence reference beyond thirty days", () => {
    expect(
      isProofDeletionEligible(
        { ...proof, hasPendingEvidence: true },
        new Date("2027-01-01T00:00:00Z"),
      ),
    ).toBe(false);
  });

  it("preserves referenced illustrations and ages unreferenced illustrations", () => {
    const now = new Date(uploadedAt.getTime() + PROOF_RETENTION_MS);
    const illustration = { ...proof, purpose: "TASK_ILLUSTRATION" as const };
    expect(
      isProofDeletionEligible(
        { ...illustration, hasIllustratedTask: true },
        now,
      ),
    ).toBe(false);
    expect(isProofDeletionEligible(illustration, now)).toBe(true);
  });

  it.each(["STAGING", "FAILED", "DELETING", "DELETED"] as const)(
    "does not admit %s to a new deletion",
    (state) => {
      expect(
        isProofDeletionEligible(
          { ...proof, state },
          new Date("2027-01-01T00:00:00Z"),
        ),
      ).toBe(false);
    },
  );

  it("does not invent a completed-upload age", () => {
    expect(
      isProofDeletionEligible(
        { ...proof, uploadedAt: null },
        new Date("2027-01-01T00:00:00Z"),
      ),
    ).toBe(false);
  });
});
