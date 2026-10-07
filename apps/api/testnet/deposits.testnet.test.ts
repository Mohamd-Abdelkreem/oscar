import { expect, it } from "vitest";
import { context, designation, inboundEvidence, until } from "./setup.js";

it("credits the designated canonical inbound raw log once in exact units", async () => {
  const f = await context();
  const evidence = await until(inboundEvidence, (value) => value !== null);
  if (evidence === null) throw new Error("Inbound evidence missing.");
  const { DepositVerifier } =
    await import("../src/modules/deposits/deposit-verifier.js");
  const { DepositCreditService } =
    await import("../src/modules/deposits/deposit-credit.service.js");
  const verifier = new DepositVerifier(
    f.worker,
    f.provider,
    f.config,
    () => new Date(),
  );
  const verification = await until(
    () => verifier.verify(evidence.transactionId),
    (v) => v.state === "VERIFIED",
  );
  if (verification.state !== "VERIFIED")
    throw new Error("Canonical inbound unavailable.");
  const owned = verification.movements.filter(
    (m) => m.assignmentId === designation.assignmentId,
  );
  expect(owned).toHaveLength(1);
  expect(owned[0]?.amountUnits).toBe(BigInt(designation.inboundUnits));
  const service = new DepositCreditService(
    f.worker,
    verifier,
    f.workerAdmission,
    () => new Date(),
  );
  const assignment = await f.worker.depositAddressAssignment.findUniqueOrThrow({
    where: { id: designation.assignmentId },
  });
  const before = await f.worker.wallet.findUniqueOrThrow({
    where: { id: assignment.walletId },
  });
  expect((await service.process(evidence.transactionId)).state).toBe(
    "ACCOUNTED",
  );
  expect((await service.process(evidence.transactionId)).state).toBe(
    "ACCOUNTED",
  );
  const after = await f.worker.wallet.findUniqueOrThrow({
    where: { id: assignment.walletId },
  });
  expect(
    after.availableNonReferralUnits - before.availableNonReferralUnits,
  ).toBe(BigInt(designation.inboundUnits));
  expect(
    await f.worker.depositReceipt.count({
      where: {
        network: f.config.network,
        transactionId: evidence.transactionId,
        assignmentId: assignment.id,
      },
    }),
  ).toBe(1);
  process.stdout.write(
    JSON.stringify({
      event: "TESTNET_INBOUND",
      transactionId: evidence.transactionId,
      logIndex: owned[0]?.logIndex,
      amountUnits: designation.inboundUnits,
      confirmedAt: owned[0]?.verifiedAt.toISOString(),
    }) + "\n",
  );
}, 1200000);
