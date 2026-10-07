import { randomUUID, createHash } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { Readable } from "node:stream";
import {
  PROOF_OUTPUT_MAX_BYTES,
  uploadIdentitySchema,
  uploadCancellationSchema,
  uploadFailureCodeSchema,
} from "@template/contracts";
import type {
  DatabaseClient,
  ImageAssetPurpose,
  ImageAsset,
} from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import { receiveMultipartImage } from "../../infrastructure/files/multipart-image-upload.js";
import { decodeImage } from "../../infrastructure/files/image-decoder.js";
import type { DecoderObservation } from "../../infrastructure/files/image-decoder.js";
import type {
  PrivateImageStorage,
  ImageStorageReservation,
} from "../../infrastructure/files/private-image-storage.js";
import {
  authorizeTaskActor,
  runTaskTransaction,
  type TaskActorIdentity,
  type TaskClock,
} from "../tasks/task-transaction.js";
import {
  authorizeImageIntake,
  lockImageAsset,
  uploadRole,
} from "./proof-authority.js";

export class ProofUploadService {
  private readonly processing = new Map<string, AbortController>();
  private readonly jobs = new Map<AbortController, Promise<void>>();
  private stopped = false;
  constructor(
    private readonly database: DatabaseClient,
    private readonly storage: PrivateImageStorage,
    private readonly clock: TaskClock,
    private readonly inputDeadlineMs: number,
    private readonly observeDecoder?: (observation: DecoderObservation) => void,
  ) {}

  async stop() {
    this.stopped = true;
    for (const controller of this.jobs.keys()) controller.abort();
    await Promise.all(this.jobs.values());
  }

  private key(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    commandId: string,
  ) {
    return `${identity.userId}:${purpose}:${commandId}`;
  }

  async observe(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    commandId: string,
  ) {
    uploadIdentitySchema.parse({ commandId });
    return runTaskTransaction(
      this.database,
      { identity },
      async (transaction) => {
        await authorizeTaskActor(transaction, identity, {
          role: uploadRole(purpose),
          clock: this.clock,
        });
        return transaction.imageAsset.findUnique({
          where: {
            ownerUserId_purpose_uploadCommandId: {
              ownerUserId: identity.userId,
              purpose,
              uploadCommandId: commandId,
            },
          },
        });
      },
    );
  }

  async cancel(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    commandId: string,
    body: unknown,
  ) {
    uploadIdentitySchema.parse({ commandId });
    uploadCancellationSchema.parse(body);
    const asset = await runTaskTransaction(
      this.database,
      { identity },
      async (transaction) => {
        const { now } = await authorizeTaskActor(transaction, identity, {
          role: uploadRole(purpose),
          clock: this.clock,
        });
        const prior = await transaction.imageAsset.findUnique({
          where: {
            ownerUserId_purpose_uploadCommandId: {
              ownerUserId: identity.userId,
              purpose,
              uploadCommandId: commandId,
            },
          },
        });
        if (prior === null)
          return transaction.imageAsset.create({
            data: {
              ownerUserId: identity.userId,
              purpose,
              uploadCommandId: commandId,
              state: "FAILED",
              failureCode: "UPLOAD_CANCELLED",
              failedAt: now,
            },
          });
        await lockImageAsset(transaction, prior.id);
        const { now: cancelledAt } = await authorizeTaskActor(
          transaction,
          identity,
          {
            role: uploadRole(purpose),
            clock: this.clock,
          },
        );
        const current = await transaction.imageAsset.findUniqueOrThrow({
          where: { id: prior.id },
        });
        if (current.state !== "STAGING") return current;
        return transaction.imageAsset.update({
          where: { id: prior.id },
          data: {
            state: "FAILED",
            failureCode: "UPLOAD_CANCELLED",
            failedAt: cancelledAt,
            processingLeaseId: null,
            processingLeaseExpiresAt: null,
          },
        });
      },
    );
    if (asset.state === "FAILED")
      this.processing.get(this.key(identity, purpose, commandId))?.abort();
    return asset;
  }

  async upload(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    input: {
      source: Readable;
      headers: IncomingHttpHeaders;
      signal: AbortSignal;
    },
  ) {
    if (this.stopped)
      throw new AppError(
        "Image processing is unavailable.",
        503,
        "IMAGE_PROCESSING_UNAVAILABLE",
      );
    const controller = new AbortController();
    let complete!: () => void;
    const finished = new Promise<void>((resolve) => {
      complete = resolve;
    });
    this.jobs.set(controller, finished);
    try {
      return await this.processUpload(identity, purpose, input, controller);
    } finally {
      this.jobs.delete(controller);
      complete();
    }
  }

  private async processUpload(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    input: {
      source: Readable;
      headers: IncomingHttpHeaders;
      signal: AbortSignal;
    },
    controller: AbortController,
  ) {
    const { now: receivedAt } = await runTaskTransaction(
      this.database,
      { identity },
      (transaction) =>
        authorizeImageIntake(transaction, identity, purpose, this.clock),
    );
    const reservation = await this.storage.reserve();
    const interrupt = () => {
      controller.abort();
    };
    input.signal.addEventListener("abort", interrupt, { once: true });
    if (input.signal.aborted) interrupt();
    let asset: ImageAsset | undefined;
    let commandKey: string | undefined;
    let accepted = false;
    let safeToDiscard = true;
    const leaseId = randomUUID();
    try {
      const uploaded = await receiveMultipartImage({
        ...input,
        signal: controller.signal,
        storage: this.storage,
        reservation,
        inputDeadlineMs: this.inputDeadlineMs,
      });
      const uploadedAt = this.clock();
      const intentHash = createHash("sha256")
        .update(
          JSON.stringify({
            owner: identity.userId,
            purpose,
            format: uploaded.format,
            bytes: uploaded.byteCount,
            hash: uploaded.contentHash,
          }),
        )
        .digest("hex");
      const registered = await this.register(identity, purpose, {
        uploaded,
        receivedAt,
        uploadedAt,
        intentHash,
        leaseId,
        storageKey: reservation.storageKey,
      });
      if (!registered.owned) return registered.asset;
      asset = registered.asset;
      commandKey = this.key(identity, purpose, uploaded.commandId);
      this.processing.set(commandKey, controller);
      const decoded = await decodeImage({
        reservation,
        format: uploaded.format,
        storage: this.storage,
        signal: controller.signal,
        ...(this.observeDecoder === undefined
          ? {}
          : { observe: this.observeDecoder }),
      });
      await this.storage.publish(reservation, PROOF_OUTPUT_MAX_BYTES);
      safeToDiscard = false;
      const ready = await this.accept(identity, purpose, {
        assetId: registered.asset.id,
        leaseId,
        decoded,
        signal: controller.signal,
      });
      accepted = true;
      return ready;
    } catch (error) {
      if (asset !== undefined) {
        const observed = await this.failUpload(
          identity,
          asset,
          leaseId,
          error,
        ).catch(() => {
          safeToDiscard = false;
          throw new AppError(
            "Upload status is unavailable.",
            503,
            "STORAGE_UNAVAILABLE",
          );
        });
        accepted =
          observed.state === "READY" ||
          observed.state === "DELETING" ||
          observed.state === "DELETED";
        safeToDiscard = observed.state === "FAILED";
        if (accepted) return observed;
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Private image storage is unavailable.",
        503,
        "STORAGE_UNAVAILABLE",
      );
    } finally {
      input.signal.removeEventListener("abort", interrupt);
      if (commandKey !== undefined) this.processing.delete(commandKey);
      await this.cleanup(reservation, accepted, safeToDiscard);
    }
  }
  private async register(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    facts: {
      uploaded: Awaited<ReturnType<typeof receiveMultipartImage>>;
      receivedAt: Date;
      uploadedAt: Date;
      intentHash: string;
      leaseId: string;
      storageKey: string;
    },
  ) {
    const {
      uploaded,
      receivedAt,
      uploadedAt,
      intentHash,
      leaseId,
      storageKey,
    } = facts;
    return runTaskTransaction(
      this.database,
      { identity },
      async (transaction) => {
        const { now } = await authorizeImageIntake(
          transaction,
          identity,
          purpose,
          this.clock,
        );
        const prior = await transaction.imageAsset.findUnique({
          where: {
            ownerUserId_purpose_uploadCommandId: {
              ownerUserId: identity.userId,
              purpose,
              uploadCommandId: uploaded.commandId,
            },
          },
        });
        if (prior !== null) {
          await lockImageAsset(transaction, prior.id);
          if (prior.state === "FAILED")
            throw new AppError(
              "The upload key is terminal.",
              409,
              prior.failureCode === "UPLOAD_CANCELLED"
                ? "UPLOAD_CANCELLED"
                : "UPLOAD_FAILED",
            );
          if (prior.uploadIntentHash !== intentHash)
            throw new AppError(
              "Upload identity conflicts.",
              409,
              "UPLOAD_INTENT_CONFLICT",
            );
          if (prior.state === "STAGING")
            throw new AppError(
              "The upload is processing.",
              409,
              "UPLOAD_PENDING",
            );
          return { asset: prior, owned: false };
        }
        return {
          owned: true,
          asset: await transaction.imageAsset.create({
            data: {
              ownerUserId: identity.userId,
              purpose,
              uploadCommandId: uploaded.commandId,
              state: "STAGING",
              receivedAt,
              uploadedAt,
              uploadIntentHash: intentHash,
              inputByteCount: uploaded.byteCount,
              uploadedBySessionId: identity.sessionId,
              storageKey,
              processingLeaseId: leaseId,
              processingLeaseExpiresAt: new Date(now.getTime() + 120_000),
            },
          }),
        };
      },
    );
  }

  private async accept(
    identity: TaskActorIdentity,
    purpose: ImageAssetPurpose,
    facts: {
      assetId: string;
      leaseId: string;
      decoded: Awaited<ReturnType<typeof decodeImage>>;
      signal: AbortSignal;
    },
  ) {
    const { assetId, leaseId, decoded, signal } = facts;
    return runTaskTransaction(
      this.database,
      { identity },
      async (transaction) => {
        await lockImageAsset(transaction, assetId);
        const current = await transaction.imageAsset.findUniqueOrThrow({
          where: { id: assetId },
        });
        const { now } = await authorizeImageIntake(
          transaction,
          identity,
          purpose,
          this.clock,
        );
        if (
          signal.aborted ||
          current.state !== "STAGING" ||
          current.processingLeaseId !== leaseId ||
          current.uploadedBySessionId !== identity.sessionId ||
          current.processingLeaseExpiresAt === null ||
          now >= current.processingLeaseExpiresAt
        )
          throw new AppError(
            "Upload processing was interrupted.",
            409,
            "UPLOAD_INTERRUPTED",
          );
        return transaction.imageAsset.update({
          where: { id: current.id },
          data: {
            state: "READY",
            readyAt: now,
            storedByteCount: decoded.byteCount,
            contentHash: decoded.contentHash,
            format: "PNG",
            width: decoded.width,
            height: decoded.height,
            processingLeaseId: null,
            processingLeaseExpiresAt: null,
          },
        });
      },
    );
  }

  private async failUpload(
    identity: TaskActorIdentity,
    ownedAsset: ImageAsset,
    leaseId: string,
    error: unknown,
  ) {
    const code = uploadFailureCodeSchema.safeParse(
      error instanceof AppError ? error.code : "STORAGE_UNAVAILABLE",
    );
    return runTaskTransaction(
      this.database,
      { identity },
      async (transaction) => {
        await lockImageAsset(transaction, ownedAsset.id);
        const current = await transaction.imageAsset.findUniqueOrThrow({
          where: { id: ownedAsset.id },
        });
        if (
          current.state !== "STAGING" ||
          current.processingLeaseId !== leaseId
        )
          return current;
        return transaction.imageAsset.update({
          where: { id: current.id },
          data: {
            state: "FAILED",
            failureCode: code.success ? code.data : "UPLOAD_INTERRUPTED",
            failedAt: this.clock(),
            processingLeaseId: null,
            processingLeaseExpiresAt: null,
          },
        });
      },
    );
  }
  private async cleanup(
    reservation: ImageStorageReservation,
    accepted: boolean,
    safeToDiscard: boolean,
  ) {
    try {
      if (accepted) await this.storage.releaseAccepted(reservation);
      else if (safeToDiscard) await this.storage.discard(reservation);
    } catch {
      throw new AppError(
        "Private image cleanup is unavailable.",
        503,
        "STORAGE_UNAVAILABLE",
      );
    } finally {
      this.storage.abandon(reservation);
    }
  }
}
