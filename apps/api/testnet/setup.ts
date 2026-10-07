import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { parseTestnetAdmission } from "../src/core/config/testnet.config.js";
import { z } from "zod";

export const designation = parseTestnetAdmission(process.env);
async function databaseUrl(setting: string) {
  const { privateCredentialFile } =
    await import("../src/core/config/custody.config.js");
  const file = privateCredentialFile(process.env, setting, process.cwd());
  const url = new URL((await readFile(file, "utf8")).trim());
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.username ||
    !url.password
  )
    throw new Error("Designated database credentials invalid.");
  return url.toString();
}
export async function until<T>(
  read: () => Promise<T>,
  ready: (value: T) => boolean,
): Promise<T> {
  const deadline = Date.now() + 600000;
  do {
    const value = await read();
    if (ready(value)) return value;
    await delay(3000);
  } while (Date.now() < deadline);
  throw new Error(
    "Designated testnet evidence did not arrive within ten minutes.",
  );
}
async function initialize() {
  if (process.platform !== "linux")
    throw new Error(
      "Controlled testnet requires Linux private-file boundaries.",
    );
  const [
    { createDatabaseClient },
    { parseTronSignerEnvironment },
    { parseSignerCustodyEnvironment },
    { CustodyKeyStorage },
    { SshRecoveryStore },
    { TronProvider },
    { FinancialRuntimeAdmission },
  ] = await Promise.all([
    import("@template/database"),
    import("../src/core/config/tron.config.js"),
    import("../src/core/config/custody.config.js"),
    import("../src/infrastructure/custody/key-storage.js"),
    import("../src/infrastructure/custody/recovery-store.js"),
    import("../src/infrastructure/tron/tron-provider.js"),
    import("../src/modules/custody/runtime-control.js"),
  ]);
  const config = parseTronSignerEnvironment(process.env, process.cwd());
  const custody = parseSignerCustodyEnvironment(process.env, process.cwd());
  const signer = createDatabaseClient(
    await databaseUrl("P06_TESTNET_SIGNER_DATABASE_FILE"),
  );
  const worker = createDatabaseClient(
    await databaseUrl("P06_TESTNET_WORKER_DATABASE_FILE"),
  );
  const operator = createDatabaseClient(
    await databaseUrl("P06_TESTNET_OPERATOR_DATABASE_FILE"),
  );
  const signerAdmission = new FinancialRuntimeAdmission(signer, "SIGNER");
  const workerAdmission = new FinancialRuntimeAdmission(
    worker,
    "DEPOSIT_WORKER",
  );
  const close = async () => {
    await Promise.all([
      signer.$disconnect(),
      worker.$disconnect(),
      operator.$disconnect(),
    ]);
  };
  try {
    const pending = await signer.depositAddressAssignment.findMany({
      where: { state: { not: "READY" } },
    });
    if (
      pending.length !== 1 ||
      pending[0]?.id !== designation.assignmentId ||
      pending[0].state !== "REQUESTED"
    )
      throw new Error(
        "Testnet requires only the designated fresh REQUESTED assignment.",
      );
    await signerAdmission.register();
    await workerAdmission.register();
    process.stdout.write(
      JSON.stringify({
        event: "TESTNET_BOOT_APPROVAL_REQUIRED",
        signerBootId: signerAdmission.bootId,
        workerBootId: workerAdmission.bootId,
      }) + "\n",
    );
    await until(async () => {
      const control = await signer.financialRuntimeControl.findUniqueOrThrow({
        where: { id: 1 },
      });
      const boots = await signer.financialRuntimeAdmission.findMany({
        where: {
          bootId: { in: [signerAdmission.bootId, workerAdmission.bootId] },
        },
      });
      return (
        !control.financialWritesFenced &&
        !control.newDispatchPaused &&
        boots.length === 2 &&
        boots.every((b) => b.acknowledgedGeneration === control.generation)
      );
    }, Boolean);
    const provider = new TronProvider(config);
    await provider.verifyIdentity();
    const keys = new CustodyKeyStorage({
      storageRoot: custody.storageRoot,
      currentKeyId: custody.keyId,
      keyFiles: custody.keyFiles,
      projectRoot: process.cwd(),
    });
    return {
      signer,
      worker,
      operator,
      signerAdmission,
      workerAdmission,
      provider,
      keys,
      archive: new SshRecoveryStore(custody),
      config,
      custody,
      close,
    };
  } catch (failure) {
    await close();
    throw failure;
  }
}
let current: ReturnType<typeof initialize> | undefined;
export function context() {
  current ??= initialize();
  return current;
}
export async function inboundEvidence() {
  const { privateCredentialFile } =
    await import("../src/core/config/custody.config.js");
  const path = privateCredentialFile(
    process.env,
    "P06_TESTNET_INBOUND_EVIDENCE_FILE",
    process.cwd(),
  );
  const input: unknown = JSON.parse(await readFile(path, "utf8"));
  if (z.object({}).strict().safeParse(input).success) return null;
  return z
    .object({
      assignmentId: z.literal(designation.assignmentId),
      transactionId: z.string().regex(/^[0-9a-f]{64}$/u),
      amountUnits: z.literal(designation.inboundUnits),
    })
    .strict()
    .parse(input);
}
