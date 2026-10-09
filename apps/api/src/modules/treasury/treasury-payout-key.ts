import { TronWeb } from "tronweb";
import { z } from "zod";
import type { DatabaseClient } from "@template/database";
import type { TronPayoutConfig } from "../../core/config/tron.config.js";
import { envelopeDigest } from "../../infrastructure/custody/key-storage.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import { treasuryAuthority } from "./treasury.service.js";
import { treasuryCommandSchema } from "./treasury.intent.js";
import {
  acknowledgePayoutRecord,
  retainedPayoutRecord,
  type PayoutStores,
} from "../withdrawals/payout-records.js";

export const treasuryKeyPayloadSchema = z
  .object({
    keyRecordId: z.uuid(),
    network: z.enum(["TRON_MAINNET", "TRON_SHASTA", "TRON_NILE"]),
    tokenContract: z.string(),
    source: z.string(),
    privateKey: z.string().regex(/^[0-9a-f]{64}$/u),
    createdAt: z.iso.datetime(),
  })
  .strict();
export async function provisionTreasuryPayoutKey(
  database: DatabaseClient,
  config: TronPayoutConfig,
  context: Readonly<{
    stores: PayoutStores;
    operatorIdentity: string;
    input: unknown;
  }>,
) {
  const command = treasuryCommandSchema.parse(context.input);
  if (
    command.operation !== "PROVISION_PAYOUT_KEY" ||
    TronWeb.address.fromPrivateKey(command.privateKey) !== config.treasury
  )
    throw new TreasuryPolicyError("PAYOUT_KEY_CONFLICT");
  await database.$transaction((tx) =>
    treasuryAuthority(tx, "p06_recovery_operator"),
  );
  let envelope = await retainedPayoutRecord(
    context.stores,
    config.treasuryKeyId,
    "TREASURY_KEY",
  );
  if (envelope === null)
    envelope = await context.stores.keys.obtainRecord(
      context.stores.keys.sealRecord(
        "TREASURY_KEY",
        config.treasuryKeyId,
        treasuryKeyPayloadSchema.parse({
          keyRecordId: config.treasuryKeyId,
          network: config.network,
          tokenContract: config.token.contract,
          source: config.treasury,
          privateKey: command.privateKey.toLowerCase(),
          createdAt: new Date().toISOString(),
        }),
      ),
    );
  const payload = treasuryKeyPayloadSchema.parse(
    context.stores.keys.openRecord(envelope),
  );
  if (
    envelope.type !== "TREASURY_KEY" ||
    payload.keyRecordId !== config.treasuryKeyId ||
    payload.network !== config.network ||
    payload.tokenContract !== config.token.contract ||
    payload.source !== config.treasury ||
    TronWeb.address.fromPrivateKey(payload.privateKey) !== config.treasury
  )
    throw new TreasuryPolicyError("PAYOUT_KEY_CONFLICT");
  const ack = await acknowledgePayoutRecord(context.stores, envelope);
  return database.$transaction(async (tx) => {
    await treasuryAuthority(tx, "p06_recovery_operator");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(606081::bigint)`;
    const saved = await tx.treasuryPayoutKey.findUnique({
      where: { id: config.treasuryKeyId },
    });
    if (saved !== null) {
      if (
        saved.envelopeDigest !== envelopeDigest(envelope) ||
        saved.network !== payload.network ||
        saved.tokenContract !== payload.tokenContract ||
        saved.source !== payload.source
      )
        throw new TreasuryPolicyError("PAYOUT_KEY_CONFLICT");
      return saved;
    }
    return tx.treasuryPayoutKey.create({
      data: {
        id: config.treasuryKeyId,
        network: payload.network,
        tokenContract: payload.tokenContract,
        source: payload.source,
        envelopeId: envelope.objectId,
        envelopeDigest: envelopeDigest(envelope),
        recoveryAckId: ack.ackId,
        recoveryDigest: ack.digest,
        recoveryAcknowledgedAt: new Date(ack.acknowledgedAt),
        operatorIdentity: context.operatorIdentity,
        reason: command.reason,
        createdAt: new Date(),
      },
    });
  });
}
