import { readFile } from "node:fs/promises";
import { createLinuxCustodyRuntime } from "../custody/testing/linux-custody-runtime.js";
import { linuxTreasuryProgram } from "./testing/linux-treasury-program.js";
import { withAdmittedFinancialDatabase } from "../ledger/testing/financial-fixtures.js";
import { fenceFinancialRuntime } from "../custody/runtime-control.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { policySnapshot } from "./treasury.intent.js";
import { createLogger } from "../../infrastructure/logger/logger.js";
import { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";
import { TreasuryRecovery } from "./treasury-recovery.js";
import { TreasuryReconciliation } from "./treasury-reconciliation.js";
import { TreasuryService } from "./treasury.service.js";
import { TreasuryAttempts } from "./treasury-attempts.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import { changeDispatchPause } from "../custody/runtime-control.js";
import { withTreasuryFixture } from "./testing/treasury-fixtures.js";
import { financialRaceBarrier } from "../ledger/testing/financial-fixtures.js";
import {
  readDueTreasurySweeps,
  runTreasuryOperation,
} from "./treasury.runtime.js";
import type { TreasurySweep } from "@template/database";

describe("protected company treasury", () => {
  it("backs off twenty older policy conflicts so a later independent source progresses", async () => {
    await withTreasuryFixture(async (f) => {
      const policyA = {
        ...f.config,
        maximumSweepUnits: f.config.maximumSweepUnits + 1n,
      };
      const oldPolicy = new TreasuryService(
        f.operator,
        policyA,
        "test-only-operator",
      );
      const conflicts: TreasurySweep[] = [];
      for (let index = 0; index < 20; index++) {
        const source = await f.assignment();
        conflicts.push(
          await oldPolicy.create({ ...f.command(), assignmentId: source.id }),
        );
      }
      const valid = await f.service.create(f.command());
      const now = new Date(f.now.getTime() + 3600000);
      await f.database.treasurySweep.updateMany({
        data: { nextAttemptAt: now },
      });
      const wallets = await f.database.wallet.findMany({
        orderBy: { id: "asc" },
      });
      const chunks: string[] = [];
      const signals = new RuntimeSignals(
        createLogger({
          level: "info",
          pretty: false,
          destination: {
            write: (chunk) => {
              chunks.push(chunk);
            },
          },
        }),
        () => now,
      );
      const first = await readDueTreasurySweeps(f.signer, now);
      expect(first).toHaveLength(20);
      expect(first.map((row) => row.id)).not.toContain(valid.id);
      for (const sweep of first)
        await runTreasuryOperation({
          database: f.signer,
          sweepId: sweep.id,
          signals,
          clock: () => now,
          operation: async () => {
            await f.attempts().sign(sweep.id);
          },
        });
      expect(await f.database.transferAttempt.count()).toBe(0);
      expect(f.built()).toBe(0);
      const next = await readDueTreasurySweeps(f.signer, now);
      expect(next.map((row) => row.id)).toEqual([valid.id]);
      await runTreasuryOperation({
        database: f.signer,
        sweepId: valid.id,
        signals,
        clock: () => now,
        operation: async () => {
          await f.attempts().sign(valid.id);
        },
      });
      expect(
        await f.database.transferAttempt.findUniqueOrThrow({
          where: { sweepId: valid.id },
        }),
      ).toMatchObject({ state: "SIGNED" });
      expect(f.built()).toBe(1);
      for (const conflict of conflicts) {
        const retained = await f.database.treasurySweep.findUniqueOrThrow({
          where: { id: conflict.id },
        });
        expect(retained).toMatchObject({
          state: "REQUESTED",
          currentAttemptId: null,
          lastErrorCode: "TREASURY_POLICY_CONFLICT",
          payloadHash: conflict.payloadHash,
          nextAttemptAt: new Date(now.getTime() + 300000),
        });
        await expect(
          f.service.create({
            ...f.command(),
            assignmentId: conflict.assignmentId,
          }),
        ).rejects.toThrow();
      }
      expect(
        chunks.some(
          (chunk) =>
            chunk.includes('"event":"EVIDENCE_CONFLICT"') &&
            chunk.includes('"code":"TREASURY_POLICY_CONFLICT"'),
        ),
      ).toBe(true);
      const retryBatch = await readDueTreasurySweeps(
        f.signer,
        new Date(now.getTime() + 300000),
      );
      expect(retryBatch).toHaveLength(20);
      expect(
        retryBatch.filter((row) =>
          conflicts.some((conflict) => conflict.id === row.id),
        ),
      ).toHaveLength(19);
      expect(
        await f.database.wallet.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(wallets);
      expect(await f.database.depositReceipt.count()).toBe(0);
      expect(await f.database.financialOperation.count()).toBe(0);
    });
  });
  it("retains the original source claim while finality advances between lookups", async () => {
    await withTreasuryFixture(async (f) => {
      const earlierFloor = await f.provider.solidifiedFloor();
      const sweep = await f.service.create(f.command());
      const signed = await f.attempts().sign(sweep.id);
      await f.attempts().broadcast(sweep.id);
      let staleFloor = true;
      const reconciliation = new TreasuryReconciliation(
        f.signer,
        {
          ...f.provider,
          solidifiedFloor: () =>
            staleFloor
              ? Promise.resolve(earlierFloor)
              : f.provider.solidifiedFloor(),
        },
        f.config,
      );
      expect(await reconciliation.reconcile(sweep.id)).toMatchObject({
        state: "UNKNOWN",
        transactionId: signed.transactionId,
        lastErrorCode: "TRON_UNFINALIZED",
      });
      await expect(f.service.create(f.command())).rejects.toThrow();
      staleFloor = false;
      expect(await reconciliation.reconcile(sweep.id)).toMatchObject({
        state: "CONFIRMED",
        transactionId: signed.transactionId,
      });
      expect(f.sent).toHaveLength(1);
      expect(await f.database.transferAttempt.count()).toBe(1);
      expect(await f.database.financialOperation.count()).toBe(0);
      expect(await f.database.depositReceipt.count()).toBe(0);
    });
  });
  it("denies unprivileged database identity and payload changes, without employee effects", async () => {
    await withTreasuryFixture(async (f) => {
      const command = f.command();
      await expect(
        new TreasuryService(f.database, f.config, "forged-operator").create(
          command,
        ),
      ).rejects.toMatchObject({ code: "TREASURY_AUTHORITY_DENIED" });
      const original = await f.service.create(command);
      expect((await f.service.create(command)).id).toBe(original.id);
      for (const changed of [
        { ...command, amount: "2" },
        { ...command, reason: "changed" },
        { ...command, destination: f.config.treasury },
      ])
        await expect(f.service.create(changed)).rejects.toThrow();
      await expect(
        new TreasuryService(f.operator, f.config, "changed-operator").create(
          command,
        ),
      ).rejects.toThrow();
      expect(await f.database.financialOperation.count()).toBe(0);
      expect(await f.database.depositReceipt.count()).toBe(0);
      expect(
        await f.database.wallet.findMany({
          select: {
            availableNonReferralUnits: true,
            availableReferralUnits: true,
            reservedNonReferralUnits: true,
            reservedReferralUnits: true,
          },
        }),
      ).toEqual([
        {
          availableNonReferralUnits: 0n,
          availableReferralUnits: 0n,
          reservedNonReferralUnits: 0n,
          reservedReferralUnits: 0n,
        },
      ]);
    });
  });
  it("excludes competing same-source intents while allowing another source", async () => {
    await withTreasuryFixture(async (f) => {
      const barrier = financialRaceBarrier(2);
      const peer = new TreasuryService(
        f.operatorPeer,
        f.config,
        "test-only-operator",
      );
      const outcomes = await Promise.allSettled([
        barrier().then(() => f.service.create(f.command())),
        barrier().then(() => peer.create(f.command())),
      ]);
      expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
      const second = await f.assignment();
      await f.service.create({ ...f.command(), assignmentId: second.id });
      expect(await f.database.treasurySweep.count()).toBe(2);
      expect(await f.database.transferAttempt.count()).toBe(0);
    });
  });
  it("recovers the sealed returned object after remote ACK loss before database signed metadata", async () => {
    await withTreasuryFixture(async (f) => {
      const sweep = await f.service.create(f.command());
      const interrupted = new TreasuryAttempts(
        f.signer,
        f.admission,
        f.config,
        {
          stores: {
            keys: f.keys,
            archive: {
              ...f.stores.archive,
              put: async (envelope) => {
                await f.stores.archive.put(envelope);
                throw new CustodyStorageError("RECOVERY_UNAVAILABLE");
              },
            },
          },
          provider: f.provider,
          clock: () => f.now,
        },
      );
      await expect(interrupted.sign(sweep.id)).rejects.toThrow(
        "RECOVERY_UNAVAILABLE",
      );
      const before = await f.database.transferAttempt.findUniqueOrThrow({
        where: { sweepId: sweep.id },
      });
      expect(before.transactionId).toBeNull();
      const signed = await f.attempts().sign(sweep.id);
      expect(f.built()).toBe(1);
      expect(signed.transactionId).not.toBeNull();
      const again = await f.attempts().sign(sweep.id);
      expect(again.transactionId).toBe(signed.transactionId);
      expect(f.built()).toBe(1);
      expect(f.sent).toHaveLength(0);
    });
  });
  it.each(["SUCCESS", "REVERT"] as const)(
    "reconciles canonical %s and exact company costs with no wallet credit",
    async (outcome) => {
      await withTreasuryFixture(async (f) => {
        const sweep = await f.service.create(f.command());
        await f.attempts().sign(sweep.id);
        await f.attempts().broadcast(sweep.id);
        f.outcome(outcome);
        const result = await f.reconciliation().reconcile(sweep.id);
        expect(result?.state).toBe(
          outcome === "SUCCESS" ? "CONFIRMED" : "CHAIN_FAILED",
        );
        expect(result?.feeSun).toBe(11n);
        expect(result?.energyUnits).toBe(1000n);
        expect(result?.bandwidthUnits).toBe(300n);
        expect(await f.database.financialOperation.count()).toBe(0);
        expect(await f.database.depositReceipt.count()).toBe(0);
        expect(
          await f.database.wallet.findMany({
            select: {
              availableNonReferralUnits: true,
              availableReferralUnits: true,
              reservedNonReferralUnits: true,
              reservedReferralUnits: true,
            },
          }),
        ).toEqual([
          {
            availableNonReferralUnits: 0n,
            availableReferralUnits: 0n,
            reservedNonReferralUnits: 0n,
            reservedReferralUnits: 0n,
          },
        ]);
      });
    },
  );
  it("blocks later paused admissions, retains expired UNKNOWN and rebroadcasts identical bytes", async () => {
    await withTreasuryFixture(async (f) => {
      const sweep = await f.service.create(f.command());
      await f.attempts().sign(sweep.id);
      await f.attempts().broadcast(sweep.id);
      await changeDispatchPause(f.database, {
        action: "PAUSE",
        operatorIdentity: "test-only",
        reason: "Emergency test pause",
      });
      await expect(f.attempts().broadcast(sweep.id)).rejects.toMatchObject({
        code: "NEW_DISPATCH_PAUSED",
      });
      expect(f.sent).toHaveLength(1);
      await changeDispatchPause(f.database, {
        action: "RESUME",
        operatorIdentity: "test-only",
        reason: "Resume test",
      });
      await f.attempts().broadcast(sweep.id);
      expect(f.sent[1]).toEqual(f.sent[0]);
      f.outcome("MISSING");
      f.now.setTime(f.now.getTime() + 120000);
      expect((await f.reconciliation().reconcile(sweep.id))?.state).toBe(
        "UNKNOWN",
      );
      await expect(f.attempts().broadcast(sweep.id)).rejects.toThrow();
      await expect(
        f.service.create({ ...f.command(), operationId: randomUUID() }),
      ).rejects.toThrow();
      expect(await f.database.transferAttempt.count()).toBe(1);
    });
  });
  it.each([
    "excessive-energy",
    "missing-energy-price",
    "missing-bandwidth-price",
    "negative-energy-price",
    "negative-bandwidth-price",
  ])("does not sign with %s resource evidence", async (scenario) => {
    await withTreasuryFixture(async (f) => {
      const sweep = await f.service.create(f.command());
      const owner = new TreasuryAttempts(f.signer, f.admission, f.config, {
        stores: f.stores,
        provider: {
          ...f.provider,
          estimateSweep:
            scenario === "excessive-energy"
              ? () => Promise.resolve(2000000)
              : f.provider.estimateSweep,
          chainParameters: async () => {
            const parameters = await f.provider.chainParameters();
            if (scenario === "excessive-energy") return parameters;
            const omitted = scenario.endsWith("energy-price")
              ? "getEnergyFee"
              : "getTransactionFee";
            return {
              chainParameter: parameters.chainParameter.map((entry) =>
                entry.key === omitted
                  ? scenario.startsWith("negative-")
                    ? { key: entry.key, value: -1 }
                    : { key: entry.key }
                  : entry,
              ),
            };
          },
        },
        clock: () => f.now,
      });
      await expect(owner.sign(sweep.id)).rejects.toThrow(
        scenario === "excessive-energy"
          ? "TREASURY_RESOURCE_SHORTFALL"
          : "TREASURY_RESOURCES_UNAVAILABLE",
      );
      expect(f.built()).toBe(0);
      expect(f.sent).toHaveLength(0);
      expect(
        (
          await f.database.transferAttempt.findUniqueOrThrow({
            where: { sweepId: sweep.id },
          })
        ).transactionId,
      ).toBeNull();
    });
  });
  it("allows an already admitted send after pause while denying every later retry", async () => {
    await withTreasuryFixture(async (f) => {
      const sweep = await f.service.create(f.command());
      await f.attempts().sign(sweep.id);
      let release: () => void = () => {};
      let admitted: () => void = () => {};
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const reached = new Promise<void>((resolve) => {
        admitted = resolve;
      });
      const owner = new TreasuryAttempts(f.signer, f.admission, f.config, {
        stores: {
          keys: f.keys,
          archive: {
            ...f.stores.archive,
            put: async (envelope) => {
              if (envelope.type === "BROADCAST_INTENT") {
                admitted();
                await barrier;
              }
              return f.stores.archive.put(envelope);
            },
          },
        },
        provider: f.provider,
        clock: () => f.now,
      });
      const sending = owner.broadcast(sweep.id);
      await reached;
      try {
        await changeDispatchPause(f.database, {
          action: "PAUSE",
          operatorIdentity: "test-only",
          reason: "Pause after admission",
        });
      } finally {
        release();
      }
      expect((await sending).state).toBe("SUBMITTED");
      expect(f.sent).toHaveLength(1);
      await expect(f.attempts().broadcast(sweep.id)).rejects.toMatchObject({
        code: "NEW_DISPATCH_PAUSED",
      });
      expect((await f.reconciliation().reconcile(sweep.id))?.state).toBe(
        "CONFIRMED",
      );
    });
  });
  it("retains the original possibly sent attempt on lost broadcast response", async () => {
    await withTreasuryFixture(async (f) => {
      const sweep = await f.service.create(f.command());
      const original = await f.attempts().sign(sweep.id);
      const owner = new TreasuryAttempts(f.signer, f.admission, f.config, {
        stores: f.stores,
        provider: {
          ...f.provider,
          broadcastSweep: async (signed) => {
            await f.provider.broadcastSweep(signed);
            throw new Error("test-only-lost-response");
          },
        },
        clock: () => f.now,
      });
      const uncertain = await owner.broadcast(sweep.id);
      expect(uncertain.state).toBe("UNKNOWN");
      expect(uncertain.transactionId).toBe(original.transactionId);
      expect((await f.reconciliation().reconcile(sweep.id))?.state).toBe(
        "CONFIRMED",
      );
      expect(f.built()).toBe(1);
      expect(f.sent).toHaveLength(1);
    });
  });
  it("does not send before the broadcast envelope ACK and resumes the same intent after ACK loss", async () => {
    await withTreasuryFixture(async (f) => {
      const sweep = await f.service.create(f.command());
      await f.attempts().sign(sweep.id);
      const owner = new TreasuryAttempts(f.signer, f.admission, f.config, {
        stores: {
          keys: f.keys,
          archive: {
            ...f.stores.archive,
            put: async (e) => {
              const ack = await f.stores.archive.put(e);
              if (e.type === "BROADCAST_INTENT")
                throw new CustodyStorageError("RECOVERY_UNAVAILABLE");
              return ack;
            },
          },
        },
        provider: f.provider,
        clock: () => f.now,
      });
      await expect(owner.broadcast(sweep.id)).rejects.toThrow(
        "RECOVERY_UNAVAILABLE",
      );
      expect(f.sent).toHaveLength(0);
      const before = await f.database.transferAttempt.findUniqueOrThrow({
        where: { sweepId: sweep.id },
      });
      const after = await f.attempts().broadcast(sweep.id);
      expect(after.broadcastIntentId).toBe(before.broadcastIntentId);
      expect(after.transactionId).toBe(before.transactionId);
      expect(after.observationBlockNumber).toBe(before.observationBlockNumber);
      expect(f.sent).toHaveLength(1);
      expect(f.built()).toBe(1);
    });
  });
  it("fails closed for missing funds, malformed estimates, unavailable provider and changed caps without signing", async () => {
    await withTreasuryFixture(async (f) => {
      const sweep = await f.service.create(f.command());
      const providers = [
        { ...f.provider, tokenBalance: () => Promise.resolve(0n) },
        {
          ...f.provider,
          sweepAccount: (address: string) =>
            Promise.resolve({
              address,
              balance: 0,
              owner_permission: {
                threshold: 1,
                keys: [{ address, weight: 1 }],
              },
            }),
        },
        { ...f.provider, estimateSweep: () => Promise.resolve(Number.NaN) },
        {
          ...f.provider,
          estimateSweep: () => {
            throw new CustodyStorageError("RECOVERY_UNAVAILABLE");
          },
        },
        {
          ...f.provider,
          chainParameters: () => Promise.resolve({ chainParameter: [] }),
        },
      ];
      for (const provider of providers)
        await expect(
          new TreasuryAttempts(f.signer, f.admission, f.config, {
            stores: f.stores,
            provider: provider,
            clock: () => f.now,
          }).sign(sweep.id),
        ).rejects.toThrow();
      await expect(
        new TreasuryAttempts(
          f.signer,
          f.admission,
          { ...f.config, maximumSweepUnits: 1n },
          { stores: f.stores, provider: f.provider, clock: () => f.now },
        ).sign(sweep.id),
      ).rejects.toThrow();
      expect(f.built()).toBe(0);
      expect(f.sent).toHaveLength(0);
      expect(
        (
          await f.database.transferAttempt.findUniqueOrThrow({
            where: { sweepId: sweep.id },
          })
        ).transactionId,
      ).toBeNull();
    });
  });
  it("rejects missing recovery inventory while preserving the active claim and fence", async () => {
    await withTreasuryFixture(async (f) => {
      const sweep = await f.service.create(f.command());
      await f.attempts().sign(sweep.id);
      const recovery = new TreasuryRecovery(f.operator, f.keys, {
        ...f.stores.archive,
        list: () =>
          Promise.resolve({
            operation: "LIST",
            protocolVersion: 1,
            records: [],
            cursor: null,
          }),
      });
      await expect(recovery.assertInventory()).rejects.toThrow(
        "CUSTODY_EVIDENCE_CONFLICT",
      );
      await fenceFinancialRuntime(f.database, {
        operatorIdentity: "test-only",
        reason: "Incomplete recovery inventory",
      });
      await expect(recovery.restoreInventory()).rejects.toThrow(
        "CUSTODY_EVIDENCE_CONFLICT",
      );
      expect(
        (
          await f.database.financialRuntimeControl.findUniqueOrThrow({
            where: { id: 1 },
          })
        ).financialWritesFenced,
      ).toBe(true);
      expect(await f.database.transferAttempt.count()).toBe(1);
      expect(f.sent).toHaveLength(0);
    });
  });
  it("emits bounded safe resource alerts from actual signing retries and clears on recovery", async () => {
    await withTreasuryFixture(async (f) => {
      const chunks: string[] = [];
      const logger = createLogger({
        level: "info",
        pretty: false,
        destination: {
          write: (chunk) => {
            chunks.push(chunk);
          },
        },
      });
      const signals = new RuntimeSignals(logger, () => f.now);
      let energy = Number.NaN;
      const owner = new TreasuryAttempts(f.signer, f.admission, f.config, {
        stores: f.stores,
        provider: {
          ...f.provider,
          estimateSweep: () => Promise.resolve(energy),
        },
        clock: () => f.now,
        signals,
      });
      const sweep = await f.service.create(f.command());
      await expect(owner.sign(sweep.id)).rejects.toThrow(
        "TREASURY_RESOURCES_UNAVAILABLE",
      );
      f.now.setTime(f.now.getTime() + 299999);
      await expect(owner.sign(sweep.id)).rejects.toThrow(
        "TREASURY_RESOURCES_UNAVAILABLE",
      );
      expect(chunks).toHaveLength(1);
      f.now.setTime(f.now.getTime() + 1);
      await expect(owner.sign(sweep.id)).rejects.toThrow(
        "TREASURY_RESOURCES_UNAVAILABLE",
      );
      energy = 1000;
      await owner.sign(sweep.id);
      const events = chunks.map(
        (chunk) =>
          JSON.parse(chunk) as {
            event: string;
            state: string;
            attemptId: string;
            code?: string;
          },
      );
      expect(events.map((e) => [e.event, e.state])).toEqual([
        ["RESOURCE_SHORTFALL", "ACTIVE"],
        ["RESOURCE_SHORTFALL", "REMINDER"],
        ["RESOURCE_SHORTFALL", "CLEARED"],
      ]);
      expect(new Set(events.map((e) => e.attemptId)).size).toBe(1);
      expect(chunks.join("")).not.toContain("Test-only company consolidation");
      expect(chunks.join("")).not.toContain("test-only-treasury-provider");
      expect(f.sent).toHaveLength(0);
    });
  });
  it("converges simultaneous canonical reconciliation despite JSONB key ordering", async () => {
    await withTreasuryFixture(async (f) => {
      const sweep = await f.service.create(f.command());
      await f.attempts().sign(sweep.id);
      await f.attempts().broadcast(sweep.id);
      const barrier = financialRaceBarrier(2);
      const provider = {
        ...f.provider,
        transactionInfo: async (id: string) => {
          await barrier();
          return f.provider.transactionInfo(id);
        },
      };
      const left = new TreasuryReconciliation(f.signer, provider, f.config);
      const right = new TreasuryReconciliation(
        f.operatorPeer,
        provider,
        f.config,
        "p06_recovery_operator",
      );
      const observed = await Promise.all([
        left.reconcile(sweep.id),
        right.reconcile(sweep.id),
      ]);
      expect(observed.map((a) => a?.state)).toEqual(["CONFIRMED", "CONFIRMED"]);
      expect(observed[0]?.finalEvidence).toEqual(observed[1]?.finalEvidence);
      expect(await f.database.transferAttempt.count()).toBe(1);
      expect(await f.database.financialOperation.count()).toBe(0);
    });
  });
});

describe("Linux off-host treasury recovery", () => {
  it("keeps the actual built signer fair across twenty pre-attempt policy conflicts", async () => {
    const runtime = await createLinuxCustodyRuntime();
    try {
      await withTreasuryFixture(async (f) => {
        await f.database.$executeRawUnsafe(
          `GRANT UPDATE ON deposit_address_assignments TO "${new URL(f.signerUrl).username}"`,
        );
        const oldPolicy = new TreasuryService(
          f.operator,
          { ...f.config, maximumSweepUnits: f.config.maximumSweepUnits + 1n },
          "test-only-operator",
        );
        const assignments = [f.source];
        const conflicts = [];
        for (let index = 0; index < 20; index++) {
          const source = await f.assignment();
          assignments.push(source);
          conflicts.push(
            await oldPolicy.create({ ...f.command(), assignmentId: source.id }),
          );
        }
        const valid = await f.service.create(f.command());
        const now = new Date(f.now.getTime() + 3600000);
        await f.database.treasurySweep.updateMany({
          data: { nextAttemptAt: now },
        });
        const wallets = await f.database.wallet.findMany({
          orderBy: { id: "asc" },
        });
        const envelopes = [];
        for (const assignment of assignments) {
          const envelope = await f.keys.read(assignment.keyRecordId, 1);
          if (envelope === null)
            throw new Error("Missing published source key");
          envelopes.push(envelope);
        }
        const hostUrl = (value: string) => {
          const url = new URL(value);
          url.hostname = "host.docker.internal";
          return url.toString();
        };
        expect(
          JSON.parse(
            await runtime.run(linuxTreasuryProgram, {
              step: "fair-signer",
              key: (await readFile(f.keyFile)).toString("base64"),
              envelopes,
              ownerUrl: hostUrl(f.databaseUrl),
              signerUrl: hostUrl(f.signerUrl),
              now: now.toISOString(),
              validId: valid.id,
              conflictIds: conflicts.map((row) => row.id),
              environment: {
                NODE_ENV: "test",
                TRON_NETWORK: f.config.network,
                TRON_TOKEN_CONTRACT: f.config.token.contract,
                TRON_EXPECTED_GENESIS_BLOCK_ID: f.config.genesisBlockId,
                TRON_PROVIDER_URL: f.config.providerUrl,
                TRON_PROVIDER_API_KEY_FILE: "/primary/provider.key",
                TRON_TREASURY_ADDRESS: f.config.treasury,
                TRON_MAX_SWEEP_UNITS: String(f.config.maximumSweepUnits),
                TRON_ENERGY_FEE_LIMIT_SUN: String(f.config.energyFeeLimitSun),
                TRON_MAX_COMPANY_COST_SUN: String(
                  f.config.maximumCompanyCostSun,
                ),
                TRON_MAX_MANUAL_FUNDING_SUN: String(
                  f.config.maximumManualFundingSun,
                ),
              },
            }),
          ),
        ).toEqual({
          state: "FAIR_SIGNER_PROGRESS",
          policyConflicts: 20,
          validSourceWaitingForResources: true,
          unauthorizedSigningDenied: true,
        });
        expect(
          await f.database.wallet.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(wallets);
        for (const conflict of conflicts)
          await expect(
            f.service.create({
              ...f.command(),
              assignmentId: conflict.assignmentId,
            }),
          ).rejects.toThrow();
      });
    } finally {
      await runtime.close();
    }
  }, 300000);
  it("restores a post-snapshot signed attempt and source claim after primary file loss from independent SSH storage and escrow", async () => {
    const runtime = await createLinuxCustodyRuntime();
    try {
      await withTreasuryFixture(async (f) => {
        const sweep = await f.service.create(f.command());
        await f.attempts().sign(sweep.id);
        await f.attempts().broadcast(sweep.id);
        const attempt = await f.database.transferAttempt.findUniqueOrThrow({
          where: { sweepId: sweep.id },
        });
        if (attempt.broadcastIntentId === null)
          throw new Error("Missing broadcast identity");
        const envelopes = await Promise.all([
          f.keys.readRecord(f.source.keyRecordId),
          f.keys.readRecord(attempt.id),
          f.keys.readRecord(attempt.broadcastIntentId),
        ]);
        expect(envelopes.every((e) => e !== null)).toBe(true);
        expect(
          JSON.parse(
            await runtime.run(linuxTreasuryProgram, {
              step: "archive",
              key: (await readFile(f.keyFile)).toString("base64"),
              envelopes,
            }),
          ),
        ).toEqual({ state: "ARCHIVED" });
        await runtime.escrow();
        for (const user of ["api", "worker"])
          expect(
            await runtime.runRoot("primary", [
              "runuser",
              "-u",
              user,
              "--",
              "node",
              "-e",
              "try { require('fs').readFileSync('/primary/encryption.key'); process.exit(1); } catch(e) { if(e.code !== 'EACCES') process.exit(2); process.stdout.write('DENIED'); }",
            ]),
          ).toBe("DENIED");
        // Fixed disposable primary paths; independent recovery/escrow volumes stay mounted.
        await runtime.runRoot("primary", [
          "sh",
          "-c",
          "test -d /primary/keys && rm -rf /primary/keys /primary/encryption.key && mkdir /primary/keys && chown custody:custody /primary/keys && chmod 700 /primary/keys",
        ]);
        await runtime.restoreEscrow();
        await withAdmittedFinancialDatabase(async (restored, restoredUrl) => {
          const user = await f.database.user.findUniqueOrThrow({
            where: { id: f.source.employeeId },
          });
          const wallet = await f.database.wallet.findUniqueOrThrow({
            where: { id: f.source.walletId },
          });
          await restored.user.create({ data: user });
          await restored.wallet.create({ data: wallet });
          for (const statement of [
            `GRANT USAGE ON SCHEMA public TO "${f.operatorRole}"`,
            `GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${f.operatorRole}"`,
            `GRANT INSERT,UPDATE ON deposit_address_assignments,treasury_sweeps,transfer_attempts,financial_runtime_admissions TO "${f.operatorRole}"`,
            `GRANT UPDATE ON financial_runtime_control TO "${f.operatorRole}"`,
          ])
            await restored.$executeRawUnsafe(statement);
          await fenceFinancialRuntime(restored, {
            operatorIdentity: "disposable-test",
            reason: "Restore isolated snapshot before treasury intent",
          });
          const url = new URL(f.operatorUrl);
          url.hostname = "host.docker.internal";
          url.pathname = new URL(restoredUrl).pathname;
          const result: unknown = JSON.parse(
            await runtime.run(linuxTreasuryProgram, {
              step: "restore",
              operatorUrl: url.toString(),
              sweepId: sweep.id,
              transactionId: attempt.transactionId,
              broadcastIntentId: attempt.broadcastIntentId,
            }),
          );
          expect(result).toEqual({
            state: "RESTORED_FENCED",
            transactionId: attempt.transactionId,
          });
          expect(await restored.transferAttempt.count()).toBe(1);
          expect(
            (
              await restored.treasurySweep.findUniqueOrThrow({
                where: { id: sweep.id },
              })
            ).currentAttemptId,
          ).toBe(attempt.id);
          expect(await restored.financialOperation.count()).toBe(0);
          expect(await restored.depositReceipt.count()).toBe(0);
          await expect(
            restored.treasurySweep.create({
              data: {
                ...sweep,
                id: randomUUID(),
                policySnapshot: policySnapshot(f.config),
              },
            }),
          ).rejects.toThrow();
          await restored.$executeRawUnsafe(`DROP OWNED BY "${f.operatorRole}"`);
        });
      });
    } finally {
      await runtime.close();
    }
  }, 300000);
});
