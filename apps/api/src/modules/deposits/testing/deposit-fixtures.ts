import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TronWeb, utils as tronUtils } from "tronweb";
import type { DatabaseClient } from "@template/database";
import { parseTronWorkerEnvironment } from "../../../core/config/tron.config.js";
import { TronProvider } from "../../../infrastructure/tron/tron-provider.js";
import { createFinancialAccount } from "../../ledger/testing/financial-fixtures.js";

export const depositToken = TronWeb.address.fromHex(`41${"11".repeat(20)}`);
export const depositRecipient = TronWeb.address.fromHex(`41${"22".repeat(20)}`);
export const depositSender = TronWeb.address.fromHex(`41${"33".repeat(20)}`);
export const transferTopic =
  "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const depositClock = () => new Date("2026-10-10T20:00:00.000Z");
export function transferLog(recipient = depositRecipient, units = 1000001n) {
  return {
    address: TronWeb.address.toHex(depositToken).slice(2).toLowerCase(),
    topics: [
      transferTopic,
      `0`.repeat(24) +
        TronWeb.address.toHex(depositSender).slice(2).toLowerCase(),
      `0`.repeat(24) + TronWeb.address.toHex(recipient).slice(2).toLowerCase(),
    ],
    data: units.toString(16).padStart(64, "0"),
  };
}
export function rawDeposit(logs = [transferLog()]) {
  const transaction = {
    txID: "",
    raw_data_hex: "",
    visible: false,
    raw_data: {
      ref_block_bytes: "007b",
      ref_block_hash: "ab".repeat(8),
      timestamp: depositClock().getTime() - 60000,
      expiration: depositClock().getTime() + 60000,
      fee_limit: 100000000,
      data: randomUUID().replaceAll("-", ""),
      contract: [
        {
          type: "TriggerSmartContract",
          parameter: {
            type_url: "type.googleapis.com/protocol.TriggerSmartContract",
            value: {
              owner_address: TronWeb.address.toHex(depositSender),
              contract_address: TronWeb.address.toHex(depositToken),
              data:
                "a9059cbb" +
                "0".repeat(24) +
                TronWeb.address.toHex(depositRecipient).slice(2) +
                transferLog().data,
            },
          },
        },
      ],
    },
    ret: [{ contractRet: "SUCCESS" }],
  };
  const protobuf: unknown = tronUtils.transaction.txJsonToPb(transaction);
  transaction.raw_data_hex = tronUtils.transaction
    .txPbToRawDataHex(protobuf)
    .toLowerCase();
  const transactionId = createHash("sha256")
    .update(Buffer.from(transaction.raw_data_hex, "hex"))
    .digest("hex");
  transaction.txID = transactionId;
  const block = {
    blockID: "ab".repeat(32),
    block_header: { raw_data: { number: 123, timestamp: 1791660000000 } },
    transactions: [{ txID: transactionId }],
  };
  const info = {
    id: transactionId,
    blockNumber: 123,
    blockTimeStamp: block.block_header.raw_data.timestamp,
    receipt: { result: "SUCCESS" },
    log: logs,
  };
  return {
    transactionId,
    block,
    solidified: structuredClone(block),
    transaction,
    info,
  };
}
export type RawDeposit = ReturnType<typeof rawDeposit>;
export async function withDepositProvider<T>(
  raw: RawDeposit,
  work: (
    provider: TronProvider,
    config: ReturnType<typeof parseTronWorkerEnvironment>,
  ) => Promise<T>,
  discovery?: (url: URL) => Response | Promise<Response>,
  transactionInfo?: () => unknown,
) {
  const root = await mkdtemp(join(tmpdir(), "p06-deposit-"));
  try {
    const key = join(root, "provider.key");
    await writeFile(key, "test-only-deposit-provider", { mode: 0o600 });
    const config = parseTronWorkerEnvironment(
      {
        TRON_NETWORK: "TRON_NILE",
        TRON_TOKEN_CONTRACT: depositToken,
        TRON_EXPECTED_GENESIS_BLOCK_ID: "cd".repeat(32),
        TRON_PROVIDER_URL: "https://nile.trongrid.io",
        TRON_PROVIDER_API_KEY_FILE: key,
      },
      process.cwd(),
    );
    const provider = new TronProvider(config, (url, options) => {
      const requestUrl = new URL(url instanceof Request ? url.url : url);
      const path = requestUrl.pathname;
      if (path.startsWith("/v1/") && discovery !== undefined)
        return Promise.resolve(discovery(requestUrl));
      if (typeof options?.body !== "string")
        throw new Error("Expected provider JSON request");
      const body: unknown = JSON.parse(options.body);
      let payload: unknown;
      if (path.endsWith("triggerconstantcontract"))
        payload = {
          result: { result: true },
          constant_result: ["0".repeat(63) + "6"],
        };
      else if (path.endsWith("gettransactioninfobyid"))
        payload = transactionInfo?.() ?? raw.info;
      else if (path.endsWith("gettransactionbyid")) payload = raw.transaction;
      else if (
        path.endsWith("getblockbynum") &&
        typeof body === "object" &&
        body !== null &&
        "num" in body &&
        body.num === 0
      )
        payload = {
          blockID: config.genesisBlockId,
          block_header: { raw_data: { number: 0, timestamp: 1 } },
        };
      else if (path.endsWith("getnowblock")) payload = raw.solidified;
      else payload = raw.block;
      return Promise.resolve(new Response(JSON.stringify(payload)));
    });
    return await work(provider, config);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
export async function createDepositAssignment(
  database: DatabaseClient,
  address = depositRecipient,
) {
  const account = await createFinancialAccount(database);
  return bindDepositAssignment(database, account, address);
}
export async function bindDepositAssignment(
  database: DatabaseClient,
  account: { ownerUserId: string; wallet: { id: string } },
  address = depositRecipient,
  now = depositClock(),
) {
  const assignment = await database.depositAddressAssignment.create({
    data: {
      employeeId: account.ownerUserId,
      walletId: account.wallet.id,
      network: "TRON_NILE",
      keyRecordId: randomUUID(),
      createdAt: now,
    },
  });
  await database.depositAddressAssignment.update({
    where: { id: assignment.id },
    data: {
      state: "READY",
      address,
      keyEnvelopeDigest: "a".repeat(64),
      keyVersion: 1,
      recoveryAckId: randomUUID(),
      recoveryDigest: "a".repeat(64),
      recoveryAcknowledgedAt: now,
      readyAt: now,
      scanBoundaryBlockNumber: 100n,
      scanBoundaryBlockId: "a".repeat(64),
      scanBoundaryTimestamp: 1n,
    },
  });
  return { ...account, assignmentId: assignment.id };
}
