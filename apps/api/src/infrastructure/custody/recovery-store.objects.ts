import type { RecoveryEnvelope } from "./encrypted-envelope.js";
import { randomUUID } from "node:crypto";
import { opendir } from "node:fs/promises";
import type { z } from "zod";
import { envelopeBytes, envelopeDigest } from "./key-storage.js";
import {
  assertPrivateRoot,
  CustodyStorageError,
  publishProtectedFile,
  readProtectedFile,
} from "./protected-files.js";
import {
  recoveryRequestSchema,
  recoveryResponseSchema,
  type RecoveryRequest,
  type RecoveryResponse,
} from "./recovery-store.protocol.js";

const storedSchema = recoveryResponseSchema.options[1];
export class RecoveryObjectStore {
  constructor(private readonly root: string) {}
  async execute(input: RecoveryRequest): Promise<RecoveryResponse> {
    const request = recoveryRequestSchema.parse(input);
    await assertPrivateRoot(this.root);
    if (request.operation === "PUT")
      return this.put(request.envelope, request.digest);
    if (request.operation === "GET")
      return this.get(`${request.objectId}.${String(request.version)}.json`);
    return this.list(request);
  }
  private async get(name: string) {
    const contents = await readProtectedFile(this.root, name, 262144);
    if (contents === null) throw new CustodyStorageError("RECOVERY_NOT_FOUND");
    try {
      const stored = storedSchema.parse(JSON.parse(contents.toString("utf8")));
      if (
        `${stored.objectId}.${String(stored.version)}.json` !== name ||
        stored.envelope.objectId !== stored.objectId ||
        stored.envelope.version !== stored.version ||
        envelopeDigest(stored.envelope) !== stored.digest
      )
        throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
      return stored;
    } catch {
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    }
  }
  private async put(envelope: RecoveryEnvelope, digest: string) {
    if (
      envelopeDigest(envelope) !== digest ||
      envelopeBytes(envelope).length > 250000
    )
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    const stored = {
      operation: "GET" as const,
      protocolVersion: 1 as const,
      type: envelope.type,
      objectId: envelope.objectId,
      version: envelope.version,
      digest,
      ackId: randomUUID(),
      acknowledgedAt: new Date().toISOString(),
      envelope,
    };
    const name = `${envelope.objectId}.${String(envelope.version)}.json`;
    await publishProtectedFile(
      this.root,
      name,
      Buffer.from(JSON.stringify(stored)),
    );
    const readback = await this.get(name);
    if (readback.digest !== digest)
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    const { envelope: _envelope, ...ack } = readback;
    return { ...ack, operation: "PUT" as const };
  }
  private async list(
    request: Extract<RecoveryRequest, { operation: "LIST" }>,
  ): Promise<RecoveryResponse> {
    const candidates: string[] = [];
    const directory = await opendir(this.root);
    // Selection stays bounded even when the retained archive grows.
    for await (const entry of directory) {
      if (!/^[0-9a-f-]{36}\.[1-9][0-9]{0,9}\.json$/u.test(entry.name)) continue;
      const stored = await this.get(entry.name);
      if (stored.type !== request.type) continue;
      const identity = entry.name.slice(0, -5);
      if (request.cursor !== undefined && identity <= request.cursor) continue;
      candidates.push(identity);
      candidates.sort();
      if (candidates.length > request.limit + 1) candidates.pop();
    }
    const page = candidates.slice(0, request.limit);
    const records: z.infer<
      (typeof recoveryResponseSchema.options)[2]
    >["records"] = [];
    for (const identity of page) {
      const stored = await this.get(`${identity}.json`);
      records.push({
        type: stored.type,
        objectId: stored.objectId,
        version: stored.version,
        digest: stored.digest,
      });
    }
    return {
      operation: "LIST",
      protocolVersion: 1,
      records,
      cursor: candidates.length > request.limit ? (page.at(-1) ?? null) : null,
    };
  }
}
