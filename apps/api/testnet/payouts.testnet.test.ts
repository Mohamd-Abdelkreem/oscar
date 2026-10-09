import { expect, it } from "vitest";
import { payoutContext, until } from "./setup.js";

it("recovers the single original lost-reply payout and settles its canonical exact net and gross sources once", async () => {
  const f = await payoutContext();
  try {
    const [
      { WithdrawalAttempts },
      { WithdrawalRecovery },
      { CustodyKeyStorage },
      { TronProvider, TronProviderError },
      { FinancialRuntimeAdmission },
      { waitForPayoutBoot },
      { retainedSignedPayout },
      { createHash },
    ] = await Promise.all([
      import("../src/modules/withdrawals/withdrawal-attempts.js"),
      import("../src/modules/withdrawals/withdrawal-recovery.js"),
      import("../src/infrastructure/custody/key-storage.js"),
      import("../src/infrastructure/tron/tron-provider.js"),
      import("../src/modules/custody/runtime-control.js"),
      import("./payout-setup.js"),
      import("../src/modules/withdrawals/withdrawal-payout.records.js"),
      import("node:crypto"),
    ]);
    const before = await f.signer.wallet.findUniqueOrThrow({
      where: { id: f.request.walletId },
    });
    let sends = 0;
    const recoveringOriginal = f.designation.originalTransactionId !== null;
    const expectedSends = recoveringOriginal ? 0 : 1;
    // The designated original HTTP send executes once; only its response is discarded.
    const lostReply: typeof fetch = async (input, options) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const broadcast = url.pathname === "/wallet/broadcasttransaction";
      if (broadcast) {
        sends++;
        if (recoveringOriginal || sends > 1)
          throw new Error("Additional live payout send is forbidden.");
      }
      const response = await fetch(input, options);
      if (broadcast) {
        await response.body?.cancel();
        throw new TypeError("Controlled original payout response loss.");
      }
      return response;
    };
    const provider = new TronProvider(f.config, lostReply);
    const originalOwner = new WithdrawalAttempts(
      f.signer,
      f.admission,
      f.config,
      {
        stores: { keys: f.keys, archive: f.archive },
        provider,
      },
    );
    const signed = await originalOwner.sign(f.request.id);
    if (signed === null || signed.transactionId === null)
      throw new Error("Designated original payout was not signed.");
    if (recoveringOriginal)
      expect(signed.transactionId).toBe(f.designation.originalTransactionId);
    const original = await retainedSignedPayout(
      { keys: f.keys, archive: f.archive },
      f.request,
      signed,
    );
    const digest = (transaction: typeof original.record.transaction) =>
      createHash("sha256").update(JSON.stringify(transaction)).digest("hex");
    const originalDigest = digest(original.record.transaction);
    const uncertain = recoveringOriginal
      ? signed
      : await originalOwner.broadcast(f.request.id);
    expect(uncertain.state).toBe("UNKNOWN");
    expect(uncertain.transactionId).toBe(signed.transactionId);
    expect(sends).toBe(expectedSends);
    expect(
      (
        await f.signer.reservationAllocation.findUniqueOrThrow({
          where: { id: f.allocation.id },
        })
      ).state,
    ).toBe("ACTIVE");
    process.stdout.write(
      JSON.stringify({
        event: "PAYOUT_TESTNET_RECOVERY_FENCE_REQUIRED",
        transactionId: signed.transactionId,
        state: uncertain.state,
      }) + "\n",
    );
    // The independent operator fences and verifies canonical/history/archive evidence via the existing CLI.
    await until(async () => {
      const control = await f.signer.financialRuntimeControl.findUniqueOrThrow({
        where: { id: 1 },
      });
      return control.financialWritesFenced && control.newDispatchPaused;
    }, Boolean);
    const recoveredKeys = new CustodyKeyStorage({
      storageRoot: f.designation.recoveredRoot,
      currentKeyId: f.custody.keyId,
      keyFiles: f.custody.keyFiles,
      projectRoot: process.cwd(),
    });
    const stores = { keys: recoveredKeys, archive: f.archive };
    await new WithdrawalRecovery(f.signer, stores).assertInventory(f.archive);
    const recovered = await retainedSignedPayout(stores, f.request, uncertain);
    expect(recovered.record.transaction.txID).toBe(signed.transactionId);
    expect(digest(recovered.record.transaction)).toBe(originalDigest);
    const admission = new FinancialRuntimeAdmission(f.signer, "SIGNER");
    await waitForPayoutBoot({
      signer: f.signer,
      admission,
      newDispatch: false,
    });
    const recoveredOwner = new WithdrawalAttempts(
      f.signer,
      admission,
      f.config,
      { stores, provider },
    );
    expect((await recoveredOwner.sign(f.request.id))?.transactionId).toBe(
      signed.transactionId,
    );
    const finalized = await until(
      async () => {
        try {
          return await recoveredOwner.reconciliation.observe(f.request.id);
        } catch (failure) {
          if (
            failure instanceof TronProviderError &&
            failure.code === "TRON_UNFINALIZED"
          )
            return null;
          throw failure;
        }
      },
      (request) =>
        request?.state === "COMPLETED" || request?.state === "FAILED",
    );
    process.stdout.write(
      JSON.stringify({
        event: "PAYOUT_TESTNET_FINAL",
        transactionId: signed.transactionId,
        state: finalized?.state,
        ...(finalized?.state === "COMPLETED"
          ? { netUnits: f.designation.netUnits }
          : {}),
      }) + "\n",
    );
    expect(finalized?.state).toBe("COMPLETED");
    await recoveredOwner.reconciliation.observe(f.request.id);
    const after = await f.signer.wallet.findUniqueOrThrow({
      where: { id: f.request.walletId },
    });
    expect(after.availableNonReferralUnits).toBe(
      before.availableNonReferralUnits,
    );
    expect(after.availableReferralUnits).toBe(before.availableReferralUnits);
    expect(after.reservedNonReferralUnits).toBe(
      before.reservedNonReferralUnits - f.allocation.nonReferralUnits,
    );
    expect(after.reservedReferralUnits).toBe(
      before.reservedReferralUnits - f.allocation.referralUnits,
    );
    const settlement = await f.signer.financialOperation.findUniqueOrThrow({
      where: {
        kind_businessNamespace_businessKey: {
          kind: "SETTLE",
          businessNamespace: "p08.withdrawal.settle",
          businessKey: f.request.id,
        },
      },
      include: { postings: true },
    });
    expect(settlement.magnitudeUnits).toBe(f.request.grossUnits);
    const expectedPostings = [
      {
        source: "NON_REFERRAL",
        availableDeltaUnits: 0n,
        reservedDeltaUnits: -f.allocation.nonReferralUnits,
      },
      {
        source: "REFERRAL",
        availableDeltaUnits: 0n,
        reservedDeltaUnits: -f.allocation.referralUnits,
      },
    ].filter((posting) => posting.reservedDeltaUnits !== 0n);
    expect(
      settlement.postings.map(
        ({ source, availableDeltaUnits, reservedDeltaUnits }) => ({
          source,
          availableDeltaUnits,
          reservedDeltaUnits,
        }),
      ),
    ).toEqual(expect.arrayContaining(expectedPostings));
    expect(settlement.postings.length).toBe(expectedPostings.length);
    expect(
      await f.signer.withdrawalAttempt.count({
        where: { withdrawalId: f.request.id },
      }),
    ).toBe(1);
    expect(
      await f.signer.withdrawalAction.count({
        where: { requestId: f.request.id, kind: "COMPLETE" },
      }),
    ).toBe(1);
    expect(
      (
        await f.signer.reservationAllocation.findUniqueOrThrow({
          where: { id: f.allocation.id },
        })
      ).releaseOperationId,
    ).toBeNull();
    expect(sends).toBe(expectedSends);
  } finally {
    await f.close();
  }
}, 2400000);
