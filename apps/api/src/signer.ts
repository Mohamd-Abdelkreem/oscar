import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createDatabaseClient, type DatabaseClient } from "@template/database";
import { parseSignerCustodyEnvironment } from "./core/config/custody.config.js";
import { parseTronSignerEnvironment } from "./core/config/tron.config.js";
import { CustodyKeyStorage } from "./infrastructure/custody/key-storage.js";
import { CustodyStorageError } from "./infrastructure/custody/protected-files.js";
import { SshRecoveryStore } from "./infrastructure/custody/recovery-store.js";
import {
  TronProvider,
  TronProviderError,
} from "./infrastructure/tron/tron-provider.js";
import { AppError } from "./core/errors/app.error.js";
import { CustodyProvisioner } from "./modules/custody/custody.provisioner.js";
import { FinancialRuntimeAdmission } from "./modules/custody/runtime-control.js";
import { assertRuntimeDatabaseAuthority } from "./modules/custody/api-database-authority.js";
import { RuntimeSignals } from "./infrastructure/logger/runtime-signals.js";
import { logger } from "./infrastructure/logger/logger.js";
import { TreasuryAttempts } from "./modules/treasury/treasury-attempts.js";
import { TreasuryReconciliation } from "./modules/treasury/treasury-reconciliation.js";
import { TreasuryRecovery } from "./modules/treasury/treasury-recovery.js";
import {
  readDueTreasurySweeps,
  runTreasuryOperation,
} from "./modules/treasury/treasury.runtime.js";
import { TreasuryPolicyError } from "./infrastructure/tron/tron-signer.js";

export async function assertProtectedDatabaseRole(
  database: DatabaseClient,
  role: "p06_signer" | "p06_recovery_operator",
): Promise<void> {
  if (role === "p06_signer") {
    await assertRuntimeDatabaseAuthority(database, role);
    return;
  }
  const rows = await database.$queryRaw<
    { permitted: boolean; owner: boolean }[]
  >`SELECT p06_role_member(${role}) AS permitted, EXISTS (SELECT 1 FROM pg_class WHERE oid='financial_runtime_control'::regclass AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owner`;
  if (rows[0]?.permitted !== true || rows[0].owner)
    throw new Error("CUSTODY_AUTHORITY_DENIED");
}
export async function runSigner(): Promise<void> {
  if (process.platform !== "linux" || process.argv.length !== 2)
    throw new Error("CUSTODY_AUTHORITY_DENIED");
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const custody = parseSignerCustodyEnvironment(process.env, root);
  const provider = parseTronSignerEnvironment(process.env, root);
  const url = process.env["DATABASE_URL"];
  if (url === undefined || !/^postgres(?:ql)?:$/u.test(new URL(url).protocol))
    throw new Error("CUSTODY_CONFIGURATION_INVALID");
  const database = createDatabaseClient(url);
  const shutdown = new AbortController();
  const isStopping = () => shutdown.signal.aborted;
  const stop = () => {
    shutdown.abort();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    await database.$connect();
    await assertProtectedDatabaseRole(database, "p06_signer");
    const admission = new FinancialRuntimeAdmission(database, "SIGNER");
    await admission.register();
    process.stdout.write(
      JSON.stringify({
        event: "RUNTIME_ADMISSION",
        processKind: "SIGNER",
        bootId: admission.bootId,
        state: "REQUESTED",
      }) + "\n",
    );
    const signals = new RuntimeSignals(logger, () => new Date());
    const keys = new CustodyKeyStorage({
      storageRoot: custody.storageRoot,
      currentKeyId: custody.keyId,
      keyFiles: custody.keyFiles,
      projectRoot: root,
    });
    const archive = new SshRecoveryStore(custody, signals);
    const chain = new TronProvider(provider);
    const provisioner = new CustodyProvisioner(database, provider, admission, {
      keys,
      recovery: archive,
      provider: chain,
    });
    const treasury = new TreasuryAttempts(database, admission, provider, {
      stores: { keys, archive },
      provider: chain,
      clock: () => new Date(),
      signals: signals,
    });
    const reconciliation = new TreasuryReconciliation(
      database,
      chain,
      provider,
    );
    const inventory = new TreasuryRecovery(database, keys, archive);
    while (!isStopping()) {
      try {
        await inventory.assertInventory();
        const pending = await database.transferAttempt.findMany({
          where: {
            state: { in: ["SIGNED", "SUBMITTED", "UNKNOWN"] },
            nextAttemptAt: { lte: new Date() },
          },
          take: 20,
          orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
        });
        for (const attempt of pending) {
          if (isStopping()) break;
          await runTreasuryOperation({
            database,
            sweepId: attempt.sweepId,
            signals,
            operation: async () => {
              const observed = await reconciliation.reconcile(attempt.sweepId);
              signals.observe(
                "UNRESOLVED_ATTEMPT",
                observed?.state === "UNKNOWN",
                { processKind: "SIGNER", attemptId: attempt.id },
              );
              if (
                observed !== null &&
                ["SIGNED", "SUBMITTED", "UNKNOWN"].includes(observed.state) &&
                observed.expiration !== null &&
                observed.expiration > BigInt(Date.now()) &&
                observed.attemptCount < provider.maximumAttempts &&
                !isStopping()
              )
                await treasury.broadcast(attempt.sweepId);
            },
          });
        }
        if (!isStopping()) {
          const requested = await readDueTreasurySweeps(database, new Date());
          for (const sweep of requested) {
            if (isStopping()) break;
            await runTreasuryOperation({
              database,
              sweepId: sweep.id,
              signals,
              operation: async () => {
                const signed = await treasury.sign(sweep.id);
                if (signed.state === "SIGNED" && !isStopping())
                  await treasury.broadcast(sweep.id);
              },
            });
          }
        }
        if (!isStopping() && (await provisioner.provisionNext()) !== null) {
          signals.observe("RECOVERY_UNAVAILABLE", false, {
            processKind: "SIGNER",
          });
          signals.observe("EVIDENCE_CONFLICT", false, {
            processKind: "SIGNER",
          });
        }
        signals.observe("RUNTIME_ADMISSION", false, { processKind: "SIGNER" });
      } catch (failure) {
        if (
          !(failure instanceof AppError) &&
          !(failure instanceof CustodyStorageError) &&
          !(failure instanceof TronProviderError) &&
          !(failure instanceof TreasuryPolicyError)
        )
          throw failure;
        if (
          failure instanceof AppError &&
          failure.code === "FINANCIAL_WRITES_FENCED"
        )
          signals.observe("RUNTIME_ADMISSION", true, {
            processKind: "SIGNER",
            code: failure.code,
          });
        else if (failure instanceof CustodyStorageError)
          signals.observe(
            failure.code === "CUSTODY_EVIDENCE_CONFLICT"
              ? "EVIDENCE_CONFLICT"
              : "RECOVERY_UNAVAILABLE",
            true,
            { processKind: "SIGNER", code: failure.code },
          );
        else if (
          failure instanceof TronProviderError &&
          failure.code === "TRON_IDENTITY_CONFLICT"
        )
          signals.observe("EVIDENCE_CONFLICT", true, {
            processKind: "SIGNER",
            code: failure.code,
          });
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
    await database.$disconnect();
  }
}
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runSigner().catch(() => {
    process.stderr.write("CUSTODY_STARTUP_UNAVAILABLE\n");
    process.exitCode = 1;
  });
}
