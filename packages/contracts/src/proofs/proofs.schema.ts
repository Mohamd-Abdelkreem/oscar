import { z } from "zod";
import { financialInstantSchema } from "../financial/financial.schema.ts";

export const PROOF_INPUT_MAX_BYTES = 5_242_880;
export const PROOF_MULTIPART_MAX_BYTES = 5_259_264;
export const PROOF_OUTPUT_MAX_BYTES = 33_554_432;
export const PROOF_MAX_DIMENSION = 8_192;
export const PROOF_MAX_PIXELS = 16_777_216;
export const PROOF_MAX_CHANNELS = 4;
export const PROOF_MAX_FRAMES = 1;
export const PROOF_INPUT_DEADLINE_MS = 30_000;
export const PROOF_DECODER_TIMEOUT_SECONDS = 5;
export const PROOF_CHILD_DEADLINE_MS = 10_000;
export const PROOF_CHILD_HEAP_MIB = 128;
export const PROOF_PROCESSING_SLOTS = 2;
export const PROOF_UPLOAD_RESERVATION_BYTES = 40 * 1_024 * 1_024;
export const PROOF_STAGING_MAX_BYTES = 256 * 1_024 * 1_024;
export const PROOF_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const assetPurposeSchema = z.enum(["PROOF", "TASK_ILLUSTRATION"]);
export const assetAvailabilitySchema = z.enum([
  "PRESENT",
  "REMOVED",
  "STORAGE_UNAVAILABLE",
]);
export const uploadFailureCodeSchema = z.enum([
  "UPLOAD_CANCELLED",
  "UPLOAD_TOO_LARGE",
  "UNSUPPORTED_IMAGE",
  "INVALID_IMAGE",
  "STORAGE_UNAVAILABLE",
  "IMAGE_PROCESSING_UNAVAILABLE",
  "UPLOAD_INTERRUPTED",
  "UPLOAD_EXPIRED",
]);
export const assetMetadataShape = {
  id: z.uuid(),
  uploadedAt: financialInstantSchema,
  width: z.number().int().min(1).max(PROOF_MAX_DIMENSION),
  height: z.number().int().min(1).max(PROOF_MAX_DIMENSION),
  contentType: z.literal("image/png"),
  byteCount: z.number().int().min(1).max(PROOF_OUTPUT_MAX_BYTES),
  availability: assetAvailabilitySchema,
};
const withinPixels = (asset: { width: number; height: number }) =>
  asset.width * asset.height <= PROOF_MAX_PIXELS;
export const proofAssetSchema = z
  .strictObject({
    ...assetMetadataShape,
    purpose: z.literal("PROOF"),
  })
  .refine(withinPixels, "Image exceeds pixel limit.");
export const illustrationAssetSchema = z
  .strictObject({
    ...assetMetadataShape,
    purpose: z.literal("TASK_ILLUSTRATION"),
  })
  .refine(withinPixels, "Image exceeds pixel limit.");
export const uploadIdentitySchema = z.strictObject({ commandId: z.uuid() });
export const uploadCancellationSchema = z.strictObject({
  confirmed: z.literal(true),
});
const observationIdentity = {
  commandId: z.uuid(),
  purpose: assetPurposeSchema,
};
const readyUploadSchema = z.discriminatedUnion("purpose", [
  z.strictObject({
    commandId: z.uuid(),
    purpose: z.literal("PROOF"),
    state: z.literal("READY"),
    asset: proofAssetSchema,
  }),
  z.strictObject({
    commandId: z.uuid(),
    purpose: z.literal("TASK_ILLUSTRATION"),
    state: z.literal("READY"),
    asset: illustrationAssetSchema,
  }),
]);
export const uploadObservationSchema = z.union([
  readyUploadSchema,
  z.strictObject({ ...observationIdentity, state: z.literal("PENDING") }),
  z.strictObject({ ...observationIdentity, state: z.literal("NOT_OBSERVED") }),
  z.strictObject({
    ...observationIdentity,
    state: z.literal("FAILED"),
    failureCode: uploadFailureCodeSchema,
    failedAt: financialInstantSchema,
  }),
]);
export const uploadCancellationOutcomeSchema = uploadObservationSchema.refine(
  (observation) =>
    observation.state === "READY" || observation.state === "FAILED",
  "Cancellation requires a terminal observation.",
);
export type ProofAsset = z.infer<typeof proofAssetSchema>;
export type IllustrationAsset = z.infer<typeof illustrationAssetSchema>;
export type UploadObservation = z.infer<typeof uploadObservationSchema>;
