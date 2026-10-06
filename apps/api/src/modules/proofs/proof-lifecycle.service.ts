import { randomUUID } from "node:crypto";
import { PROOF_RETENTION_MS } from "@template/contracts";
import { Prisma, type DatabaseClient } from "@template/database";
import type { PrivateImageStorage } from "../../infrastructure/files/private-image-storage.js";
import { runIdentityTransaction } from "../auth/session-authority.js";
import { lockImageAsset } from "./proof-authority.js";
import { isProofDeletionEligible } from "./proof-retention.js";
import type { TaskClock } from "../tasks/task-transaction.js";

export class ProofLifecycleService {
  private scanning: Promise<void> | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopped = true;
  private cursor: string | undefined;
  constructor(
    private readonly database: DatabaseClient,
    private readonly storage: PrivateImageStorage,
    private readonly clock: TaskClock,
    private readonly onFailure: (
      code: "PROOF_SCAN_FAILED" | "PROOF_UNLINK_FAILED",
    ) => void,
  ) {}

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.timer = setInterval(() => {
      void this.scan().catch(() => {
        this.onFailure("PROOF_SCAN_FAILED");
      });
    }, 60_000);
    this.timer.unref();
  }

  async stop() {
    this.stopped = true;
    if (this.timer !== undefined) clearInterval(this.timer);
    await this.scanning;
  }

  scan() {
    if (this.scanning !== undefined) return this.scanning;
    const scan = this.scanOnce().finally(() => {
      this.scanning = undefined;
    });
    this.scanning = scan;
    return scan;
  }

  private async claim(id: string) {
    const leaseId = randomUUID();
    return runIdentityTransaction(
      this.database,
      {
        userIds: [],
        adminPopulation: false,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
      async (transaction) => {
        await lockImageAsset(transaction, id);
        const now = this.clock();
        const asset = await transaction.imageAsset.findUnique({
          where: { id },
          include: {
            evidence: {
              where: { submission: { status: "PENDING" } },
              take: 1,
              select: { id: true },
            },
            illustratedTasks: { take: 1, select: { id: true } },
          },
        });
        if (asset === null || asset.storageKey === null) return null;
        const candidate = {
          purpose: asset.purpose,
          state: asset.state,
          uploadedAt: asset.uploadedAt,
          hasPendingEvidence: asset.evidence.length > 0,
          hasIllustratedTask: asset.illustratedTasks.length > 0,
        };
        if (asset.state === "DELETING") {
          if (
            asset.deletionLeaseExpiresAt === null ||
            now < asset.deletionLeaseExpiresAt
          )
            return null;
        } else if (!isProofDeletionEligible(candidate, now)) return null;
        return transaction.imageAsset.update({
          where: { id },
          data: {
            state: "DELETING",
            deletionLeaseId: leaseId,
            deletionLeaseExpiresAt: new Date(now.getTime() + 120_000),
          },
        });
      },
    );
  }

  private async scanOnce() {
    await this.recoverAcceptedReservations();
    const now = this.clock();
    const candidates = await this.database.imageAsset.findMany({
      ...(this.cursor === undefined
        ? {}
        : { cursor: { id: this.cursor }, skip: 1 }),
      where: {
        OR: [
          {
            state: "READY",
            uploadedAt: { lte: new Date(now.getTime() - PROOF_RETENTION_MS) },
            AND: [
              {
                OR: [
                  {
                    purpose: "PROOF",
                    evidence: { none: { submission: { status: "PENDING" } } },
                  },
                  {
                    purpose: "TASK_ILLUSTRATION",
                    illustratedTasks: { none: {} },
                  },
                ],
              },
            ],
          },
          { state: "DELETING", deletionLeaseExpiresAt: { lte: now } },
          {
            state: "STAGING",
            receivedAt: { lte: new Date(now.getTime() - 3_600_000) },
            processingLeaseExpiresAt: { lte: now },
          },
          { state: "FAILED", storageKey: { not: null } },
        ],
      },
      orderBy: { id: "asc" },
      take: 100,
      select: { id: true, state: true },
    });
    this.cursor = candidates.at(-1)?.id;
    for (const candidate of candidates) {
      const unfinished =
        candidate.state === "STAGING" || candidate.state === "FAILED"
          ? await this.expireStaging(candidate.id)
          : null;
      if (unfinished !== null) {
        try {
          await this.storage.removeUnaccepted(unfinished);
        } catch {
          this.onFailure("PROOF_UNLINK_FAILED");
        }
        continue;
      }
      const claimed = await this.claim(candidate.id);
      if (claimed === null || claimed.storageKey === null) continue;
      try {
        await this.storage.removeContent(claimed.storageKey);
        await this.database.imageAsset.updateMany({
          where: {
            id: claimed.id,
            state: "DELETING",
            deletionLeaseId: claimed.deletionLeaseId,
          },
          data: {
            state: "DELETED",
            deletedAt: this.clock(),
            deletionLeaseId: null,
            deletionLeaseExpiresAt: null,
          },
        });
      } catch {
        this.onFailure("PROOF_UNLINK_FAILED");
      }
    }
  }

  private async recoverAcceptedReservations() {
    const keys = this.storage.abandonedStorageKeys();
    if (keys.length === 0) return;
    const accepted = await this.database.imageAsset.findMany({
      where: {
        storageKey: { in: keys },
        state: { in: ["READY", "DELETING", "DELETED"] },
      },
      select: { storageKey: true },
    });
    for (const asset of accepted) {
      if (asset.storageKey === null) continue;
      try {
        await this.storage.recoverAccepted(asset.storageKey);
      } catch {
        this.onFailure("PROOF_UNLINK_FAILED");
      }
    }
  }

  private async expireStaging(id: string) {
    return runIdentityTransaction(
      this.database,
      {
        userIds: [],
        adminPopulation: false,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
      async (transaction) => {
        await lockImageAsset(transaction, id);
        const asset = await transaction.imageAsset.findUnique({
          where: { id },
        });
        if (asset === null) return null;
        if (asset.state === "FAILED") return asset.storageKey;
        const now = this.clock();
        if (
          asset.state !== "STAGING" ||
          asset.receivedAt === null ||
          now.getTime() - asset.receivedAt.getTime() < 3_600_000 ||
          asset.processingLeaseExpiresAt === null ||
          now < asset.processingLeaseExpiresAt
        )
          return null;
        await transaction.imageAsset.update({
          where: { id },
          data: {
            state: "FAILED",
            failureCode: "UPLOAD_INTERRUPTED",
            failedAt: now,
            processingLeaseId: null,
            processingLeaseExpiresAt: null,
          },
        });
        return asset.storageKey;
      },
    );
  }
}
