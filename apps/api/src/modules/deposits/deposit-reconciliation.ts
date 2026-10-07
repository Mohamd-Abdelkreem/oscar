import { Prisma, type DatabaseClient } from "@template/database";
import {
  checkOperation,
  operationEvidence,
} from "../ledger/ledger-reconciliation.evidence.js";
import { LedgerService } from "../ledger/ledger.service.js";
import type { DepositVerifier } from "./deposit-verifier.js";
import type { TronProvider } from "../../infrastructure/tron/tron-provider.js";
import type { TronWorkerConfig } from "../../core/config/tron.config.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import { createHash } from "node:crypto";

export class DepositReconciliation {
  private readonly ledger: LedgerService;
  constructor(
    private readonly database: DatabaseClient,
    private readonly verifier: DepositVerifier,
  ) {
    this.ledger = new LedgerService(database, {
      processIds: ["deposit-reconciliation"],
      businessNamespaces: [],
    });
  }
  async inspectCandidate(
    transactionId: string,
    network: "TRON_MAINNET" | "TRON_SHASTA" | "TRON_NILE",
  ) {
    const canonical = await this.verifier.verify(transactionId);
    if (canonical.state !== "VERIFIED")
      return { state: canonical.state, code: canonical.code };
    return this.database.$transaction(
      async (transaction) => {
        const candidate = await transaction.depositCandidate.findUnique({
          where: { network_transactionId: { network, transactionId } },
        });
        const digest = createHash("sha256")
          .update(
            JSON.stringify(
              canonical.movements.map((movement) => movement.evidenceDigest),
            ),
          )
          .digest("hex");
        if (
          candidate?.state === "INELIGIBLE" ||
          (candidate?.state === "ACCOUNTED" &&
            candidate.canonicalEvidenceDigest !== digest)
        )
          return { state: "CONFLICT", code: "DEPOSIT_EVIDENCE_CONFLICT" };
        for (const movement of canonical.movements) {
          const receipt = await transaction.depositReceipt.findUnique({
            where: {
              network_transactionId_logIndex: {
                network,
                transactionId,
                logIndex: movement.logIndex,
              },
            },
            include: { operation: { include: operationEvidence } },
          });
          if (receipt === null)
            return { state: "PENDING", code: "DEPOSIT_NOT_RECORDED" };
          const faults: string[] = [];
          checkOperation(receipt.operation, (fault) => {
            faults.push(fault.category);
          });
          if (
            faults.length > 0 ||
            receipt.assignmentId !== movement.assignmentId ||
            receipt.walletId !== movement.walletId ||
            receipt.evidenceDigest !== movement.evidenceDigest
          )
            return { state: "CONFLICT", code: "DEPOSIT_EVIDENCE_CONFLICT" };
        }
        return { state: "ACCOUNTED", code: null };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async inspectBatch(after?: string) {
    const receipts = await this.database.depositReceipt.findMany({
      orderBy: { id: "asc" },
      take: 100,
      ...(after === undefined ? {} : { where: { id: { gt: after } } }),
      include: { operation: { include: operationEvidence } },
    });
    const conflicts = new Set<string>();
    for (const receipt of receipts) {
      checkOperation(receipt.operation, () => {
        conflicts.add(receipt.id);
      });
      const candidate = await this.database.depositCandidate.findUnique({
        where: {
          network_transactionId: {
            network: receipt.network,
            transactionId: receipt.transactionId,
          },
        },
      });
      if (candidate?.state === "INELIGIBLE") conflicts.add(receipt.id);
      if (candidate?.state === "ACCOUNTED") {
        const movements = await this.database.depositReceipt.findMany({
          where: {
            network: receipt.network,
            transactionId: receipt.transactionId,
          },
          orderBy: { logIndex: "asc" },
          select: { evidenceDigest: true },
          take: 10001,
        });
        const digest = createHash("sha256")
          .update(
            JSON.stringify(
              movements.map((movement) => movement.evidenceDigest),
            ),
          )
          .digest("hex");
        if (digest !== candidate.canonicalEvidenceDigest)
          conflicts.add(receipt.id);
      }
    }
    for (const walletId of new Set(
      receipts.map((receipt) => receipt.walletId),
    )) {
      const report = await this.ledger.reconcileWallet(walletId, {
        actor: { type: "PROCESS", processId: "deposit-reconciliation" },
        observe: async () => {},
      });
      if (!report.consistent) conflicts.add(walletId);
    }
    return {
      consistent: conflicts.size === 0,
      conflicts: [...conflicts],
      next: receipts.length === 100 ? receipts.at(-1)?.id : undefined,
    };
  }
  async inspectWalletBatch(after?: string) {
    const wallets = await this.database.wallet.findMany({
      select: { id: true },
      take: 100,
      orderBy: { id: "asc" },
      ...(after === undefined ? {} : { where: { id: { gt: after } } }),
    });
    const conflicts: string[] = [];
    for (const wallet of wallets) {
      const report = await this.ledger.reconcileWallet(wallet.id, {
        actor: { type: "PROCESS", processId: "deposit-reconciliation" },
        observe: async () => {},
      });
      if (!report.consistent) conflicts.push(wallet.id);
    }
    return {
      consistent: conflicts.length === 0,
      conflicts,
      next: wallets.length === 100 ? wallets.at(-1)?.id : undefined,
    };
  }
  private async assertRetainedCandidates(network: TronWorkerConfig["network"]) {
    let afterCandidate: string | undefined;
    do {
      const candidates = await this.database.depositCandidate.findMany({
        where: {
          network,
          ...(afterCandidate === undefined
            ? {}
            : { id: { gt: afterCandidate } }),
        },
        orderBy: { id: "asc" },
        take: 100,
      });
      for (const candidate of candidates) {
        if (candidate.state === "CONFLICT")
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
        const agreement = await this.inspectCandidate(
          candidate.transactionId,
          candidate.network,
        );
        if (!["ACCOUNTED", "PENDING", "INELIGIBLE"].includes(agreement.state))
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      }
      afterCandidate =
        candidates.length === 100 ? candidates.at(-1)?.id : undefined;
    } while (afterCandidate !== undefined);
  }
  private async queueRecoveryPage(request: {
    network: TronWorkerConfig["network"];
    generation: bigint;
    page: Awaited<ReturnType<TronProvider["discover"]>>;
    assignmentId: string;
  }) {
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(606033::bigint)`;
      const control =
        await transaction.financialRuntimeControl.findUniqueOrThrow({
          where: { id: 1 },
        });
      if (
        !control.financialWritesFenced ||
        control.generation !== request.generation
      )
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      for (const observation of request.page.transactions) {
        const now = new Date();
        const candidate = await transaction.depositCandidate.upsert({
          where: {
            network_transactionId: {
              network: request.network,
              transactionId: observation.transactionId,
            },
          },
          create: {
            network: request.network,
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
            assignmentId: request.assignmentId,
            discoveredAt: now,
          },
          skipDuplicates: true,
        });
      }
    });
  }
  async recoverInbound(request: {
    provider: TronProvider;
    config: TronWorkerConfig;
    generation: bigint;
    cutoff: Date;
  }) {
    const floor = await request.provider.solidifiedFloor();
    if (floor.timestamp > request.cutoff.getTime())
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    await this.assertRetainedCandidates(request.config.network);
    let after: string | undefined;
    let pages = 0;
    do {
      const assignments = await this.database.depositAddressAssignment.findMany(
        {
          where: {
            network: request.config.network,
            state: "READY",
            ...(after === undefined ? {} : { id: { gt: after } }),
          },
          orderBy: { id: "asc" },
          take: 100,
        },
      );
      for (const assignment of assignments) {
        if (
          assignment.address === null ||
          assignment.scanBoundaryTimestamp === null ||
          assignment.scanBoundaryTimestamp > BigInt(floor.timestamp)
        )
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
        let fingerprint: string | undefined;
        do {
          if (++pages > 10000)
            throw new CustodyStorageError("RECOVERY_UNAVAILABLE");
          const page = await request.provider.discover({
            address: assignment.address,
            from: Number(assignment.scanBoundaryTimestamp),
            to: floor.timestamp,
            ...(fingerprint === undefined ? {} : { fingerprint }),
          });
          for (const observation of page.transactions) {
            const agreement = await this.inspectCandidate(
              observation.transactionId,
              request.config.network,
            );
            if (
              !["ACCOUNTED", "PENDING", "INELIGIBLE"].includes(agreement.state)
            )
              throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
          }
          await this.queueRecoveryPage({
            assignmentId: assignment.id,
            network: request.config.network,
            generation: request.generation,
            page,
          });
          fingerprint = page.fingerprint ?? undefined;
        } while (fingerprint !== undefined);
      }
      after = assignments.length === 100 ? assignments.at(-1)?.id : undefined;
    } while (after !== undefined);
    return { cutoff: floor.timestamp, pages };
  }
}
