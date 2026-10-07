import { TronWeb, Types, utils } from "tronweb";
import { z } from "zod";

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hexAddress = z.string().regex(/^41[0-9a-fA-F]{40}$/u);
const contractSchema = z
  .object({
    type: z.literal(Types.ContractType.TriggerSmartContract),
    Permission_id: z.literal(0).default(0),
    parameter: z
      .object({
        type_url: z.literal(
          "type.googleapis.com/protocol.TriggerSmartContract",
        ),
        value: z
          .object({
            owner_address: hexAddress,
            contract_address: hexAddress,
            data: z.string().regex(/^a9059cbb[0-9a-f]{128}$/u),
            call_value: z.literal(0).default(0),
            call_token_value: z.literal(0).default(0),
            token_id: z.literal(0).default(0),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export const sweepTransactionSchema = z
  .object({
    visible: z.literal(false).default(false),
    txID: z.string().regex(/^[0-9a-f]{64}$/u),
    raw_data_hex: z
      .string()
      .regex(/^(?:[0-9a-f]{2})+$/u)
      .max(16384),
    raw_data: z
      .object({
        contract: z.array(contractSchema).length(1),
        ref_block_bytes: z.string().regex(/^[0-9a-f]{4}$/u),
        ref_block_hash: z.string().regex(/^[0-9a-f]{16}$/u),
        timestamp: integer,
        expiration: integer,
        fee_limit: integer,
      })
      .strict(),
    signature: z
      .array(z.string().regex(/^[0-9a-fA-F]{130}$/u))
      .length(1)
      .optional(),
  })
  .strict();
export type SweepTransaction = z.infer<typeof sweepTransactionSchema>;
export type SweepMovement = Readonly<{
  source: string;
  tokenContract: string;
  treasury: string;
  amountUnits: bigint;
}>;
export class TreasuryPolicyError extends Error {
  constructor(readonly code = "TREASURY_POLICY_CONFLICT") {
    super(code);
  }
}
export function transferCalldata(
  treasury: string,
  amountUnits: bigint,
): string {
  if (
    !TronWeb.isAddress(treasury) ||
    amountUnits <= 0n ||
    amountUnits > 9223372036854775807n
  )
    throw new TreasuryPolicyError();
  return `a9059cbb${TronWeb.address.toHex(treasury).slice(2).toLowerCase().padStart(64, "0")}${amountUnits.toString(16).padStart(64, "0")}`;
}
export function assertSweepTransaction(
  input: unknown,
  intent: SweepMovement,
  policy: Readonly<{
    now: number;
    maximumFeeSun: bigint;
    signed: boolean;
    historical?: boolean;
  }>,
): SweepTransaction {
  try {
    const tx = sweepTransactionSchema.parse(input);
    const contract = tx.raw_data.contract[0];
    if (contract === undefined) throw new TreasuryPolicyError();
    const value = contract.parameter.value;
    if (
      value.owner_address.toLowerCase() !==
        TronWeb.address.toHex(intent.source).toLowerCase() ||
      value.contract_address.toLowerCase() !==
        TronWeb.address.toHex(intent.tokenContract).toLowerCase() ||
      value.data !== transferCalldata(intent.treasury, intent.amountUnits) ||
      BigInt(tx.raw_data.fee_limit) > policy.maximumFeeSun ||
      tx.raw_data.fee_limit === 0 ||
      tx.raw_data.expiration <= tx.raw_data.timestamp ||
      tx.raw_data.expiration - tx.raw_data.timestamp > 600000 ||
      (!policy.historical &&
        (tx.raw_data.timestamp > policy.now + 30000 ||
          tx.raw_data.timestamp < policy.now - 60000 ||
          tx.raw_data.expiration <= policy.now)) ||
      (policy.signed
        ? tx.signature === undefined
        : tx.signature !== undefined) ||
      !utils.transaction.txCheck(tx)
    )
      throw new TreasuryPolicyError();
    if (
      policy.signed &&
      (tx.signature?.[0] === undefined ||
        TronWeb.address.fromHex(
          utils.crypto.ecRecover(tx.txID, tx.signature[0]),
        ) !== intent.source)
    )
      throw new TreasuryPolicyError();
    return tx;
  } catch {
    throw new TreasuryPolicyError();
  }
}

// This adapter has no process/environment initialization and never broadcasts.
// The caller must supply a recovered key only after durable intent/resource admission.
export async function signSweepTransaction(
  input: unknown,
  intent: SweepMovement,
  policy: Readonly<{ now: number; maximumFeeSun: bigint }>,
  privateKey: string,
): Promise<SweepTransaction> {
  const { signature: _signature, ...unsigned } = assertSweepTransaction(
    input,
    intent,
    { ...policy, signed: false },
  );
  if (TronWeb.address.fromPrivateKey(privateKey) !== intent.source)
    throw new TreasuryPolicyError();
  const sdk = new TronWeb({ fullHost: "https://nile.trongrid.io" });
  // trx.sign is local in pinned 6.5.1; no defaultPrivateKey or network call is used.
  const returned = await sdk.trx.sign(unsigned, privateKey);
  const signed = assertSweepTransaction(returned, intent, {
    ...policy,
    signed: true,
  });
  if (
    signed.txID !== unsigned.txID ||
    signed.raw_data_hex !== unsigned.raw_data_hex ||
    JSON.stringify(signed.raw_data) !== JSON.stringify(unsigned.raw_data)
  )
    throw new TreasuryPolicyError();
  return signed;
}
