import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { TronWeb } from "tronweb";
import { z } from "zod";
import {
  privateCredentialFile,
  privateCustodyPath,
} from "../../core/config/custody.config.js";
import {
  CustodyStorageError,
  publishProtectedFile,
  readProtectedFile,
} from "./protected-files.js";

import {
  recoveryEnvelopeSchema,
  sealEnvelope,
  openEnvelope,
  type RecoveryEnvelope,
} from "./encrypted-envelope.js";

const floorSchema = z
  .object({
    number: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    id: z.string().regex(/^[0-9a-f]{64}$/u),
    timestamp: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export const keyBindingSchema = z
  .object({
    assignmentId: z.uuid(),
    employeeId: z.uuid(),
    walletId: z.uuid(),
    network: z.enum(["TRON_MAINNET", "TRON_SHASTA", "TRON_NILE"]),
    createdAt: z.iso.datetime(),
    floor: floorSchema,
  })
  .strict();
const payloadSchema = keyBindingSchema
  .extend({
    address: z.string().regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/u),
    privateKey: z.string().regex(/^[0-9a-fA-F]{64}$/u),
  })
  .strict();
export const envelopeSchema = recoveryEnvelopeSchema.extend({
  type: z.literal("KEY_ASSIGNMENT"),
});
export type KeyBinding = z.infer<typeof keyBindingSchema>;
export type KeyPayload = z.infer<typeof payloadSchema>;
export type KeyEnvelope = z.infer<typeof envelopeSchema>;
export function envelopeBytes(envelope: RecoveryEnvelope): Buffer {
  return Buffer.from(JSON.stringify(recoveryEnvelopeSchema.parse(envelope)));
}
export function envelopeDigest(envelope: RecoveryEnvelope): string {
  return createHash("sha256").update(envelopeBytes(envelope)).digest("hex");
}
function filename(id: string, version: number): string {
  if (
    !z.uuid().safeParse(id).success ||
    !z.number().int().min(1).max(2147483647).safeParse(version).success
  )
    throw new CustodyStorageError("CUSTODY_INPUT_INVALID");
  return `${id}.${String(version)}.json`;
}
export class CustodyKeyStorage {
  constructor(
    private readonly config: Readonly<{
      storageRoot: string;
      currentKeyId: string;
      keyFiles: Readonly<Record<string, string>>;
      projectRoot: string;
    }>,
  ) {
    privateCustodyPath(
      { STORAGE_ROOT: config.storageRoot },
      "STORAGE_ROOT",
      config.projectRoot,
      "directory",
    );
  }
  private key(keyId: string): Buffer {
    const configured = this.config.keyFiles[keyId];
    if (!Object.hasOwn(this.config.keyFiles, keyId) || configured === undefined)
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    const path = privateCredentialFile(
      { KEY_FILE: configured },
      "KEY_FILE",
      this.config.projectRoot,
      32,
    );
    const key = readFileSync(path);
    if (key.length !== 32 || new Set(key).size < 8) {
      key.fill(0);
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    }
    return key;
  }
  decrypt(input: unknown): KeyPayload {
    const validation = envelopeSchema.safeParse(input);
    if (!validation.success)
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    const envelope = validation.data;
    try {
      const payload = payloadSchema.parse(
        openEnvelope(envelope, this.key(envelope.keyId)),
      );
      if (
        TronWeb.address.fromPrivateKey(payload.privateKey) !== payload.address
      )
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      return payload;
    } catch {
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    }
  }
  sealRecord(
    type: Exclude<RecoveryEnvelope["type"], "KEY_ASSIGNMENT">,
    objectId: string,
    payload: unknown,
  ): RecoveryEnvelope {
    return sealEnvelope(
      {
        format: 1,
        type,
        objectId: z.uuid().parse(objectId),
        version: 1,
        keyId: this.config.currentKeyId,
      },
      payload,
      this.key(this.config.currentKeyId),
    );
  }
  openRecord(input: unknown): unknown {
    const envelope = recoveryEnvelopeSchema.parse(input);
    return openEnvelope(envelope, this.key(envelope.keyId));
  }
  async readRecord(objectId: string): Promise<RecoveryEnvelope | null> {
    const bytes = await readProtectedFile(
      this.config.storageRoot,
      filename(objectId, 1),
      262144,
    );
    if (bytes === null) return null;
    const envelope = recoveryEnvelopeSchema.parse(
      JSON.parse(bytes.toString("utf8")),
    );
    if (envelope.objectId !== objectId || envelope.version !== 1)
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    this.openRecord(envelope);
    return envelope;
  }
  async storeRecord(input: RecoveryEnvelope): Promise<RecoveryEnvelope> {
    this.openRecord(input);
    const bytes = await publishProtectedFile(
      this.config.storageRoot,
      filename(input.objectId, input.version),
      envelopeBytes(input),
    );
    const stored = recoveryEnvelopeSchema.parse(
      JSON.parse(bytes.toString("utf8")),
    );
    this.openRecord(stored);
    if (envelopeDigest(stored) !== envelopeDigest(input))
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return stored;
  }
  async obtainRecord(input: RecoveryEnvelope): Promise<RecoveryEnvelope> {
    this.openRecord(input);
    const bytes = await publishProtectedFile(
      this.config.storageRoot,
      filename(input.objectId, input.version),
      envelopeBytes(input),
    );
    const winner = recoveryEnvelopeSchema.parse(
      JSON.parse(bytes.toString("utf8")),
    );
    if (
      winner.objectId !== input.objectId ||
      winner.version !== input.version ||
      winner.type !== input.type
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    this.openRecord(winner);
    return winner;
  }
  assertBinding(payload: KeyPayload, binding: KeyBinding): void {
    const {
      address: _address,
      privateKey: _privateKey,
      ...actualBinding
    } = payload;
    if (
      JSON.stringify(keyBindingSchema.parse(actualBinding)) !==
      JSON.stringify(keyBindingSchema.parse(binding))
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
  }
  async read(id: string, version: number): Promise<KeyEnvelope | null> {
    const contents = await readProtectedFile(
      this.config.storageRoot,
      filename(id, version),
      262144,
    );
    if (contents === null) return null;
    try {
      const envelope = envelopeSchema.parse(
        JSON.parse(contents.toString("utf8")),
      );
      if (envelope.objectId !== id || envelope.version !== version)
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      this.decrypt(envelope);
      return envelope;
    } catch {
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    }
  }
  async obtain(id: string, binding: KeyBinding) {
    const validBinding = keyBindingSchema.parse(binding);
    let envelope = await this.read(id, 1);
    if (envelope === null) {
      const account = await TronWeb.createAccount();
      const generated = this.encrypt(id, 1, {
        ...validBinding,
        address: account.address.base58,
        privateKey: account.privateKey,
      });
      const stored = await publishProtectedFile(
        this.config.storageRoot,
        filename(id, 1),
        envelopeBytes(generated),
      );
      envelope = envelopeSchema.parse(JSON.parse(stored.toString("utf8")));
    }
    const payload = this.decrypt(envelope);
    this.assertBinding(payload, validBinding);
    return { envelope, payload, digest: envelopeDigest(envelope) };
  }
  async importEnvelope(input: unknown): Promise<KeyEnvelope> {
    const validation = envelopeSchema.safeParse(input);
    if (!validation.success)
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    const envelope = validation.data;
    this.decrypt(envelope);
    const stored = await publishProtectedFile(
      this.config.storageRoot,
      filename(envelope.objectId, envelope.version),
      envelopeBytes(envelope),
    );
    const winner = envelopeSchema.parse(JSON.parse(stored.toString("utf8")));
    this.decrypt(winner);
    if (envelopeDigest(winner) !== envelopeDigest(envelope))
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return winner;
  }
  async rotate(
    envelope: KeyEnvelope,
  ): Promise<{ envelope: KeyEnvelope; digest: string }> {
    const payload = this.decrypt(envelope);
    const nextVersion = envelope.version + 1;
    let replacement = await this.read(envelope.objectId, nextVersion);
    if (replacement === null) {
      const generated = this.encrypt(envelope.objectId, nextVersion, payload);
      const stored = await publishProtectedFile(
        this.config.storageRoot,
        filename(envelope.objectId, nextVersion),
        envelopeBytes(generated),
      );
      replacement = envelopeSchema.parse(JSON.parse(stored.toString("utf8")));
    }
    if (
      replacement.objectId !== envelope.objectId ||
      replacement.version !== nextVersion ||
      replacement.keyId !== this.config.currentKeyId ||
      JSON.stringify(this.decrypt(replacement)) !== JSON.stringify(payload)
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return { envelope: replacement, digest: envelopeDigest(replacement) };
  }
  private encrypt(
    objectId: string,
    version: number,
    payload: KeyPayload,
  ): KeyEnvelope {
    filename(objectId, version);
    const header = {
      format: 1 as const,
      type: "KEY_ASSIGNMENT" as const,
      objectId,
      version,
      keyId: this.config.currentKeyId,
    };
    return envelopeSchema.parse(
      sealEnvelope(
        header,
        payloadSchema.parse(payload),
        this.key(header.keyId),
      ),
    );
  }
}
