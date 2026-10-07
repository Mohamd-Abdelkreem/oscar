import { describe, expect, it } from "vitest";
import {
  decodeCanonicalReceipt,
  TronReceiptError,
} from "../../infrastructure/tron/tron-receipt.js";
import {
  depositClock,
  depositToken,
  rawDeposit,
  transferLog,
} from "./testing/deposit-fixtures.js";

const decode = (raw: ReturnType<typeof rawDeposit>) =>
  decodeCanonicalReceipt({
    transactionId: raw.transactionId,
    transaction: raw.transaction,
    info: raw.info,
    block: {
      number: raw.block.block_header.raw_data.number,
      timestamp: raw.block.block_header.raw_data.timestamp,
      id: raw.block.blockID,
      transactionIds: raw.block.transactions.map((tx) => tx.txID),
    },
    solidified: {
      number: raw.solidified.block_header.raw_data.number,
      timestamp: raw.solidified.block_header.raw_data.timestamp,
      id: raw.solidified.blockID,
    },
    network: "TRON_NILE",
    tokenContract: depositToken,
    verifiedAt: depositClock(),
  });
describe("canonical deposit verification", () => {
  it("keeps original unfiltered indices and exact multiple token movements", () => {
    const raw = rawDeposit([
      { address: "44".repeat(20), topics: [], data: "" },
      transferLog(),
      transferLog(undefined, 1n),
    ]);
    expect(
      decode(raw).map((movement) => [movement.logIndex, movement.amountUnits]),
    ).toEqual([
      [1, 1000001n],
      [2, 1n],
    ]);
  });
  it.each([
    [
      "above solidified height",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.solidified.block_header.raw_data.number = 122;
      },
    ],
    [
      "contradictory solidified block",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.solidified.blockID = "ee".repeat(32);
      },
    ],
    [
      "failed execution",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.receipt.result = "REVERT";
      },
    ],
    [
      "failed transaction",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.transaction.ret = [{ contractRet: "REVERT" }];
      },
    ],
    [
      "contradictory TxID",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.id = "ee".repeat(32);
      },
    ],
    [
      "missing canonical inclusion",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.block.transactions = [];
      },
    ],
    [
      "contradictory block time",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.blockTimeStamp++;
      },
    ],
    [
      "wrong raw hash",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.transaction.raw_data_hex = "abcd";
      },
    ],
    [
      "zero",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.log = [transferLog(undefined, 0n)];
      },
    ],
    [
      "uint256 overflow",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.log = [transferLog(undefined, (1n << 256n) - 1n)];
      },
    ],
    [
      "storage overflow",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.log = [transferLog(undefined, 9223372036854775808n)];
      },
    ],
    [
      "malformed ABI",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.log = [
          { ...transferLog(), topics: transferLog().topics.slice(0, 2) },
        ];
      },
    ],
    [
      "nonhex amount",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.log = [{ ...transferLog(), data: "1.000001" }];
      },
    ],
    [
      "invalid sender padding",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.log = [
          {
            ...transferLog(),
            topics: transferLog().topics.map((topic, index) =>
              index === 1 ? "ff".repeat(32) : topic,
            ),
          },
        ];
      },
    ],
  ])("rejects %s without verified movements", (_name, alter) => {
    const raw = rawDeposit();
    alter(raw);
    expect(() => decode(raw)).toThrow(TronReceiptError);
  });
  it.each([1n, 9223372036854775807n])(
    "retains the exact representable boundary %s",
    (units) => {
      expect(decode(rawDeposit([transferLog(undefined, units)]))).toMatchObject(
        [{ amountUnits: units }],
      );
    },
  );
  it("does not treat a symbol, TxID, wrong emitter or unrelated topic as a deposit", () => {
    const raw = rawDeposit();
    raw.info.log = [{ ...transferLog(), address: "44".repeat(20) }];
    expect(decode(raw)).toEqual([]);
    raw.info.log = [{ ...transferLog(), topics: ["ff".repeat(32)] }];
    expect(decode(raw)).toEqual([]);
    expect(() =>
      decodeCanonicalReceipt({
        ...raw,
        transaction: { txID: raw.transactionId, symbol: "USDT" },
      }),
    ).toThrow(TronReceiptError);
  });
});
