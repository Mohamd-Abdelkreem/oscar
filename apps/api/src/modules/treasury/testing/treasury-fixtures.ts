import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabaseClient, type DatabaseClient } from "@template/database";
import { TronWeb, utils } from "tronweb";
import {
  CustodyKeyStorage,
  envelopeDigest,
} from "../../../infrastructure/custody/key-storage.js";
import { RecoveryObjectStore } from "../../../infrastructure/custody/recovery-store.objects.js";
import { parseTronSignerEnvironment } from "../../../core/config/tron.config.js";
import {
  FinancialRuntimeAdmission,
  acknowledgeFinancialBoot,
  changeDispatchPause,
} from "../../custody/runtime-control.js";
import {
  createFinancialAccount,
  withAdmittedFinancialDatabase,
} from "../../ledger/testing/financial-fixtures.js";
import { TreasuryService } from "../treasury.service.js";
import { TreasuryAttempts } from "../treasury-attempts.js";
import { TreasuryReconciliation } from "../treasury-reconciliation.js";
import {
  transferCalldata,
  sweepTransactionSchema,
  type SweepTransaction,
} from "../../../infrastructure/tron/tron-signer.js";
import { TronProviderError } from "../../../infrastructure/tron/tron-provider.js";
import { transferTopic } from "../../deposits/testing/deposit-fixtures.js";

export async function withTreasuryFixture(
  work: (context: Awaited<ReturnType<typeof fixture>>) => Promise<void>,
) {
  await withAdmittedFinancialDatabase(async (database, databaseUrl) => {
    const context = await fixture(database, databaseUrl);
    try {
      await work(context);
    } finally {
      await context.close();
    }
  });
}
async function fixture(database: DatabaseClient, databaseUrl: string) {
  const root = await mkdtemp(join(tmpdir(), "p06-treasury-"));
  const primary = join(root, "primary");
  const remote = join(root, "archive");
  await mkdir(primary, { mode: 0o700 });
  await mkdir(remote, { mode: 0o700 });
  const keyFile = join(root, "key");
  await writeFile(keyFile, randomBytes(32), { mode: 0o600 });
  const providerKey = join(root, "provider");
  await writeFile(providerKey, "test-only-treasury-provider", { mode: 0o600 });
  const config = parseTronSignerEnvironment(
    {
      TRON_NETWORK: "TRON_NILE",
      TRON_TOKEN_CONTRACT: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
      TRON_EXPECTED_GENESIS_BLOCK_ID: "ab".repeat(32),
      TRON_PROVIDER_URL: "https://nile.trongrid.io",
      TRON_PROVIDER_API_KEY_FILE: providerKey,
      TRON_TREASURY_ADDRESS: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
      TRON_MAX_SWEEP_UNITS: "100000000",
      TRON_ENERGY_FEE_LIMIT_SUN: "1000000",
      TRON_MAX_COMPANY_COST_SUN: "2000000",
      TRON_MAX_MANUAL_FUNDING_SUN: "2000000",
    },
    process.cwd(),
  );
  const keys = new CustodyKeyStorage({
    storageRoot: primary,
    currentKeyId: "test-only",
    keyFiles: { "test-only": keyFile },
    projectRoot: process.cwd(),
  });
  const objects = new RecoveryObjectStore(remote);
  const stores = {
    keys,
    archive: {
      put: async (
        envelope: Parameters<CustodyKeyStorage["storeRecord"]>[0],
      ) => {
        const reply = await objects.execute({
          operation: "PUT",
          envelope,
          digest: envelopeDigest(envelope),
        });
        if (reply.operation !== "PUT") throw new Error("Invalid fixture ACK");
        return reply;
      },
      get: async (objectId: string, version: number) => {
        const reply = await objects.execute({
          operation: "GET",
          objectId,
          version,
        });
        if (reply.operation !== "GET") throw new Error("Invalid fixture GET");
        return reply;
      },
      list: async (
        cursor?: string,
        type:
          | "KEY_ASSIGNMENT"
          | "SIGNED_ATTEMPT"
          | "BROADCAST_INTENT" = "KEY_ASSIGNMENT",
      ) => {
        const reply = await objects.execute({
          operation: "LIST",
          type,
          limit: 100,
          ...(cursor === undefined ? {} : { cursor }),
        });
        if (reply.operation !== "LIST") throw new Error("Invalid fixture LIST");
        return reply;
      },
    },
  };
  const suffix = randomUUID().replaceAll("-", "");
  const password = randomUUID();
  const roles = [`treasury_signer_${suffix}`, `treasury_operator_${suffix}`];
  const clients: DatabaseClient[] = [];
  const createdRoles: string[] = [];
  const close = async () => {
    for (const client of clients) await client.$disconnect();
    for (const role of createdRoles) {
      await database.$executeRawUnsafe(`DROP OWNED BY "${role}"`);
      await database.$executeRawUnsafe(`DROP ROLE "${role}"`);
    }
    await rm(root, { recursive: true, force: true });
  };
  try {
    for (const [index, group] of [
      "p06_signer",
      "p06_recovery_operator",
    ].entries()) {
      const role = roles[index];
      if (role === undefined) throw new Error("Invalid fixture role");
      await database.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${group}') THEN CREATE ROLE ${group} NOLOGIN; END IF; END $$`,
      );
      await database.$executeRawUnsafe(
        `CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`,
      );
      createdRoles.push(role);
      await database.$executeRawUnsafe(`GRANT ${group} TO "${role}"`);
      await database.$executeRawUnsafe(
        `GRANT USAGE ON SCHEMA public TO "${role}"`,
      );
      await database.$executeRawUnsafe(
        `GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`,
      );
      await database.$executeRawUnsafe(
        `GRANT INSERT,UPDATE ON treasury_sweeps,transfer_attempts,financial_runtime_admissions TO "${role}"`,
      );
      // PostgreSQL row locks require UPDATE; the existing role-bound trigger still denies signer changes.
      await database.$executeRawUnsafe(
        `GRANT UPDATE ON financial_runtime_control TO "${role}"`,
      );
      const url = new URL(databaseUrl);
      url.username = role;
      url.password = password;
      clients.push(createDatabaseClient(url.toString()));
    }
    const signer = clients[0];
    const operator = clients[1];
    if (signer === undefined || operator === undefined)
      throw new Error("Invalid fixture clients");
    const peerUrl = new URL(databaseUrl);
    peerUrl.username = roles[1] ?? "";
    peerUrl.password = password;
    const operatorPeer = createDatabaseClient(peerUrl.toString());
    clients.push(operatorPeer);
    const admission = new FinancialRuntimeAdmission(signer, "SIGNER");
    await admission.register();
    const cutoff = new Date();
    await acknowledgeFinancialBoot(database, {
      bootId: admission.bootId,
      operatorIdentity: "test-only",
      reason: "Known clean fixture",
      evidence: {
        financialHistoryReference: "test-only",
        assignmentInventoryReference: "test-only",
        attemptInventoryReference: "test-only",
        reconciliationReference: "test-only",
        reconciliationCutoff: cutoff,
        financialHistoryRecoveredThrough: cutoff,
      },
    });
    await changeDispatchPause(database, {
      action: "RESUME",
      operatorIdentity: "test-only",
      reason: "Known clean fixture",
    });
    const now = new Date();
    const floor = {
      number: 100,
      id: "ab".repeat(32),
      timestamp: now.getTime() - 1000,
    };
    async function assignment() {
      const account = await createFinancialAccount(database);
      const row = await database.depositAddressAssignment.create({
        data: {
          employeeId: account.ownerUserId,
          walletId: account.wallet.id,
          network: config.network,
          keyRecordId: randomUUID(),
          createdAt: now,
        },
      });
      const retained = await keys.obtain(row.keyRecordId, {
        assignmentId: row.id,
        employeeId: account.ownerUserId,
        walletId: account.wallet.id,
        network: config.network,
        createdAt: now.toISOString(),
        floor,
      });
      const ack = await stores.archive.put(retained.envelope);
      return database.depositAddressAssignment.update({
        where: { id: row.id },
        data: {
          state: "READY",
          address: retained.payload.address,
          keyVersion: 1,
          keyEnvelopeDigest: retained.digest,
          recoveryAckId: ack.ackId,
          recoveryDigest: ack.digest,
          recoveryAcknowledgedAt: new Date(ack.acknowledgedAt),
          readyAt: new Date(),
          scanBoundaryBlockNumber: 100n,
          scanBoundaryBlockId: floor.id,
          scanBoundaryTimestamp: BigInt(floor.timestamp),
        },
      });
    }
    const source = await assignment();
    if (source.address === null) throw new Error("Missing fixture address");
    const inclusion = {
      number: 101,
      id: "cd".repeat(32),
      timestamp: now.getTime() + 3000,
    };
    const sourceAddress = source.address;
    const operatorRole = roles[1];
    if (operatorRole === undefined) throw new Error("Fixture role missing");
    const sent: SweepTransaction[] = [];
    let built = 0;
    let outcome: "SUCCESS" | "REVERT" | "MISSING" = "SUCCESS";
    const provider = {
      block: (number: number) =>
        Promise.resolve(number === 100 ? floor : inclusion),
      solidifiedFloor: () =>
        Promise.resolve(sent.length === 0 ? floor : inclusion),
      resources: () => Promise.resolve({ EnergyLimit: 100000, EnergyUsed: 0 }),
      chainParameters: () =>
        Promise.resolve({
          chainParameter: [
            { key: "getEnergyFee", value: 100 },
            { key: "getTransactionFee", value: 1 },
            // Nile protobuf JSON omits zero values for unrelated parameters.
            { key: "getAllowSameTokenName" },
            { key: "getRemoveThePowerOfTheGr", value: -1 },
          ],
        }),
      tokenBalance: () => Promise.resolve(100000000n),
      sweepAccount: (address: string) =>
        Promise.resolve({
          address,
          balance: 10000000,
          owner_permission: { threshold: 1, keys: [{ address, weight: 1 }] },
        }),
      account: (address: string) =>
        Promise.resolve({ address, balance: 10000000 }),
      estimateSweep: () => Promise.resolve(1000),
      buildSweep: (
        owner: string,
        treasury: string,
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
                    data: transferCalldata(treasury, amount),
                  },
                },
              },
            ],
            ref_block_bytes: "0064",
            ref_block_hash: "ab".repeat(8),
            timestamp: now.getTime(),
            expiration: now.getTime() + 60000,
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
      broadcastSweep: (signed: Record<string, unknown>) => {
        sent.push(sweepTransactionSchema.parse(signed));
        return Promise.resolve(true);
      },
      transaction: (id: string) => {
        if (outcome === "MISSING")
          throw new TronProviderError("TRON_UNFINALIZED");
        const signed = sent.find((tx) => tx.txID === id);
        if (signed === undefined)
          throw new TronProviderError("TRON_UNFINALIZED");
        return Promise.resolve({ ...signed, ret: [{ contractRet: outcome }] });
      },
      transactionInfo: (id: string) =>
        Promise.resolve({
          id,
          blockNumber: inclusion.number,
          blockTimeStamp: inclusion.timestamp,
          fee: 11,
          receipt: {
            result: outcome,
            energy_usage_total: 1000,
            net_usage: 300,
          },
          log:
            outcome === "SUCCESS"
              ? [
                  {
                    address: TronWeb.address
                      .toHex(config.token.contract)
                      .slice(2),
                    topics: [
                      transferTopic,
                      TronWeb.address
                        .toHex(sourceAddress)
                        .slice(2)
                        .padStart(64, "0"),
                      TronWeb.address
                        .toHex(config.treasury)
                        .slice(2)
                        .padStart(64, "0"),
                    ],
                    data: 1000001n.toString(16).padStart(64, "0"),
                  },
                ]
              : [],
        }),
      transactionBlock: () =>
        Promise.resolve({
          ...inclusion,
          transactionIds: sent.map((tx) => tx.txID),
        }),
    };
    const service = new TreasuryService(operator, config, "test-only-operator");
    const attempts = () =>
      new TreasuryAttempts(signer, admission, config, {
        stores: stores,
        provider: provider,
        clock: () => now,
      });
    const reconciliation = () =>
      new TreasuryReconciliation(signer, provider, config);
    const command = () => ({
      operation: "CREATE" as const,
      operationId: randomUUID(),
      assignmentId: source.id,
      amount: "1.000001",
      reason: "Test-only company consolidation",
    });
    return {
      database,
      databaseUrl,
      keyFile,
      operatorUrl: peerUrl.toString(),
      signerUrl: (() => {
        const url = new URL(databaseUrl);
        url.username = roles[0] ?? "";
        url.password = password;
        return url.toString();
      })(),
      operatorRole,
      signer,
      operator,
      operatorPeer,
      config,
      admission,
      keys,
      stores,
      provider,
      source,
      assignment,
      now,
      floor,
      service,
      attempts,
      reconciliation,
      command,
      sent,
      built: () => built,
      outcome: (next: typeof outcome) => {
        outcome = next;
      },
      close,
    };
  } catch (failure) {
    await close();
    throw failure;
  }
}
