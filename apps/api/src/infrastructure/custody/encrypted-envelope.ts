import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { CustodyStorageError } from "./protected-files.js";

export const recoveryRecordTypeSchema = z.enum([
  "KEY_ASSIGNMENT",
  "SIGNED_ATTEMPT",
  "BROADCAST_INTENT",
  "TREASURY_KEY",
  "PAYOUT_SIGNED_ATTEMPT",
  "PAYOUT_BROADCAST_INTENT",
]);
export const recoveryEnvelopeSchema = z
  .object({
    format: z.literal(1),
    type: recoveryRecordTypeSchema,
    objectId: z.uuid(),
    version: z.number().int().min(1).max(2147483647),
    keyId: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/u),
    nonce: z.string().regex(/^[0-9a-f]{24}$/u),
    ciphertext: z
      .string()
      .regex(
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u,
      )
      .min(4)
      .max(250000),
    tag: z.string().regex(/^[0-9a-f]{32}$/u),
  })
  .strict();
export type RecoveryEnvelope = z.infer<typeof recoveryEnvelopeSchema>;
type Header = Pick<
  RecoveryEnvelope,
  "format" | "type" | "objectId" | "version" | "keyId"
>;
function context(envelope: Header): Buffer {
  return Buffer.from(
    JSON.stringify({
      format: envelope.format,
      type: envelope.type,
      objectId: envelope.objectId,
      version: envelope.version,
      keyId: envelope.keyId,
    }),
  );
}
export function sealEnvelope(
  header: Header,
  payload: unknown,
  key: Buffer,
): RecoveryEnvelope {
  const nonce = randomBytes(12);
  const plaintext = Buffer.from(JSON.stringify(payload));
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(context(header));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    return recoveryEnvelopeSchema.parse({
      ...header,
      nonce: nonce.toString("hex"),
      ciphertext: ciphertext.toString("base64"),
      tag: cipher.getAuthTag().toString("hex"),
    });
  } finally {
    plaintext.fill(0);
    key.fill(0);
  }
}
export function openEnvelope(envelope: RecoveryEnvelope, key: Buffer): unknown {
  try {
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(envelope.nonce, "hex"),
    );
    cipher.setAAD(context(envelope));
    cipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
    const plaintext = Buffer.concat([
      cipher.update(Buffer.from(envelope.ciphertext, "base64")),
      cipher.final(),
    ]);
    try {
      return JSON.parse(plaintext.toString("utf8"));
    } finally {
      plaintext.fill(0);
    }
  } catch {
    throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
  } finally {
    key.fill(0);
  }
}
