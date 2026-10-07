import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@template/database";
import { DepositIndexer } from "./deposit-indexer.js";
import { DepositVerifier } from "./deposit-verifier.js";
import { DepositCreditService } from "./deposit-credit.service.js";
import {
  rawDeposit,
  withDepositProvider,
  createDepositAssignment,
  depositClock,
  transferLog,
} from "./testing/deposit-fixtures.js";
import {
  withAdmittedFinancialDatabase,
  financialFixtureAdmission,
} from "../ledger/testing/financial-fixtures.js";
import { DepositReconciliation } from "./deposit-reconciliation.js";
import {
  financialHistoryDigest,
  verifyRecoveredFinancialHistory,
} from "../custody/recovery-history.js";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";
import { createLogger } from "../../infrastructure/logger/logger.js";
import { randomUUID } from "node:crypto";
import { financialRaceBarrier } from "../ledger/testing/financial-fixtures.js";
import { acceptedReviewFixture } from "../task-submissions/testing/review-fixtures.js";
import { withTaskFileFixture } from "../tasks/testing/task-fixtures.js";
import { taskHttpToken } from "../tasks/testing/task-http-fixtures.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { assertSessionAuthority } from "../auth/session-authority.js";
import { fundSubscriptionFixture } from "../subscriptions/testing/subscription-fixtures.js";
import {
  bindDepositAssignment,
  depositRecipient,
  depositToken,
} from "./testing/deposit-fixtures.js";
import { runLinuxProofProgram } from "../proofs/testing/linux-proof-runtime.js";
import { depositBootProgram } from "./testing/deposit-boot-program.js";
import { runtimeAuthorityRejections } from "../custody/testing/runtime-authority-fixtures.js";
import {
  fenceFinancialRuntime,
  acknowledgeFinancialBoot,
  FinancialRuntimeAdmission,
} from "../custody/runtime-control.js";

const url = process.env["DATABASE_URL"];
if (url === undefined) throw new Error("Missing disposable database");
const database = createDatabaseClient(url);
afterAll(() => database.$disconnect());

describe("durable deposit recovery", () => {
  it("acknowledges only the selected current boots atomically under one protected recovery fence", async () => {
    await withAdmittedFinancialDatabase(async (isolated) => {
      const api = new FinancialRuntimeAdmission(isolated, "API");
      const worker = new FinancialRuntimeAdmission(isolated, "DEPOSIT_WORKER");
      await api.register();
      await worker.register();
      await fenceFinancialRuntime(isolated, {
        operatorIdentity: "test-operator",
        reason: "test coordinated recovery",
      });
      const control = await isolated.financialRuntimeControl.findUniqueOrThrow({
        where: { id: 1 },
      });
      const cutoff = new Date();
      const approval = {
        bootId: api.bootId,
        operatorIdentity: "test-operator",
        reason: "Known disposable history",
        expectedGeneration: control.generation,
        expectedFencedVersion: control.version,
        evidence: {
          financialHistoryReference: "isolated-history",
          assignmentInventoryReference: "isolated-assignments",
          attemptInventoryReference: "isolated-attempts",
          reconciliationReference: "isolated-reconciliation",
          reconciliationCutoff: cutoff,
          financialHistoryRecoveredThrough: cutoff,
        },
      };
      await expect(
        acknowledgeFinancialBoot(isolated, {
          ...approval,
          additionalBootIds: [worker.bootId, randomUUID()],
        }),
      ).rejects.toThrow();
      expect(
        await isolated.financialRuntimeAdmission.count({
          where: {
            bootId: { in: [api.bootId, worker.bootId] },
            acknowledgedAt: { not: null },
          },
        }),
      ).toBe(0);
      expect(
        (
          await isolated.financialRuntimeControl.findUniqueOrThrow({
            where: { id: 1 },
          })
        ).financialWritesFenced,
      ).toBe(true);
      await acknowledgeFinancialBoot(isolated, {
        ...approval,
        additionalBootIds: [worker.bootId],
      });
      await isolated.$transaction((transaction) =>
        api.assertMutationAdmission(transaction),
      );
      await isolated.$transaction((transaction) =>
        worker.assertMutationAdmission(transaction),
      );
      await expect(
        acknowledgeFinancialBoot(isolated, approval),
      ).rejects.toMatchObject({ code: "FINANCIAL_WRITES_FENCED" });
    });
  });
  it("rolls back candidate and page progress together and lets competing connections claim one candidate", async () => {
    await withAdmittedFinancialDatabase(async (isolated, isolatedUrl) => {
      await createDepositAssignment(isolated);
      const raw = rawDeposit();
      let now = depositClock();
      await withDepositProvider(
        raw,
        async (provider, config) => {
          const admission = financialFixtureAdmission(isolated);
          const credit = new DepositCreditService(
            isolated,
            new DepositVerifier(isolated, provider, config, () => now),
            admission,
            () => now,
          );
          const indexer = new DepositIndexer(isolated, {
            provider,
            config,
            credit,
            admission,
            clock: () => now,
          });
          await isolated.$executeRawUnsafe(
            "CREATE FUNCTION fail_page_candidate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test page interruption'; END $$",
          );
          await isolated.$executeRawUnsafe(
            "CREATE TRIGGER fail_page_candidate BEFORE INSERT ON deposit_candidates FOR EACH ROW EXECUTE FUNCTION fail_page_candidate()",
          );
          try {
            await expect(indexer.scanNext()).rejects.toThrow();
          } finally {
            await isolated.$executeRawUnsafe(
              "DROP TRIGGER fail_page_candidate ON deposit_candidates",
            );
          }
          expect(await isolated.depositCandidate.count()).toBe(0);
          expect(await isolated.depositCandidateDiscovery.count()).toBe(0);
          expect(
            await isolated.depositScanProgress.findFirst({
              where: { mode: "HOT" },
            }),
          ).toMatchObject({ fingerprint: null, lastCompletedAt: null });
          now = new Date(now.getTime() + 120001);
          await indexer.scanNext();
          await indexer.scanNext();
          expect(await isolated.depositCandidate.count()).toBe(1);
          expect(await isolated.depositCandidateDiscovery.count()).toBe(1);
          const first = createDatabaseClient(isolatedUrl);
          const second = createDatabaseClient(isolatedUrl);
          try {
            const start = financialRaceBarrier(2);
            const replies = await Promise.all(
              [first, second].map(async (client) => {
                await start();
                const ownCredit = new DepositCreditService(
                  client,
                  new DepositVerifier(client, provider, config, () => now),
                  admission,
                  () => now,
                );
                return new DepositIndexer(client, {
                  provider,
                  config,
                  credit: ownCredit,
                  admission,
                  clock: () => now,
                }).accountNext();
              }),
            );
            expect(replies.filter(Boolean)).toHaveLength(1);
            expect(await isolated.depositReceipt.count()).toBe(1);
            expect(await isolated.depositCandidate.findFirst()).toMatchObject({
              state: "ACCOUNTED",
            });
          } finally {
            await first.$disconnect();
            await second.$disconnect();
          }
        },
        () =>
          new Response(
            JSON.stringify({
              success: true,
              data: [
                {
                  transaction_id: raw.transactionId,
                  block_timestamp: raw.info.blockTimeStamp,
                },
              ],
              meta: {},
            }),
          ),
      );
    });
  });
  it("starts the actual built nonowner API and worker closed against stale OPEN, admits their own boots and invalidates both after restore", async () => {
    await withAdmittedFinancialDatabase(async (isolated, databaseUrl) =>
      withTaskFileFixture(async (root) => {
        const review = await acceptedReviewFixture(isolated, root);
        const buyer = await createIdentityFixture(isolated);
        await fundSubscriptionFixture(
          isolated,
          buyer,
          { referral: "0", nonReferral: "100" },
          new Date(),
        );
        if (buyer.wallet === null) throw new Error("Missing wallet");
        await bindDepositAssignment(isolated, {
          ownerUserId: buyer.user.id,
          wallet: buyer.wallet,
        });
        const suffix = randomUUID().replaceAll("-", "");
        const password = randomUUID();
        const apiRole = `p06_boot_api_${suffix}`;
        const workerRole = `p06_boot_worker_${suffix}`;
        const recoveryRole = `p06_boot_recovery_${suffix}`;
        const signerRole = `p06_boot_signer_${suffix}`;
        const tableOwnerRole = `p06_boot_owner_${suffix}`;
        for (const [role, group] of [
          [apiRole, "p06_api"],
          [workerRole, "p06_deposit_worker"],
          [recoveryRole, "p06_recovery_operator"],
          [signerRole, "p06_signer"],
          [tableOwnerRole, "p06_api"],
        ] as const) {
          await isolated.$executeRawUnsafe(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${group}') THEN CREATE ROLE ${group} NOLOGIN; END IF; END $$`,
          );
          await isolated.$executeRawUnsafe(
            `CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`,
          );
          await isolated.$executeRawUnsafe(`GRANT ${group} TO "${role}"`);
          await isolated.$executeRawUnsafe(
            `GRANT USAGE ON SCHEMA public TO "${role}"`,
          );
          await isolated.$executeRawUnsafe(
            `GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`,
          );
          await isolated.$executeRawUnsafe(
            `GRANT INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`,
          );
        }
        await isolated.$executeRawUnsafe(`GRANT p06_api TO "${recoveryRole}"`);
        await isolated.$executeRawUnsafe(
          `ALTER TABLE manual_credits OWNER TO "${tableOwnerRole}"`,
        );
        const workerRejections = await runtimeAuthorityRejections(
          isolated,
          databaseUrl,
          "p06_deposit_worker",
        );
        const raw = rawDeposit();
        raw.info.blockTimeStamp = Date.now() - 1000;
        raw.block.block_header.raw_data.timestamp = raw.info.blockTimeStamp;
        raw.solidified.block_header.raw_data.timestamp =
          raw.info.blockTimeStamp;
        const output = await runLinuxProofProgram(
          depositBootProgram,
          databaseUrl,
          {
            apiRole,
            workerRole,
            recoveryRole,
            signerRole,
            tableOwnerRole,
            workerRejections,
            password,
            oldBootId: financialFixtureAdmission(isolated).bootId,
            buyerToken: taskHttpToken(buyer),
            adminToken: taskHttpToken(review.admin),
            submissionId: review.submission.id,
            review: review.intent,
            raw,
            token: depositToken,
            recipient: depositRecipient,
          },
        );
        expect(JSON.parse(output)).toEqual({
          state: "ACTUAL_BOOTS_FENCED",
          purchaseDenied: true,
          rewardDenied: true,
          depositDeniedBeforeAcknowledgement: true,
          admittedPurchaseAndDeposit: true,
          restoreInvalidated: true,
          observationsAvailable: true,
          cleanShutdown: true,
          unsafeCredentialsDenied: true,
          unsafeWorkerCredentialsDenied: workerRejections.length,
        });
      }),
    );
  }, 300000);
  it("retains fixed inclusive bounds across equal-time pages and accounts every raw log once", async () => {
    await withAdmittedFinancialDatabase(async (isolated) => {
      const account = await createDepositAssignment(isolated);
      const raw = rawDeposit();
      const queries: URLSearchParams[] = [];
      await withDepositProvider(
        raw,
        async (provider, config) => {
          const admission = financialFixtureAdmission(isolated);
          const credit = new DepositCreditService(
            isolated,
            new DepositVerifier(isolated, provider, config, depositClock),
            admission,
            depositClock,
          );
          const indexer = new DepositIndexer(isolated, {
            provider,
            credit,
            config,
            admission,
            clock: depositClock,
          });
          await indexer.scanNext();
          expect(await isolated.depositCandidate.count()).toBe(1);
          const progress = await isolated.depositScanProgress.findFirstOrThrow({
            where: { mode: "HOT" },
          });
          expect(progress.lastCompletedAt).toEqual(depositClock());
          expect(queries).toHaveLength(2);
          for (const key of [
            "min_timestamp",
            "max_timestamp",
            "contract_address",
            "limit",
            "order_by",
          ])
            expect(queries[1]?.get(key)).toBe(queries[0]?.get(key));
          await indexer.accountNext();
          expect(await isolated.depositCandidate.findFirst()).toMatchObject({
            state: "ACCOUNTED",
          });
          expect(
            await isolated.wallet.findUnique({
              where: { id: account.wallet.id },
            }),
          ).toMatchObject({ availableNonReferralUnits: 1000001n });
          expect(await isolated.depositReceipt.count()).toBe(1);
        },
        (request) => {
          queries.push(request.searchParams);
          return new Response(
            JSON.stringify({
              success: true,
              data: [
                {
                  transaction_id: raw.transactionId,
                  block_timestamp: raw.info.blockTimeStamp,
                },
              ],
              meta: request.searchParams.has("fingerprint")
                ? {}
                : { fingerprint: "second-page" },
            }),
          );
        },
      );
    });
  });

  it("does not advance on outage and restarts rejected cursors in the same window", async () => {
    await withAdmittedFinancialDatabase(async (isolated) => {
      await createDepositAssignment(isolated);
      const raw = rawDeposit();
      let stage = 0;
      const queries: URLSearchParams[] = [];
      await withDepositProvider(
        raw,
        async (provider, original) => {
          const config = {
            ...original,
            pagesPerAddress: 1,
            maximumAttempts: 1,
          };
          const admission = financialFixtureAdmission(isolated);
          const credit = new DepositCreditService(
            isolated,
            new DepositVerifier(isolated, provider, config, depositClock),
            admission,
            depositClock,
          );
          let now = depositClock();
          const indexer = new DepositIndexer(isolated, {
            provider,
            credit,
            config,
            admission,
            clock: () => now,
          });
          await indexer.scanNext();
          const before = await isolated.depositScanProgress.findFirstOrThrow({
            where: { fingerprint: "expired" },
          });
          stage = 1;
          // Let only this HOT row be due so HISTORICAL fairness cannot consume the test step.
          await isolated.depositScanProgress.updateMany({
            where: { id: { not: before.id } },
            data: { nextAttemptAt: new Date(now.getTime() + 1000000) },
          });
          now = new Date(now.getTime() + 10000);
          await indexer.scanNext();
          const rejected = await isolated.depositScanProgress.findUniqueOrThrow(
            { where: { id: before.id } },
          );
          expect(rejected).toMatchObject({
            fingerprint: null,
            windowFrom: before.windowFrom,
            windowTo: before.windowTo,
            lastCompletedAt: null,
          });
          stage = 2;
          now = new Date(now.getTime() + 10000);
          await indexer.scanNext();
          expect(
            await isolated.depositScanProgress.findUnique({
              where: { id: before.id },
            }),
          ).toMatchObject({
            windowFrom: before.windowFrom,
            windowTo: before.windowTo,
            lastCompletedAt: null,
          });
          expect(queries[2]?.get("min_timestamp")).toBe(
            queries[0]?.get("min_timestamp"),
          );
          stage = 3;
          now = new Date(now.getTime() + 10000);
          await indexer.scanNext();
          expect(
            await isolated.depositScanProgress.findUnique({
              where: { id: before.id },
            }),
          ).toMatchObject({
            windowFrom: before.windowFrom,
            windowTo: before.windowTo,
            lastCompletedAt: null,
          });
          expect(queries[3]?.get("min_timestamp")).toBe(
            queries[0]?.get("min_timestamp"),
          );
        },
        (request) => {
          queries.push(request.searchParams);
          if (stage === 1) return new Response("{}", { status: 400 });
          if (stage === 2) throw new TypeError("sentinel-provider-secret");
          if (stage === 3) return new Response("{}", { status: 429 });
          return new Response(
            JSON.stringify({
              success: true,
              data: [],
              meta: { fingerprint: "expired" },
            }),
          );
        },
      );
    });
  });

  it("replays an expired lease after financial commit before acknowledgement without a second credit", async () => {
    await withAdmittedFinancialDatabase(async (isolated) => {
      const account = await createDepositAssignment(isolated);
      const raw = rawDeposit([transferLog(), transferLog(undefined, 1n)]);
      let now = depositClock();
      await isolated.depositCandidate.create({
        data: {
          network: "TRON_NILE",
          transactionId: raw.transactionId,
          firstObservedAt: now,
          lastObservedAt: now,
          nextAttemptAt: now,
        },
      });
      await withDepositProvider(raw, async (provider, config) => {
        const admission = financialFixtureAdmission(isolated);
        const verifier = new DepositVerifier(
          isolated,
          provider,
          config,
          () => now,
        );
        const credit = new DepositCreditService(
          isolated,
          verifier,
          admission,
          () => now,
        );
        const indexer = new DepositIndexer(isolated, {
          provider,
          config,
          credit,
          admission,
          clock: () => now,
        });
        await isolated.$executeRawUnsafe(
          "CREATE FUNCTION fail_candidate_ack() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='ACCOUNTED' THEN RAISE EXCEPTION 'test interruption'; END IF; RETURN NEW; END $$",
        );
        await isolated.$executeRawUnsafe(
          "CREATE TRIGGER fail_candidate_ack BEFORE UPDATE ON deposit_candidates FOR EACH ROW EXECUTE FUNCTION fail_candidate_ack()",
        );
        try {
          await expect(indexer.accountNext()).rejects.toThrow();
        } finally {
          await isolated.$executeRawUnsafe(
            "DROP TRIGGER fail_candidate_ack ON deposit_candidates",
          );
        }
        expect(await isolated.depositReceipt.count()).toBe(2);
        expect(await isolated.depositCandidate.findFirst()).toMatchObject({
          state: "VERIFYING",
          accountedAt: null,
        });
        now = new Date(now.getTime() + 120001);
        const restarted = new DepositIndexer(isolated, {
          provider,
          config,
          credit,
          admission,
          clock: () => now,
        });
        await restarted.accountNext();
        expect(await isolated.depositCandidate.findFirst()).toMatchObject({
          state: "ACCOUNTED",
        });
        expect(await isolated.depositReceipt.count()).toBe(2);
        expect(
          await isolated.wallet.findUnique({
            where: { id: account.wallet.id },
          }),
        ).toMatchObject({ availableNonReferralUnits: 1000002n });
        const reconciliation = new DepositReconciliation(isolated, verifier);
        expect(
          await reconciliation.inspectCandidate(raw.transactionId, "TRON_NILE"),
        ).toMatchObject({ state: "ACCOUNTED" });
        expect(await reconciliation.inspectBatch()).toMatchObject({
          consistent: true,
        });
      });
    });
  });

  it("rediscovers delayed history outside hot overlap from the retained chain floor with skewed host time", async () => {
    await withAdmittedFinancialDatabase(async (isolated) => {
      await createDepositAssignment(isolated);
      const raw = rawDeposit();
      raw.block.block_header.raw_data.timestamp = 1000;
      raw.info.blockTimeStamp = 1000;
      raw.solidified.block_header.raw_data.number = 124;
      raw.solidified.blockID = "bc".repeat(32);
      let visible = false;
      let now = depositClock();
      await withDepositProvider(
        raw,
        async (provider, config) => {
          const admission = financialFixtureAdmission(isolated);
          const credit = new DepositCreditService(
            isolated,
            new DepositVerifier(isolated, provider, config, () => now),
            admission,
            () => now,
          );
          const indexer = new DepositIndexer(isolated, {
            provider,
            credit,
            config,
            admission,
            clock: () => now,
          });
          await indexer.scanNext(); // HOT cannot cover the delayed old block.
          now = new Date(now.getTime() + 1);
          await indexer.scanNext(); // An empty first historical page is not permanent retirement.
          expect(await isolated.depositCandidate.count()).toBe(0);
          const history = await isolated.depositScanProgress.findFirstOrThrow({
            where: { mode: "HISTORICAL" },
          });
          // Simulate the persisted end of the cycle; restarting must return to the original floor.
          await isolated.depositScanProgress.update({
            where: { id: history.id },
            data: {
              windowFrom: BigInt(
                raw.solidified.block_header.raw_data.timestamp,
              ),
              windowTo: BigInt(raw.solidified.block_header.raw_data.timestamp),
              nextWindowFrom: BigInt(
                raw.solidified.block_header.raw_data.timestamp,
              ),
              nextAttemptAt: now,
            },
          });
          await isolated.depositScanProgress.updateMany({
            where: { mode: "HOT" },
            data: { nextAttemptAt: new Date(now.getTime() + 1000000) },
          });
          now = new Date(now.getTime() + 10000);
          visible = true;
          await new DepositIndexer(isolated, {
            provider,
            credit,
            config,
            admission,
            clock: () => now,
          }).scanNext();
          expect(
            await isolated.depositScanProgress.findUnique({
              where: { id: history.id },
            }),
          ).toMatchObject({ historyBoundary: 1n, windowFrom: 1n, cycle: 1 });
          expect(await isolated.depositCandidate.count()).toBe(1);
          await indexer.accountNext();
          expect(await isolated.depositReceipt.count()).toBe(1);
        },
        (request) =>
          new Response(
            JSON.stringify({
              success: true,
              data:
                visible &&
                Number(request.searchParams.get("min_timestamp")) <= 1000
                  ? [
                      {
                        transaction_id: raw.transactionId,
                        block_timestamp: 1000,
                      },
                    ]
                  : [],
              meta: {},
            }),
          ),
      );
    });
  });

  it("queues protected inbound recovery without credit and refuses retained conflicts absent from discovery", async () => {
    await withAdmittedFinancialDatabase(async (isolated) => {
      await createDepositAssignment(isolated);
      const raw = rawDeposit();
      await withDepositProvider(
        raw,
        async (provider, config) => {
          await fenceFinancialRuntime(isolated, {
            operatorIdentity: "test-operator",
            reason: "test restore",
          });
          const control =
            await isolated.financialRuntimeControl.findUniqueOrThrow({
              where: { id: 1 },
            });
          const reconciliation = new DepositReconciliation(
            isolated,
            new DepositVerifier(isolated, provider, config, depositClock),
          );
          await reconciliation.recoverInbound({
            provider,
            config,
            generation: control.generation,
            cutoff: depositClock(),
          });
          expect(
            await isolated.depositCandidate.count({
              where: { state: "PENDING" },
            }),
          ).toBe(1);
          expect(await isolated.depositReceipt.count()).toBe(0);
          expect(await isolated.financialOperation.count()).toBe(0);
          await isolated.depositCandidate.updateMany({
            data: {
              state: "CONFLICT",
              lastErrorCode: "DEPOSIT_EVIDENCE_CONFLICT",
            },
          });
          await expect(
            reconciliation.recoverInbound({
              provider,
              config,
              generation: control.generation,
              cutoff: depositClock(),
            }),
          ).rejects.toMatchObject({ code: "CUSTODY_EVIDENCE_CONFLICT" });
          expect(
            (
              await isolated.financialRuntimeControl.findUniqueOrThrow({
                where: { id: 1 },
              })
            ).financialWritesFenced,
          ).toBe(true);
        },
        () =>
          new Response(
            JSON.stringify({
              success: true,
              data: [
                {
                  transaction_id: raw.transactionId,
                  block_timestamp: raw.info.blockTimeStamp,
                },
              ],
              meta: {},
            }),
          ),
      );
    });
  });

  it.each(["BANNED", "DEACTIVATED", "REVOKED"] as const)(
    "rejects a restored snapshot missing only %s authority",
    async (change) => {
      await withAdmittedFinancialDatabase(async (isolated) => {
        const root = await mkdtemp(join(tmpdir(), "p06-identity-history-"));
        try {
          const identity = await createIdentityFixture(isolated, {
            role: change === "DEACTIVATED" ? "ADMIN" : "USER",
          });
          const now = new Date();
          const user =
            change === "REVOKED"
              ? identity.user
              : await isolated.user.update({
                  where: { id: identity.user.id },
                  data: { status: change, accountVersion: { increment: 1 } },
                });
          const session =
            change === "REVOKED"
              ? await isolated.authSession.update({
                  where: { id: identity.session.id },
                  data: { revokedAt: now },
                })
              : identity.session;
          const file = join(root, "history.json");
          await writeFile(
            file,
            JSON.stringify({
              reference: "identity-authority",
              recoveredThrough: now.toISOString(),
              digest: await financialHistoryDigest(isolated),
            }),
            { mode: 0o600 },
          );
          if (change === "REVOKED")
            await isolated.$transaction(async (transaction) => {
              await transaction.authSession.delete({
                where: { id: session.id },
              });
              await transaction.authSession.create({ data: identity.session });
            });
          else
            await isolated.user.update({
              where: { id: user.id },
              data: {
                status: identity.user.status,
                accountVersion: identity.user.accountVersion,
                updatedAt: identity.user.updatedAt,
              },
            });
          await fenceFinancialRuntime(isolated, {
            operatorIdentity: "disposable-restore",
            reason: "Restore stale authority snapshot",
          });
          const evidence = {
            environment: { CUSTODY_FINANCIAL_HISTORY_FILE: file },
            projectRoot: process.cwd(),
            reference: "identity-authority",
            recoveredThrough: now,
            cutoff: now,
          };
          await expect(
            verifyRecoveredFinancialHistory(isolated, evidence),
          ).rejects.toMatchObject({ code: "CUSTODY_EVIDENCE_CONFLICT" });
          expect(
            (
              await isolated.financialRuntimeControl.findUniqueOrThrow({
                where: { id: 1 },
              })
            ).financialWritesFenced,
          ).toBe(true);
          expect(await isolated.financialOperation.count()).toBe(0);
          if (change === "REVOKED")
            await isolated.authSession.update({
              where: { id: session.id },
              data: { revokedAt: session.revokedAt },
            });
          else
            await isolated.user.update({
              where: { id: user.id },
              data: {
                status: user.status,
                accountVersion: user.accountVersion,
                updatedAt: user.updatedAt,
              },
            });
          await verifyRecoveredFinancialHistory(isolated, evidence);
          expect(() =>
            assertSessionAuthority(user, session, new Date()),
          ).toThrow();
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      });
    },
  );

  it("rejects a balanced stale snapshot against separately retained off-chain authority", async () => {
    await withAdmittedFinancialDatabase(async (isolated) => {
      const directory = await mkdtemp(join(tmpdir(), "p06-history-"));
      try {
        const cutoff = new Date();
        const account = await createIdentityFixture(isolated);
        await fundSubscriptionFixture(
          isolated,
          account,
          { referral: "1", nonReferral: "0" },
          cutoff,
        );
        expect(await isolated.financialOperation.count()).toBe(1);
        const file = join(directory, "history.json");
        await writeFile(
          file,
          JSON.stringify({
            reference: "independent-history",
            recoveredThrough: cutoff.toISOString(),
            digest: await financialHistoryDigest(isolated),
          }),
          { mode: 0o600 },
        );
        const evidence = {
          environment: { CUSTODY_FINANCIAL_HISTORY_FILE: file },
          projectRoot: process.cwd(),
          reference: "independent-history",
          cutoff,
          recoveredThrough: cutoff,
        };
        await verifyRecoveredFinancialHistory(isolated, evidence);
        // A separate older empty snapshot has no post-snapshot financial authority.
        await withAdmittedFinancialDatabase(async (restored) => {
          await fenceFinancialRuntime(restored, {
            operatorIdentity: "test-operator",
            reason: "test stale snapshot restore",
          });
          expect(await restored.wallet.count()).toBe(0);
          expect(await restored.financialOperation.count()).toBe(0);
          await expect(
            verifyRecoveredFinancialHistory(restored, evidence),
          ).rejects.toMatchObject({ code: "CUSTODY_EVIDENCE_CONFLICT" });
          expect(
            (
              await restored.financialRuntimeControl.findUniqueOrThrow({
                where: { id: 1 },
              })
            ).financialWritesFenced,
          ).toBe(true);
        });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  });

  it("reports scan and pending thresholds with bounded reminders and clears only completed hot scans", async () => {
    await withAdmittedFinancialDatabase(async (isolated) => {
      await createDepositAssignment(isolated);
      const raw = rawDeposit();
      let now = depositClock();
      await isolated.depositCandidate.create({
        data: {
          network: "TRON_NILE",
          transactionId: raw.transactionId,
          firstObservedAt: now,
          lastObservedAt: now,
          nextAttemptAt: now,
        },
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
      await withDepositProvider(
        raw,
        async (provider, config) => {
          const admission = financialFixtureAdmission(isolated);
          const credit = new DepositCreditService(
            isolated,
            new DepositVerifier(isolated, provider, config, () => now),
            admission,
            () => now,
          );
          const indexer = new DepositIndexer(isolated, {
            provider,
            config,
            credit,
            admission,
            clock: () => now,
          });
          await indexer.scanNext();
          now = new Date(now.getTime() + 299999);
          await indexer.observeHealth(signals);
          expect(chunks).toHaveLength(0);
          now = new Date(now.getTime() + 1);
          await indexer.observeHealth(signals);
          expect(chunks).toHaveLength(2);
          await indexer.observeHealth(signals);
          expect(chunks).toHaveLength(2);
          now = new Date(now.getTime() + 300000);
          await indexer.observeHealth(signals);
          expect(chunks).toHaveLength(4);
          await indexer.scanNext();
          await indexer.observeHealth(signals);
          expect(chunks).toHaveLength(4); // Historical completion cannot clear HOT lag.
          await indexer.scanNext();
          await indexer.accountNext();
          await indexer.observeHealth(signals);
          expect(chunks.join("")).toContain('"state":"CLEARED"');
          expect(chunks.join("")).toContain('"event":"PENDING_WORK"');
          await fenceFinancialRuntime(isolated, {
            operatorIdentity: "test-operator",
            reason: "intentional test fence",
            signals,
          });
          await expect(indexer.observeHealth(signals)).rejects.toMatchObject({
            code: "FINANCIAL_WRITES_FENCED",
          });
          expect(chunks.join("")).toContain('"state":"FENCED"');
        },
        () =>
          new Response(JSON.stringify({ success: true, data: [], meta: {} })),
      );
    });
  });
});
