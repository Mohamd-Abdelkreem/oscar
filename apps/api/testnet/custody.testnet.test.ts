import { expect, it } from "vitest";
import { context, designation } from "./setup.js";

it("publishes a fresh designated key only after independent SSH ACK and recovers its address with escrow", async () => {
  const f = await context();
  const { CustodyProvisioner } =
    await import("../src/modules/custody/custody.provisioner.js");
  expect(
    await new CustodyProvisioner(f.signer, f.config, f.signerAdmission, {
      keys: f.keys,
      recovery: f.archive,
      provider: f.provider,
    }).provisionNext(),
  ).toBe(designation.assignmentId);
  const row = await f.signer.depositAddressAssignment.findUniqueOrThrow({
    where: { id: designation.assignmentId },
  });
  expect(row.state).toBe("READY");
  if (row.keyVersion === null)
    throw new Error("Published key version missing.");
  const version = row.keyVersion;
  const archived = await f.archive.get(row.keyRecordId, version);
  expect(archived.digest).toBe(row.keyEnvelopeDigest);
  const { parseRecoveryOperatorEnvironment } =
    await import("../src/core/config/custody.config.js");
  const { CustodyKeyStorage } =
    await import("../src/infrastructure/custody/key-storage.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "p06-testnet-escrow-"));
  try {
    const escrow = parseRecoveryOperatorEnvironment(process.env, process.cwd());
    const recovered = new CustodyKeyStorage({
      storageRoot: root,
      currentKeyId: f.custody.keyId,
      keyFiles: { [f.custody.keyId]: escrow.escrowKeyFile },
      projectRoot: process.cwd(),
    });
    await recovered.importEnvelope(archived.envelope);
    expect(recovered.decrypt(archived.envelope).address).toBe(row.address);
    expect(await recovered.read(row.keyRecordId, version)).not.toBeNull();
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
  process.stdout.write(
    JSON.stringify({
      event: "TESTNET_READY",
      assignmentId: row.id,
      address: row.address,
    }) + "\n",
  );
}, 1200000);
