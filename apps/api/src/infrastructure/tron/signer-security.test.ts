import { createLogger } from "../logger/logger.js";
import { RuntimeSignals } from "../logger/runtime-signals.js";
import {
  actualSweepBandwidth,
  sameSweepEvidence,
} from "../../modules/treasury/treasury-reconciliation.evidence.js";
import { treasuryCommandSchema } from "../../modules/treasury/treasury.intent.js";
import {
  payoutIntentSchema,
  payoutPolicySchema,
} from "../../modules/withdrawals/withdrawal-payout.intent.js";
import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TronWeb, utils } from "tronweb";
import {
  assertTransferTransaction,
  signTransferTransaction,
  signRetainedTransferTransaction,
} from "./tron-signer.js";
import {
  assertSweepTransaction,
  signSweepTransaction,
  transferCalldata,
} from "./tron-signer.js";

const key = randomBytes(32).toString("hex");
const source = String(TronWeb.address.fromPrivateKey(key));
const treasury = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
const tokenContract = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
const now = 1800000000000;
const intent = { source, treasury, tokenContract, amountUnits: 1000001n };
function transaction() {
  const raw_data = {
    contract: [
      {
        type: "TriggerSmartContract",
        parameter: {
          type_url: "type.googleapis.com/protocol.TriggerSmartContract",
          value: {
            owner_address: TronWeb.address.toHex(source),
            contract_address: TronWeb.address.toHex(tokenContract),
            data: transferCalldata(treasury, intent.amountUnits),
            call_value: 0,
          },
        },
      },
    ],
    ref_block_bytes: "0001",
    ref_block_hash: "1234567890abcdef",
    timestamp: now,
    expiration: now + 60000,
    fee_limit: 1000000,
  };
  const tx = { visible: false, txID: "", raw_data, raw_data_hex: "" };
  const pb: unknown = utils.transaction.txJsonToPb(tx);
  tx.raw_data_hex = utils.transaction.txPbToRawDataHex(pb).toLowerCase();
  tx.txID = utils.transaction.txPbToTxID(pb).replace(/^0x/u, "");
  return tx;
}
function contract(tx: ReturnType<typeof transaction>) {
  const value = tx.raw_data.contract[0];
  if (value === undefined) throw new Error("Fixture contract missing");
  return value;
}
const options = { now, maximumFeeSun: 1000000n, signed: false };
describe("independent treasury signing policy", () => {
  it("signs the original retained unexpired body after the fresh-build window and refuses expiry or future time", async () => {
    const original = transaction();
    original.raw_data.expiration = now + 600000;
    const protobuf: unknown = utils.transaction.txJsonToPb(original);
    original.raw_data_hex = utils.transaction
      .txPbToRawDataHex(protobuf)
      .toLowerCase();
    original.txID = utils.transaction.txPbToTxID(protobuf).replace(/^0x/u, "");
    const movement = {
      source,
      recipient: treasury,
      tokenContract,
      amountUnits: intent.amountUnits,
    };
    await expect(
      signTransferTransaction(
        original,
        movement,
        { ...options, now: now + 90000 },
        key,
      ),
    ).rejects.toThrow();
    const signed = await signRetainedTransferTransaction(
      original,
      movement,
      { ...options, now: now + 90000 },
      key,
    );
    expect(signed.txID).toBe(original.txID);
    expect(signed.raw_data_hex).toBe(original.raw_data_hex);
    expect(() =>
      signRetainedTransferTransaction(
        original,
        movement,
        { ...options, now: now + 600000 },
        key,
      ),
    ).toThrow();
    expect(() =>
      signRetainedTransferTransaction(
        original,
        movement,
        { ...options, now: now - 31000 },
        key,
      ),
    ).toThrow();
  });
  it("signs supplied original payout recipient/net and rejects other recipient, net, source or company cap", async () => {
    const movement = {
      source,
      recipient: treasury,
      tokenContract,
      amountUnits: intent.amountUnits,
    };
    const signed = await signTransferTransaction(
      transaction(),
      movement,
      options,
      key,
    );
    expect(
      assertTransferTransaction(signed, movement, { ...options, signed: true })
        .txID,
    ).toBe(signed.txID);
    for (const patch of [
      { recipient: source },
      { source: treasury },
      { amountUnits: intent.amountUnits + 1n },
    ])
      expect(() =>
        assertTransferTransaction(
          signed,
          { ...movement, ...patch },
          { ...options, signed: true },
        ),
      ).toThrow();
    expect(() =>
      assertTransferTransaction(signed, movement, {
        ...options,
        maximumFeeSun: 1n,
        signed: true,
      }),
    ).toThrow();
  });
  it("validates exact calldata and persists the returned installed-SDK signed object", async () => {
    const { signature: _signature, ...unsigned } = assertSweepTransaction(
      transaction(),
      intent,
      options,
    );
    const sdk = new TronWeb({ fullHost: "https://nile.trongrid.io" });
    const returned = await sdk.trx.sign(unsigned, key);
    const signed = assertSweepTransaction(returned, intent, {
      ...options,
      signed: true,
    });
    expect(signed.signature).toHaveLength(1);
    expect("signature" in unsigned).toBe(false);
    expect(signed.txID).toBe(unsigned.txID);
    expect(signed.raw_data_hex).toBe(unsigned.raw_data_hex);
    if (signed.signature === undefined)
      throw new Error("Expected signed transaction");
    expect(sdk.trx.ecRecover({ ...signed, signature: signed.signature })).toBe(
      source,
    );
    expect(JSON.stringify(signed)).not.toContain(key);
  });
  it.each([
    [
      "source",
      (tx: ReturnType<typeof transaction>) => {
        contract(tx).parameter.value.owner_address =
          TronWeb.address.toHex(treasury);
      },
    ],
    [
      "token",
      (tx: ReturnType<typeof transaction>) => {
        contract(tx).parameter.value.contract_address =
          TronWeb.address.toHex(treasury);
      },
    ],
    [
      "recipient",
      (tx: ReturnType<typeof transaction>) => {
        contract(tx).parameter.value.data = transferCalldata(source, 1000001n);
      },
    ],
    [
      "amount",
      (tx: ReturnType<typeof transaction>) => {
        contract(tx).parameter.value.data = transferCalldata(
          treasury,
          1000000n,
        );
      },
    ],
    [
      "value",
      (tx: ReturnType<typeof transaction>) => {
        contract(tx).parameter.value.call_value = 1;
      },
    ],
    [
      "multiple contracts",
      (tx: ReturnType<typeof transaction>) => {
        tx.raw_data.contract.push(contract(tx));
      },
    ],
    [
      "expiration",
      (tx: ReturnType<typeof transaction>) => {
        tx.raw_data.expiration = now;
      },
    ],
    [
      "fee",
      (tx: ReturnType<typeof transaction>) => {
        tx.raw_data.fee_limit++;
      },
    ],
    [
      "TAPOS",
      (tx: ReturnType<typeof transaction>) => {
        tx.raw_data.ref_block_hash = "1234";
      },
    ],
    [
      "identity",
      (tx: ReturnType<typeof transaction>) => {
        tx.txID = "a".repeat(64);
      },
    ],
  ])("rejects altered %s before signing", (_name, mutate) => {
    const tx = transaction();
    mutate(tx);
    expect(() => assertSweepTransaction(tx, intent, options)).toThrow(
      "TREASURY_POLICY_CONFLICT",
    );
  });
  it("rejects arbitrary signing input, permission changes and TRC10 authority", () => {
    for (const extra of [{ Permission_id: 2 }, { unknown: true }]) {
      const tx = transaction();
      Object.assign(contract(tx), extra);
      expect(() => assertSweepTransaction(tx, intent, options)).toThrow(
        "TREASURY_POLICY_CONFLICT",
      );
    }
    for (const extra of [{ token_id: 1 }, { call_token_value: 1 }]) {
      const tx = transaction();
      Object.assign(contract(tx).parameter.value, extra);
      expect(() => assertSweepTransaction(tx, intent, options)).toThrow(
        "TREASURY_POLICY_CONFLICT",
      );
    }
    expect(() => assertSweepTransaction(key, intent, options)).toThrow(
      "TREASURY_POLICY_CONFLICT",
    );
  });
  it("rejects a signature from another key and unsigned caller signatures", async () => {
    const signed = await signSweepTransaction(
      transaction(),
      intent,
      options,
      key,
    );
    expect(() => assertSweepTransaction(signed, intent, options)).toThrow();
    const wrong = utils.crypto.signTransaction(randomBytes(32), transaction());
    expect(() =>
      assertSweepTransaction(wrong, intent, { ...options, signed: true }),
    ).toThrow();
    expect(() =>
      assertSweepTransaction(
        { ...signed, signature: ["00".repeat(65)] },
        intent,
        { ...options, signed: true },
      ),
    ).toThrow();
  });
  it("imports the public app without initializing privileged configuration", async () => {
    const app = await import("../../app.js");
    expect(app.createApp).toBeTypeOf("function");
  }, 30000);
});

describe("protected parser and safe treasury signals", () => {
  it.each([
    "not-integer",
    "1.5",
    "1e3",
    "-1",
    "0",
    "01",
    "9223372036854775808",
  ])(
    "rejects malformed or out-of-range original payout units %s without native exceptions",
    (units) => {
      const policy = {
        maximumPayoutUnits: "500000000",
        energyFeeLimitSun: "1000000",
        maximumCompanyCostSun: "2000000",
      };
      const payout = {
        operation: "WITHDRAWAL_PAYOUT",
        requestId: randomUUID(),
        attemptId: randomUUID(),
        employeeId: randomUUID(),
        walletId: randomUUID(),
        reservationId: randomUUID(),
        treasuryKeyId: randomUUID(),
        network: "TRON_NILE",
        tokenContract,
        source,
        recipient: treasury,
        addressVersion: 1,
        netUnits: "79000000",
        termsHash: "a".repeat(64),
        policy,
      };
      expect(payoutIntentSchema.safeParse(payout).success).toBe(true);
      expect(
        payoutIntentSchema.safeParse({ ...payout, netUnits: units }).success,
      ).toBe(false);
      for (const field of [
        "maximumPayoutUnits",
        "energyFeeLimitSun",
        "maximumCompanyCostSun",
      ]) {
        const invalidPolicy = { ...policy, [field]: units };
        expect(payoutPolicySchema.safeParse(invalidPolicy).success).toBe(false);
        expect(
          payoutIntentSchema.safeParse({ ...payout, policy: invalidPolicy })
            .success,
        ).toBe(false);
      }
    },
  );

  it("rejects private authority arguments and unbounded operator input", () => {
    const command = {
      operation: "CREATE",
      operationId: randomUUID(),
      assignmentId: randomUUID(),
      amount: "1.000001",
      reason: "Company consolidation",
    };
    for (const field of [
      "destination",
      "privateKey",
      "rawTransaction",
      "export",
      "network",
      "operatorIdentity",
    ])
      expect(
        treasuryCommandSchema.safeParse({
          ...command,
          [field]: "secret-sentinel",
        }).success,
      ).toBe(false);
    for (const changed of [
      { amount: "0" },
      { amount: "1.0000001" },
      { reason: "x".repeat(501) },
      { operation: "SIGN" },
    ])
      expect(
        treasuryCommandSchema.safeParse({ ...command, ...changed }).success,
      ).toBe(false);
  });
  it("bounds reminders independently per attempt and clears once without secret fields", () => {
    const chunks: string[] = [];
    const clock = new Date("2026-10-07T00:00:00Z");
    const logger = createLogger({
      level: "info",
      pretty: false,
      destination: {
        write: (c) => {
          chunks.push(c);
        },
      },
    });
    const signals = new RuntimeSignals(logger, () => clock);
    const first = {
      attemptId: randomUUID(),
      processKind: "SIGNER" as const,
      code: "TREASURY_RESOURCE_SHORTFALL",
      privateKey: "sentinel-private",
      reason: "sentinel-private",
      url: "sentinel-private",
    };
    signals.observe("RESOURCE_SHORTFALL", true, first);
    signals.observe("RESOURCE_SHORTFALL", true, {
      ...first,
      attemptId: randomUUID(),
    });
    clock.setTime(clock.getTime() + 299999);
    signals.observe("RESOURCE_SHORTFALL", true, first);
    expect(chunks).toHaveLength(2);
    clock.setTime(clock.getTime() + 1);
    signals.observe("RESOURCE_SHORTFALL", true, first);
    signals.observe("RESOURCE_SHORTFALL", false, first);
    signals.observe("RESOURCE_SHORTFALL", false, first);
    const events = chunks.map((c) => JSON.parse(c) as { state: string });
    expect(events.map((e) => e.state)).toEqual([
      "ACTIVE",
      "ACTIVE",
      "REMINDER",
      "CLEARED",
    ]);
    expect(chunks.join("")).not.toContain("sentinel-private");
  });
});

it("records paid bandwidth using canonical protobuf size while rejecting absent or contradictory resource bills", async () => {
  const signed = await signSweepTransaction(
    transaction(),
    intent,
    options,
    key,
  );
  const protobuf = utils.transaction.txJsonToPb(signed) as {
    addSignature: (signature: Uint8Array) => void;
    serializeBinary: () => Uint8Array;
  };
  if (signed.signature?.[0] === undefined)
    throw new Error("Signed fixture missing signature");
  protobuf.addSignature(Buffer.from(signed.signature[0], "hex"));
  expect(actualSweepBandwidth(signed, { net_usage: 0, net_fee: 500000 })).toBe(
    BigInt(protobuf.serializeBinary().length + 64),
  );
  expect(actualSweepBandwidth(signed, { net_usage: 300, net_fee: 0 })).toBe(
    300n,
  );
  for (const bill of [
    { net_usage: 0, net_fee: 0 },
    { net_usage: 300, net_fee: 1000 },
  ])
    expect(() => actualSweepBandwidth(signed, bill)).toThrow(
      "TREASURY_POLICY_CONFLICT",
    );
});

it("compares canonical stored company-cost evidence independent of JSONB field order and refuses changed cost", () => {
  const evidence = {
    transactionId: "a".repeat(64),
    blockId: "b".repeat(64),
    blockNumber: "100",
    blockTimestamp: "1800000000000",
    result: "SUCCESS",
    tokenContract,
    source,
    treasury,
    amountUnits: "1000001",
    feeSun: "1000",
    energyUnits: "100",
    bandwidthUnits: "300",
  };
  const reordered = Object.fromEntries(Object.entries(evidence).reverse());
  expect(sameSweepEvidence(evidence, reordered)).toBe(true);
  expect(sameSweepEvidence(evidence, { ...reordered, feeSun: "1001" })).toBe(
    false,
  );
  expect(
    sameSweepEvidence(evidence, { ...reordered, unexpected: "authority" }),
  ).toBe(false);
});
