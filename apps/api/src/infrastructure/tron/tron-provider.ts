import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { TronWeb } from "tronweb";
import { z } from "zod";
import type { TronWorkerConfig } from "../../core/config/tron.config.js";
import { TRANSFER_TOPIC } from "./tron-receipt.js";

const hash = z.string().regex(/^[0-9a-f]{64}$/u);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const blockSchema = z.object({
  blockID: hash,
  block_header: z.object({
    raw_data: z.object({ number: integer, timestamp: integer }),
  }),
});
// Protobuf JSON omits zero-valued fields in the genesis block only.
const genesisSchema = blockSchema.extend({
  block_header: z.object({
    raw_data: z.object({
      number: integer.default(0),
      timestamp: integer.default(0),
    }),
  }),
});
const objectSchema = z.record(z.string(), z.unknown());
const constantSchema = z.object({
  result: z.object({ result: z.literal(true) }),
  constant_result: z.array(z.string().regex(/^[0-9a-fA-F]{64}$/u)).length(1),
});
export type SolidifiedFloor = Readonly<{
  number: number;
  id: string;
  timestamp: number;
}>;
export type TronProviderFailureCode =
  | "TRON_INPUT_INVALID"
  | "TRON_IDENTITY_CONFLICT"
  | "TRON_UNAVAILABLE"
  | "TRON_UNFINALIZED"
  | "TRON_THROTTLED"
  | "TRON_MALFORMED"
  | "TRON_RESPONSE_LIMIT";
export class TronProviderError extends Error {
  constructor(readonly code: TronProviderFailureCode) {
    super(code);
  }
}
export class TronCursorRejected extends TronProviderError {
  constructor() {
    super("TRON_INPUT_INVALID");
  }
}
function parsed<T>(schema: z.ZodType<T>, payload: unknown): T {
  const validated = schema.safeParse(payload);
  if (!validated.success) throw new TronProviderError("TRON_MALFORMED");
  return validated.data;
}
function address(input: string): string {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/u.test(input) || !TronWeb.isAddress(input))
    throw new TronProviderError("TRON_INPUT_INVALID");
  return input;
}
function transactionId(input: string): string {
  if (!hash.safeParse(input).success)
    throw new TronProviderError("TRON_INPUT_INVALID");
  return input;
}
function transferParameter(recipient: string, amountUnits: bigint) {
  if (amountUnits <= 0n || amountUnits > 9223372036854775807n)
    throw new TronProviderError("TRON_INPUT_INVALID");
  return (
    TronWeb.address.toHex(address(recipient)).slice(2).padStart(64, "0") +
    amountUnits.toString(16).padStart(64, "0")
  );
}
function simulatedTransferSchema(
  source: string,
  treasury: string,
  amount: bigint,
  token: string,
) {
  const topic = (owner: string) =>
    TronWeb.address
      .toHex(address(owner))
      .slice(2)
      .toLowerCase()
      .padStart(64, "0");
  return z.object({
    address: z.literal(TronWeb.address.toHex(token).slice(2).toLowerCase()),
    topics: z.tuple([
      z.literal(TRANSFER_TOPIC),
      z.literal(topic(source)),
      z.literal(topic(treasury)),
    ]),
    data: z.literal(amount.toString(16).padStart(64, "0")),
  });
}
async function boundedJson(
  response: Response,
  maximumBytes: number,
): Promise<unknown> {
  if (response.body === null) throw new TronProviderError("TRON_MALFORMED");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const bytes: unknown = chunk.value;
      if (!(bytes instanceof Uint8Array))
        throw new TronProviderError("TRON_MALFORMED");
      size += bytes.byteLength;
      if (size > maximumBytes)
        throw new TronProviderError("TRON_RESPONSE_LIMIT");
      chunks.push(bytes);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new TronProviderError("TRON_MALFORMED");
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export class TronProvider {
  private readonly apiKey: string | null;
  constructor(
    private readonly config: TronWorkerConfig,
    private readonly request: typeof fetch = fetch,
  ) {
    if (config.providerApiKeyFile === null) {
      if (config.network === "TRON_MAINNET")
        throw new TronProviderError("TRON_INPUT_INVALID");
      this.apiKey = null;
      return;
    }
    this.apiKey = readFileSync(config.providerApiKeyFile, "utf8").trim();
    if (
      this.apiKey.length === 0 ||
      this.apiKey.length > 4096 ||
      /\p{Cc}/u.test(this.apiKey)
    )
      throw new TronProviderError("TRON_INPUT_INVALID");
  }

  // Identity is rechecked for each provisioning pass, including after a provider outage.
  async verifyIdentity(
    expected: Pick<TronWorkerConfig, "network" | "token"> = this.config,
  ): Promise<void> {
    if (
      expected.network !== this.config.network ||
      expected.token.contract !== this.config.token.contract
    )
      throw new TronProviderError("TRON_IDENTITY_CONFLICT");
    const genesis = await this.block(0);
    if (genesis.id !== this.config.genesisBlockId)
      throw new TronProviderError("TRON_IDENTITY_CONFLICT");
    const decimals = parsed(
      constantSchema,
      await this.call("/walletsolidity/triggerconstantcontract", {
        owner_address: this.config.token.contract,
        contract_address: this.config.token.contract,
        function_selector: "decimals()",
        visible: true,
      }),
    );
    if (BigInt(`0x${String(decimals.constant_result[0])}`) !== 6n)
      throw new TronProviderError("TRON_IDENTITY_CONFLICT");
  }
  async solidifiedFloor(): Promise<SolidifiedFloor> {
    await this.verifyIdentity();
    return this.blockResult(await this.call("/walletsolidity/getnowblock", {}));
  }
  async block(number: number): Promise<SolidifiedFloor> {
    if (!integer.safeParse(number).success)
      throw new TronProviderError("TRON_INPUT_INVALID");
    const solidified = this.blockResult(
      await this.call("/walletsolidity/getblockbynum", { num: number }),
      number === 0 ? genesisSchema : blockSchema,
    );
    if (solidified.number !== number)
      throw new TronProviderError("TRON_IDENTITY_CONFLICT");
    return solidified;
  }
  private blockResult(
    payload: unknown,
    schema: z.ZodType<z.output<typeof blockSchema>> = blockSchema,
  ): SolidifiedFloor {
    const raw = parsed(objectSchema, payload);
    if (Object.keys(raw).length === 0)
      throw new TronProviderError("TRON_UNFINALIZED");
    const block = parsed(schema, raw);
    return {
      number: block.block_header.raw_data.number,
      id: block.blockID,
      timestamp: block.block_header.raw_data.timestamp,
    };
  }
  async transaction(id: string): Promise<Record<string, unknown>> {
    return this.transactionEvidence(
      "/walletsolidity/gettransactionbyid",
      id,
      "txID",
    );
  }
  async transactionBlock(
    number: number,
  ): Promise<SolidifiedFloor & { transactionIds: string[] }> {
    if (!integer.safeParse(number).success)
      throw new TronProviderError("TRON_INPUT_INVALID");
    const payload = await this.call("/walletsolidity/getblockbynum", {
      num: number,
    });
    const floor = this.blockResult(payload);
    const block = parsed(
      blockSchema.extend({
        transactions: z.array(z.object({ txID: hash })).default([]),
      }),
      payload,
    );
    if (floor.number !== number)
      throw new TronProviderError("TRON_IDENTITY_CONFLICT");
    return {
      ...floor,
      transactionIds: block.transactions.map((transaction) => transaction.txID),
    };
  }
  async transactionInfo(id: string): Promise<Record<string, unknown>> {
    return this.transactionEvidence(
      "/walletsolidity/gettransactioninfobyid",
      id,
      "id",
    );
  }
  private async transactionEvidence(
    endpoint: string,
    id: string,
    identityField: string,
  ) {
    const expected = transactionId(id);
    const evidence = parsed(
      objectSchema,
      await this.call(endpoint, { value: expected }),
    );
    if (Object.keys(evidence).length === 0)
      throw new TronProviderError("TRON_UNFINALIZED");
    if (evidence[identityField] !== expected)
      throw new TronProviderError("TRON_IDENTITY_CONFLICT");
    return evidence;
  }
  async account(owner: string): Promise<Record<string, unknown>> {
    return parsed(
      objectSchema,
      await this.call("/walletsolidity/getaccount", {
        address: address(owner),
        visible: true,
      }),
    );
  }
  async resources(owner: string): Promise<Record<string, unknown>> {
    return parsed(
      objectSchema,
      await this.call("/wallet/getaccountresource", {
        address: address(owner),
        visible: true,
      }),
    );
  }
  async chainParameters(): Promise<Record<string, unknown>> {
    return parsed(
      objectSchema,
      await this.call("/wallet/getchainparameters", {}),
    );
  }
  async tokenBalance(owner: string): Promise<bigint> {
    const parameter = TronWeb.address
      .toHex(address(owner))
      .slice(2)
      .padStart(64, "0");
    const balance = parsed(
      constantSchema,
      await this.call("/walletsolidity/triggerconstantcontract", {
        owner_address: owner,
        contract_address: this.config.token.contract,
        function_selector: "balanceOf(address)",
        parameter,
        visible: true,
      }),
    );
    return BigInt(`0x${String(balance.constant_result[0])}`);
  }
  async sweepAccount(owner: string): Promise<Record<string, unknown>> {
    return parsed(
      objectSchema,
      await this.call("/wallet/getaccount", {
        address: address(owner),
        visible: true,
      }),
    );
  }
  async buildSweep(
    source: string,
    treasury: string,
    amountUnits: bigint,
    feeLimitSun: bigint,
  ): Promise<unknown> {
    const parameter = transferParameter(treasury, amountUnits);
    if (feeLimitSun <= 0n || feeLimitSun > BigInt(Number.MAX_SAFE_INTEGER))
      throw new TronProviderError("TRON_INPUT_INVALID");
    const response = parsed(
      z.object({
        result: z.object({ result: z.literal(true) }),
        transaction: objectSchema,
      }),
      await this.call("/wallet/triggersmartcontract", {
        owner_address: TronWeb.address.toHex(address(source)),
        contract_address: TronWeb.address.toHex(this.config.token.contract),
        function_selector: "transfer(address,uint256)",
        parameter,
        call_value: 0,
        fee_limit: Number(feeLimitSun),
        visible: false,
      }),
    );
    return response.transaction;
  }
  async estimateSweep(
    source: string,
    treasury: string,
    amountUnits: bigint,
  ): Promise<number> {
    const parameter = transferParameter(treasury, amountUnits);
    const estimate = parsed(
      z.object({
        result: z.object({ result: z.literal(true) }),
        energy_used: integer.positive(),
        // Simulation omits protobuf SUCESS=0; ABI return bytes do not prove a transfer.
        transaction: z.object({
          ret: z
            .array(
              z.object({
                ret: z.literal("SUCESS").default("SUCESS"),
                contractRet: z.literal("SUCCESS").optional(),
              }),
            )
            .length(1),
        }),
        logs: z
          .array(
            simulatedTransferSchema(
              source,
              treasury,
              amountUnits,
              this.config.token.contract,
            ),
          )
          .length(1),
      }),
      await this.call("/wallet/triggerconstantcontract", {
        owner_address: TronWeb.address.toHex(address(source)),
        contract_address: TronWeb.address.toHex(this.config.token.contract),
        function_selector: "transfer(address,uint256)",
        parameter,
        visible: false,
      }),
    );
    return estimate.energy_used;
  }
  async broadcastSweep(transaction: Record<string, unknown>): Promise<boolean> {
    // Every send has its own durable admission. Network retries belong to the treasury owner.
    const response = parsed(
      z.object({ result: z.boolean(), txid: hash.optional() }),
      await this.call("/wallet/broadcasttransaction", transaction, 1),
    );
    if (response.result && response.txid !== transaction["txID"])
      throw new TronProviderError("TRON_IDENTITY_CONFLICT");
    return response.result;
  }
  buildTransfer(
    source: string,
    recipient: string,
    amountUnits: bigint,
    feeLimitSun: bigint,
  ) {
    return this.buildSweep(source, recipient, amountUnits, feeLimitSun);
  }
  estimateTransfer(source: string, recipient: string, amountUnits: bigint) {
    return this.estimateSweep(source, recipient, amountUnits);
  }
  broadcastTransfer(transaction: Record<string, unknown>) {
    return this.broadcastSweep(transaction);
  }
  async discover(
    window: Readonly<{
      address: string;
      from: number;
      to: number;
      fingerprint?: string;
    }>,
  ) {
    if (
      !integer.safeParse(window.from).success ||
      !integer.safeParse(window.to).success ||
      window.to < window.from ||
      (window.fingerprint !== undefined &&
        (window.fingerprint.length === 0 ||
          window.fingerprint.length > 2048 ||
          /\p{Cc}/u.test(window.fingerprint)))
    )
      throw new TronProviderError("TRON_INPUT_INVALID");
    const query = new URLSearchParams({
      only_to: "true",
      only_confirmed: "true",
      contract_address: this.config.token.contract,
      min_timestamp: String(window.from),
      max_timestamp: String(window.to),
      order_by: "block_timestamp,asc",
      limit: String(this.config.discoveryPageSize),
    });
    if (window.fingerprint !== undefined)
      query.set("fingerprint", window.fingerprint);
    const page = parsed(
      z.object({
        success: z.literal(true),
        data: z
          .array(z.object({ transaction_id: hash, block_timestamp: integer }))
          .max(this.config.discoveryPageSize),
        meta: z.object({ fingerprint: z.string().min(1).max(2048).optional() }),
      }),
      await this.call(
        `/v1/accounts/${address(window.address)}/transactions/trc20?${query.toString()}`,
      ),
    );
    if (
      page.data.some(
        (entry) =>
          entry.block_timestamp < window.from ||
          entry.block_timestamp > window.to,
      )
    )
      throw new TronProviderError("TRON_MALFORMED");
    return {
      transactions: page.data.map((entry) => ({
        transactionId: entry.transaction_id,
        timestamp: entry.block_timestamp,
      })),
      fingerprint: page.meta.fingerprint ?? null,
    };
  }
  private async call(
    endpoint: string,
    body?: Record<string, unknown>,
    maximumAttempts = this.config.maximumAttempts,
  ): Promise<unknown> {
    for (let attempt = 0; attempt < maximumAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.config.providerTimeoutMs);
      try {
        const response = await this.request(
          new URL(endpoint, this.config.providerUrl),
          {
            method: body === undefined ? "GET" : "POST",
            redirect: "error",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              ...(this.apiKey === null
                ? {}
                : { "TRON-PRO-API-KEY": this.apiKey }),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          },
        );
        if (response.status === 429 || response.status >= 500) {
          await response.body?.cancel();
          const code =
            response.status === 429 ? "TRON_THROTTLED" : "TRON_UNAVAILABLE";
          if (attempt + 1 === maximumAttempts)
            throw new TronProviderError(code);
          const retryAfter = response.headers.get("Retry-After");
          const seconds =
            retryAfter !== null && /^\d{1,5}$/u.test(retryAfter)
              ? Number(retryAfter)
              : null;
          await delay(
            seconds === null
              ? Math.min(250 * 2 ** attempt, 2000)
              : Math.min(seconds * 1000, 2000),
          );
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          if (
            response.status === 400 &&
            new URL(endpoint, this.config.providerUrl).searchParams.has(
              "fingerprint",
            )
          )
            throw new TronCursorRejected();
          throw new TronProviderError("TRON_UNAVAILABLE");
        }
        const payload = await boundedJson(
          response,
          this.config.maximumResponseBytes,
        );
        const shape = parsed(objectSchema, payload);
        if ("Error" in shape || "error" in shape)
          throw new TronProviderError("TRON_MALFORMED");
        return shape;
      } catch (failure) {
        if (failure instanceof TronProviderError) throw failure;
        if (
          !(failure instanceof TypeError) &&
          !(failure instanceof DOMException)
        )
          throw failure;
        if (attempt + 1 === maximumAttempts)
          throw new TronProviderError("TRON_UNAVAILABLE");
        await delay(Math.min(250 * 2 ** attempt, 2000));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new TronProviderError("TRON_UNAVAILABLE");
  }
}
