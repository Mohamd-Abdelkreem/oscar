import { readFile, unlink, writeFile } from "node:fs/promises";
import { createDatabaseClient } from "@template/database";
import { financialHistoryDigest } from "../apps/api/dist/modules/custody/recovery-history.js";
import { invokeCli, loadConfig } from "./runtime.mjs";

const environment = await loadConfig("operator");
if (environment.TRON_NETWORK !== "TRON_NILE")
  throw new Error("Local admission requires Nile.");
const reason = "Owner-requested isolated local Nile development environment";
const operation = process.argv[3];
if (operation === "fence") {
  console.log(
    await invokeCli(
      "modules/custody/recovery.cli.js",
      { operation: "FENCE", reason },
      environment,
    ),
  );
} else if (operation === "acknowledge") {
  const database = createDatabaseClient(environment.DATABASE_URL);
  try {
    if (
      !(await database.treasuryPayoutKey.findUnique({
        where: { id: environment.TRON_PAYOUT_KEY_ID },
      }))
    ) {
      const privateKey = await readFile(
        "/private/operator/treasury.key",
        "utf8",
      );
      await invokeCli(
        "modules/treasury/treasury.cli.js",
        { operation: "PROVISION_PAYOUT_KEY", privateKey, reason },
        environment,
      );
      await unlink("/private/operator/treasury.key");
    }
    const boots = [];
    for (const kind of ["API", "DEPOSIT_WORKER", "SIGNER"]) {
      const boot = await database.financialRuntimeAdmission.findFirst({
        where: { processKind: kind },
        orderBy: { requestedAt: "desc" },
      });
      if (boot === null) throw new Error(`Missing local ${kind} boot.`);
      boots.push(boot.bootId);
    }
    const time = new Date().toISOString();
    const reference = `local-nile-${Date.now()}`;
    const history = {
      reference,
      recoveredThrough: time,
      digest: await financialHistoryDigest(database),
    };
    await writeFile(
      environment.CUSTODY_FINANCIAL_HISTORY_FILE,
      JSON.stringify(history),
      { mode: 0o600 },
    );
    const evidence = {
      financialHistoryReference: reference,
      assignmentInventoryReference: "local-independent-ssh",
      attemptInventoryReference: "local-original-attempts",
      reconciliationReference: "local-canonical-reconciliation",
      reconciliationCutoff: time,
      financialHistoryRecoveredThrough: time,
    };
    console.log(
      await invokeCli(
        "modules/custody/recovery.cli.js",
        {
          operation: "ACKNOWLEDGE",
          bootId: boots[0],
          additionalBootIds: boots.slice(1),
          reason,
          evidence,
        },
        environment,
      ),
    );
    console.log(
      await invokeCli(
        "modules/treasury/treasury.cli.js",
        { operation: "PAUSE", action: "RESUME", reason },
        environment,
      ),
    );
  } finally {
    await database.$disconnect();
  }
} else {
  throw new Error("Unknown local admission operation.");
}
