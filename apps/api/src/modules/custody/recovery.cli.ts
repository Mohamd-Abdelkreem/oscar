import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
import { createDatabaseClient } from "@template/database";
import {
  parseRecoveryOperatorEnvironment,
  parseSignerCustodyEnvironment,
  requiredCustodySetting,
} from "../../core/config/custody.config.js";
import { CustodyKeyStorage } from "../../infrastructure/custody/key-storage.js";
import { SshRecoveryStore } from "../../infrastructure/custody/recovery-store.js";
import { CustodyRecovery } from "./custody-recovery.js";
import {
  acknowledgeFinancialBoot,
  fenceFinancialRuntime,
} from "./runtime-control.js";
import { assertProtectedDatabaseRole } from "../../signer.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { verifyRecoveredFinancialHistory } from "./recovery-history.js";
import {
  parseTronWorkerEnvironment,
  parseTronSignerEnvironment,
} from "../../core/config/tron.config.js";
import { TreasuryRecovery } from "../treasury/treasury-recovery.js";
import { TreasuryReconciliation } from "../treasury/treasury-reconciliation.js";
import { TronProvider } from "../../infrastructure/tron/tron-provider.js";
import { DepositVerifier } from "../deposits/deposit-verifier.js";
import { DepositReconciliation } from "../deposits/deposit-reconciliation.js";
import { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";
import { createLogger } from "../../infrastructure/logger/logger.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import { WithdrawalRecovery } from "../withdrawals/withdrawal-recovery.js";
import { hasIndependentRecoveryAuthority } from "./recovery-authority.js";

const signals = new RuntimeSignals(
  createLogger({
    pretty: false,
    destination: {
      write: (chunk) => {
        process.stderr.write(chunk);
      },
    },
  }),
  () => new Date(),
);

const reference = z.string().regex(/^[A-Za-z0-9._:-]{1,256}$/u);
const evidence = z
  .object({
    financialHistoryReference: reference,
    assignmentInventoryReference: reference,
    attemptInventoryReference: reference,
    reconciliationReference: reference,
    reconciliationCutoff: z.iso.datetime(),
    financialHistoryRecoveredThrough: z.iso.datetime(),
  })
  .strict();
export const custodyRecoveryCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("FENCE"),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z.object({ operation: z.literal("RESTORE"), evidence }).strict(),
  z.object({ operation: z.literal("ROTATE"), assignmentId: z.uuid() }).strict(),
  z
    .object({
      operation: z.literal("ACKNOWLEDGE"),
      bootId: z.uuid(),
      additionalBootIds: z.array(z.uuid()).max(63).optional(),
      reason: z.string().trim().min(1).max(500),
      evidence,
    })
    .strict(),
]);
async function protectedInput() {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    const input: unknown = chunk;
    if (!(input instanceof Buffer)) throw new Error("CUSTODY_INPUT_INVALID");
    const contents: Buffer = input;
    bytes += contents.length;
    if (bytes > 8192) throw new Error("CUSTODY_INPUT_INVALID");
    chunks.push(contents);
  }
  return custodyRecoveryCommandSchema.parse(
    JSON.parse(Buffer.concat(chunks).toString("utf8")),
  );
}
export async function runCustodyRecovery(): Promise<void> {
  if (process.platform !== "linux" || process.argv.length !== 2)
    throw new Error("CUSTODY_AUTHORITY_DENIED");
  const root = fileURLToPath(new URL("../../../../../", import.meta.url));
  const operatorIdentity = requiredCustodySetting(
    process.env,
    "CUSTODY_OPERATOR_IDENTITY",
  );
  const url = process.env["DATABASE_URL"];
  if (url === undefined || !/^postgres(?:ql)?:$/u.test(new URL(url).protocol))
    throw new Error("CUSTODY_CONFIGURATION_INVALID");
  const database = createDatabaseClient(url);
  try {
    await database.$connect();
    await assertProtectedDatabaseRole(database, "p06_recovery_operator");
    if (!(await hasIndependentRecoveryAuthority(database)))
      throw new Error("CUSTODY_AUTHORITY_DENIED");
    const command = await protectedInput();
    if (command.operation === "FENCE") {
      await fenceFinancialRuntime(database, {
        operatorIdentity,
        reason: command.reason,
        signals,
      });
      process.stdout.write('{"state":"FENCED"}\n');
      return;
    }
    const operator = parseRecoveryOperatorEnvironment(process.env, root);
    // Fencing must remain available during a storage/escrow outage.
    // Recovery uses independently escrowed decryption authority, never the signer's key file.
    const config = parseSignerCustodyEnvironment(
      { ...process.env, CUSTODY_KEY_FILE: operator.escrowKeyFile },
      root,
    );
    const keys = new CustodyKeyStorage({
      storageRoot: config.storageRoot,
      currentKeyId: config.keyId,
      keyFiles: config.keyFiles,
      projectRoot: root,
    });
    const archive = new SshRecoveryStore(config);
    const recovery = new CustodyRecovery(database, keys, archive);
    if (command.operation === "ROTATE") {
      await recovery.rotate(command.assignmentId);
      process.stdout.write('{"state":"ROTATED"}\n');
      return;
    }
    const cutoff = new Date(command.evidence.reconciliationCutoff);
    const through = new Date(command.evidence.financialHistoryRecoveredThrough);
    if (cutoff > new Date() || through < cutoff || through > new Date())
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    const ledger = new LedgerService(database, {
      processIds: ["custody-recovery"],
      businessNamespaces: [],
    });
    let after: string | undefined;
    for (;;) {
      const wallets = await database.wallet.findMany({
        take: 100,
        orderBy: { id: "asc" },
        ...(after === undefined ? {} : { where: { id: { gt: after } } }),
      });
      if (wallets.length === 0) break;
      for (const wallet of wallets) {
        const report = await ledger.reconcileWallet(wallet.id, {
          actor: { type: "PROCESS", processId: "custody-recovery" },
          observe: async () => {},
        });
        if (!report.consistent)
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      }
      after = wallets.at(-1)?.id;
    }
    const inventory = await recovery.restoreInventory();
    await new TreasuryRecovery(database, keys, archive).restoreInventory();
    const payouts = new WithdrawalRecovery(database, { keys, archive });
    await payouts.completeUnacknowledgedBroadcasts({
      environment: process.env,
      projectRoot: root,
      reference: command.evidence.financialHistoryReference,
      recoveredThrough: through,
      cutoff,
    });
    if (command.operation === "RESTORE") await payouts.assertInventory(archive);
    if (command.operation === "ACKNOWLEDGE") {
      const admissionControl =
        await database.financialRuntimeControl.findUniqueOrThrow({
          where: { id: 1 },
        });
      await verifyRecoveredFinancialHistory(database, {
        environment: process.env,
        projectRoot: root,
        reference: command.evidence.financialHistoryReference,
        recoveredThrough: through,
        cutoff,
      });
      const providerConfig = parseTronWorkerEnvironment(process.env, root);
      const provider = new TronProvider(providerConfig);
      if (
        (await database.transferAttempt.count({
          where: { broadcastIntentId: { not: null } },
        })) !== 0
      ) {
        const treasuryConfig = parseTronSignerEnvironment(process.env, root);
        const treasury = new TreasuryReconciliation(
          database,
          provider,
          treasuryConfig,
          "p06_recovery_operator",
        );
        let afterAttempt: string | undefined;
        for (;;) {
          const attempts = await database.transferAttempt.findMany({
            take: 100,
            orderBy: { id: "asc" },
            ...(afterAttempt === undefined
              ? {}
              : { where: { id: { gt: afterAttempt } } }),
          });
          if (attempts.length === 0) break;
          for (const attempt of attempts) {
            const result = await treasury.reconcile(attempt.sweepId);
            if (result?.state === "UNKNOWN")
              throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
          }
          afterAttempt = attempts.at(-1)?.id;
        }
      }
      const reconciliation = new DepositReconciliation(
        database,
        new DepositVerifier(
          database,
          provider,
          providerConfig,
          () => new Date(),
        ),
      );
      let afterReceipt: string | undefined;
      do {
        const report = await reconciliation.inspectBatch(afterReceipt);
        if (!report.consistent)
          throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
        afterReceipt = report.next;
      } while (afterReceipt !== undefined);
      await reconciliation.recoverInbound({
        provider,
        config: providerConfig,
        generation: inventory.generation,
        cutoff,
      });
      // Rescanning only queues genuine new inbound work. Recheck original off-chain authority.
      await verifyRecoveredFinancialHistory(database, {
        environment: process.env,
        projectRoot: root,
        reference: command.evidence.financialHistoryReference,
        recoveredThrough: through,
        cutoff,
      });
      const payoutInventory = await payouts.verifyAdmission(provider, archive);
      await acknowledgeFinancialBoot(database, {
        bootId: command.bootId,
        ...(command.additionalBootIds === undefined
          ? {}
          : { additionalBootIds: command.additionalBootIds }),
        operatorIdentity: operator.operatorIdentity,
        reason: command.reason,
        expectedGeneration: inventory.generation,
        expectedFencedVersion: admissionControl.version,
        signals,
        payoutInventory,
        evidence: {
          ...command.evidence,
          reconciliationCutoff: cutoff,
          financialHistoryRecoveredThrough: through,
        },
      });
    }
    process.stdout.write(
      JSON.stringify({
        state:
          command.operation === "RESTORE" ? "RECOVERED_FENCED" : "ACKNOWLEDGED",
        assignments: inventory.assignments,
      }) + "\n",
    );
  } finally {
    await database.$disconnect();
  }
}
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runCustodyRecovery().catch((failure: unknown) => {
    signals.observe(
      failure instanceof CustodyStorageError &&
        failure.code === "CUSTODY_EVIDENCE_CONFLICT"
        ? "EVIDENCE_CONFLICT"
        : "RECOVERY_UNAVAILABLE",
      true,
      {
        processKind: "RECOVERY_OPERATOR",
        code: "CUSTODY_RECOVERY_UNAVAILABLE",
      },
    );
    process.stderr.write("CUSTODY_RECOVERY_UNAVAILABLE\n");
    process.exitCode = 1;
  });
}
