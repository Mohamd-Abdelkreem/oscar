import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createDatabaseClient } from "@template/database";
import { parseTronWorkerEnvironment } from "./core/config/tron.config.js";
import { AppError } from "./core/errors/app.error.js";
import {
  TronProvider,
  TronProviderError,
} from "./infrastructure/tron/tron-provider.js";
import { logger } from "./infrastructure/logger/logger.js";
import { RuntimeSignals } from "./infrastructure/logger/runtime-signals.js";
import { FinancialRuntimeAdmission } from "./modules/custody/runtime-control.js";
import { assertRuntimeDatabaseAuthority } from "./modules/custody/api-database-authority.js";
import { DepositCreditService } from "./modules/deposits/deposit-credit.service.js";
import { DepositVerifier } from "./modules/deposits/deposit-verifier.js";
import { DepositIndexer } from "./modules/deposits/deposit-indexer.js";
import { DepositReconciliation } from "./modules/deposits/deposit-reconciliation.js";
import { parseWithdrawalQueueEnvironment } from "./core/config/withdrawal.config.js";
import {
  WithdrawalWakeups,
  WithdrawalWakeupConsumer,
} from "./infrastructure/queue/withdrawal-wakeups.js";
import { WithdrawalScheduler } from "./modules/withdrawals/withdrawal-scheduler.js";

export async function runDepositWorker(): Promise<void> {
  if (process.platform !== "linux" || process.argv.length !== 2)
    throw new Error("DEPOSIT_WORKER_AUTHORITY_DENIED");
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const config = parseTronWorkerEnvironment(process.env, root);
  const url = process.env["DATABASE_URL"];
  if (url === undefined || !/^postgres(?:ql)?:$/u.test(new URL(url).protocol))
    throw new Error("DEPOSIT_WORKER_CONFIGURATION_INVALID");
  const database = createDatabaseClient(url);
  const shutdown = new AbortController();
  const stop = () => {
    shutdown.abort();
  };
  const stopping = () => shutdown.signal.aborted;
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  const clock = () => new Date();
  const signals = new RuntimeSignals(logger, clock);
  let wakeups: WithdrawalWakeups | undefined;
  let consumer: WithdrawalWakeupConsumer | undefined;
  try {
    await database.$connect();
    await assertRuntimeDatabaseAuthority(database, "p06_deposit_worker");
    const admission = new FinancialRuntimeAdmission(database, "DEPOSIT_WORKER");
    await admission.register();
    signals.admission("REQUESTED", {
      processKind: "DEPOSIT_WORKER",
      bootId: admission.bootId,
    });
    const provider = new TronProvider(config);
    const verifier = new DepositVerifier(database, provider, config, clock);
    const credit = new DepositCreditService(
      database,
      verifier,
      admission,
      clock,
    );
    const indexer = new DepositIndexer(database, {
      config,
      provider,
      credit,
      admission,
      clock,
    });
    const reconciliation = new DepositReconciliation(database, verifier);
    const withdrawalQueueConfig = parseWithdrawalQueueEnvironment(process.env);
    wakeups = new WithdrawalWakeups(withdrawalQueueConfig);
    const withdrawals = new WithdrawalScheduler(
      database,
      admission,
      clock,
      withdrawalQueueConfig.batchSize,
    );
    consumer = new WithdrawalWakeupConsumer(withdrawalQueueConfig, (payload) =>
      stopping() ? Promise.resolve(false) : withdrawals.discover(payload),
    );
    let nextWithdrawalScanAt = 0;
    let after: string | undefined;
    let receiptsReconciled = false;
    let startupReconciled = false;
    while (!shutdown.signal.aborted) {
      try {
        if (!startupReconciled) {
          const report = receiptsReconciled
            ? await reconciliation.inspectWalletBatch(after)
            : await reconciliation.inspectBatch(after);
          signals.observe("EVIDENCE_CONFLICT", !report.consistent, {
            processKind: "DEPOSIT_WORKER",
            count: report.conflicts.length,
          });
          if (!report.consistent) throw new Error("DEPOSIT_RECOVERY_CONFLICT");
          after = report.next;
          if (after === undefined) {
            if (receiptsReconciled) startupReconciled = true;
            else receiptsReconciled = true;
          }
        } else {
          await indexer.scanNext();
          for (
            let count = 0;
            count < config.candidateBatchSize && !stopping();
            count++
          )
            if (!(await indexer.accountNext())) break;
          await indexer.observeHealth(signals);
        }
        if (!stopping() && clock().getTime() >= nextWithdrawalScanAt) {
          await withdrawals.repair(wakeups, stopping);
          nextWithdrawalScanAt =
            clock().getTime() + withdrawalQueueConfig.scanIntervalMs;
        }
        signals.observe("RUNTIME_ADMISSION", false, {
          processKind: "DEPOSIT_WORKER",
        });
      } catch (failure) {
        if (
          failure instanceof AppError &&
          failure.code === "FINANCIAL_WRITES_FENCED"
        )
          signals.observe("RUNTIME_ADMISSION", true, {
            processKind: "DEPOSIT_WORKER",
            code: "FINANCIAL_WRITES_FENCED",
          });
        else if (failure instanceof TronProviderError)
          await indexer.observeHealth(signals);
        else throw failure;
      }
      try {
        await delay(1000, undefined, { signal: shutdown.signal });
      } catch (failure) {
        if (!(failure instanceof Error) || failure.name !== "AbortError")
          throw failure;
      }
    }
  } finally {
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
    try {
      await consumer?.close();
    } finally {
      try {
        await wakeups?.close();
      } finally {
        await database.$disconnect();
      }
    }
  }
}
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runDepositWorker().catch(() => {
    logger.error(
      { code: "DEPOSIT_WORKER_UNAVAILABLE" },
      "Deposit worker stopped.",
    );
    process.exitCode = 1;
  });
}
