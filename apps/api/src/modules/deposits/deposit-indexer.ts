import { createHash, randomUUID } from "node:crypto";
import {
  Prisma,
  type DatabaseClient,
  type DepositScanProgress,
} from "@template/database";
import type { TronWorkerConfig } from "../../core/config/tron.config.js";
import {
  TronCursorRejected,
  TronProviderError,
  type TronProvider,
} from "../../infrastructure/tron/tron-provider.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import type { DepositCreditService } from "./deposit-credit.service.js";
import { AppError } from "../../core/errors/app.error.js";
import type { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";

const WINDOW_MS = 86400000n;
const OVERLAP_MS = 300000n;
const LEASE_MS = 120000;
const POLL_MS = 1000;
const safeTimestamp = (timestamp: bigint) => {
  if (timestamp < 0n || timestamp > BigInt(Number.MAX_SAFE_INTEGER))
    throw new TronProviderError("TRON_INPUT_INVALID");
  return Number(timestamp);
};
export type IndexerDependencies = Readonly<{
  provider: TronProvider;
  credit: DepositCreditService;
  config: TronWorkerConfig;
  admission: FinancialRuntimeAdmission;
  clock: () => Date;
}>;

export class DepositIndexer {
  private readonly owner = randomUUID();
  private readonly policy: string;
  constructor(
    private readonly database: DatabaseClient,
    private readonly dependencies: IndexerDependencies,
  ) {
    const { config } = dependencies;
    this.policy = createHash("sha256")
      .update(
        JSON.stringify({
          network: config.network,
          token: config.token.contract,
          pageSize: config.discoveryPageSize,
          order: "block_timestamp,asc",
          confirmed: true,
          to: true,
        }),
      )
      .digest("hex");
  }
  private admitted<T>(
    work: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.database.$transaction(async (transaction) => {
      await this.dependencies.admission.assertMutationAdmission(transaction);
      return work(transaction);
    });
  }
  private async initialize(cutoff: bigint) {
    const assignments = await this.database.depositAddressAssignment.findMany({
      where: {
        network: this.dependencies.config.network,
        state: "READY",
        OR: [
          { scans: { none: { mode: "HOT" } } },
          { scans: { none: { mode: "HISTORICAL" } } },
        ],
      },
      orderBy: { id: "asc" },
      take: this.dependencies.config.candidateBatchSize,
    });
    for (const assignment of assignments) {
      const boundary = assignment.scanBoundaryTimestamp;
      if (boundary === null || assignment.address === null || boundary > cutoff)
        throw new TronProviderError("TRON_IDENTITY_CONFLICT");
      await this.admitted(async (transaction) => {
        for (const mode of ["HOT", "HISTORICAL"] as const) {
          const from =
            mode === "HOT"
              ? cutoff - OVERLAP_MS > boundary
                ? cutoff - OVERLAP_MS
                : boundary
              : boundary;
          const to =
            mode === "HOT" || from + WINDOW_MS > cutoff
              ? cutoff
              : from + WINDOW_MS;
          await transaction.depositScanProgress.upsert({
            where: { assignmentId_mode: { assignmentId: assignment.id, mode } },
            update: {},
            create: {
              assignmentId: assignment.id,
              mode,
              windowFrom: from,
              windowTo: to,
              nextWindowFrom: from,
              historyBoundary: boundary,
              queryPolicyHash: this.policy,
              nextAttemptAt: new Date(
                this.dependencies.clock().getTime() + (mode === "HOT" ? 0 : 1),
              ),
            },
          });
        }
      });
    }
  }
  private async claimScan(cutoff: bigint) {
    const now = this.dependencies.clock();
    return this.admitted(async (transaction) => {
      const due = await transaction.depositScanProgress.findFirst({
        where: {
          assignment: {
            network: this.dependencies.config.network,
            state: "READY",
          },
          nextAttemptAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
        },
        orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
      });
      if (due === null) return null;
      const next = this.nextWindow(due, cutoff);
      const claim = await transaction.depositScanProgress.updateMany({
        where: { id: due.id, version: due.version },
        data: {
          ...next,
          leaseOwner: this.owner,
          leaseUntil: new Date(now.getTime() + LEASE_MS),
          version: { increment: 1 },
        },
      });
      return claim.count === 1
        ? transaction.depositScanProgress.findUniqueOrThrow({
            where: { id: due.id },
            include: { assignment: true },
          })
        : null;
    });
  }
  private nextWindow(scan: DepositScanProgress, cutoff: bigint) {
    if (scan.queryPolicyHash !== this.policy) {
      // A new query policy must replay the retained window, never reuse its opaque cursor.
      return {
        fingerprint: null,
        queryPolicyHash: this.policy,
        lastErrorCode: "SCAN_POLICY_CHANGED",
      };
    }
    if (
      scan.lastCompletedAt === null ||
      scan.fingerprint !== null ||
      scan.lastErrorCode !== null ||
      scan.nextWindowFrom !== scan.windowTo
    )
      return {};
    const boundary = scan.historyBoundary;
    const historicalRestart =
      scan.mode === "HISTORICAL" &&
      (scan.windowTo >= cutoff || scan.windowTo - scan.windowFrom < WINDOW_MS);
    const from =
      scan.mode === "HOT"
        ? scan.windowTo - OVERLAP_MS > boundary
          ? scan.windowTo - OVERLAP_MS
          : boundary
        : historicalRestart
          ? boundary
          : scan.windowTo;
    const to =
      scan.mode === "HOT" || from + WINDOW_MS > cutoff
        ? cutoff
        : from + WINDOW_MS;
    if (to < from) throw new TronProviderError("TRON_IDENTITY_CONFLICT");
    return {
      windowFrom: from,
      windowTo: to,
      nextWindowFrom: from,
      cycle: historicalRestart ? scan.cycle + 1 : scan.cycle,
    };
  }
  async scanNext(): Promise<boolean> {
    // Check before external reads so an intentionally closed worker cannot look like an outage.
    await this.admitted(async () => {});
    const floor = await this.dependencies.provider.solidifiedFloor();
    const cutoff = BigInt(floor.timestamp);
    await this.initialize(cutoff);
    let scan = await this.claimScan(cutoff);
    if (scan === null) return false;
    try {
      for (
        let pageNumber = 0;
        pageNumber < this.dependencies.config.pagesPerAddress;
        pageNumber++
      ) {
        if (scan.assignment.address === null)
          throw new TronProviderError("TRON_IDENTITY_CONFLICT");
        const page = await this.dependencies.provider.discover({
          address: scan.assignment.address,
          from: safeTimestamp(scan.windowFrom),
          to: safeTimestamp(scan.windowTo),
          ...(scan.fingerprint === null
            ? {}
            : { fingerprint: scan.fingerprint }),
        });
        const persisted = await this.commitPage(scan, page);
        if (persisted === null || page.fingerprint === null) return true;
        scan = { ...persisted, assignment: scan.assignment };
      }
      await this.releaseScan(scan, null);
      return true;
    } catch (failure) {
      if (!(failure instanceof TronProviderError)) throw failure;
      await this.releaseScan(scan, failure);
      return true;
    }
  }
  private async commitPage(
    scan: DepositScanProgress,
    page: Awaited<ReturnType<TronProvider["discover"]>>,
  ) {
    const now = this.dependencies.clock();
    return this.admitted(async (transaction) => {
      const updated = await transaction.depositScanProgress.updateMany({
        where: { id: scan.id, version: scan.version, leaseOwner: this.owner },
        data: {
          fingerprint: page.fingerprint,
          version: { increment: 1 },
          lastErrorCode: null,
          ...(page.fingerprint === null
            ? {
                nextWindowFrom: scan.windowTo,
                lastCompletedAt: now,
                leaseOwner: null,
                leaseUntil: null,
                nextAttemptAt: new Date(now.getTime() + POLL_MS),
              }
            : {}),
        },
      });
      if (updated.count !== 1) return null;
      for (const observation of page.transactions) {
        const candidate = await transaction.depositCandidate.upsert({
          where: {
            network_transactionId: {
              network: this.dependencies.config.network,
              transactionId: observation.transactionId,
            },
          },
          create: {
            network: this.dependencies.config.network,
            transactionId: observation.transactionId,
            firstObservedAt: now,
            lastObservedAt: now,
            observedBlockTime: BigInt(observation.timestamp),
            nextAttemptAt: now,
          },
          update: { lastObservedAt: now },
        });
        await transaction.depositCandidateDiscovery.createMany({
          data: {
            candidateId: candidate.id,
            assignmentId: scan.assignmentId,
            discoveredAt: now,
          },
          skipDuplicates: true,
        });
      }
      return transaction.depositScanProgress.findUniqueOrThrow({
        where: { id: scan.id },
      });
    });
  }
  private async releaseScan(
    scan: DepositScanProgress,
    failure: TronProviderError | null,
  ) {
    const now = this.dependencies.clock();
    await this.admitted(async (transaction) => {
      await transaction.depositScanProgress.updateMany({
        where: { id: scan.id, version: scan.version, leaseOwner: this.owner },
        data: {
          leaseOwner: null,
          leaseUntil: null,
          version: { increment: 1 },
          nextAttemptAt: new Date(
            now.getTime() + (failure === null ? POLL_MS : 5000),
          ),
          ...(failure === null ? {} : { lastErrorCode: failure.code }),
          ...(failure instanceof TronCursorRejected
            ? { fingerprint: null }
            : {}),
        },
      });
    });
  }
  private async claimCandidate() {
    const now = this.dependencies.clock();
    return this.admitted(async (transaction) => {
      const candidate = await transaction.depositCandidate.findFirst({
        where: {
          network: this.dependencies.config.network,
          state: { in: ["PENDING", "VERIFYING", "UNRESOLVED"] },
          nextAttemptAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
        },
        orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
      });
      if (candidate === null) return null;
      const claim = await transaction.depositCandidate.updateMany({
        where: { id: candidate.id, version: candidate.version },
        data: {
          state: "VERIFYING",
          leaseOwner: this.owner,
          leaseUntil: new Date(now.getTime() + LEASE_MS),
          version: { increment: 1 },
          attemptCount: { increment: 1 },
        },
      });
      return claim.count === 1
        ? transaction.depositCandidate.findUniqueOrThrow({
            where: { id: candidate.id },
          })
        : null;
    });
  }
  async accountNext(): Promise<boolean> {
    const candidate = await this.claimCandidate();
    if (candidate === null) return false;
    try {
      const outcome = await this.dependencies.credit.process(
        candidate.transactionId,
      );
      const now = this.dependencies.clock();
      await this.admitted(async (transaction) => {
        const state =
          outcome.state === "ACCOUNTED" ||
          outcome.state === "INELIGIBLE" ||
          outcome.state === "CONFLICT"
            ? outcome.state
            : "UNRESOLVED";
        const receipts =
          state === "ACCOUNTED"
            ? await transaction.depositReceipt.findMany({
                where: {
                  network: candidate.network,
                  transactionId: candidate.transactionId,
                },
                orderBy: { logIndex: "asc" },
                select: { evidenceDigest: true },
                take: 10001,
              })
            : [];
        const digest =
          outcome.state === "ACCOUNTED"
            ? createHash("sha256")
                .update(
                  JSON.stringify(
                    receipts.map((receipt) => receipt.evidenceDigest),
                  ),
                )
                .digest("hex")
            : outcome.evidenceDigest;
        await transaction.depositCandidate.updateMany({
          where: {
            id: candidate.id,
            version: candidate.version,
            leaseOwner: this.owner,
          },
          data: {
            state,
            version: { increment: 1 },
            leaseOwner: null,
            leaseUntil: null,
            nextAttemptAt: new Date(
              now.getTime() +
                Math.min(
                  60000,
                  1000 * 2 ** Math.min(candidate.attemptCount, 6),
                ),
            ),
            lastErrorCode: outcome.state === "ACCOUNTED" ? null : outcome.code,
            ...(state === "ACCOUNTED"
              ? { accountedAt: now, verifiedAt: now }
              : {}),
            ...(digest === undefined
              ? {}
              : { canonicalEvidenceDigest: digest, verifiedAt: now }),
          },
        });
      });
      return true;
    } catch (failure) {
      if (
        !(failure instanceof AppError) ||
        failure.code !== "FINANCIAL_WRITES_FENCED"
      )
        throw failure;
      // The financial commit may have happened before the fence. Leave the lease for replay.
      return true;
    }
  }
  async observeHealth(signals: RuntimeSignals) {
    await this.admitted(async () => {});
    const now = this.dependencies.clock();
    const network = this.dependencies.config.network;
    const [lagged, pending, conflicts] = await Promise.all([
      this.database.$queryRaw<{ age: number; count: number }[]>(
        Prisma.sql`SELECT count(*)::int AS count, COALESCE(max(EXTRACT(EPOCH FROM (${now}::timestamptz - COALESCE(s.last_completed_at,a.ready_at))) * 1000),0)::float8 AS age FROM deposit_address_assignments a LEFT JOIN deposit_scan_progress s ON s.assignment_id=a.id AND s.mode='HOT' WHERE a.state='READY' AND a.network=${network}::tron_network`,
      ),
      this.database.depositCandidate.aggregate({
        where: {
          network,
          state: { in: ["PENDING", "VERIFYING", "UNRESOLVED"] },
        },
        _count: true,
        _min: { firstObservedAt: true },
      }),
      this.database.depositCandidate.count({
        where: { network, state: "CONFLICT" },
      }),
    ]);
    const lagAge = Math.max(0, Math.floor(lagged[0]?.age ?? 0));
    const pendingAge =
      pending._min.firstObservedAt === null
        ? 0
        : Math.max(0, now.getTime() - pending._min.firstObservedAt.getTime());
    signals.observe(
      "SCAN_LAG",
      lagAge >= this.dependencies.config.scanLagAlertAfterMs,
      {
        processKind: "DEPOSIT_WORKER",
        count: lagged[0]?.count ?? 0,
        ageMs: lagAge,
      },
    );
    signals.observe(
      "PENDING_WORK",
      pendingAge >= this.dependencies.config.pendingWorkAlertAfterMs,
      {
        processKind: "DEPOSIT_WORKER",
        count: pending._count,
        ageMs: pendingAge,
      },
    );
    signals.observe("EVIDENCE_CONFLICT", conflicts > 0, {
      processKind: "DEPOSIT_WORKER",
      count: conflicts,
    });
  }
}
