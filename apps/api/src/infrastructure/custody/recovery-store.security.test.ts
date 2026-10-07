import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CustodyKeyStorage, envelopeDigest } from "./key-storage.js";
import { RecoveryObjectStore } from "./recovery-store.objects.js";
import {
  recoveryRequestSchema,
  validateRecoveryResponse,
} from "./recovery-store.protocol.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const primary = await mkdtemp(join(tmpdir(), "p06-primary-"));
  const remote = await mkdtemp(join(tmpdir(), "p06-recovery-"));
  roots.push(primary, remote);
  const key = join(primary, "key");
  await writeFile(key, randomBytes(32), { mode: 0o600 });
  const keys = new CustodyKeyStorage({
    storageRoot: primary,
    currentKeyId: "test-key",
    keyFiles: { "test-key": key },
    projectRoot: process.cwd(),
  });
  const record = await keys.obtain(randomUUID(), {
    assignmentId: randomUUID(),
    employeeId: randomUUID(),
    walletId: randomUUID(),
    network: "TRON_NILE",
    createdAt: new Date().toISOString(),
    floor: { number: 12, id: "ab".repeat(32), timestamp: 1000 },
  });
  return { remote, record, objects: new RecoveryObjectStore(remote) };
}
describe("immutable recovery object protocol", () => {
  it("acknowledges matching durable readback and recovers a lost reply using the same record", async () => {
    const { objects, record, remote } = await fixture();
    const request = {
      operation: "PUT" as const,
      envelope: record.envelope,
      digest: record.digest,
    };
    const first = await objects.execute(request);
    const replay = await objects.execute(request);
    expect(replay).toEqual(first);
    expect(validateRecoveryResponse(request, first)).toEqual(first);
    const stored: unknown = JSON.parse(
      await readFile(
        join(remote, `${record.envelope.objectId}.1.json`),
        "utf8",
      ),
    );
    expect(stored).toMatchObject({
      digest: record.digest,
      envelope: record.envelope,
    });
    const inventory = await objects.execute({
      operation: "LIST",
      type: "KEY_ASSIGNMENT",
      limit: 1,
    });
    expect(inventory).toMatchObject({
      operation: "LIST",
      records: [
        {
          objectId: record.envelope.objectId,
          version: 1,
          digest: record.digest,
        },
      ],
      cursor: null,
    });
    expect(
      await objects.execute({
        operation: "GET",
        objectId: record.envelope.objectId,
        version: 1,
      }),
    ).toMatchObject({ envelope: record.envelope, digest: record.digest });
  });
  it("rejects overwrite, false ACK and a digest that does not describe stored ciphertext", async () => {
    const { objects, record } = await fixture();
    const request = {
      operation: "PUT" as const,
      envelope: record.envelope,
      digest: record.digest,
    };
    const ack = await objects.execute(request);
    expect(() =>
      validateRecoveryResponse(request, { ...ack, digest: "aa".repeat(32) }),
    ).toThrow("CUSTODY_EVIDENCE_CONFLICT");
    const changed = { ...record.envelope, tag: "11".repeat(16) };
    await expect(
      objects.execute({
        operation: "PUT",
        envelope: changed,
        digest: envelopeDigest(changed),
      }),
    ).rejects.toThrow("CUSTODY_EVIDENCE_CONFLICT");
    await expect(
      objects.execute({ ...request, digest: "aa".repeat(32) }),
    ).rejects.toThrow("CUSTODY_EVIDENCE_CONFLICT");
  });
  it.each([
    { operation: "GET", objectId: "../secret", version: 1 },
    { operation: "LIST", type: "KEY_ASSIGNMENT", limit: 101 },
    { operation: "LIST", type: "KEY_ASSIGNMENT", limit: 0 },
    { operation: "DELETE", objectId: randomUUID() },
    { operation: "GET", objectId: randomUUID(), version: 1, path: "/secret" },
  ])("rejects unbounded or path/command authority", (request) => {
    expect(recoveryRequestSchema.safeParse(request).success).toBe(false);
  });
  it("distinguishes missing records from unavailable/tampered storage", async () => {
    const { objects, record, remote } = await fixture();
    await expect(
      objects.execute({ operation: "GET", objectId: randomUUID(), version: 1 }),
    ).rejects.toThrow("RECOVERY_NOT_FOUND");
    await objects.execute({
      operation: "PUT",
      envelope: record.envelope,
      digest: record.digest,
    });
    await writeFile(
      join(remote, `${record.envelope.objectId}.1.json`),
      "corrupt-private-sentinel",
    );
    await expect(
      objects.execute({
        operation: "GET",
        objectId: record.envelope.objectId,
        version: 1,
      }),
    ).rejects.toThrow("CUSTODY_EVIDENCE_CONFLICT");
  });
});
