import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TronWeb } from "tronweb";
import { createLinuxCustodyRuntime } from "./testing/linux-custody-runtime.js";
import { linuxCustodyProgram } from "./testing/linux-custody-program.js";
import { runtimeAuthorityRejections } from "./testing/runtime-authority-fixtures.js";
import {
  CustodyKeyStorage,
  envelopeSchema,
  envelopeDigest,
} from "../../infrastructure/custody/key-storage.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";
import { RecoveryObjectStore } from "../../infrastructure/custody/recovery-store.objects.js";
import { CustodyService } from "./custody.service.js";
import { CustodyProvisioner } from "./custody.provisioner.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import {
  withAdmittedFinancialDatabase,
  financialFixtureAdmission,
  withAdmittedIndependentFinancialClients,
} from "../ledger/testing/financial-fixtures.js";
import {
  acknowledgeFinancialBoot,
  FinancialRuntimeAdmission,
  fenceFinancialRuntime,
} from "./runtime-control.js";

describe("recoverable assignment persistence", () => {
  it("denies stale-generation recovery approval and revoked or foreign session provisioning", async () => {
    await withAdmittedFinancialDatabase(async (database) => {
      const first = await createIdentityFixture(database);
      const second = await createIdentityFixture(database);
      const service = new CustodyService(
        database,
        {
          network: "TRON_NILE",
          token: {
            symbol: "USDT",
            contract: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
            decimals: 6,
          },
        },
        financialFixtureAdmission(database),
      );
      await expect(
        service.request({
          userId: first.user.id,
          sessionId: second.session.id,
        }),
      ).rejects.toMatchObject({ statusCode: 401 });
      await database.authSession.update({
        where: { id: first.session.id },
        data: { revokedAt: new Date() },
      });
      await expect(
        service.request({ userId: first.user.id, sessionId: first.session.id }),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(await database.depositAddressAssignment.count()).toBe(0);
      await fenceFinancialRuntime(database, {
        operatorIdentity: "disposable-recovery",
        reason: "Inventory cutoff",
      });
      const control = await database.financialRuntimeControl.findUniqueOrThrow({
        where: { id: 1 },
      });
      await fenceFinancialRuntime(database, {
        operatorIdentity: "disposable-recovery",
        reason: "New recovery generation",
      });
      const cutoff = new Date();
      const reference = "disposable-stale-generation";
      await expect(
        acknowledgeFinancialBoot(database, {
          bootId: financialFixtureAdmission(database).bootId,
          operatorIdentity: "disposable-recovery",
          reason: "Stale inventory",
          expectedGeneration: control.generation,
          evidence: {
            financialHistoryReference: reference,
            assignmentInventoryReference: reference,
            attemptInventoryReference: reference,
            reconciliationReference: reference,
            reconciliationCutoff: cutoff,
            financialHistoryRecoveredThrough: cutoff,
          },
        }),
      ).rejects.toMatchObject({ code: "FINANCIAL_WRITES_FENCED" });
      expect(
        (
          await database.financialRuntimeControl.findUniqueOrThrow({
            where: { id: 1 },
          })
        ).financialWritesFenced,
      ).toBe(true);
    });
  });
  it.each(["FLOOR_READ", "LOCAL_WRITE", "REMOTE_ACK", "READY_WRITE"] as const)(
    "resumes %s interruption without replacing the retained key or exposing nonready state",
    async (interruption) => {
      await withAdmittedFinancialDatabase(async (database) => {
        const identity = await createIdentityFixture(database);
        const metadata = {
          network: "TRON_NILE" as const,
          token: {
            symbol: "USDT" as const,
            contract: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
            decimals: 6 as const,
          },
        };
        const api = new CustodyService(
          database,
          metadata,
          financialFixtureAdmission(database),
        );
        const owner = {
          userId: identity.user.id,
          sessionId: identity.session.id,
        };
        const signer = new FinancialRuntimeAdmission(database, "SIGNER");
        await signer.register();
        const cutoff = new Date();
        const reference = "disposable-interruption-history";
        await acknowledgeFinancialBoot(database, {
          bootId: signer.bootId,
          operatorIdentity: "test-recovery",
          reason: "Known empty history",
          evidence: {
            financialHistoryReference: reference,
            assignmentInventoryReference: reference,
            attemptInventoryReference: reference,
            reconciliationReference: reference,
            reconciliationCutoff: cutoff,
            financialHistoryRecoveredThrough: cutoff,
          },
        });
        await api.request(owner);
        const primary = await mkdtemp(
          join(tmpdir(), "p06-interrupted-primary-"),
        );
        const remote = await mkdtemp(join(tmpdir(), "p06-interrupted-remote-"));
        try {
          const keyFile = join(primary, "key");
          await writeFile(keyFile, randomBytes(32), { mode: 0o600 });
          let interrupted = false;
          class InterruptedFiles extends CustodyKeyStorage {
            override async obtain(
              ...parameters: Parameters<CustodyKeyStorage["obtain"]>
            ) {
              const row =
                await database.depositAddressAssignment.findFirstOrThrow();
              expect(row.scanBoundaryTimestamp).toBe(1000n);
              const retained = await super.obtain(...parameters);
              if (interruption === "LOCAL_WRITE" && !interrupted) {
                interrupted = true;
                throw new CustodyStorageError("RECOVERY_UNAVAILABLE");
              }
              return retained;
            }
          }
          const keys = new InterruptedFiles({
            storageRoot: primary,
            currentKeyId: "test-key",
            keyFiles: { "test-key": keyFile },
            projectRoot: process.cwd(),
          });
          const objects = new RecoveryObjectStore(remote);
          const recovery = {
            get: async (objectId: string, version: number) => {
              const response = await objects.execute({
                operation: "GET",
                objectId,
                version,
              });
              if (response.operation !== "GET")
                throw new Error("Unexpected GET");
              return response;
            },
            put: async (input: Parameters<typeof keys.decrypt>[0]) => {
              const envelope = envelopeSchema.parse(input);
              const response = await objects.execute({
                operation: "PUT",
                envelope,
                digest: envelopeDigest(envelope),
              });
              if (interruption === "REMOTE_ACK" && !interrupted) {
                interrupted = true;
                throw new CustodyStorageError("RECOVERY_UNAVAILABLE");
              }
              if (response.operation !== "PUT")
                throw new Error("Unexpected PUT");
              return response;
            },
          };
          if (interruption === "READY_WRITE") {
            await database.$executeRawUnsafe(
              "CREATE SEQUENCE custody_ready_failure",
            );
            await database.$executeRawUnsafe(
              "CREATE FUNCTION interrupt_ready() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='READY' AND nextval('custody_ready_failure')=1 THEN RAISE EXCEPTION 'Disposable READY interruption'; END IF; RETURN NEW; END $$",
            );
            await database.$executeRawUnsafe(
              "CREATE TRIGGER interrupt_ready BEFORE UPDATE ON deposit_address_assignments FOR EACH ROW EXECUTE FUNCTION interrupt_ready()",
            );
          }
          const provisioner = new CustodyProvisioner(
            database,
            metadata,
            signer,
            {
              keys,
              recovery,
              provider: {
                solidifiedFloor: () => {
                  if (interruption === "FLOOR_READ" && !interrupted) {
                    interrupted = true;
                    return Promise.reject(
                      new CustodyStorageError("RECOVERY_UNAVAILABLE"),
                    );
                  }
                  return Promise.resolve({
                    number: 123,
                    id: "ab".repeat(32),
                    timestamp: 1000,
                  });
                },
              },
            },
          );
          await expect(provisioner.provisionNext()).rejects.toThrow();
          const before =
            await database.depositAddressAssignment.findFirstOrThrow();
          expect(before.state).toBe(
            interruption === "READY_WRITE"
              ? "RECOVERY_ACKED"
              : interruption === "REMOTE_ACK"
                ? "KEY_STORED"
                : "REQUESTED",
          );
          const envelope = await keys.read(before.keyRecordId, 1);
          expect(await api.read(owner)).not.toHaveProperty("address");
          await database.depositAddressAssignment.update({
            where: { id: before.id },
            data: {
              leaseOwner: null,
              leaseUntil: null,
              nextAttemptAt: new Date(0),
            },
          });
          await provisioner.provisionNext();
          const after =
            await database.depositAddressAssignment.findFirstOrThrow();
          expect(after.state).toBe("READY");
          expect(after.keyRecordId).toBe(before.keyRecordId);
          if (envelope !== null) {
            expect(after.keyEnvelopeDigest).toBe(envelopeDigest(envelope));
            expect(after.address).toBe(keys.decrypt(envelope).address);
          }
          expect(after.scanBoundaryTimestamp).toBe(1000n);
          expect(await database.depositAddressAssignment.count()).toBe(1);
        } finally {
          await rm(primary, { recursive: true, force: true });
          await rm(remote, { recursive: true, force: true });
        }
      });
    },
    120000,
  );
  it("converges concurrent requests, resumes lost ACK and never returns the address before READY", async () => {
    await withAdmittedFinancialDatabase(async (database, databaseUrl) => {
      const first = await createIdentityFixture(database);
      const second = await createIdentityFixture(database);
      const metadata = {
        network: "TRON_NILE" as const,
        token: {
          symbol: "USDT" as const,
          contract: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
          decimals: 6 as const,
        },
      };
      const service = new CustodyService(
        database,
        metadata,
        financialFixtureAdmission(database),
      );
      const owner = { userId: first.user.id, sessionId: first.session.id };
      expect((await service.read(owner)).state).toBe("UNASSIGNED");
      expect(await database.depositAddressAssignment.count()).toBe(0);
      const responses = await withAdmittedIndependentFinancialClients(
        databaseUrl,
        async (left, right) =>
          Promise.all([
            new CustodyService(
              left,
              metadata,
              financialFixtureAdmission(left),
            ).request(owner),
            new CustodyService(
              right,
              metadata,
              financialFixtureAdmission(right),
            ).request(owner),
          ]),
      );
      const secondResponse = responses[1];
      if (secondResponse.state !== "PROVISIONING")
        throw new Error("Expected pending assignment");
      expect(responses[0]).toMatchObject({
        state: "PROVISIONING",
        assignmentId: secondResponse.assignmentId,
      });
      expect(await database.depositAddressAssignment.count()).toBe(1);
      await service.request({
        userId: second.user.id,
        sessionId: second.session.id,
      });
      const primary = await mkdtemp(join(tmpdir(), "p06-primary-db-"));
      const remote = await mkdtemp(join(tmpdir(), "p06-remote-db-"));
      try {
        const key = join(primary, "key");
        await writeFile(key, randomBytes(32), { mode: 0o600 });
        const keys = new CustodyKeyStorage({
          storageRoot: primary,
          currentKeyId: "test-key",
          keyFiles: { "test-key": key },
          projectRoot: process.cwd(),
        });
        const objects = new RecoveryObjectStore(remote);
        const signer = new FinancialRuntimeAdmission(database, "SIGNER");
        await signer.register();
        const cutoff = new Date();
        const reference = "test-only-clean-history";
        await acknowledgeFinancialBoot(database, {
          bootId: signer.bootId,
          operatorIdentity: "test-recovery",
          reason: "Disposable test",
          evidence: {
            financialHistoryReference: reference,
            assignmentInventoryReference: reference,
            attemptInventoryReference: reference,
            reconciliationReference: reference,
            reconciliationCutoff: cutoff,
            financialHistoryRecoveredThrough: cutoff,
          },
        });
        let lostAck = true;
        const recovery = {
          get: async (id: string, version: number) => {
            const observed = await objects.execute({
              operation: "GET",
              objectId: id,
              version,
            });
            if (observed.operation !== "GET")
              throw new Error("Unexpected response");
            return observed;
          },
          put: async (envelope: Parameters<typeof keys.decrypt>[0]) => {
            const record = keys.decrypt(envelope);
            expect(record.floor.timestamp).toBe(1000);
            const { envelopeSchema, envelopeDigest } =
              await import("../../infrastructure/custody/key-storage.js");
            const checked = envelopeSchema.parse(envelope);
            const ack = await objects.execute({
              operation: "PUT",
              envelope: checked,
              digest: envelopeDigest(checked),
            });
            if (lostAck) {
              lostAck = false;
              throw new Error("test-only lost acknowledgement");
            }
            if (ack.operation !== "PUT") throw new Error("Unexpected response");
            return ack;
          },
        };
        const provisioner = new CustodyProvisioner(database, metadata, signer, {
          keys,
          recovery,
          provider: {
            solidifiedFloor: () =>
              Promise.resolve({
                number: 123,
                id: "ab".repeat(32),
                timestamp: 1000,
              }),
          },
        });
        await expect(provisioner.provisionNext()).rejects.toThrow(
          "test-only lost acknowledgement",
        );
        const stored = await database.depositAddressAssignment.findFirstOrThrow(
          { where: { employeeId: first.user.id } },
        );
        expect(stored.state).toBe("KEY_STORED");
        expect(stored.scanBoundaryTimestamp).toBe(1000n);
        expect(await service.read(owner)).not.toHaveProperty("address");
        await database.depositAddressAssignment.updateMany({
          data: { leaseOwner: null, leaseUntil: null },
        });
        await provisioner.provisionNext();
        await provisioner.provisionNext();
        const assignments = await database.depositAddressAssignment.findMany();
        expect(
          assignments.every((assignment) => assignment.state === "READY"),
        ).toBe(true);
        expect(
          new Set(assignments.map((assignment) => assignment.address)).size,
        ).toBe(2);
        const publicAddress = await service.read(owner);
        expect(publicAddress).toMatchObject({
          state: "READY",
          address: stored.address,
          activationState: "UNKNOWN",
        });
        expect(JSON.stringify(publicAddress)).not.toMatch(
          /privateKey|keyEnvelope|recoveryAck/u,
        );
        await fenceFinancialRuntime(database, {
          operatorIdentity: "test-recovery",
          reason: "Simulated restore",
        });
        expect((await service.read(owner)).state).toBe("READY");
        await expect(service.request(owner)).rejects.toMatchObject({
          code: "FINANCIAL_WRITES_FENCED",
        });
        expect(await database.depositAddressAssignment.count()).toBe(2);
      } finally {
        await rm(primary, { recursive: true, force: true });
        await rm(remote, { recursive: true, force: true });
      }
    });
  }, 120000);
});

describe("built Linux signer and independent forced-SSH recovery", () => {
  let runtime:
    Awaited<ReturnType<typeof createLinuxCustodyRuntime>> | undefined;
  beforeAll(async () => {
    runtime = await createLinuxCustodyRuntime();
  }, 300000);
  afterAll(async () => {
    if (runtime) await runtime.close();
  }, 120000);
  it("restores newly published keys from isolated volumes/escrow and denies nonowner or missing evidence", async () => {
    if (runtime === undefined)
      throw new Error("Linux custody runtime unavailable");
    const linuxRuntime = runtime;
    await withAdmittedFinancialDatabase(async (database, databaseUrl) => {
      const identities = [
        await createIdentityFixture(database),
        await createIdentityFixture(database),
      ];
      const token = TronWeb.address.fromHex(`41${"11".repeat(20)}`);
      const treasury = TronWeb.address.fromHex(`41${"22".repeat(20)}`);
      const metadata = {
        network: "TRON_NILE" as const,
        token: {
          symbol: "USDT" as const,
          contract: token,
          decimals: 6 as const,
        },
      };
      const service = new CustodyService(
        database,
        metadata,
        financialFixtureAdmission(database),
      );
      for (const identity of identities)
        await service.request({
          userId: identity.user.id,
          sessionId: identity.session.id,
        });
      const suffix = randomUUID().replaceAll("-", "");
      const password = randomUUID();
      for (const group of ["p06_signer", "p06_recovery_operator"])
        await database.$executeRawUnsafe(
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${group}') THEN CREATE ROLE ${group} NOLOGIN; END IF; END $$`,
        );
      const signerRole = `custody_signer_${suffix}`;
      const operatorRole = `custody_operator_${suffix}`;
      for (const role of [signerRole, operatorRole]) {
        await database.$executeRawUnsafe(
          `CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`,
        );
        await database.$executeRawUnsafe(
          `GRANT USAGE ON SCHEMA public TO "${role}"`,
        );
        await database.$executeRawUnsafe(
          `GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`,
        );
        await database.$executeRawUnsafe(
          `GRANT INSERT ON financial_runtime_admissions TO "${role}"`,
        );
        await database.$executeRawUnsafe(
          `GRANT UPDATE ON deposit_address_assignments,financial_runtime_control,financial_runtime_admissions TO "${role}"`,
        );
      }
      await database.$executeRawUnsafe(`GRANT p06_signer TO "${signerRole}"`);
      await database.$executeRawUnsafe(
        `GRANT p06_recovery_operator TO "${operatorRole}"`,
      );
      await database.$executeRawUnsafe(
        `GRANT INSERT ON deposit_address_assignments TO "${operatorRole}"`,
      );
      await database.$executeRawUnsafe(
        `GRANT UPDATE ON financial_runtime_control,financial_runtime_admissions TO "${operatorRole}"`,
      );
      const credentials = (role: string) => {
        const url = new URL(databaseUrl);
        url.hostname = "host.docker.internal";
        url.username = role;
        url.password = password;
        return url.toString();
      };
      const fixtures = {
        signerUrl: credentials(signerRole),
        operatorUrl: credentials(operatorRole),
        ownerUrl: (() => {
          const url = new URL(databaseUrl);
          url.hostname = "host.docker.internal";
          return url.toString();
        })(),
        token,
        treasury,
      };
      const signerRejections = await runtimeAuthorityRejections(
        database,
        databaseUrl,
        "p06_signer",
      );
      expect(
        JSON.parse(
          await linuxRuntime.run(linuxCustodyProgram, {
            ...fixtures,
            step: "prepare",
          }),
        ),
      ).toEqual({ state: "PREPARED" });
      await linuxRuntime.escrow();
      expect(
        JSON.parse(
          await linuxRuntime.run(linuxCustodyProgram, {
            ...fixtures,
            step: "provision",
            signerRejections,
          }),
        ),
      ).toEqual({
        state: "PROVISIONED",
        assignments: 2,
        actualSignerBootClosed: true,
        replayStable: true,
        pinnedHostDenied: true,
        unsafeSignerCredentialsDenied: signerRejections.length,
      });
      const original = await database.depositAddressAssignment.findMany({
        orderBy: { id: "asc" },
      });
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      await linuxRuntime.restoreEscrow();
      const identity = identities[0];
      if (identity === undefined) throw new Error("Missing recovery identity");
      expect(
        JSON.parse(
          await linuxRuntime.run(linuxCustodyProgram, {
            ...fixtures,
            step: "authority-history",
            authorities: [identity, admin, identities[1]].map((row) => {
              if (row === undefined)
                throw new Error("Missing recovery authority");
              return { userId: row.user.id, sessionId: row.session.id };
            }),
          }),
        ),
      ).toEqual({
        state: "AUTHORITY_RESTORE_VERIFIED",
        staleAcknowledgementsDenied: 3,
        revokedSessionDenied: true,
      });
      for (const user of ["api", "worker"]) {
        const denied = await linuxRuntime.runRoot("primary", [
          "runuser",
          "-u",
          user,
          "--",
          "node",
          "-e",
          "try { require('fs').readFileSync('/primary/encryption.key'); process.exit(1); } catch(e) { if(e.code!=='EACCES') process.exit(2); process.stdout.write('DENIED'); }",
        ]);
        expect(denied).toBe("DENIED");
      }
      expect(
        await linuxRuntime.runRoot("recovery", [
          "runuser",
          "-u",
          "escrow",
          "--",
          "node",
          "-e",
          "try { require('fs').readFileSync('/escrow/encryption.key'); process.exit(1); } catch(e) { if(e.code!=='EACCES') process.exit(2); process.stdout.write('DENIED'); }",
        ]),
      ).toBe("DENIED");
      await fenceFinancialRuntime(database, {
        operatorIdentity: "disposable-recovery",
        reason: "Loss of primary custody storage",
      });
      await linuxRuntime.runRoot("primary", [
        "sh",
        "-c",
        "rm -rf /primary/keys /primary/encryption.key && mkdir /primary/keys && chown custody:custody /primary/keys && chmod 700 /primary/keys",
      ]);
      await linuxRuntime.restoreEscrow();
      const firstAssignment = original[0];
      if (firstAssignment === undefined)
        throw new Error("Published assignment missing");
      expect(
        JSON.parse(
          await linuxRuntime.run(linuxCustodyProgram, {
            ...fixtures,
            step: "rotate",
            assignmentId: firstAssignment.id,
            originalAddress: firstAssignment.address,
          }),
        ),
      ).toEqual({ state: "ROTATED_ORIGINAL_KEY" });
      const retainedObject = `/recovery/${firstAssignment.keyRecordId}.2.json`;
      await linuxRuntime.runRoot("recovery", [
        "mv",
        retainedObject,
        `${retainedObject}.held`,
      ]);
      try {
        expect(
          JSON.parse(
            await linuxRuntime.run(linuxCustodyProgram, {
              ...fixtures,
              step: "missing-inventory",
            }),
          ),
        ).toEqual({ state: "MISSING_INVENTORY_DENIED" });
      } finally {
        await linuxRuntime.runRoot("recovery", [
          "mv",
          `${retainedObject}.held`,
          retainedObject,
        ]);
      }
      expect(
        JSON.parse(
          await linuxRuntime.run(linuxCustodyProgram, {
            ...fixtures,
            step: "restore",
          }),
        ),
      ).toEqual({
        state: "RESTORED_FENCED",
        assignments: 2,
        originalBindingsRetained: true,
        missingEscrowDenied: true,
      });
      expect(
        (
          await database.depositAddressAssignment.findMany({
            orderBy: { id: "asc" },
          })
        ).map(({ id, employeeId, address }) => ({ id, employeeId, address })),
      ).toEqual(
        original.map(({ id, employeeId, address }) => ({
          id,
          employeeId,
          address,
        })),
      );
      expect(
        (
          await database.financialRuntimeControl.findUniqueOrThrow({
            where: { id: 1 },
          })
        ).financialWritesFenced,
      ).toBe(true);
    });
  }, 300000);
});
