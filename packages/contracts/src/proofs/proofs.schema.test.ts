import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  illustrationAssetSchema,
  proofAssetSchema,
  PROOF_INPUT_MAX_BYTES,
  PROOF_OUTPUT_MAX_BYTES,
  uploadCancellationOutcomeSchema,
  uploadCancellationSchema,
  uploadIdentitySchema,
  uploadObservationSchema,
} from "./proofs.schema.ts";

const proof = {
  id: randomUUID(),
  purpose: "PROOF",
  uploadedAt: "2026-10-05T09:00:00.000Z",
  width: 4096,
  height: 4096,
  byteCount: PROOF_OUTPUT_MAX_BYTES,
  contentType: "image/png",
  availability: "PRESENT",
};
describe("private asset wire contracts", () => {
  it("keeps raw-input and canonical-output bounds distinct", () => {
    expect(PROOF_INPUT_MAX_BYTES).toBe(5_242_880);
    expect(proofAssetSchema.parse(proof)).toEqual(proof);
    expect(
      proofAssetSchema.safeParse({
        ...proof,
        byteCount: PROOF_OUTPUT_MAX_BYTES + 1,
      }).success,
    ).toBe(false);
    expect(proofAssetSchema.safeParse({ ...proof, width: 4097 }).success).toBe(
      false,
    );
    expect(illustrationAssetSchema.safeParse(proof).success).toBe(false);
  });
  it.each([
    "storageKey",
    "ownerUserId",
    "contentHash",
    "url",
    "filename",
    "inputByteCount",
  ])("rejects private/authority field %s", (field) => {
    expect(
      proofAssetSchema.safeParse({ ...proof, [field]: "untrusted" }).success,
    ).toBe(false);
  });
  it("represents absent cancelled uploads without invented file facts", () => {
    const observation = {
      commandId: randomUUID(),
      purpose: "PROOF",
      state: "FAILED",
      failureCode: "UPLOAD_CANCELLED",
      failedAt: "2026-10-05T09:00:00Z",
    };
    expect(uploadCancellationOutcomeSchema.safeParse(observation).success).toBe(
      true,
    );
    expect(
      uploadObservationSchema.safeParse({ ...observation, asset: null })
        .success,
    ).toBe(false);
    expect(
      uploadCancellationOutcomeSchema.safeParse({
        commandId: observation.commandId,
        purpose: "PROOF",
        state: "NOT_OBSERVED",
      }).success,
    ).toBe(false);
    expect(
      uploadObservationSchema.safeParse({
        commandId: observation.commandId,
        purpose: "TASK_ILLUSTRATION",
        state: "READY",
        asset: proof,
      }).success,
    ).toBe(false);
    expect(
      uploadCancellationSchema.safeParse({ confirmed: "true" }).success,
    ).toBe(false);
    expect(
      uploadIdentitySchema.safeParse({ commandId: "../file" }).success,
    ).toBe(false);
  });
});
