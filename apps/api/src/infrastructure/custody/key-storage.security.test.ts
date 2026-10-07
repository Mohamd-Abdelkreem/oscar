import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TronWeb } from "tronweb";
import { CustodyKeyStorage } from "./key-storage.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "p06-key-storage-"));
  roots.push(root);
  const keyFile = join(root, "encryption.key");
  await writeFile(keyFile, randomBytes(32), { mode: 0o600 });
  const store = new CustodyKeyStorage({
    storageRoot: root,
    currentKeyId: "test-v1",
    keyFiles: { "test-v1": keyFile },
    projectRoot: process.cwd(),
  });
  const binding = {
    assignmentId: randomUUID(),
    employeeId: randomUUID(),
    walletId: randomUUID(),
    network: "TRON_NILE" as const,
    createdAt: new Date().toISOString(),
    floor: { number: 123, id: "ab".repeat(32), timestamp: 1000 },
  };
  return { root, store, binding, id: randomUUID(), keyFile };
}
describe("encrypted custody files", () => {
  it("retains one generated account during concurrent no-replace writes and rederives it", async () => {
    const { root, store, binding, id } = await fixture();
    const [first, second] = await Promise.all([
      store.obtain(id, binding),
      store.obtain(id, binding),
    ]);
    expect(first.payload.address).toBe(second.payload.address);
    expect(first.digest).toBe(second.digest);
    const serialized = await readFile(join(root, `${id}.1.json`), "utf8");
    expect(serialized).not.toContain(first.payload.privateKey);
    expect(serialized).not.toContain(binding.employeeId);
    expect(TronWeb.address.fromPrivateKey(first.payload.privateKey)).toBe(
      first.payload.address,
    );
    expect((await store.obtain(id, binding)).digest).toBe(first.digest);
  });
  it.each(["ciphertext", "keyId", "version", "objectId"])(
    "rejects tampered %s without disclosing plaintext",
    async (field) => {
      const { store, binding, id } = await fixture();
      const record = await store.obtain(id, binding);
      const changed = {
        ...record.envelope,
        [field]: field === "version" ? 2 : "tampered-private-sentinel",
      };
      expect(() => store.decrypt(changed)).toThrow("CUSTODY_EVIDENCE_CONFLICT");
      expect(() => {
        store.assertBinding(record.payload, {
          ...binding,
          employeeId: randomUUID(),
        });
      }).toThrow("CUSTODY_EVIDENCE_CONFLICT");
    },
  );
  it("keeps old key versions readable after rotation to an acknowledged replacement", async () => {
    const { root, store, binding, id, keyFile } = await fixture();
    const original = await store.obtain(id, binding);
    const nextKey = join(root, "next.key");
    await writeFile(nextKey, randomBytes(32), { mode: 0o600 });
    const rotated = new CustodyKeyStorage({
      storageRoot: root,
      currentKeyId: "test-v2",
      keyFiles: { "test-v1": keyFile, "test-v2": nextKey },
      projectRoot: process.cwd(),
    });
    const [replacement, concurrent] = await Promise.all([
      rotated.rotate(original.envelope),
      rotated.rotate(original.envelope),
    ]);
    expect(concurrent).toEqual(replacement);
    const retainedBytes = await readFile(join(root, `${id}.2.json`));
    const retried = await rotated.rotate(original.envelope);
    expect(retried).toEqual(replacement);
    expect(await readFile(join(root, `${id}.2.json`))).toEqual(retainedBytes);
    expect(replacement.envelope.version).toBe(2);
    expect(rotated.decrypt(original.envelope).privateKey).toBe(
      rotated.decrypt(replacement.envelope).privateKey,
    );
    expect(await store.read(id, 1)).not.toBeNull();
    expect(await rotated.read(id, 2)).not.toBeNull();
    await expect(store.rotate(original.envelope)).rejects.toThrow(
      "CUSTODY_EVIDENCE_CONFLICT",
    );
    await writeFile(
      join(root, `${id}.2.json`),
      JSON.stringify({ ...replacement.envelope, tag: "11".repeat(16) }),
      { mode: 0o600 },
    );
    await expect(rotated.rotate(original.envelope)).rejects.toThrow(
      "CUSTODY_EVIDENCE_CONFLICT",
    );
  });
  it("rejects traversal, symlinks, missing retained keys and mismatched imported bindings", async () => {
    const { root, store, binding, id } = await fixture();
    const record = await store.obtain(id, binding);
    await expect(store.read("../outside", 1)).rejects.toThrow(
      "CUSTODY_INPUT_INVALID",
    );
    const aliasId = randomUUID();
    const alias = join(root, `${aliasId}.1.json`);
    await symlink(
      process.platform === "win32" ? root : join(root, `${id}.1.json`),
      alias,
      process.platform === "win32" ? "junction" : "file",
    );
    await expect(store.read(aliasId, 1)).rejects.toThrow(
      "CUSTODY_STORAGE_UNAVAILABLE",
    );
    expect(() =>
      store.decrypt({ ...record.envelope, keyId: "missing" }),
    ).toThrow("CUSTODY_EVIDENCE_CONFLICT");
    await expect(
      store.importEnvelope({ ...record.envelope, ciphertext: "AAAA" }),
    ).rejects.toThrow("CUSTODY_EVIDENCE_CONFLICT");
  });
});
