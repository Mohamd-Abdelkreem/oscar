import { describe, expect, it } from "vitest";
import {
  withPayoutFixture,
  withPayoutDatabase,
  interruptBroadcastRecord,
} from "./testing/withdrawal-payout-fixtures.js";
import { financialHistoryDigest } from "../custody/recovery-history.js";
import {
  reservationServices,
  reservationEmployee,
} from "./testing/withdrawal-reservation-fixtures.js";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { WithdrawalRecovery } from "./withdrawal-recovery.js";
import { signedPayoutRecordId } from "./withdrawal-payout.records.js";
import {
  FinancialRuntimeAdmission,
  acknowledgeFinancialBoot,
  fenceFinancialRuntime,
  changeDispatchPause,
} from "../custody/runtime-control.js";
import { withWithdrawalSnapshot } from "./testing/withdrawal-snapshot-fixtures.js";
import { withWithdrawalRole } from "./testing/withdrawal-authority-fixtures.js";
import { withdrawalRaceBarrier } from "./testing/withdrawal-fixtures.js";
import { CustodyRecovery } from "../custody/custody-recovery.js";
import { TreasuryRecovery } from "../treasury/treasury-recovery.js";
import { runWithdrawalOperation } from "./withdrawal-runtime.js";
import { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";
import { createLogger } from "../../infrastructure/logger/logger.js";
import { z } from "zod";
import { TronProviderError } from "../../infrastructure/tron/tron-provider.js";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { TronWeb } from "tronweb";
import { createLinuxCustodyRuntime } from "../custody/testing/linux-custody-runtime.js";
import {
  linuxPayoutProgram,
  linuxPayoutProvider,
  linuxPayoutArchiveClock,
} from "./testing/linux-payout-program.js";

const operatorSignalEvents = z.array(
  z
    .object({
      event: z.string().optional(),
      state: z.string(),
      code: z
        .string()
        .regex(/^[A-Z0-9_]{1,64}$/u)
        .optional(),
      withdrawalId: z.uuid().optional(),
      ageMs: z.number().int().nonnegative().optional(),
    })
    .strict(),
);

describe("original payout recovery", () => {
  it.each([
    "SIGNED_MISSING",
    "SIGNED_CONFLICT",
    "KEY_MISSING",
    "KEY_CONFLICT",
    "HISTORY_CONFLICT",
    "HISTORY_MISSING",
  ] as const)(
    "retains the pre-file intent fence when original authority is %s",
    async (damage) =>
      withPayoutFixture(async (fixture) => {
        const original = await interruptBroadcastRecord(fixture);
        if (
          original.broadcastIntentId === null ||
          original.signedRecordId === null
        )
          throw new Error("Expected original identities");
        await fenceFinancialRuntime(fixture.operator, {
          operatorIdentity: "independent-negative",
          reason: "Verify authoritative original evidence",
        });
        const history = await fixture.recoveredHistory(
          damage === "HISTORY_CONFLICT",
        );
        if (damage === "HISTORY_MISSING")
          history.environment.CUSTODY_FINANCIAL_HISTORY_FILE += ".missing";
        if (damage.startsWith("SIGNED_"))
          await fixture.damageRetainedRecord(
            original.signedRecordId,
            damage === "SIGNED_MISSING" ? "MISSING" : "CONFLICT",
          );
        if (damage.startsWith("KEY_"))
          await fixture.damageRetainedRecord(
            fixture.key.envelopeId,
            damage === "KEY_MISSING" ? "MISSING" : "CONFLICT",
          );
        await expect(
          new WithdrawalRecovery(
            fixture.operator,
            fixture.stores,
          ).completeUnacknowledgedBroadcasts(history),
        ).rejects.toThrow();
        expect(
          await fixture.stores.keys.readRecord(original.broadcastIntentId),
        ).toBeNull();
        expect(
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { id: original.id },
          }),
        ).toEqual(original);
        expect(
          (
            await fixture.database.financialRuntimeControl.findUniqueOrThrow({
              where: { id: 1 },
            })
          ).financialWritesFenced,
        ).toBe(true);
        expect(fixture.sent).toHaveLength(0);
        expect(
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        ).toMatchObject({
          state: "ACTIVE",
          nonReferralUnits: 70000000n,
          referralUnits: 30000000n,
        });
        expect(
          await fixture.database.financialOperation.count({
            where: {
              kind: { in: ["RELEASE", "SETTLE"] },
              businessKey: fixture.request.id,
            },
          }),
        ).toBe(0);
      }),
  );
  it("does not recreate a missing previously acknowledged broadcast intent", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      const original =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      if (original.broadcastIntentId === null)
        throw new Error("Expected original intent");
      await fixture.damageRetainedRecord(original.broadcastIntentId, "MISSING");
      await fenceFinancialRuntime(fixture.operator, {
        operatorIdentity: "independent-negative",
        reason: "Acknowledged record loss",
      });
      const recovery = new WithdrawalRecovery(fixture.operator, fixture.stores);
      await recovery.completeUnacknowledgedBroadcasts(
        await fixture.recoveredHistory(),
      );
      await expect(
        recovery.assertInventory(fixture.stores.archive),
      ).rejects.toThrow();
      expect(
        await fixture.stores.keys.readRecord(original.broadcastIntentId),
      ).toBeNull();
      expect(
        (
          await fixture.database.financialRuntimeControl.findUniqueOrThrow({
            where: { id: 1 },
          })
        ).financialWritesFenced,
      ).toBe(true);
      expect(fixture.sent).toHaveLength(1);
    }));
  it("completes only the original pre-file broadcast gap through independent fenced history and truthful archive readback", async () =>
    withPayoutFixture(async (fixture) => {
      const original = await interruptBroadcastRecord(fixture);
      const id = original.broadcastIntentId;
      if (id === null) throw new Error("Expected committed intent");
      expect(original).toMatchObject({
        state: "BROADCAST_INTENT",
        broadcastDigest: null,
        broadcastAckId: null,
      });
      expect(await fixture.stores.keys.readRecord(id)).toBeNull();
      await expect(fixture.stores.archive.get(id, 1)).rejects.toMatchObject({
        code: "RECOVERY_NOT_FOUND",
      });
      await expect(
        fixture.attempts().broadcast(fixture.request.id),
      ).rejects.toThrow();
      expect(await fixture.stores.keys.readRecord(id)).toBeNull();
      const recovery = new WithdrawalRecovery(fixture.operator, fixture.stores);
      const history = await fixture.recoveredHistory();
      await expect(
        recovery.completeUnacknowledgedBroadcasts(history),
      ).rejects.toThrow();
      await fenceFinancialRuntime(fixture.operator, {
        operatorIdentity: "independent-original",
        reason: "Recover original pre-file gap",
      });
      for (const ordinary of [fixture.database, fixture.signer])
        await expect(
          new WithdrawalRecovery(
            ordinary,
            fixture.stores,
          ).completeUnacknowledgedBroadcasts(history),
        ).rejects.toMatchObject({ code: "PAYOUT_AUTHORITY_DENIED" });
      const [operatorRole] = await fixture.operator.$queryRaw<
        { name: string }[]
      >`SELECT current_user AS name`;
      if (
        operatorRole === undefined ||
        !/^p08_test_[0-9a-f]{32}$/u.test(operatorRole.name)
      )
        throw new Error("Expected isolated operator role");
      await fixture.database.$executeRawUnsafe(
        `GRANT p06_signer TO "${operatorRole.name}"`,
      );
      try {
        await expect(
          recovery.completeUnacknowledgedBroadcasts(history),
        ).rejects.toMatchObject({ code: "PAYOUT_AUTHORITY_DENIED" });
        expect(await fixture.stores.keys.readRecord(id)).toBeNull();
      } finally {
        await fixture.database.$executeRawUnsafe(
          `REVOKE p06_signer FROM "${operatorRole.name}"`,
        );
      }
      const put = fixture.stores.archive.put;
      let lost = true;
      fixture.stores.archive.put = async (envelope) => {
        const ack = await put(envelope);
        if (envelope.objectId === id && lost) {
          lost = false;
          throw new Error("Lost original intent PUT reply");
        }
        return ack;
      };
      await expect(
        recovery.completeUnacknowledgedBroadcasts(history),
      ).rejects.toThrow("Lost original intent PUT reply");
      const winner = await fixture.stores.keys.readRecord(id);
      const archived = await fixture.stores.archive.get(id, 1);
      expect(archived.envelope).toEqual(winner);
      await recovery.completeUnacknowledgedBroadcasts(history);
      expect(await fixture.stores.keys.readRecord(id)).toEqual(winner);
      expect(
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { id: original.id },
        }),
      ).toEqual(original);
      expect(
        (
          await fixture.database.financialRuntimeControl.findUniqueOrThrow({
            where: { id: 1 },
          })
        ).financialWritesFenced,
      ).toBe(true);
      expect(fixture.sent).toHaveLength(0);
      expect(
        await fixture.database.financialOperation.count({
          where: {
            kind: { in: ["SETTLE", "RELEASE"] },
            businessKey: fixture.request.id,
          },
        }),
      ).toBe(0);
    }));
  it("runs original payout crash recovery and no-accept retry through built Linux signer and independent operator with pinned escrow", async () => {
    const dependencyImage = process.env["P08_TEST_DEPENDENCY_IMAGE"];
    const runtime = await createLinuxCustodyRuntime(
      dependencyImage === undefined ? {} : { dependencyImage },
    );
    try {
      await withPayoutDatabase(
        async (database, databaseUrl) => {
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
          const accepted = await services.reservations.accept(
            employee.identity,
            {
              quoteId: quote.quoteId,
              confirmed: true,
            },
          );
          const requestId = accepted.withdrawal.id;
          const acceptedRequest =
            await database.withdrawalRequest.findUniqueOrThrow({
              where: { id: requestId },
            });
          const source = TronWeb.address.fromPrivateKey("11".repeat(32));
          if (source === false) throw new Error("Invalid disposable key");
          const environment = {
            TRON_NETWORK: "TRON_NILE",
            TRON_TOKEN_CONTRACT: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
            TRON_EXPECTED_GENESIS_BLOCK_ID: "ab".repeat(32),
            TRON_PROVIDER_URL: "https://nile.trongrid.io",
            TRON_TREASURY_ADDRESS: source,
            TRON_MAX_SWEEP_UNITS: "500000000",
            TRON_ENERGY_FEE_LIMIT_SUN: "1000000",
            TRON_MAX_COMPANY_COST_SUN: "2000000",
            TRON_MAX_MANUAL_FUNDING_SUN: "2000000",
            TRON_PAYOUT_KEY_ID: randomUUID(),
            TRON_MAX_PAYOUT_UNITS: "500000000",
            TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN: "1000000",
            TRON_PAYOUT_MAX_COMPANY_COST_SUN: "2000000",
            WITHDRAWAL_PAYOUT_REPAIR_INTERVAL_MS: "1000",
            WITHDRAWAL_PENDING_ALERT_AFTER_MS: "1000",
          };
          const hostUrl = (value: string) => {
            const url = new URL(value);
            url.hostname = "host.docker.internal";
            return url.toString();
          };
          const common = {
            environment,
            requestId,
            timestamp: Date.now() - 1000,
            clockTimestamp: Date.now(),
            preload: linuxPayoutProvider,
          };
          const run = async (
            step: string,
            extra: Record<string, unknown> = {},
            user: "custody" | "worker" | "api" | "recoveryowner" = "custody",
          ) =>
            z.record(z.string(), z.unknown()).parse(
              JSON.parse(
                await runtime.run(
                  linuxPayoutProgram,
                  {
                    ...common,
                    clockTimestamp: Date.now(),
                    clockHostTimestamp:
                      performance.timeOrigin + performance.now(),
                    step,
                    ...extra,
                  },
                  user,
                ),
              ),
            );
          expect(
            await run("PREPARE", {
              encryptionKey: randomBytes(32).toString("base64"),
            }),
          ).toEqual({ state: "PREPARED" });
          await runtime.escrow();
          await runtime.preparePayoutOperator();
          await runtime.runRoot("recovery", [
            "node",
            "-e",
            linuxPayoutArchiveClock,
            String(Date.now()),
          ]);
          for (const [user, role] of [
            ["api", "p06_api"],
            ["worker", "p06_deposit_worker"],
          ] as const) {
            await withWithdrawalRole(
              { database, databaseUrl, role },
              async (_actor, actorUrl) => {
                expect(
                  await run(
                    "PUBLIC_PROCESS_OUTAGE",
                    { databaseUrl: hostUrl(actorUrl) },
                    user,
                  ),
                ).toMatchObject({ state: "PUBLIC_PROCESS_STOPPED", user });
              },
            );
          }
          expect(await database.withdrawalAttempt.count()).toBe(0);
          for (const user of ["api", "worker"] as const)
            expect(
              await run(
                "PRIVATE_ACCESS",
                {
                  deniedPaths: [
                    "/primary/encryption.key",
                    "/primary/keys",
                    "/primary/identity",
                    "/operator/encryption.key",
                    "/operator/identity",
                  ],
                },
                user,
              ),
            ).toEqual({ state: "ACCESS_DENIED", user });
          expect(
            await run("PRIVATE_ACCESS", {
              deniedPaths: ["/operator/encryption.key", "/operator/identity"],
            }),
          ).toEqual({ state: "ACCESS_DENIED", user: "custody" });
          expect(
            await run(
              "PRIVATE_ACCESS",
              { deniedPaths: ["/primary/encryption.key", "/primary/identity"] },
              "recoveryowner",
            ),
          ).toEqual({ state: "ACCESS_DENIED", user: "recoveryowner" });
          await withWithdrawalRole(
            { database, databaseUrl, role: "p06_recovery_operator" },
            async (operator, operatorUrl) => {
              expect(
                await run(
                  "PROVISION",
                  {
                    databaseUrl: hostUrl(operatorUrl),
                    privateKey: "11".repeat(32),
                  },
                  "recoveryowner",
                ),
              ).toMatchObject({
                state: "RECOVERY_ACKED",
                keyRecordId: environment.TRON_PAYOUT_KEY_ID,
              });
              await withWithdrawalRole(
                { database, databaseUrl, role: "p06_signer" },
                async (_signer, signerUrl) => {
                  const processState = { running: false };
                  const start = async (
                    options: {
                      transactionId?: string;
                      retryOriginal?: true;
                      crashBeforeBroadcastRecord?: true;
                    } = {},
                  ) => {
                    await fenceFinancialRuntime(operator, {
                      operatorIdentity: "isolated-linux-payout",
                      reason: "Fresh process requires recovered authority",
                    });
                    const boot = await run("START_SIGNER", {
                      databaseUrl: hostUrl(signerUrl),
                      ...options,
                    });
                    processState.running = true;
                    expect(
                      await run(
                        "ACKNOWLEDGE",
                        {
                          databaseUrl: hostUrl(operatorUrl),
                          bootId: boot["bootId"],
                          historyDigest: await financialHistoryDigest(database),
                          transactionId: options.transactionId,
                        },
                        "recoveryowner",
                      ),
                    ).toEqual({ state: "ACKNOWLEDGED" });
                    return boot;
                  };
                  const stop = async (
                    options: Record<string, unknown> = {},
                  ) => {
                    const stopped = await run("STOP_SIGNER", options);
                    processState.running = false;
                    return stopped;
                  };
                  const until = async (
                    work: () => Promise<boolean>,
                    timeoutMs = 60000,
                  ) => {
                    const deadline = performance.now() + timeoutMs;
                    while (performance.now() < deadline) {
                      if (await work()) return;
                      await delay(50);
                    }
                    throw new Error("Built payout state timeout");
                  };
                  await withWithdrawalSnapshot({
                    databaseUrl,
                    clients: [database, operator, _signer],
                    work: async (stale, staleUrl) => {
                      // This proof/account history is newer than the deliberately stale restore.
                      const postSnapshotEmployee = await reservationEmployee(
                        database,
                        { nonReferral: "25", now: acceptedAt },
                      );
                      try {
                        let originalId: string | null = null;
                        for (const column of [
                          "transaction_id",
                          "signed_record_id",
                          "broadcast_record",
                          "broadcast_ack_id",
                        ] as const) {
                          if (column === "broadcast_record") {
                            await start({ crashBeforeBroadcastRecord: true });
                            const gap = await run("WAIT_BROADCAST_GAP");
                            const original =
                              await database.withdrawalAttempt.findUniqueOrThrow(
                                { where: { withdrawalId: requestId } },
                              );
                            expect(original).toMatchObject({
                              state: "BROADCAST_INTENT",
                              broadcastIntentId: gap["objectId"],
                              broadcastDigest: null,
                              broadcastAckId: null,
                              broadcastAcknowledgedAt: null,
                              transactionId: originalId,
                              recipient: acceptedRequest.recipient,
                            });
                            expect(await stop({ crash: true })).toEqual({
                              state: "STOPPED",
                              builds: 1,
                              sends: [],
                            });
                            await fenceFinancialRuntime(operator, {
                              operatorIdentity: "isolated-linux-gap",
                              reason:
                                "Restore exact committed intent before first file",
                            });
                            expect(
                              await run(
                                "RESTORE",
                                {
                                  databaseUrl: hostUrl(operatorUrl),
                                  historyDigest: "00".repeat(32),
                                  reject: true,
                                },
                                "recoveryowner",
                              ),
                            ).toEqual({ state: "REJECTED_FENCED" });
                            expect(await run("WAIT_BROADCAST_GAP")).toEqual(
                              gap,
                            );
                            expect(
                              await run(
                                "RESTORE",
                                {
                                  databaseUrl: hostUrl(operatorUrl),
                                  historyDigest:
                                    await financialHistoryDigest(database),
                                },
                                "recoveryowner",
                              ),
                            ).toEqual({ state: "RECOVERED_FENCED" });
                            expect(
                              await database.withdrawalAttempt.findUniqueOrThrow(
                                { where: { id: original.id } },
                              ),
                            ).toEqual(original);
                            expect(
                              (
                                await database.financialRuntimeControl.findUniqueOrThrow(
                                  { where: { id: 1 } },
                                )
                              ).financialWritesFenced,
                            ).toBe(true);
                            expect(
                              await database.financialOperation.count({
                                where: {
                                  kind: { in: ["SETTLE", "RELEASE"] },
                                  businessKey: requestId,
                                },
                              }),
                            ).toBe(0);
                            expect(
                              await database.reservationAllocation.findUniqueOrThrow(
                                {
                                  where: { id: acceptedRequest.reservationId },
                                },
                              ),
                            ).toMatchObject({
                              state: "ACTIVE",
                              nonReferralUnits: 70000000n,
                              referralUnits: 30000000n,
                            });
                            expect(await run("READ_COUNTS")).toEqual({
                              builds: 1,
                              sends: [],
                            });
                            continue;
                          }
                          await database.$executeRawUnsafe(
                            "CREATE SEQUENCE p08_linux_attachment_count",
                          );
                          await database.$executeRawUnsafe(
                            "GRANT USAGE ON SEQUENCE p08_linux_attachment_count TO p06_signer",
                          );
                          await database.$executeRawUnsafe(
                            `CREATE FUNCTION p08_linux_attachment_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.${column} IS NULL AND NEW.${column} IS NOT NULL THEN PERFORM nextval('p08_linux_attachment_count'); RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='controlled crash'; END IF; RETURN NEW; END $$`,
                          );
                          await database.$executeRawUnsafe(
                            "CREATE TRIGGER p08_linux_attachment_failure BEFORE UPDATE ON withdrawal_attempts FOR EACH ROW EXECUTE FUNCTION p08_linux_attachment_failure()",
                          );
                          try {
                            await start();
                            await until(
                              async () =>
                                (await database.withdrawalAttempt.findUnique({
                                  where: { withdrawalId: requestId },
                                })) !== null,
                            );
                            if (column === "broadcast_ack_id")
                              await until(
                                async () =>
                                  (
                                    await database.withdrawalAttempt.findUniqueOrThrow(
                                      { where: { withdrawalId: requestId } },
                                    )
                                  ).broadcastIntentId !== null,
                              );
                            const pending =
                              await database.withdrawalAttempt.findUniqueOrThrow(
                                {
                                  where: { withdrawalId: requestId },
                                },
                              );
                            const recordId =
                              column === "transaction_id"
                                ? pending.id
                                : column === "signed_record_id"
                                  ? signedPayoutRecordId(pending.id)
                                  : pending.broadcastIntentId;
                            expect(
                              await run("WAIT_RECORD", {
                                recordId,
                                archived: column !== "transaction_id",
                              }),
                            ).toEqual({ state: "RETAINED" });
                            await until(async () => {
                              const [observed] = await database.$queryRaw<
                                { is_called: boolean }[]
                              >`SELECT is_called FROM p08_linux_attachment_count`;
                              return observed?.is_called === true;
                            });
                            expect(await stop({ crash: true })).toEqual({
                              state: "STOPPED",
                              builds: 1,
                              sends: [],
                            });
                          } catch {
                            const request =
                              await database.withdrawalRequest.findUniqueOrThrow(
                                {
                                  where: { id: requestId },
                                  select: { state: true, blocker: true },
                                },
                              );
                            const attempt =
                              await database.withdrawalAttempt.findUnique({
                                where: { withdrawalId: requestId },
                                select: { state: true, transactionId: true },
                              });
                            throw new Error(
                              `Built crash boundary ${column}: ${JSON.stringify({ request, attempt, counts: await stop({ diagnostics: true }) })}`,
                            );
                          } finally {
                            await stop();
                            await database.$executeRawUnsafe(
                              "DROP TRIGGER p08_linux_attachment_failure ON withdrawal_attempts",
                            );
                            await database.$executeRawUnsafe(
                              "DROP FUNCTION p08_linux_attachment_failure()",
                            );
                            await database.$executeRawUnsafe(
                              "DROP SEQUENCE p08_linux_attachment_count",
                            );
                          }
                          const attempt =
                            await database.withdrawalAttempt.findUniqueOrThrow({
                              where: { withdrawalId: requestId },
                            });
                          expect(
                            attempt[
                              column === "transaction_id"
                                ? "transactionId"
                                : column === "signed_record_id"
                                  ? "signedRecordId"
                                  : "broadcastAckId"
                            ],
                          ).toBeNull();
                          if (attempt.transactionId !== null) {
                            if (originalId !== null)
                              expect(attempt.transactionId).toBe(originalId);
                            originalId = attempt.transactionId;
                          }
                          expect(
                            await database.reservationAllocation.findUniqueOrThrow(
                              {
                                where: { id: acceptedRequest.reservationId },
                              },
                            ),
                          ).toMatchObject({ state: "ACTIVE" });
                        }
                        if (originalId === null)
                          throw new Error(
                            "Original transaction identity missing",
                          );
                        await run("RECEIPT_EVIDENCE", { malformed: true });
                        await start({ retryOriginal: true });
                        try {
                          await until(
                            async () =>
                              (
                                await database.withdrawalAttempt.findUniqueOrThrow(
                                  {
                                    where: { withdrawalId: requestId },
                                  },
                                )
                              ).state === "UNKNOWN",
                          );
                        } catch {
                          const request =
                            await database.withdrawalRequest.findUniqueOrThrow({
                              where: { id: requestId },
                              select: { state: true, blocker: true },
                            });
                          const attempt =
                            await database.withdrawalAttempt.findUniqueOrThrow({
                              where: { withdrawalId: requestId },
                              select: {
                                state: true,
                                blocker: true,
                                broadcastAckId: true,
                              },
                            });
                          throw new Error(
                            `Built original broadcast: ${JSON.stringify({ request, attempt, counts: await stop({ diagnostics: true }) })}`,
                          );
                        }
                        const lost =
                          await database.withdrawalAttempt.findUniqueOrThrow({
                            where: { withdrawalId: requestId },
                          });
                        expect(lost.transactionId).toBe(originalId);
                        expect(lost.broadcastAckId).not.toBeNull();
                        expect(await run("READ_COUNTS")).toEqual({
                          builds: 1,
                          sends: [],
                        });
                        expect(
                          await database.reservationAllocation.findUniqueOrThrow(
                            {
                              where: { id: acceptedRequest.reservationId },
                            },
                          ),
                        ).toMatchObject({ state: "ACTIVE" });
                        // Retry scans recheck inventory over pinned SSH before dispatch.
                        // Allow the 30-second backoff plus those real round trips.
                        try {
                          await until(
                            async () =>
                              z
                                .array(z.string())
                                .parse((await run("READ_COUNTS"))["sends"])
                                .length === 1,
                            180000,
                          );
                          await until(
                            async () =>
                              (
                                await database.withdrawalRequest.findUniqueOrThrow(
                                  { where: { id: requestId } },
                                )
                              ).blocker === "EVIDENCE_CONFLICT",
                            120000,
                          );
                          const activeDiagnostics = await run(
                            "READ_SIGNER_DIAGNOSTICS",
                          );
                          expect(activeDiagnostics).toMatchObject({
                            state: "RUNNING",
                          });
                          expect(
                            operatorSignalEvents.parse(
                              activeDiagnostics["events"],
                            ),
                          ).toEqual(
                            expect.arrayContaining([
                              expect.objectContaining({
                                event: "EVIDENCE_CONFLICT",
                                state: "ACTIVE",
                                withdrawalId: requestId,
                              }),
                              expect.objectContaining({
                                event: "UNRESOLVED_ATTEMPT",
                                state: "ACTIVE",
                                withdrawalId: requestId,
                              }),
                              expect.objectContaining({
                                event: "PENDING_WORK",
                                state: "ACTIVE",
                              }),
                            ]),
                          );
                          expect(
                            await database.financialOperation.count({
                              where: {
                                kind: { in: ["SETTLE", "RELEASE"] },
                                businessKey: requestId,
                              },
                            }),
                          ).toBe(0);
                          expect(
                            await database.reservationAllocation.findUniqueOrThrow(
                              { where: { id: acceptedRequest.reservationId } },
                            ),
                          ).toMatchObject({ state: "ACTIVE" });
                          expect(await run("READ_COUNTS")).toEqual({
                            builds: 1,
                            sends: [originalId],
                          });
                          await run("RECEIPT_EVIDENCE", { malformed: false });
                          await until(
                            async () =>
                              (
                                await database.withdrawalRequest.findUniqueOrThrow(
                                  {
                                    where: { id: requestId },
                                  },
                                )
                              ).state === "COMPLETED",
                            120000,
                          );
                          await until(async () =>
                            operatorSignalEvents
                              .parse(
                                (await run("READ_SIGNER_DIAGNOSTICS"))[
                                  "events"
                                ],
                              )
                              .some(
                                (event) =>
                                  event.event === "PENDING_WORK" &&
                                  event.state === "CLEARED",
                              ),
                          );
                          const clearedDiagnostics = await run(
                            "READ_SIGNER_DIAGNOSTICS",
                          );
                          expect(clearedDiagnostics).toMatchObject({
                            state: "RUNNING",
                          });
                          expect(
                            operatorSignalEvents.parse(
                              clearedDiagnostics["events"],
                            ),
                          ).toEqual(
                            expect.arrayContaining([
                              expect.objectContaining({
                                event: "EVIDENCE_CONFLICT",
                                state: "CLEARED",
                                withdrawalId: requestId,
                              }),
                              expect.objectContaining({
                                event: "UNRESOLVED_ATTEMPT",
                                state: "CLEARED",
                                withdrawalId: requestId,
                              }),
                            ]),
                          );
                        } catch {
                          const request =
                            await database.withdrawalRequest.findUniqueOrThrow({
                              where: { id: requestId },
                              select: {
                                state: true,
                                blocker: true,
                                nextCheckAt: true,
                              },
                            });
                          throw new Error(
                            `Built original retry: ${JSON.stringify({ request, counts: await stop({ diagnostics: true }) })}`,
                          );
                        }
                        expect(await stop()).toEqual({
                          state: "STOPPED",
                          builds: 1,
                          sends: [originalId],
                        });
                        await start({ transactionId: originalId });
                        expect(await stop()).toEqual({
                          state: "STOPPED",
                          builds: 1,
                          sends: [originalId],
                        });
                        expect(await database.withdrawalAttempt.count()).toBe(
                          1,
                        );
                        expect(
                          await database.withdrawalAction.count({
                            where: { requestId, kind: "COMPLETE" },
                          }),
                        ).toBe(1);
                        expect(
                          await database.withdrawalRequest.findUniqueOrThrow({
                            where: { id: requestId },
                          }),
                        ).toMatchObject({
                          releaseOperationId: null,
                          state: "COMPLETED",
                        });
                        const recoveredDigest =
                          await financialHistoryDigest(database);
                        const checkRestored = async (
                          restored: typeof database,
                          restoredUrl: string,
                          reject: boolean,
                        ) => {
                          await withWithdrawalRole(
                            {
                              database: restored,
                              databaseUrl: restoredUrl,
                              role: "p06_recovery_operator",
                            },
                            async (recoveredOperator, recoveredOperatorUrl) => {
                              await withWithdrawalRole(
                                {
                                  database: restored,
                                  databaseUrl: restoredUrl,
                                  role: "p06_signer",
                                },
                                async (
                                  _recoveredSigner,
                                  recoveredSignerUrl,
                                ) => {
                                  await fenceFinancialRuntime(
                                    recoveredOperator,
                                    {
                                      operatorIdentity: "isolated-linux-payout",
                                      reason:
                                        "Validate restored history and original bytes",
                                    },
                                  );
                                  const boot = await run("START_SIGNER", {
                                    databaseUrl: hostUrl(recoveredSignerUrl),
                                    transactionId: originalId,
                                  });
                                  processState.running = true;
                                  try {
                                    expect(
                                      await run(
                                        "ACKNOWLEDGE",
                                        {
                                          databaseUrl:
                                            hostUrl(recoveredOperatorUrl),
                                          bootId: boot["bootId"],
                                          transactionId: originalId,
                                          historyDigest: recoveredDigest,
                                          reject,
                                        },
                                        "recoveryowner",
                                      ),
                                    ).toEqual({
                                      state: reject
                                        ? "REJECTED_FENCED"
                                        : "ACKNOWLEDGED",
                                    });
                                    expect(
                                      (
                                        await restored.financialRuntimeControl.findUniqueOrThrow(
                                          { where: { id: 1 } },
                                        )
                                      ).financialWritesFenced,
                                    ).toBe(reject);
                                  } finally {
                                    expect(await stop()).toEqual({
                                      state: "STOPPED",
                                      builds: 1,
                                      sends: [originalId],
                                    });
                                  }
                                },
                              );
                            },
                          );
                        };
                        await checkRestored(stale, staleUrl, true);
                        expect(await stale.withdrawalAttempt.count()).toBe(0);
                        await withWithdrawalSnapshot({
                          databaseUrl,
                          clients: [database, operator, _signer],
                          work: async (recovered, recoveredUrl) => {
                            expect(
                              await financialHistoryDigest(recovered),
                            ).toBe(recoveredDigest);
                            expect(
                              await recovered.withdrawalDestinationAudit.count({
                                where: {
                                  actorUserId: postSnapshotEmployee.user.id,
                                },
                              }),
                            ).toBe(2);
                            await checkRestored(recovered, recoveredUrl, false);
                            expect(
                              (
                                await recovered.withdrawalAttempt.findUniqueOrThrow(
                                  { where: { withdrawalId: requestId } },
                                )
                              ).transactionId,
                            ).toBe(originalId);
                            const saved =
                              await recovered.withdrawalAttempt.findUniqueOrThrow(
                                { where: { withdrawalId: requestId } },
                              );
                            const recordId = saved.signedRecordId;
                            if (
                              recordId === null ||
                              !/^[0-9a-f-]{36}$/u.test(recordId)
                            )
                              throw new Error(
                                "Original signed identity missing",
                              );
                            await runtime.runRoot("recovery", [
                              "node",
                              "-e",
                              `const fs=require('node:fs');fs.renameSync('/recovery/${recordId}.1.json','/recovery/.p08-test-original');`,
                            ]);
                            try {
                              await checkRestored(
                                recovered,
                                recoveredUrl,
                                true,
                              );
                            } finally {
                              await runtime.runRoot("recovery", [
                                "node",
                                "-e",
                                `const fs=require('node:fs');fs.renameSync('/recovery/.p08-test-original','/recovery/${recordId}.1.json');`,
                              ]);
                            }
                            await runtime.runRoot("recovery", [
                              "node",
                              "-e",
                              `const fs=require('node:fs');const file='/recovery/${recordId}.1.json';const original=fs.statSync(file);fs.copyFileSync(file,'/recovery/.p08-test-original');fs.chownSync('/recovery/.p08-test-original',original.uid,original.gid);const record=JSON.parse(fs.readFileSync(file,'utf8'));record.digest='00'.repeat(32);fs.writeFileSync(file,JSON.stringify(record));`,
                            ]);
                            try {
                              await checkRestored(
                                recovered,
                                recoveredUrl,
                                true,
                              );
                            } finally {
                              await runtime.runRoot("recovery", [
                                "node",
                                "-e",
                                `const fs=require('node:fs');fs.renameSync('/recovery/.p08-test-original','/recovery/${recordId}.1.json');`,
                              ]);
                            }
                            expect(
                              await financialHistoryDigest(recovered),
                            ).toBe(recoveredDigest);
                            expect(
                              await recovered.withdrawalAction.count({
                                where: { requestId, kind: "COMPLETE" },
                              }),
                            ).toBe(1);
                          },
                        });
                      } finally {
                        if (processState.running) await stop();
                      }
                    },
                  });
                },
              );
            },
          );
        },
        { advancing: true },
      );
    } finally {
      await runtime.close();
    }
  }, 1200000);

  it("backs off UNKNOWN observations and clears the operator alert on later success during dispatch pause", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      fixture.loseReply();
      await fixture.attempts().broadcast(fixture.request.id);
      const output: string[] = [];
      const signals = new RuntimeSignals(
        createLogger({
          level: "info",
          pretty: false,
          destination: {
            write: (chunk) => {
              output.push(chunk);
            },
          },
        }),
        () => new Date(),
      );
      const attempts = fixture.attempts();
      const context = {
        database: fixture.signer,
        attempts,
        signals,
        requestId: fixture.request.id,
        operation: () => attempts.reconciliation.observe(fixture.request.id),
      };
      fixture.outcome("MISSING");
      await runWithdrawalOperation(context);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({
        state: "UNKNOWN",
        blocker: "UNRESOLVED_ATTEMPT",
        releaseOperationId: null,
      });
      expect(
        (
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { withdrawalId: fixture.request.id },
          })
        ).nextCheckAt.getTime(),
      ).toBeGreaterThan(Date.now());
      await changeDispatchPause(fixture.operator, {
        action: "PAUSE",
        operatorIdentity: "test-operator",
        reason: "Observation remains available",
      });
      fixture.outcome("SUCCESS");
      await runWithdrawalOperation(context);
      expect(
        output.map((line) =>
          z
            .object({ event: z.string(), state: z.string() })
            .parse(JSON.parse(line)),
        ),
      ).toEqual([
        expect.objectContaining({
          event: "UNRESOLVED_ATTEMPT",
          state: "ACTIVE",
        }),
        expect.objectContaining({
          event: "UNRESOLVED_ATTEMPT",
          state: "CLEARED",
        }),
      ]);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "COMPLETED" });
      expect(fixture.sent).toHaveLength(1);
    }));

  it.each(["RESOURCE_SHORTFALL", "PROVIDER_UNAVAILABLE"] as const)(
    "holds the reservation and delivers %s without claiming a new lane",
    async (blocker) =>
      withPayoutFixture(async (fixture) => {
        const output: string[] = [];
        const signals = new RuntimeSignals(
          createLogger({
            level: "info",
            pretty: false,
            destination: {
              write: (chunk) => {
                output.push(chunk);
              },
            },
          }),
          () => new Date(),
        );
        if (blocker === "PROVIDER_UNAVAILABLE")
          fixture.provider.solidifiedFloor = () =>
            Promise.reject(new TronProviderError("TRON_UNAVAILABLE"));
        else {
          const account = fixture.provider.sweepAccount;
          fixture.provider.sweepAccount = async (address) => ({
            ...(await account(address)),
            balance: 0,
          });
        }
        const attempts = fixture.attempts();
        await runWithdrawalOperation({
          database: fixture.signer,
          attempts,
          signals,
          requestId: fixture.request.id,
          operation: () => attempts.claim(fixture.request.id),
        });
        expect(
          await fixture.database.withdrawalRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
          }),
        ).toMatchObject({ state: "SCHEDULED", blocker });
        expect(
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        ).toMatchObject({ state: "ACTIVE" });
        expect(await fixture.database.withdrawalAttempt.count()).toBe(0);
        expect(
          output.map((line) =>
            z
              .object({ event: z.string(), state: z.string() })
              .parse(JSON.parse(line)),
          ),
        ).toEqual([
          expect.objectContaining({ event: blocker, state: "ACTIVE" }),
        ]);
      }),
  );
  it("delivers shortage and pause blockers to the operator JSON sink while preserving money and future backoff", async () =>
    withPayoutFixture(async (fixture) => {
      const output: string[] = [];
      const signals = new RuntimeSignals(
        createLogger({
          level: "info",
          pretty: false,
          destination: {
            write: (chunk) => {
              output.push(chunk);
            },
          },
        }),
        () => new Date(),
      );
      const attempts = fixture.attempts();
      const context = {
        database: fixture.signer,
        attempts,
        signals,
        requestId: fixture.request.id,
      };
      fixture.liquidity(0n);
      await runWithdrawalOperation({
        ...context,
        operation: () => attempts.claim(fixture.request.id),
      });
      const held = await fixture.database.withdrawalRequest.findUniqueOrThrow({
        where: { id: fixture.request.id },
      });
      expect(held).toMatchObject({
        state: "SCHEDULED",
        blocker: "LIQUIDITY_SHORTFALL",
      });
      expect(held.nextCheckAt?.getTime()).toBeGreaterThan(Date.now());
      const future = new Date(Date.now() + 3600000);
      await fixture.database.withdrawalRequest.update({
        where: { id: held.id },
        data: { nextCheckAt: future },
      });
      fixture.liquidity(500000000n);
      await changeDispatchPause(fixture.operator, {
        action: "PAUSE",
        operatorIdentity: "test-pause-operator",
        reason: "Controlled emergency pause",
      });
      await runWithdrawalOperation({
        ...context,
        operation: () => attempts.sign(fixture.request.id),
      });
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: held.id },
        }),
      ).toMatchObject({ nextCheckAt: future, blocker: "DISPATCH_PAUSED" });
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: held.reservationId },
        }),
      ).toMatchObject({ state: "ACTIVE" });
      expect(
        await fixture.database.financialRuntimeControl.findUniqueOrThrow({
          where: { id: 1 },
        }),
      ).toMatchObject({
        newDispatchPaused: true,
        operatorIdentity: "test-pause-operator",
        reason: "Controlled emergency pause",
      });
      expect(
        output.map((line) =>
          z
            .object({ event: z.string(), state: z.string() })
            .parse(JSON.parse(line)),
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: "LIQUIDITY_SHORTFALL",
            state: "ACTIVE",
          }),
          expect.objectContaining({
            event: "LIQUIDITY_SHORTFALL",
            state: "CLEARED",
          }),
          expect.objectContaining({
            event: "DISPATCH_PAUSED",
            state: "ACTIVE",
          }),
        ]),
      );
      expect(fixture.sent).toHaveLength(0);
    }));
  it("lets the independent operator inspect existing custody inventories before payout admission using production grants", async () =>
    withPayoutFixture(async (fixture) => {
      await fenceFinancialRuntime(fixture.operator, {
        operatorIdentity: "test-recovery",
        reason: "Existing private inventory inspection",
      });
      expect(
        await new CustodyRecovery(
          fixture.operator,
          fixture.stores.keys,
          fixture.stores.archive,
        ).restoreInventory(),
      ).toMatchObject({ assignments: 0 });
      await new TreasuryRecovery(
        fixture.operator,
        fixture.stores.keys,
        fixture.stores.archive,
      ).restoreInventory();
      expect(
        await fixture.database.financialRuntimeControl.findUniqueOrThrow({
          where: { id: 1 },
        }),
      ).toMatchObject({ financialWritesFenced: true });
    }));
  it("rejects an actual stale PostgreSQL snapshot and admits restored post-snapshot original authority", async () =>
    withPayoutFixture(async (fixture) => {
      await withWithdrawalSnapshot({
        databaseUrl: fixture.databaseUrl,
        clients: [fixture.database, fixture.signer, fixture.operator],
        work: async (stale) => {
          const postSnapshot = await reservationEmployee(fixture.database);
          const proofEvents =
            await fixture.database.withdrawalDestinationAudit.findMany({
              where: { actorUserId: postSnapshot.user.id },
              orderBy: { id: "asc" },
            });
          expect(proofEvents.map((event) => event.kind).sort()).toEqual([
            "PROOF_CONSUMED",
            "PROOF_ISSUED",
          ]);
          expect(
            await stale.withdrawalDestinationAudit.count({
              where: { actorUserId: postSnapshot.user.id },
            }),
          ).toBe(0);
          await fixture.attempts().sign(fixture.request.id);
          fixture.loseReply();
          await fixture.attempts().broadcast(fixture.request.id);
          const recoveredDigest = await financialHistoryDigest(
            fixture.database,
          );
          expect(await financialHistoryDigest(stale)).not.toBe(recoveredDigest);
          expect(await stale.withdrawalAttempt.count()).toBe(0);
          await fenceFinancialRuntime(stale, {
            operatorIdentity: "test-recovery",
            reason: "Stale snapshot fence",
          });
          expect(
            await stale.financialRuntimeControl.findUniqueOrThrow({
              where: { id: 1 },
            }),
          ).toMatchObject({ financialWritesFenced: true });
          await expect(
            new WithdrawalRecovery(stale, fixture.stores).verifyAdmission(
              fixture.provider,
              fixture.stores.archive,
            ),
          ).rejects.toThrow();
          await withWithdrawalSnapshot({
            databaseUrl: fixture.databaseUrl,
            clients: [fixture.database, fixture.signer, fixture.operator],
            work: async (restored, databaseUrl) => {
              expect(
                await restored.withdrawalDestinationAudit.findMany({
                  where: { actorUserId: postSnapshot.user.id },
                  orderBy: { id: "asc" },
                }),
              ).toEqual(proofEvents);
              expect(await financialHistoryDigest(restored)).toBe(
                recoveredDigest,
              );
              expect(
                await restored.withdrawalAttempt.findUniqueOrThrow({
                  where: { withdrawalId: fixture.request.id },
                }),
              ).toMatchObject({
                state: "UNKNOWN",
                transactionId: fixture.sent[0]?.txID,
              });
              await fenceFinancialRuntime(restored, {
                operatorIdentity: "test-recovery",
                reason: "Recovered original inventory",
              });
              await withWithdrawalRole(
                {
                  database: restored,
                  databaseUrl,
                  role: "p06_recovery_operator",
                },
                async (operator) => {
                  const inventory = await new WithdrawalRecovery(
                    operator,
                    fixture.stores,
                  ).verifyAdmission(fixture.provider, fixture.stores.archive);
                  expect(inventory.fingerprint).toMatch(/^[0-9a-f]{64}$/u);
                  expect(
                    await restored.reservationAllocation.findUniqueOrThrow({
                      where: { id: fixture.request.reservationId },
                    }),
                  ).toMatchObject({ state: "ACTIVE", grossUnits: 100000000n });
                },
              );
            },
          });
          expect(fixture.sent).toHaveLength(1);
        },
      });
    }));
  it("denies ordinary and mixed recovery roles even when they possess verified current inventory", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      await fenceFinancialRuntime(fixture.operator, {
        operatorIdentity: "test-recovery",
        reason: "Separate operator required",
      });
      const admission = new FinancialRuntimeAdmission(fixture.signer, "SIGNER");
      await admission.register();
      const inventory = await new WithdrawalRecovery(
        fixture.operator,
        fixture.stores,
      ).verifyAdmission(fixture.provider, fixture.stores.archive);
      const cutoff = new Date();
      const approval = {
        bootId: admission.bootId,
        operatorIdentity: "test-recovery",
        reason: "Verified retained original",
        payoutInventory: inventory,
        evidence: {
          financialHistoryReference: "restored-history",
          assignmentInventoryReference: "original-key",
          attemptInventoryReference: "original-attempt",
          reconciliationReference: "canonical-original",
          reconciliationCutoff: cutoff,
          financialHistoryRecoveredThrough: cutoff,
        },
      };
      for (const role of [
        "p06_api",
        "p06_deposit_worker",
        "p06_signer",
      ] as const) {
        await withWithdrawalRole(
          {
            database: fixture.database,
            databaseUrl: fixture.databaseUrl,
            role,
          },
          async (ordinary) => {
            await expect(
              acknowledgeFinancialBoot(ordinary, approval),
            ).rejects.toThrow();
          },
        );
      }
      const [operator] = await fixture.operator.$queryRaw<
        { name: string }[]
      >`SELECT current_user AS name`;
      if (
        operator === undefined ||
        !/^p08_test_[0-9a-f]{32}$/u.test(operator.name)
      )
        throw new Error("Disposable operator required");
      await fixture.database.$executeRawUnsafe(
        `GRANT p06_signer TO "${operator.name}"`,
      );
      try {
        await expect(
          acknowledgeFinancialBoot(fixture.operator, approval),
        ).rejects.toThrow();
      } finally {
        await fixture.database.$executeRawUnsafe(
          `REVOKE p06_signer FROM "${operator.name}"`,
        );
      }
      await fixture.database.$executeRawUnsafe(
        `ALTER ROLE "${operator.name}" CREATEROLE`,
      );
      try {
        await expect(
          acknowledgeFinancialBoot(fixture.operator, approval),
        ).rejects.toThrow();
      } finally {
        await fixture.database.$executeRawUnsafe(
          `ALTER ROLE "${operator.name}" NOCREATEROLE`,
        );
      }
      expect(
        await fixture.database.financialRuntimeControl.findUniqueOrThrow({
          where: { id: 1 },
        }),
      ).toMatchObject({ financialWritesFenced: true });
      expect(
        await fixture.database.financialRuntimeAdmission.findUniqueOrThrow({
          where: { bootId: admission.bootId },
        }),
      ).toMatchObject({ acknowledgedGeneration: null });
      await acknowledgeFinancialBoot(fixture.operator, approval);
      expect(
        await fixture.database.financialRuntimeControl.findUniqueOrThrow({
          where: { id: 1 },
        }),
      ).toMatchObject({
        financialWritesFenced: false,
        newDispatchPaused: true,
      });
    }));

  it("requires current independent inventory before admitting a fenced new signer boot", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      await fenceFinancialRuntime(fixture.operator, {
        operatorIdentity: "test-recovery",
        reason: "Isolated recovery",
      });
      const admission = new FinancialRuntimeAdmission(fixture.signer, "SIGNER");
      await admission.register();
      const cutoff = new Date();
      const approval = {
        bootId: admission.bootId,
        operatorIdentity: "test-recovery",
        reason: "Verified isolated history",
        evidence: {
          financialHistoryReference: "restored-history",
          assignmentInventoryReference: "retained-key",
          attemptInventoryReference: "original-attempt",
          reconciliationReference: "canonical-original",
          reconciliationCutoff: cutoff,
          financialHistoryRecoveredThrough: cutoff,
        },
      };
      await expect(
        acknowledgeFinancialBoot(fixture.operator, approval),
      ).rejects.toThrow();
      const recovery = new WithdrawalRecovery(fixture.operator, fixture.stores);
      const stale = await recovery.verifyAdmission(
        fixture.provider,
        fixture.stores.archive,
      );
      await fixture.database.withdrawalPolicy.update({
        where: { id: 1 },
        data: { version: { increment: 1 }, freeFeeBps: 2200 },
      });
      await expect(
        acknowledgeFinancialBoot(fixture.operator, {
          ...approval,
          payoutInventory: stale,
        }),
      ).rejects.toThrow();
      expect(
        await fixture.database.financialRuntimeControl.findUniqueOrThrow({
          where: { id: 1 },
        }),
      ).toMatchObject({ financialWritesFenced: true });
      fixture.outcome("MISSING");
      await expect(
        recovery.verifyAdmission(fixture.provider, fixture.stores.archive),
      ).rejects.toThrow();
      fixture.outcome("SUCCESS");
      const current = await recovery.verifyAdmission(
        fixture.provider,
        fixture.stores.archive,
      );
      await acknowledgeFinancialBoot(fixture.operator, {
        ...approval,
        payoutInventory: current,
      });
      expect(
        await fixture.database.financialRuntimeAdmission.findUniqueOrThrow({
          where: { bootId: admission.bootId },
        }),
      ).toMatchObject({ acknowledgedGeneration: current.generation });
      expect(
        await fixture.database.financialRuntimeControl.findUniqueOrThrow({
          where: { id: 1 },
        }),
      ).toMatchObject({
        financialWritesFenced: false,
        newDispatchPaused: true,
      });
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({ state: "ACTIVE" });
      expect(fixture.sent).toHaveLength(1);
    }));
  it("recovers the original archived signed winner when its unsigned preparation file is lost", async () =>
    withPayoutFixture(async (fixture) => {
      const clear = await fixture.failAttachment("signed_record_id");
      try {
        await expect(
          fixture.attempts().sign(fixture.request.id),
        ).rejects.toThrow();
      } finally {
        await clear();
      }
      const original =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      await fixture.discardLocalRecord(original.id);
      await new WithdrawalRecovery(
        fixture.operator,
        fixture.stores,
      ).assertInventory(fixture.stores.archive);
      const restored = await fixture.attempts().sign(fixture.request.id);
      expect(restored?.transactionId).toBe(original.transactionId);
      expect(restored?.signedRecordId).toBe(signedPayoutRecordId(original.id));
      await fixture.attempts().broadcast(fixture.request.id);
      await new WithdrawalRecovery(fixture.signer, fixture.stores).restore(
        fixture.request.id,
      );
      expect(fixture.built()).toBe(1);
      expect(fixture.sent).toHaveLength(1);
    }));

  it("restores an archived broadcast acknowledgement before observing during pause without sending again", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      const clear = await fixture.failAttachment("broadcast_ack_id");
      try {
        await expect(
          fixture.attempts().broadcast(fixture.request.id),
        ).rejects.toThrow();
      } finally {
        await clear();
      }
      const original =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      expect(original.broadcastAckId).toBeNull();
      expect(original.broadcastIntentId).not.toBeNull();
      await new WithdrawalRecovery(
        fixture.operator,
        fixture.stores,
      ).assertInventory(fixture.stores.archive);
      // The archive acknowledgement was durable, but PostgreSQL attachment failed before any send.
      expect(fixture.sent).toHaveLength(0);
      await fixture.attempts().broadcast(fixture.request.id);
      expect(fixture.sent).toHaveLength(1);
      await changeDispatchPause(fixture.operator, {
        action: "PAUSE",
        operatorIdentity: "test-operator",
        reason: "Canonical observation only",
      });
      await fixture.attempts().broadcast(fixture.request.id);
      expect(fixture.sent).toHaveLength(1);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "COMPLETED", releaseOperationId: null });
      expect(fixture.built()).toBe(1);
    }));

  it.each(["MISSING", "CONFLICT"] as const)(
    "keeps missing or conflicting original archive %s fenced without refund or replacement",
    async (mode) =>
      withPayoutFixture(async (fixture) => {
        await fixture.attempts().sign(fixture.request.id);
        await fixture.attempts().broadcast(fixture.request.id);
        const original =
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { withdrawalId: fixture.request.id },
          });
        if (original.signedRecordId === null)
          throw new Error("Signed original required");
        await fixture.damageRetainedRecord(original.signedRecordId, mode);
        await fenceFinancialRuntime(fixture.operator, {
          operatorIdentity: "test-recovery",
          reason: "Unavailable original archive",
        });
        await expect(
          new WithdrawalRecovery(
            fixture.operator,
            fixture.stores,
          ).verifyAdmission(fixture.provider, fixture.stores.archive),
        ).rejects.toThrow();
        expect(
          await fixture.database.financialRuntimeControl.findUniqueOrThrow({
            where: { id: 1 },
          }),
        ).toMatchObject({ financialWritesFenced: true });
        expect(
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { id: original.id },
          }),
        ).toEqual(original);
        expect(
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        ).toMatchObject({ state: "ACTIVE" });
        expect(
          await fixture.database.financialOperation.count({
            where: { kind: { in: ["RELEASE", "SETTLE"] } },
          }),
        ).toBe(0);
        expect(fixture.sent).toHaveLength(1);
        expect(fixture.built()).toBe(1);
      }),
  );

  it("reconciles a lost broadcast reply after restart without another payment", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      fixture.loseReply();
      const uncertain = await fixture.attempts().broadcast(fixture.request.id);
      expect(uncertain.state).toBe("UNKNOWN");
      const original = fixture.sent[0];
      expect(original).toBeDefined();
      expect(
        await fixture.attempts().reconciliation.observe(fixture.request.id),
      ).toMatchObject({ state: "COMPLETED" });
      expect(
        (await fixture.attempts().broadcast(fixture.request.id)).transactionId,
      ).toBe(original?.txID);
      expect(fixture.sent).toHaveLength(1);
      expect(fixture.built()).toBe(1);
    }));

  it("keeps UNKNOWN sources, original recipient and active slot under absent evidence and restrictions", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      fixture.loseReply();
      await fixture.attempts().broadcast(fixture.request.id);
      fixture.outcome("MISSING");
      await fixture.database.user.update({
        where: { id: fixture.employee.identity.userId },
        data: { withdrawalsBlocked: true, status: "BANNED" },
      });
      await changeDispatchPause(fixture.operator, {
        action: "PAUSE",
        operatorIdentity: "test-recovery",
        reason: "Preserve original observation",
      });
      await expect(
        fixture.attempts().reconciliation.observe(fixture.request.id),
      ).rejects.toThrow();
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({
        state: "UNKNOWN",
        recipient: fixture.request.recipient,
        releaseOperationId: null,
      });
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({
        state: "ACTIVE",
        nonReferralUnits: 70000000n,
        referralUnits: 30000000n,
      });
      expect(
        await fixture.database.withdrawalAttempt.count({
          where: { state: "UNKNOWN" },
        }),
      ).toBe(1);
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "RELEASE" },
        }),
      ).toBe(0);
      fixture.outcome("SUCCESS");
      await fixture.setTime(new Date(Date.now() + 7 * 86400000));
      expect(
        await fixture.attempts().reconciliation.observe(fixture.request.id),
      ).toMatchObject({ state: "COMPLETED" });
      expect(fixture.sent).toHaveLength(1);
    }));

  it("releases only original sources once on canonical final failure, with no fee or replacement", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      fixture.outcome("CHAIN_FAILED");
      const barrier = withdrawalRaceBarrier(2);
      const originalBlock = fixture.provider.transactionBlock;
      fixture.provider.transactionBlock = async () => {
        await barrier();
        return originalBlock();
      };
      await Promise.all([
        fixture.attempts().reconciliation.observe(fixture.request.id),
        fixture.attempts().reconciliation.observe(fixture.request.id),
      ]);
      fixture.provider.transactionBlock = originalBlock;
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "FAILED", settlementOperationId: null });
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({
        state: "RELEASED",
        nonReferralUnits: 70000000n,
        referralUnits: 30000000n,
      });
      expect(
        await fixture.database.wallet.findUniqueOrThrow({
          where: { id: fixture.request.walletId },
        }),
      ).toMatchObject({
        availableNonReferralUnits: 70000000n,
        availableReferralUnits: 50000000n,
        reservedNonReferralUnits: 0n,
        reservedReferralUnits: 0n,
      });
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "RELEASE" },
        }),
      ).toBe(1);
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "SETTLE" },
        }),
      ).toBe(0);
      expect(
        await fixture.database.withdrawalAction.count({
          where: { requestId: fixture.request.id, kind: "SAFE_FAIL" },
        }),
      ).toBe(1);
      expect(
        await fixture.database.treasuryPayoutKey.findUniqueOrThrow({
          where: { id: fixture.key.id },
        }),
      ).toMatchObject({ lastFinalBlockNumber: 101n });
      const now = new Date();
      await fixture.database.withdrawalPolicy.update({
        where: { id: 1 },
        data: { version: { increment: 1 }, maximumGrossUnits: 90000000n },
      });
      const services = reservationServices(fixture.database, () => now);
      const quote = await services.quotes.create(fixture.employee.identity, {
        gross: "80",
      });
      const accepted = await services.reservations.accept(
        fixture.employee.identity,
        { quoteId: quote.quoteId, confirmed: true },
      );
      const next = await fixture.database.withdrawalRequest.findUniqueOrThrow({
        where: { id: accepted.withdrawal.id },
      });
      expect(next.id).not.toBe(fixture.request.id);
      expect(next.grossUnits).toBe(80000000n);
      const currentQuote =
        await fixture.database.withdrawalQuote.findUniqueOrThrow({
          where: { id: next.quoteId },
        });
      const originalQuote =
        await fixture.database.withdrawalQuote.findUniqueOrThrow({
          where: { id: fixture.request.quoteId },
        });
      expect(currentQuote.policyVersion).toBeGreaterThan(
        originalQuote.policyVersion,
      );
      expect(next.originalDueAt.toISOString()).toBe(
        new BusinessClock(() => now).initialWithdrawalDeadline(
          next.acceptedAt.toISOString(),
        ),
      );
      fixture.outcome("SUCCESS");
      await expect(
        fixture.attempts().reconciliation.observe(fixture.request.id),
      ).rejects.toThrow();
      expect(fixture.sent).toHaveLength(1);
    }));

  it("rejects a forged source floor and final failure below the original admission floor without releasing money", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      fixture.outcome("CHAIN_FAILED");
      await expect(
        fixture.database.treasuryPayoutKey.update({
          where: { id: fixture.key.id },
          data: { lastFinalBlockNumber: 102n },
        }),
      ).rejects.toThrow("Source floor requires matching terminal lane");
      const originalInfo = fixture.provider.transactionInfo;
      fixture.provider.transactionInfo = async (id) => ({
        ...(await originalInfo(id)),
        blockNumber: 99,
      });
      const originalBlock = fixture.provider.transactionBlock;
      fixture.provider.transactionBlock = async () => ({
        ...(await originalBlock()),
        number: 99,
      });
      const canonicalBlock = fixture.provider.block;
      fixture.provider.block = async (number) => ({
        ...(await canonicalBlock(number)),
        number,
      });
      await expect(
        fixture.attempts().reconciliation.observe(fixture.request.id),
      ).rejects.toThrow();
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({ state: "ACTIVE" });
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "RELEASE" },
        }),
      ).toBe(0);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "SUBMITTED", releaseOperationId: null });
      expect(fixture.sent).toHaveLength(1);
    }));

  it("rolls back release, terminal identity, lane floor and audit when SAFE_FAIL insertion fails", async () =>
    withPayoutFixture(async (fixture) => {
      await fixture.attempts().sign(fixture.request.id);
      await fixture.attempts().broadcast(fixture.request.id);
      fixture.outcome("CHAIN_FAILED");
      const before = await fixture.database.wallet.findUniqueOrThrow({
        where: { id: fixture.request.walletId },
      });
      await fixture.database.$executeRawUnsafe(
        "CREATE FUNCTION p08_test_fail_action() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='SAFE_FAIL' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='controlled failure audit'; END IF; RETURN NEW; END $$",
      );
      await fixture.database.$executeRawUnsafe(
        "CREATE TRIGGER p08_test_fail_action AFTER INSERT ON withdrawal_actions FOR EACH ROW EXECUTE FUNCTION p08_test_fail_action()",
      );
      try {
        await expect(
          fixture.attempts().reconciliation.observe(fixture.request.id),
        ).rejects.toThrow();
      } finally {
        await fixture.database.$executeRawUnsafe(
          "DROP TRIGGER p08_test_fail_action ON withdrawal_actions",
        );
        await fixture.database.$executeRawUnsafe(
          "DROP FUNCTION p08_test_fail_action()",
        );
      }
      expect(
        await fixture.database.wallet.findUniqueOrThrow({
          where: { id: before.id },
        }),
      ).toEqual(before);
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({ state: "ACTIVE" });
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "SUBMITTED", releaseOperationId: null });
      expect(
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        }),
      ).toMatchObject({ state: "SUBMITTED", finalEvidence: null });
      expect(
        await fixture.database.treasuryPayoutKey.findUniqueOrThrow({
          where: { id: fixture.key.id },
        }),
      ).toMatchObject({ lastFinalBlockNumber: 0n });
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "RELEASE" },
        }),
      ).toBe(0);
      expect(
        await fixture.attempts().reconciliation.observe(fixture.request.id),
      ).toMatchObject({ state: "FAILED" });
    }));

  it("detects post-snapshot singleton policy authority in the financial history inventory", async () =>
    withPayoutFixture(async (fixture) => {
      const attempt = await fixture.attempts().sign(fixture.request.id);
      if (attempt === null) throw new Error("Original attempt required");
      const snapshot = await financialHistoryDigest(fixture.database);
      const before = await fixture.operator.$queryRaw<
        { fingerprint: string }[]
      >`SELECT p08_recovery_fingerprint() AS fingerprint`;
      await fixture.database.withdrawalRequest.update({
        where: { id: fixture.request.id },
        data: { nextCheckAt: new Date(), blocker: "PROVIDER_UNAVAILABLE" },
      });
      await fixture.database.withdrawalAttempt.update({
        where: { id: attempt.id },
        data: {
          nextCheckAt: new Date(),
          blocker: "PROVIDER_UNAVAILABLE",
          version: { increment: 1 },
        },
      });
      expect(await financialHistoryDigest(fixture.database)).toBe(snapshot);
      expect(
        await fixture.operator.$queryRaw<
          { fingerprint: string }[]
        >`SELECT p08_recovery_fingerprint() AS fingerprint`,
      ).toEqual(before);
      await fixture.database.withdrawalPolicy.update({
        where: { id: 1 },
        data: { version: { increment: 1 }, freeFeeBps: 2200 },
      });
      expect(await financialHistoryDigest(fixture.database)).not.toBe(snapshot);
    }));
});
