import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatabaseClient, ImageAsset } from "@template/database";
import { PrivateImageStorage } from "../../../infrastructure/files/private-image-storage.js";
import { ProofReadService } from "../../proofs/proof-read.service.js";
import type { TaskClock } from "../../tasks/task-transaction.js";

// Synthetic retained files exercise attachment availability, not parser/decoder acceptance.
export async function submissionFixtureReads(
  database: DatabaseClient,
  root: string,
  clock: TaskClock,
  assets: readonly ImageAsset[],
) {
  for (const asset of assets) {
    if (asset.storageKey === null || asset.storedByteCount === null)
      throw new Error("Ready fixture metadata is required.");
    const directory = join(root, "assets", asset.storageKey);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(
      join(directory, "content.png"),
      Buffer.alloc(asset.storedByteCount),
    );
  }
  return new ProofReadService(
    database,
    new PrivateImageStorage({
      storageRoot: root,
      processingSlots: 2,
      uploadReservationBytes: 41_943_040,
      stagingMaxBytes: 268_435_456,
      inputDeadlineMs: 30_000,
    }),
    clock,
  );
}
