import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createDatabaseClient } from "@template/database";
import { requiredCustodySetting } from "../../core/config/custody.config.js";
import { parseTronSignerEnvironment } from "../../core/config/tron.config.js";
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
