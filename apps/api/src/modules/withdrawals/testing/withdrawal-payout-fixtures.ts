import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TronWeb, utils } from "tronweb";
import { vi } from "vitest";
import { parseTronPayoutEnvironment } from "../../../core/config/tron.config.js";
import {
  CustodyKeyStorage,
  envelopeDigest,
} from "../../../infrastructure/custody/key-storage.js";
import { RecoveryObjectStore } from "../../../infrastructure/custody/recovery-store.objects.js";
import type { SshRecoveryStore } from "../../../infrastructure/custody/recovery-store.js";
import { TronProviderError } from "../../../infrastructure/tron/tron-provider.js";
import {
  sweepTransactionSchema,
  transferCalldata,
  type SweepTransaction,
} from "../../../infrastructure/tron/tron-signer.js";
import { TRANSFER_TOPIC } from "../../../infrastructure/tron/tron-receipt.js";
import { provisionTreasuryPayoutKey } from "../../treasury/treasury-payout-key.js";
import { withClockedWithdrawalDatabase } from "./withdrawal-fixtures.js";
import {
  withWithdrawalRole,
  admitWithdrawalRuntimeFixture,
} from "./withdrawal-authority-fixtures.js";
import {
  reservationEmployee,
  reservationServices,
} from "./withdrawal-reservation-fixtures.js";
import { WithdrawalAttempts } from "../withdrawal-attempts.js";
import type { DatabaseClient } from "@template/database";
import {
  FinancialRuntimeAdmission,
  fenceFinancialRuntime,
  acknowledgeFinancialBoot,
  changeDispatchPause,
} from "../../custody/runtime-control.js";
import { WithdrawalRecovery } from "../withdrawal-recovery.js";
import { financialHistoryDigest } from "../../custody/recovery-history.js";

export async function interruptBroadcastRecord(fixture: PayoutFixture) {
  await fixture.attempts().sign(fixture.request.id);
  const obtain = fixture.stores.keys.obtainRecord.bind(fixture.stores.keys);
  fixture.stores.keys.obtainRecord = (envelope) => {
    if (envelope.type === "PAYOUT_BROADCAST_INTENT")
      return Promise.reject(
        new Error("Interrupted before intent file creation"),
      );
    return obtain(envelope);
  };
  try {
    await fixture.attempts().broadcast(fixture.request.id);
    throw new Error("Expected interrupted broadcast");
  } catch (failure) {
    if (
      !(failure instanceof Error) ||
      failure.message !== "Interrupted before intent file creation"
    )
      throw failure;
  } finally {
    fixture.stores.keys.obtainRecord = obtain;
  }
  return fixture.database.withdrawalAttempt.findUniqueOrThrow({
    where: { withdrawalId: fixture.request.id },
  });
}

export type PayoutFixture = Awaited<ReturnType<typeof payoutFixture>>;

export const PAYOUT_WEEKDAY = new Date("2026-10-08T09:00:00Z");

// Host-date scenarios apply outside the controlled fixture, never to production.
export async function withPayoutDatabase<T>(
  work: (database: DatabaseClient, databaseUrl: string) => Promise<T>,
  options: { advancing?: boolean } = {},
) {
  const hostDate = process.env["P08_TEST_HOST_DATE"];
  if (hostDate !== undefined) {
    if (!Number.isFinite(Date.parse(hostDate)))
      throw new Error("Invalid test host date.");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(hostDate));
  }
  try {
    return await withClockedWithdrawalDatabase(PAYOUT_WEEKDAY, work, options);
  } finally {
    if (hostDate !== undefined) vi.useRealTimers();
  }
}

export async function admitPayoutPeer(
  fixture: PayoutFixture,
  database: DatabaseClient,
  kind: "SIGNER" | "DEPOSIT_WORKER",
) {
  await fenceFinancialRuntime(fixture.operator, {
    operatorIdentity: "test-recovery",
    reason: "Independent peer boot",
  });
  const admission = new FinancialRuntimeAdmission(database, kind);
  await admission.register();
  const cutoff = new Date();
  const inventory = await new WithdrawalRecovery(
    fixture.operator,
    fixture.stores,
  ).verifyAdmission(fixture.provider, fixture.stores.archive);
  await acknowledgeFinancialBoot(fixture.operator, {
    bootId: admission.bootId,
    additionalBootIds: [fixture.admission.bootId],
    payoutInventory: inventory,
    operatorIdentity: "test-recovery",
    reason: "Verified original inventory",
    evidence: {
      financialHistoryReference: "fixture-offchain-history",
      assignmentInventoryReference: "original-key",
      attemptInventoryReference: "original-inventory",
      reconciliationReference: "verified-original",
      reconciliationCutoff: cutoff,
      financialHistoryRecoveredThrough: cutoff,
    },
  });
  await changeDispatchPause(fixture.operator, {
    action: "RESUME",
    operatorIdentity: "test-recovery",
    reason: "Controlled peer race",
  });
  return admission;
}

export async function withPayoutSigners(
  fixture: PayoutFixture,
  work: (
    first: WithdrawalAttempts,
    second: WithdrawalAttempts,
  ) => Promise<void>,
) {
  await withWithdrawalRole(
    {
      database: fixture.database,
      databaseUrl: fixture.databaseUrl,
      role: "p06_signer",
    },
    async (database) => {
      const admission = await admitPayoutPeer(fixture, database, "SIGNER");
      await work(
        fixture.attempts(),
        new WithdrawalAttempts(database, admission, fixture.config, {
          stores: fixture.stores,
          provider: fixture.provider,
        }),
      );
    },
  );
}

export async function withPayoutFixture(
  work: (fixture: Awaited<ReturnType<typeof payoutFixture>>) => Promise<void>,
) {
  await withPayoutDatabase(async (database, databaseUrl) => {
    await withWithdrawalRole(
      { database, databaseUrl, role: "p06_signer" },
      async (signer) => {
        await withWithdrawalRole(
          { database, databaseUrl, role: "p06_recovery_operator" },
          async (operator) => {
            const fixture = await payoutFixture({
              database,
              databaseUrl,
              signer,
              operator,
            });
            try {
              await work(fixture);
            } finally {
              await fixture.close();
            }
          },
        );
      },
    );
  });
}
async function payoutFixture(clients: {
  databaseUrl: string;
  database: Parameters<typeof reservationEmployee>[0];
  signer: Parameters<typeof reservationEmployee>[0];
  operator: Parameters<typeof reservationEmployee>[0];
}) {
  const { database, signer, operator } = clients;
  const root = await mkdtemp(join(tmpdir(), "p08-payout-"));
  try {
    const primary = join(root, "primary");
    const archiveRoot = join(root, "archive");
    await mkdir(primary, { mode: 0o700 });
    await mkdir(archiveRoot, { mode: 0o700 });
    const encryptionFile = join(root, "encryption");
    const providerFile = join(root, "provider");
    await writeFile(encryptionFile, randomBytes(32), { mode: 0o600 });
    await writeFile(providerFile, "test-only-payout-provider", { mode: 0o600 });
    const privateKey = "11".repeat(32);
    const source = TronWeb.address.fromPrivateKey(privateKey);
    if (source === false) throw new Error("Invalid test-only key");
    const config = parseTronPayoutEnvironment(
      {
        TRON_NETWORK: "TRON_NILE",
        TRON_TOKEN_CONTRACT: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
        TRON_EXPECTED_GENESIS_BLOCK_ID: "ab".repeat(32),
        TRON_PROVIDER_URL: "https://nile.trongrid.io",
        TRON_PROVIDER_API_KEY_FILE: providerFile,
        TRON_TREASURY_ADDRESS: source,
        TRON_MAX_SWEEP_UNITS: "500000000",
        TRON_ENERGY_FEE_LIMIT_SUN: "1000000",
        TRON_MAX_COMPANY_COST_SUN: "2000000",
        TRON_MAX_MANUAL_FUNDING_SUN: "2000000",
        TRON_PAYOUT_KEY_ID: randomUUID(),
        TRON_MAX_PAYOUT_UNITS: "500000000",
        TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN: "1000000",
        TRON_PAYOUT_MAX_COMPANY_COST_SUN: "2000000",
      },
      process.cwd(),
    );
    const keys = new CustodyKeyStorage({
      storageRoot: primary,
      currentKeyId: "test-only",
      keyFiles: { "test-only": encryptionFile },
      projectRoot: process.cwd(),
    });
    const objects = new RecoveryObjectStore(archiveRoot);
    let archiveFailure = false;
    const stores = {
      keys,
      archive: {
        list: async (
          cursor?: string,
          type: Parameters<SshRecoveryStore["list"]>[1] = "KEY_ASSIGNMENT",
        ) => {
          const response = await objects.execute({
            operation: "LIST",
            type,
            limit: 100,
            ...(cursor === undefined ? {} : { cursor }),
          });
          if (response.operation !== "LIST")
            throw new Error("Invalid fixture LIST");
          return response;
        },
        put: async (
          envelope: Parameters<CustodyKeyStorage["storeRecord"]>[0],
        ) => {
          if (archiveFailure) throw new Error("Controlled archive unavailable");
          const response = await objects.execute({
            operation: "PUT",
            envelope,
            digest: envelopeDigest(envelope),
          });
          if (response.operation !== "PUT")
            throw new Error("Invalid fixture PUT");
          return response;
        },
        get: async (objectId: string, version: number) => {
          const response = await objects.execute({
            operation: "GET",
            objectId,
            version,
          });
          if (response.operation !== "GET")
            throw new Error("Invalid fixture GET");
          return response;
        },
      },
    };
    const admission = await admitWithdrawalRuntimeFixture(
      database,
      signer,
      "SIGNER",
    );
    const key = await provisionTreasuryPayoutKey(operator, config, {
      stores,
      operatorIdentity: "disposable-payout-test",
      input: {
        operation: "PROVISION_PAYOUT_KEY",
        privateKey,
        reason: "Test-only company source",
      },
    });
    const acceptedAt = new Date(Date.now() - 10 * 86400000);
    const employee = await reservationEmployee(database, {
      paid: true,
      nonReferral: "70",
      referral: "50",
      now: acceptedAt,
    });
    const services = reservationServices(database, () => acceptedAt);
    const quote = await services.quotes.create(employee.identity, {
      gross: "100",
    });
    const accepted = await services.reservations.accept(employee.identity, {
      quoteId: quote.quoteId,
      confirmed: true,
    });
    const request = await database.withdrawalRequest.findUniqueOrThrow({
      where: { id: accepted.withdrawal.id },
    });
    const now = Date.now();
    const initial = { number: 100, id: "ab".repeat(32), timestamp: now - 1000 };
    const inclusion = {
      number: 101,
      id: "cd".repeat(32),
      timestamp: now + 3000,
    };
    let built = 0;
    let outcome:
      | "SUCCESS"
      | "MISSING"
      | "WRONG_NET"
      | "REVERT"
      | "CHAIN_FAILED"
      | "NONFINAL"
      | "DISAPPEARING"
      | "MALFORMED" = "SUCCESS";
    let liquidity = 500000000n;
    let lostReply = false;
    const sent: SweepTransaction[] = [];
    const provider = {
      verifyIdentity: () => Promise.resolve(),
      solidifiedFloor: () =>
        Promise.resolve(
          sent.length > 0 && outcome !== "NONFINAL" ? inclusion : initial,
        ),
      block: (number: number) =>
        Promise.resolve(number === 100 ? initial : inclusion),
      tokenBalance: () => Promise.resolve(liquidity),
      sweepAccount: (address: string) =>
        Promise.resolve({
          address,
          balance: 10000000,
          owner_permission: { threshold: 1, keys: [{ address, weight: 1 }] },
        }),
      resources: () => Promise.resolve({ EnergyLimit: 100000, EnergyUsed: 0 }),
      chainParameters: () =>
        Promise.resolve({
          chainParameter: [
            { key: "getEnergyFee", value: 100 },
            { key: "getTransactionFee", value: 1 },
          ],
        }),
      estimateTransfer: () => Promise.resolve(1000),
      buildTransfer: (
        owner: string,
        recipient: string,
        amount: bigint,
        fee: bigint,
      ) => {
        built++;
        const transaction = {
          visible: false,
          txID: "",
          raw_data_hex: "",
          raw_data: {
            contract: [
              {
                type: "TriggerSmartContract",
                parameter: {
                  type_url: "type.googleapis.com/protocol.TriggerSmartContract",
                  value: {
                    owner_address: TronWeb.address.toHex(owner),
                    contract_address: TronWeb.address.toHex(
                      config.token.contract,
                    ),
                    data: transferCalldata(recipient, amount),
                  },
                },
              },
            ],
            ref_block_bytes: "0064",
            ref_block_hash: "ab".repeat(8),
            timestamp: Date.now(),
            expiration: Date.now() + 60000,
            fee_limit: Number(fee),
          },
        };
        const protobuf: unknown = utils.transaction.txJsonToPb(transaction);
        transaction.raw_data_hex = utils.transaction
          .txPbToRawDataHex(protobuf)
          .toLowerCase();
        transaction.txID = utils.transaction
          .txPbToTxID(protobuf)
          .replace(/^0x/u, "");
        return Promise.resolve(transaction);
      },
      broadcastTransfer: (signed: Record<string, unknown>) => {
        sent.push(sweepTransactionSchema.parse(signed));
        if (lostReply)
          return Promise.reject(new TronProviderError("TRON_UNAVAILABLE"));
        return Promise.resolve(true);
      },
      transaction: (id: string) => {
        const signed = sent.find((transaction) => transaction.txID === id);
        if (signed === undefined || outcome === "MISSING")
          return Promise.reject(new TronProviderError("TRON_UNFINALIZED"));
        return Promise.resolve({
          ...signed,
          ret: [
            {
              contractRet: ["REVERT", "CHAIN_FAILED"].includes(outcome)
                ? "REVERT"
                : "SUCCESS",
            },
          ],
        });
      },
      transactionInfo: (id: string) =>
        Promise.resolve({
          id,
          blockNumber: inclusion.number,
          blockTimeStamp: inclusion.timestamp,
          fee: 11,
          receipt: {
            result: ["REVERT", "CHAIN_FAILED"].includes(outcome)
              ? "REVERT"
              : "SUCCESS",
          },
          log:
            outcome === "CHAIN_FAILED"
              ? []
              : [
                  {
                    address: TronWeb.address
                      .toHex(config.token.contract)
                      .slice(2),
                    topics: [
                      TRANSFER_TOPIC,
                      TronWeb.address.toHex(source).slice(2).padStart(64, "0"),
                      TronWeb.address
                        .toHex(request.recipient)
                        .slice(2)
                        .padStart(64, "0"),
                    ],
                    data:
                      outcome === "MALFORMED"
                        ? "invalid-receipt-data"
                        : (outcome === "WRONG_NET"
                            ? request.netUnits + 1n
                            : request.netUnits
                          )
                            .toString(16)
                            .padStart(64, "0"),
                  },
                ],
        }),
      transactionBlock: () =>
        Promise.resolve({
          ...inclusion,
          transactionIds:
            outcome === "DISAPPEARING"
              ? []
              : sent.map((transaction) => transaction.txID),
        }),
    };
    const attempts = () =>
      new WithdrawalAttempts(signer, admission, config, { stores, provider });
    const failAttachment = async (
      column: "transaction_id" | "signed_record_id" | "broadcast_ack_id",
    ) => {
      await database.$executeRawUnsafe(
        `CREATE FUNCTION p08_test_attachment_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.${column} IS NULL AND NEW.${column} IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='controlled attachment failure'; END IF; RETURN NEW; END $$`,
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER p08_test_attachment_failure BEFORE UPDATE ON withdrawal_attempts FOR EACH ROW EXECUTE FUNCTION p08_test_attachment_failure()",
      );
      return async () => {
        await database.$executeRawUnsafe(
          "DROP TRIGGER p08_test_attachment_failure ON withdrawal_attempts",
        );
        await database.$executeRawUnsafe(
          "DROP FUNCTION p08_test_attachment_failure()",
        );
      };
    };
    return {
      ...clients,
      config,
      stores,
      provider,
      admission,
      key,
      employee,
      request,
      accepted,
      services,
      attempts,
      sent,
      failAttachment,
      recoveredHistory: async (conflict = false) => {
        const file = join(root, "history.json");
        const cutoff = new Date();
        const reference = "original-payout-history";
        await writeFile(
          file,
          JSON.stringify({
            reference,
            recoveredThrough: cutoff.toISOString(),
            digest: conflict
              ? "00".repeat(32)
              : await financialHistoryDigest(database),
          }),
          { mode: 0o600 },
        );
        return {
          environment: { CUSTODY_FINANCIAL_HISTORY_FILE: file },
          projectRoot: process.cwd(),
          reference,
          recoveredThrough: cutoff,
          cutoff,
        };
      },
      setTime: async (instant: Date) => {
        vi.setSystemTime(instant);
        await database.$executeRawUnsafe(
          `CREATE OR REPLACE FUNCTION pg_catalog.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '${instant.toISOString()}'::timestamptz $$`,
        );
      },
      built: () => built,
      outcome: (value: typeof outcome) => {
        outcome = value;
      },
      liquidity: (value: bigint) => {
        liquidity = value;
      },
      loseReply: () => {
        lostReply = true;
      },
      archiveFailure: (value: boolean) => {
        archiveFailure = value;
      },
      discardLocalRecord: (id: string) => {
        if (!/^[0-9a-f-]{36}$/u.test(id))
          throw new Error("Invalid test record id");
        return rm(join(primary, `${id}.1.json`));
      },
      damageRetainedRecord: async (
        id: string,
        mode: "MISSING" | "CONFLICT",
      ) => {
        if (!/^[0-9a-f-]{36}$/u.test(id))
          throw new Error("Invalid test record id");
        await rm(join(primary, `${id}.1.json`));
        const file = join(archiveRoot, `${id}.1.json`);
        if (mode === "MISSING") await rm(file);
        else {
          const contents = await readFile(file, "utf8");
          const record = JSON.parse(contents) as { digest: string };
          record.digest = "00".repeat(32);
          await writeFile(file, JSON.stringify(record), { mode: 0o600 });
        }
      },
      close: () => rm(root, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
