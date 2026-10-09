import { access, constants, readdir } from "node:fs/promises";
import type { parsePayoutTestnetAdmission } from "../src/core/config/testnet.config.js";
import { databaseUrl, until } from "./setup.js";
import type { DatabaseClient } from "@template/database";
import type { FinancialRuntimeAdmission } from "../src/modules/custody/runtime-control.js";

export async function waitForPayoutBoot(input: {
  signer: DatabaseClient;
  admission: FinancialRuntimeAdmission;
  newDispatch: boolean;
}) {
  await input.admission.register();
  process.stdout.write(
    JSON.stringify({
      event: "PAYOUT_TESTNET_BOOT_APPROVAL_REQUIRED",
      bootId: input.admission.bootId,
    }) + "\n",
  );
  await until(async () => {
    const current =
      await input.signer.financialRuntimeControl.findUniqueOrThrow({
        where: { id: 1 },
      });
    const boot = await input.signer.financialRuntimeAdmission.findUniqueOrThrow(
      { where: { bootId: input.admission.bootId } },
    );
    return (
      !current.financialWritesFenced &&
      (!input.newDispatch || !current.newDispatchPaused) &&
      boot.acknowledgedGeneration === current.generation
    );
  }, Boolean);
  await input.signer.$transaction((transaction) =>
    input.newDispatch
      ? input.admission.assertDispatchAdmission(transaction)
      : input.admission.assertMutationAdmission(transaction),
  );
}

async function denyOperatorMaterial(path: string) {
  try {
    await access(path, constants.R_OK);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EACCES")
      return;
    throw new Error(
      "Independent operator material must exist behind a separate Linux user boundary.",
    );
  }
  throw new Error(
    "Payout signer must not read independent operator credentials or escrow.",
  );
}

export async function initializePayout(
  designation: ReturnType<typeof parsePayoutTestnetAdmission>,
) {
  if (process.platform !== "linux")
    throw new Error("Controlled payout testnet requires Linux isolation.");
  const [
    { createDatabaseClient },
    { parseTronPayoutEnvironment },
    { parseSignerCustodyEnvironment, privateCustodyPath },
    { CustodyKeyStorage },
    { SshRecoveryStore },
    { TronProvider },
    { FinancialRuntimeAdmission },
    { WithdrawalRecovery },
    { checkPayoutResources },
  ] = await Promise.all([
    import("@template/database"),
    import("../src/core/config/tron.config.js"),
    import("../src/core/config/custody.config.js"),
    import("../src/infrastructure/custody/key-storage.js"),
    import("../src/infrastructure/custody/recovery-store.js"),
    import("../src/infrastructure/tron/tron-provider.js"),
    import("../src/modules/custody/runtime-control.js"),
    import("../src/modules/withdrawals/withdrawal-recovery.js"),
    import("../src/modules/withdrawals/withdrawal-payout.resources.js"),
  ]);
  const config = parseTronPayoutEnvironment(process.env, process.cwd());
  const custody = parseSignerCustodyEnvironment(process.env, process.cwd());
  const recoveredRoot = privateCustodyPath(
    process.env,
    "P08_TESTNET_RECOVERED_STORAGE_ROOT",
    process.cwd(),
    "directory",
  );
  if ((await readdir(recoveredRoot)).length !== 0)
    throw new Error("Recovered cache must initially be empty.");
  for (const setting of [
    "P08_TESTNET_OPERATOR_DATABASE_FILE",
    "CUSTODY_RECOVERY_KEY_FILE",
  ] as const) {
    const path = process.env[setting];
    if (path === undefined)
      throw new Error("Independent operator path missing.");
    await denyOperatorMaterial(path);
  }
  const signer = createDatabaseClient(
    await databaseUrl("P08_TESTNET_SIGNER_DATABASE_FILE"),
  );
  const close = () => signer.$disconnect();
  try {
    const [authority] = await signer.$queryRaw<{ allowed: boolean }[]>`
      SELECT p06_role_member('p06_signer') AND NOT (
        p06_role_member('p06_api') OR p06_role_member('p06_deposit_worker') OR p06_role_member('p06_recovery_operator')
        OR EXISTS(SELECT 1 FROM pg_roles WHERE (rolsuper OR rolcreaterole OR rolbypassrls) AND pg_has_role(current_user,oid,'MEMBER'))
        OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND pg_has_role(current_user,c.relowner,'MEMBER'))
        OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='public' AND pg_has_role(current_user,nspowner,'MEMBER'))
      ) AS allowed`;
    if (authority?.allowed !== true)
      throw new Error("Exclusive nonowner payout signer credentials required.");
    const control = await signer.financialRuntimeControl.findUniqueOrThrow({
      where: { id: 1 },
    });
    if (!control.financialWritesFenced || !control.newDispatchPaused)
      throw new Error("Payout testnet must start fenced and paused.");
    const active = await signer.withdrawalRequest.findMany({
      where: {
        state: {
          in: ["SCHEDULED", "SIGNING", "SIGNED", "SUBMITTED", "UNKNOWN"],
        },
      },
      take: 2,
    });
    const request = active[0];
    const recoveringOriginal = designation.originalTransactionId !== null;
    if (
      active.length !== 1 ||
      request === undefined ||
      request.id !== designation.requestId ||
      request.state !== (recoveringOriginal ? "UNKNOWN" : "SCHEDULED") ||
      request.network !== designation.network ||
      request.recipient !== designation.recipient ||
      request.grossUnits !== BigInt(designation.grossUnits) ||
      request.netUnits !== BigInt(designation.netUnits) ||
      request.feeUnits !== request.grossUnits - request.netUnits ||
      request.dispatchAt > new Date()
    )
      throw new Error(
        "Only the designated accepted, due, fixed original withdrawal may execute.",
      );
    if (
      (await signer.withdrawalAttempt.count()) !==
        (recoveringOriginal ? 1 : 0) ||
      (await signer.treasuryPayoutKey.count()) !== 1
    )
      throw new Error(
        "Payout testnet requires only its designated key and original attempt count.",
      );
    if (recoveringOriginal) {
      const attempt = await signer.withdrawalAttempt.findUniqueOrThrow({
        where: { withdrawalId: request.id },
      });
      if (
        attempt.state !== "UNKNOWN" ||
        attempt.transactionId !== designation.originalTransactionId ||
        attempt.treasuryKeyId !== designation.treasuryKeyId ||
        attempt.signedAckId === null ||
        attempt.broadcastAckId === null
      )
        throw new Error(
          "Recovery requires the exact archived original UNKNOWN payout.",
        );
    }
    const key = await signer.treasuryPayoutKey.findUniqueOrThrow({
      where: { id: designation.treasuryKeyId },
    });
    if (
      key.network !== designation.network ||
      key.source !== designation.source ||
      key.tokenContract !== designation.tokenContract
    )
      throw new Error("Designated recoverable treasury identity mismatch.");
    const keys = new CustodyKeyStorage({
      storageRoot: custody.storageRoot,
      currentKeyId: custody.keyId,
      keyFiles: custody.keyFiles,
      projectRoot: process.cwd(),
    });
    const archive = new SshRecoveryStore(custody);
    await new WithdrawalRecovery(signer, { keys, archive }).assertInventory(
      archive,
    );
    const admission = new FinancialRuntimeAdmission(signer, "SIGNER");
    await waitForPayoutBoot({
      signer,
      admission,
      newDispatch: !recoveringOriginal,
    });
    const provider = new TronProvider(config);
    await provider.verifyIdentity();
    await checkPayoutResources(
      provider,
      config,
      request.recipient,
      request.netUnits,
    );
    const allocation = await signer.reservationAllocation.findUniqueOrThrow({
      where: { id: request.reservationId },
    });
    if (
      allocation.state !== "ACTIVE" ||
      allocation.grossUnits !== request.grossUnits ||
      allocation.nonReferralUnits + allocation.referralUnits !==
        request.grossUnits
    )
      throw new Error("Designated original source reservation mismatch.");
    return {
      signer,
      admission,
      config,
      custody,
      keys,
      archive,
      provider,
      request,
      allocation,
      designation,
      close,
    };
  } catch (failure) {
    await close();
    throw failure;
  }
}
