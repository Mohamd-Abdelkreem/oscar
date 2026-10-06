import type { DatabaseClient } from "@template/database";
import type { ProofsConfig } from "../../core/config/proofs.config.js";
import {
  PrivateImageStorage,
  storageScanBatchSize,
  type StorageRecordLookup,
  type StorageRecordDisposition,
} from "../../infrastructure/files/private-image-storage.js";
import type { DecoderObservation } from "../../infrastructure/files/image-decoder.js";
import type { TaskClock } from "../tasks/task-transaction.js";
import { AppError } from "../../core/errors/app.error.js";
import { ProofUploadService } from "./proof-upload.service.js";
import { ProofReadService } from "./proof-read.service.js";
import { ProofLifecycleService } from "./proof-lifecycle.service.js";

export class ProofsRuntime {
  readonly storage: PrivateImageStorage;
  readonly uploads: ProofUploadService;
  readonly reads: ProofReadService;
  readonly lifecycle: ProofLifecycleService;
  constructor(
    private readonly database: DatabaseClient,
    config: ProofsConfig,
    clock: TaskClock,
    onFailure: (code: "PROOF_SCAN_FAILED" | "PROOF_UNLINK_FAILED") => void,
    observeDecoder?: (observation: DecoderObservation) => void,
  ) {
    this.storage = new PrivateImageStorage(config);
    this.uploads = new ProofUploadService(
      database,
      this.storage,
      clock,
      config.inputDeadlineMs,
      observeDecoder,
    );
    this.reads = new ProofReadService(database, this.storage, clock);
    this.lifecycle = new ProofLifecycleService(
      database,
      this.storage,
      clock,
      onFailure,
    );
  }
  async start() {
    try {
      await this.initialize();
    } catch {
      this.storage.closeAdmission();
      throw new AppError(
        "Private image storage startup failed.",
        503,
        "STORAGE_UNAVAILABLE",
      );
    }
  }
  private async initialize() {
    const lookup: StorageRecordLookup = async (keys) => {
      const assets = await this.database.imageAsset.findMany({
        where: { storageKey: { in: [...keys] } },
        take: storageScanBatchSize,
        select: { storageKey: true, state: true },
      });
      const records = new Map<string, StorageRecordDisposition>();
      for (const asset of assets) {
        if (asset.storageKey === null) continue;
        const disposition =
          asset.state === "DELETED"
            ? "DELETED"
            : asset.state === "READY" || asset.state === "DELETING"
              ? "RETAINED"
              : "UNACCEPTED";
        records.set(asset.storageKey, disposition);
      }
      return records;
    };
    await this.storage.initialize(lookup);
    await this.storage.reconcileOrphans(lookup);
    await this.lifecycle.scan();
    this.lifecycle.start();
  }
  async stop() {
    this.reads.stop();
    await Promise.all([this.uploads.stop(), this.lifecycle.stop()]);
  }
}
