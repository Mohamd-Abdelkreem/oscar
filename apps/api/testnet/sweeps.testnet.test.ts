import { expect, it } from "vitest";
import { context, p06Designation, until } from "./setup.js";

const designation = p06Designation();

it("reuses the recovered signed attempt and proves canonical treasury movement and company costs without employee effects", async () => {
  const f = await context();
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const recoveredRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "p06-testnet-attempt-recovery-"),
  );
  try {
    const [
      { TreasuryService },
      { TreasuryAttempts, signedAttemptSchema },
      { TreasuryReconciliation },
      { formatUsdtAmount },
    ] = await Promise.all([
      import("../src/modules/treasury/treasury.service.js"),
      import("../src/modules/treasury/treasury-attempts.js"),
      import("../src/modules/treasury/treasury-reconciliation.js"),
      import("../src/core/financial/money.js"),
    ]);
    const walletBefore = await f.signer.wallet.findMany({
      orderBy: { id: "asc" },
    });
    const receiptsBefore = await f.signer.depositReceipt.count();
    const reconcile = new TreasuryReconciliation(
      f.signer,
      f.provider,
      f.config,
    );
    const treasuryBefore = await reconcile.balances(f.config.treasury);
    const service = new TreasuryService(
      f.operator,
      f.config,
      f.custody.operatorIdentity,
    );
    const sweep = await service.create({
      operation: "CREATE",
      operationId: designation.operationId,
      assignmentId: designation.assignmentId,
      amount: formatUsdtAmount(BigInt(designation.sweepUnits)),
      reason: "Designated controlled testnet company consolidation",
    });
    const owner = new TreasuryAttempts(f.signer, f.signerAdmission, f.config, {
      stores: { keys: f.keys, archive: f.archive },
      provider: f.provider,
    });
    const signed = await owner.sign(sweep.id);
    expect(signed.transactionId).not.toBeNull();
    const archived = await f.archive.get(signed.id, 1);
    const snapshot = signedAttemptSchema.parse(
      f.keys.openRecord(archived.envelope),
    );
    expect(snapshot.transaction.txID).toBe(signed.transactionId);
    const { parseRecoveryOperatorEnvironment } =
      await import("../src/core/config/custody.config.js");
    const { CustodyKeyStorage } =
      await import("../src/infrastructure/custody/key-storage.js");
    const escrow = parseRecoveryOperatorEnvironment(process.env, process.cwd());
    const recoveredKeys = new CustodyKeyStorage({
      storageRoot: recoveredRoot,
      currentKeyId: f.custody.keyId,
      keyFiles: { [f.custody.keyId]: escrow.escrowKeyFile },
      projectRoot: process.cwd(),
    });
    expect(await recoveredKeys.readRecord(signed.id)).toBeNull();
    const recoveredOwner = new TreasuryAttempts(
      f.signer,
      f.signerAdmission,
      f.config,
      {
        stores: { keys: recoveredKeys, archive: f.archive },
        provider: f.provider,
      },
    );
    expect((await recoveredOwner.sign(sweep.id)).transactionId).toBe(
      signed.transactionId,
    );
    const recoveredRecord = await recoveredKeys.readRecord(signed.id);
    if (recoveredRecord === null) throw new Error("Recovered attempt missing.");
    const { createHash } = await import("node:crypto");
    const retainedSnapshot = signedAttemptSchema.parse(
      recoveredKeys.openRecord(recoveredRecord),
    );
    const snapshotDigest = (record: typeof snapshot) =>
      createHash("sha256").update(JSON.stringify(record)).digest("hex");
    expect(snapshotDigest(retainedSnapshot)).toBe(snapshotDigest(snapshot));
    await recoveredOwner.broadcast(sweep.id);
    const finalized = await until(
      () => reconcile.reconcile(sweep.id),
      (a) => a?.state === "CONFIRMED" || a?.state === "CHAIN_FAILED",
    );
    expect(finalized?.state).toBe("CONFIRMED");
    expect(finalized?.transactionId).toBe(signed.transactionId);
    expect(finalized?.feeSun).not.toBeNull();
    expect(finalized?.energyUnits).not.toBeNull();
    expect(finalized?.bandwidthUnits).not.toBeNull();
    expect(
      (await reconcile.balances(f.config.treasury)).tokenUnits -
        treasuryBefore.tokenUnits,
    ).toBe(BigInt(designation.sweepUnits));
    expect(await f.signer.wallet.findMany({ orderBy: { id: "asc" } })).toEqual(
      walletBefore,
    );
    expect(await f.signer.depositReceipt.count()).toBe(receiptsBefore);
    expect(
      await f.signer.transferAttempt.count({ where: { sweepId: sweep.id } }),
    ).toBe(1);
    process.stdout.write(
      JSON.stringify({
        event: "TESTNET_SWEEP",
        transactionId: signed.transactionId,
        amountUnits: designation.sweepUnits,
        state: finalized?.state,
        feeSun: String(finalized?.feeSun),
        energyUnits: String(finalized?.energyUnits),
        bandwidthUnits: String(finalized?.bandwidthUnits),
      }) + "\n",
    );
  } finally {
    await fs.rm(recoveredRoot, { recursive: true, force: true });
    await f.close();
  }
}, 1200000);
