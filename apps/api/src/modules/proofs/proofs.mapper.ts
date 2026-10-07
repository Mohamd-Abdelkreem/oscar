import {
  illustrationAssetSchema,
  proofAssetSchema,
  uploadObservationSchema,
} from "@template/contracts";
import type { ImageAsset } from "@template/database";

export function mapAcceptedImage(
  asset: ImageAsset,
  availability: "PRESENT" | "REMOVED" | "STORAGE_UNAVAILABLE",
) {
  const metadata = {
    id: asset.id,
    purpose: asset.purpose,
    uploadedAt: asset.uploadedAt?.toISOString(),
    width: asset.width,
    height: asset.height,
    contentType: "image/png",
    byteCount: asset.storedByteCount,
    availability,
  };
  return asset.purpose === "PROOF"
    ? proofAssetSchema.parse(metadata)
    : illustrationAssetSchema.parse(metadata);
}

export function mapUploadObservation(
  asset: ImageAsset | null,
  identity: { commandId: string; purpose: "PROOF" | "TASK_ILLUSTRATION" },
  availability:
    "PRESENT" | "REMOVED" | "STORAGE_UNAVAILABLE" = "STORAGE_UNAVAILABLE",
) {
  if (asset === null)
    return uploadObservationSchema.parse({
      ...identity,
      state: "NOT_OBSERVED",
    });
  if (asset.state === "STAGING")
    return uploadObservationSchema.parse({ ...identity, state: "PENDING" });
  if (asset.state === "FAILED")
    return uploadObservationSchema.parse({
      ...identity,
      state: "FAILED",
      failureCode: asset.failureCode,
      failedAt: asset.failedAt?.toISOString(),
    });
  return uploadObservationSchema.parse({
    ...identity,
    state: "READY",
    asset: mapAcceptedImage(asset, availability),
  });
}
