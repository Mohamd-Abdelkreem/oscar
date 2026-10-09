import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createDatabaseClient } from "@template/database";
import {
  requiredCustodySetting,
  parseSignerCustodyEnvironment,
} from "../../core/config/custody.config.js";
import {
  parseTronSignerEnvironment,
  parseTronPayoutEnvironment,
} from "../../core/config/tron.config.js";
import { CustodyKeyStorage } from "../../infrastructure/custody/key-storage.js";
import { SshRecoveryStore } from "../../infrastructure/custody/recovery-store.js";
import { provisionTreasuryPayoutKey } from "./treasury-payout-key.js";
import { TronProvider } from "../../infrastructure/tron/tron-provider.js";
import { TreasuryService, treasuryAuthority } from "./treasury.service.js";
import { treasuryCommandSchema } from "./treasury.intent.js";
import { TreasuryReconciliation } from "./treasury-reconciliation.js";
import { changeDispatchPause } from "../custody/runtime-control.js";

export async function runTreasuryTool(): Promise<void> {
  if (process.platform !== "linux" || process.argv.length !== 2)
    throw new Error("TREASURY_AUTHORITY_DENIED");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const input of process.stdin) {
    const chunk: unknown = input;
    if (!(chunk instanceof Buffer) || (bytes += chunk.length) > 8192)
      throw new Error("TREASURY_INPUT_INVALID");
    chunks.push(chunk);
  }
  const command = treasuryCommandSchema.parse(
    JSON.parse(Buffer.concat(chunks).toString("utf8")),
  );
  const operatorIdentity = requiredCustodySetting(
    process.env,
    "CUSTODY_OPERATOR_IDENTITY",
  );
  const url = requiredCustodySetting(process.env, "DATABASE_URL");
  if (!/^postgres(?:ql)?:$/u.test(new URL(url).protocol))
    throw new Error("TREASURY_CONFIGURATION_INVALID");
  const database = createDatabaseClient(url);
  try {
    await database.$connect();
    await database.$transaction((tx) =>
      treasuryAuthority(tx, "p06_recovery_operator"),
    );
    if (command.operation === "PAUSE") {
      await changeDispatchPause(database, {
        action: command.action,
        operatorIdentity,
        reason: command.reason,
      });
      process.stdout.write(
        JSON.stringify({
          state: command.action === "PAUSE" ? "PAUSED" : "RESUMED",
        }) + "\n",
      );
      return;
    }
    const root = fileURLToPath(new URL("../../../../../", import.meta.url));
    if (command.operation === "PROVISION_PAYOUT_KEY") {
      const custody = parseSignerCustodyEnvironment(process.env, root);
      const key = await provisionTreasuryPayoutKey(
        database,
        parseTronPayoutEnvironment(process.env, root),
        {
          operatorIdentity,
          input: command,
          stores: {
            keys: new CustodyKeyStorage({
              storageRoot: custody.storageRoot,
              currentKeyId: custody.keyId,
              keyFiles: custody.keyFiles,
              projectRoot: root,
            }),
            archive: new SshRecoveryStore(custody),
          },
        },
      );
      process.stdout.write(
        JSON.stringify({ keyRecordId: key.id, state: "RECOVERY_ACKED" }) + "\n",
      );
      return;
    }
    const config = parseTronSignerEnvironment(process.env, root);
    const service = new TreasuryService(database, config, operatorIdentity);
    if (command.operation === "RECONCILE")
      await new TreasuryReconciliation(
        database,
        new TronProvider(config),
        config,
        "p06_recovery_operator",
      ).reconcile(command.operationId);
    const sweep =
      command.operation === "CREATE"
        ? await service.create(command)
        : await service.status(command.operationId);
    // Operator results expose only durable operation/state, never keys, paths or signed material.
    process.stdout.write(
      JSON.stringify({ operationId: sweep.id, state: sweep.state }) + "\n",
    );
  } finally {
    await database.$disconnect();
  }
}
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runTreasuryTool().catch(() => {
    process.stderr.write("TREASURY_OPERATION_UNAVAILABLE\n");
    process.exitCode = 1;
  });
}
