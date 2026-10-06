import { PROOF_RETENTION_MS } from "@template/contracts";

export type RetentionCandidate = Readonly<{
  purpose: "PROOF" | "TASK_ILLUSTRATION";
  state: "STAGING" | "READY" | "FAILED" | "DELETING" | "DELETED";
  uploadedAt: Date | null;
  hasPendingEvidence: boolean;
  hasIllustratedTask: boolean;
}>;

export function isProofDeletionEligible(asset: RetentionCandidate, now: Date) {
  if (asset.state !== "READY" || asset.uploadedAt === null) return false;
  if (asset.purpose === "PROOF" && asset.hasPendingEvidence) return false;
  if (asset.purpose === "TASK_ILLUSTRATION" && asset.hasIllustratedTask)
    return false;
  return now.getTime() - asset.uploadedAt.getTime() >= PROOF_RETENTION_MS;
}
