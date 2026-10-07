import type { FileHandle } from "node:fs/promises";
import { z } from "zod";
import { PROOF_OUTPUT_MAX_BYTES } from "@template/contracts";
import type {
  DatabaseClient,
  ImageAsset,
  ImageAssetPurpose,
} from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import type { PrivateImageStorage } from "../../infrastructure/files/private-image-storage.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import { currentSubscription } from "../subscriptions/subscriptions.service.js";
import { isEffectiveSubscription } from "../subscriptions/subscriptions.mapper.js";
import type {
  TaskActorIdentity,
  TaskClock,
} from "../tasks/task-transaction.js";
import { mapAcceptedImage, mapUploadObservation } from "./proofs.mapper.js";

const notFound = () => new AppError("Image not found.", 404, "NOT_FOUND");
const unavailable = () =>
  new AppError(
    "Private image storage is unavailable.",
    503,
    "STORAGE_UNAVAILABLE",
  );

export class ProofReadService {
  private readonly streams = new Set<AbortController>();
  private stopped = false;
  private readonly calendar = new BusinessClock(() => this.clock());
  constructor(
    private readonly database: DatabaseClient,
    private readonly storage: PrivateImageStorage,
    private readonly clock: TaskClock,
  ) {}

  private async authorized(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    assetId: string,
  ) {
    z.uuid().parse(assetId);
    return this.database.$transaction(async (transaction) => {
      const now = this.clock();
      const actor = await readSessionAuthority(transaction, identity, now);
      const asset = await transaction.imageAsset.findFirst({
        where: {
          id: assetId,
          purpose,
          state: { in: ["READY", "DELETING", "DELETED"] },
        },
      });
      if (asset === null) throw notFound();
      if (actor.role === "ADMIN") return asset;
      if (purpose === "PROOF") {
        if (asset.ownerUserId !== actor.id) throw notFound();
        return asset;
      }
      const history = await transaction.task.findFirst({
        where: {
          illustrationAssetId: asset.id,
          submissions: { some: { employeeId: actor.id } },
        },
      });
      if (history !== null) return asset;
      const subscription = await currentSubscription(transaction, actor.id);
      if (actor.tasksBlocked || !isEffectiveSubscription(subscription, now))
        throw notFound();
      const task = await transaction.task.findFirst({
        where: {
          illustrationAssetId: asset.id,
          publicationState: "PUBLISHED",
          publicationDate: new Date(
            `${this.calendar.businessDate(now.toISOString())}T00:00:00.000Z`,
          ),
        },
      });
      if (task === null) throw notFound();
      return asset;
    });
  }

  private async open(asset: ImageAsset): Promise<FileHandle> {
    if (asset.state !== "READY")
      throw new AppError("Image has been removed.", 410, "PROOF_REMOVED");
    if (asset.storageKey === null || asset.storedByteCount === null)
      throw unavailable();
    let file: FileHandle | undefined;
    try {
      file = await this.storage.content(
        asset.storageKey,
        PROOF_OUTPUT_MAX_BYTES,
      );
      if ((await file.stat()).size !== asset.storedByteCount) {
        throw unavailable();
      }
      return file;
    } catch {
      await file?.close();
      throw unavailable();
    }
  }

  async availability(
    asset: ImageAsset,
  ): Promise<"PRESENT" | "REMOVED" | "STORAGE_UNAVAILABLE"> {
    if (asset.state === "DELETING" || asset.state === "DELETED")
      return "REMOVED";
    try {
      const file = await this.open(asset);
      await file.close();
      return "PRESENT";
    } catch {
      return "STORAGE_UNAVAILABLE";
    }
  }

  async metadata(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    assetId: string,
  ) {
    const asset = await this.authorized(identity, purpose, assetId);
    return mapAcceptedImage(asset, await this.availability(asset));
  }

  async content(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    assetId: string,
  ) {
    if (this.stopped) throw unavailable();
    const asset = await this.authorized(identity, purpose, assetId);
    return { file: await this.open(asset), byteCount: asset.storedByteCount };
  }

  trackStream() {
    const controller = new AbortController();
    this.streams.add(controller);
    if (this.stopped) controller.abort();
    return {
      signal: controller.signal,
      release: () => {
        this.streams.delete(controller);
      },
    };
  }

  stop() {
    this.stopped = true;
    for (const controller of this.streams) controller.abort();
  }

  async observation(
    asset: ImageAsset | null,
    commandId: string,
    purpose: ImageAssetPurpose,
  ) {
    return mapUploadObservation(
      asset,
      { commandId, purpose },
      asset !== null && asset.state !== "STAGING" && asset.state !== "FAILED"
        ? await this.availability(asset)
        : "STORAGE_UNAVAILABLE",
    );
  }
}
