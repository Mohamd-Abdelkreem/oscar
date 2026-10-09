import { z } from "zod";
import { envelopeDigest } from "./key-storage.js";
import {
  recoveryEnvelopeSchema as envelopeSchema,
  recoveryRecordTypeSchema,
} from "./encrypted-envelope.js";
import { CustodyStorageError } from "./protected-files.js";

const identity = {
  objectId: z.uuid(),
  version: z.number().int().min(1).max(2147483647),
};
const digest = z.string().regex(/^[0-9a-f]{64}$/u);
const cursor = z.string().regex(/^[0-9a-f-]{36}\.[1-9][0-9]{0,9}$/u);
const recordSchema = z
  .object({
    ...identity,
    type: recoveryRecordTypeSchema,
    digest,
  })
  .strict();
const ack = {
  ...identity,
  type: recoveryRecordTypeSchema,
  digest,
  ackId: z.uuid(),
  acknowledgedAt: z.iso.datetime(),
  protocolVersion: z.literal(1),
};
export const recoveryRequestSchema = z.discriminatedUnion("operation", [
  z
    .object({ operation: z.literal("PUT"), envelope: envelopeSchema, digest })
    .strict(),
  z.object({ operation: z.literal("GET"), ...identity }).strict(),
  z
    .object({
      operation: z.literal("LIST"),
      type: recoveryRecordTypeSchema,
      limit: z.number().int().min(1).max(100),
      cursor: cursor.optional(),
    })
    .strict(),
]);
export const recoveryResponseSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("PUT"), ...ack }).strict(),
  z
    .object({ operation: z.literal("GET"), ...ack, envelope: envelopeSchema })
    .strict(),
  z
    .object({
      operation: z.literal("LIST"),
      protocolVersion: z.literal(1),
      records: z.array(recordSchema).max(100),
      cursor: cursor.nullable(),
    })
    .strict(),
]);
export type RecoveryRequest = z.infer<typeof recoveryRequestSchema>;
export type RecoveryResponse = z.infer<typeof recoveryResponseSchema>;
export type RecoveryAck = Extract<RecoveryResponse, { operation: "PUT" }>;
export function validateRecoveryResponse(
  request: RecoveryRequest,
  input: unknown,
): RecoveryResponse {
  const parsed = recoveryResponseSchema.safeParse(input);
  if (!parsed.success || parsed.data.operation !== request.operation)
    throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
  const response = parsed.data;
  if (
    response.operation === "PUT" &&
    request.operation === "PUT" &&
    (response.objectId !== request.envelope.objectId ||
      response.version !== request.envelope.version ||
      response.digest !== request.digest ||
      response.type !== request.envelope.type)
  )
    throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
  if (
    response.operation === "GET" &&
    request.operation === "GET" &&
    (response.objectId !== request.objectId ||
      response.version !== request.version ||
      response.envelope.objectId !== request.objectId ||
      response.envelope.version !== request.version ||
      response.type !== response.envelope.type ||
      envelopeDigest(response.envelope) !== response.digest)
  )
    throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
  if (
    response.operation === "LIST" &&
    request.operation === "LIST" &&
    (response.records.length > request.limit ||
      response.records.some(
        (record, index) =>
          (request.cursor !== undefined &&
            `${record.objectId}.${String(record.version)}` <= request.cursor) ||
          (index > 0 &&
            `${record.objectId}.${String(record.version)}` <=
              `${String(response.records[index - 1]?.objectId)}.${String(response.records[index - 1]?.version)}`),
      ) ||
      (response.cursor !== null &&
        response.cursor !==
          `${String(response.records.at(-1)?.objectId)}.${String(response.records.at(-1)?.version)}`))
  )
    throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
  return response;
}
