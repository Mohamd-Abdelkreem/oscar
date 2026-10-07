import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TaskSubmissionsService } from "./task-submissions.service.js";
import { identityRaceBarrier } from "../auth/testing/identity-fixtures.js";
import {
  createTaskScenario,
  createReadyProofFixture,
  taskIdentity,
  withTaskDatabase,
  withIndependentTaskClients,
  withTaskFileFixture,
} from "../tasks/testing/task-fixtures.js";
import { submissionFixtureReads } from "./testing/submission-fixtures.js";
import { TaskPublicationService } from "../tasks/task-publication.service.js";
import { TaskUnlockService } from "../task-codes/task-unlock.service.js";
import { TaskCodesService } from "../task-codes/task-codes.service.js";
import { PurchaseQuoteService } from "../subscriptions/purchase-quote.service.js";
import { SubscriptionPurchaseService } from "../subscriptions/subscription-purchase.service.js";
import {
  fundSubscriptionFixture,
  withSubscriptionUserLock,
} from "../subscriptions/testing/subscription-fixtures.js";
import type { DatabaseClient } from "@template/database";
import { TaskReviewService } from "./task-review.service.js";
import {
  acceptedReviewFixture,
  reviewState,
} from "./testing/review-fixtures.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { SubmissionEvidenceService } from "./submission-evidence.service.js";
import { LedgerService } from "../ledger/ledger.service.js";

async function waitForUserLock(database: DatabaseClient) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const waiting = await database.$queryRaw<
      { waiting: boolean }[]
    >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%users%' AND pid<>pg_backend_pid()) AS waiting`;
    if (waiting[0]?.waiting) return;
  }
  throw new Error("The independent request did not reach its user lock.");
}

describe("US2 final decision races", () => {
  it.each(["APPROVE", "REJECT"] as const)(
    "serializes approval against %s from an independent administrator",
    async (competingDecision) => {
      await withTaskDatabase(async (database, url) =>
        withTaskFileFixture(async (root) => {
          const fixture = await acceptedReviewFixture(database, root);
          const otherAdmin = await createIdentityFixture(database, {
            role: "ADMIN",
            now: fixture.clock(),
          });
          await fundSubscriptionFixture(database, fixture.employee, {
            referral: "20",
            nonReferral: "30",
          });
          const wallet = await database.wallet.findUniqueOrThrow({
            where: { ownerUserId: fixture.employee.user.id },
          });
          await new LedgerService(
            database,
            {
              businessNamespaces: ["p05.fixture.reserve"],
              processIds: ["fixture"],
            },
            financialFixtureAdmission(database),
          ).execute(
            {
              kind: "RESERVE",
              walletId: wallet.id,
              businessNamespace: "p05.fixture.reserve",
              businessKey: randomUUID(),
              reservationId: randomUUID(),
              amount: "35",
            },
            {
              actor: { type: "PROCESS", processId: "fixture" },
              walletIds: [wallet.id],
              clock: fixture.clock,
              observe: async () => {},
              mutate: async () => {},
              eligibleSources: () =>
                Promise.resolve(["NON_REFERRAL", "REFERRAL"]),
            },
          );
          const before = await reviewState(database);
          const beforeWallet = before.wallets.find(
            (row) => row.id === wallet.id,
          );
          if (beforeWallet === undefined)
            throw new Error("Missing fixture wallet.");
          await withIndependentTaskClients(url, async (first, second) => {
            const start = identityRaceBarrier(2);
            const results = await Promise.allSettled([
              start().then(() =>
                new TaskReviewService(
                  first,
                  fixture.clock,
                  undefined,
                  financialFixtureAdmission(first),
                ).review(
                  taskIdentity(fixture.admin),
                  fixture.submission.id,
                  fixture.intent,
                ),
              ),
              start().then(() =>
                new TaskReviewService(
                  second,
                  fixture.clock,
                  undefined,
                  financialFixtureAdmission(second),
                ).review(taskIdentity(otherAdmin), fixture.submission.id, {
                  ...fixture.intent,
                  commandId: randomUUID(),
                  decision: competingDecision,
                }),
              ),
            ]);
            expect(
              results.filter((result) => result.status === "fulfilled"),
            ).toHaveLength(1);
            expect(
              results.find((result) => result.status === "rejected"),
            ).toMatchObject({ reason: { code: "SUBMISSION_FINAL" } });
          });
          const final = await database.finalReview.findFirstOrThrow();
          const reward = final.decision === "APPROVED" ? 2_000_000n : 0n;
          expect(
            await database.taskSubmission.findUniqueOrThrow({
              where: { id: fixture.submission.id },
            }),
          ).toEqual({
            ...fixture.submission,
            version: 2,
            status: final.decision,
          });
          expect(
            await database.wallet.findUniqueOrThrow({
              where: { id: wallet.id },
            }),
          ).toMatchObject({
            ...beforeWallet,
            updatedAt: (
              await database.wallet.findUniqueOrThrow({
                where: { id: wallet.id },
              })
            ).updatedAt,
            availableNonReferralUnits:
              beforeWallet.availableNonReferralUnits + reward,
          });
          expect(
            await database.reservationAllocation.findMany({
              orderBy: { id: "asc" },
            }),
          ).toEqual(before.allocations);
          expect(await database.finalReview.count()).toBe(1);
          expect(
            await database.taskCommandRecord.count({
              where: { kind: "FINAL_REVIEW" },
            }),
          ).toBe(1);
          expect(
            await database.financialOperation.count({
              where: { businessNamespace: "p05.task-reward" },
            }),
          ).toBe(reward > 0n ? 1 : 0);
          expect(
            await database.ledgerPosting.count({
              where: { operation: { businessNamespace: "p05.task-reward" } },
            }),
          ).toBe(reward > 0n ? 1 : 0);
          expect(
            await database.auditRecord.count({
              where: { operation: { businessNamespace: "p05.task-reward" } },
            }),
          ).toBe(reward > 0n ? 1 : 0);
        }),
      );
    },
  );

  it("binds final review to the replacement winner's actual current evidence", async () => {
    await withTaskDatabase(async (database, url) =>
      withTaskFileFixture(async (root) => {
        const fixture = await acceptedReviewFixture(database, root);
        await withIndependentTaskClients(url, async (first, second) => {
          const start = identityRaceBarrier(2);
          const [review, replacement] = await Promise.allSettled([
            start().then(() =>
              new TaskReviewService(
                first,
                fixture.clock,
                undefined,
                financialFixtureAdmission(first),
              ).review(
                taskIdentity(fixture.admin),
                fixture.submission.id,
                fixture.intent,
              ),
            ),
            start().then(() =>
              new SubmissionEvidenceService(
                second,
                fixture.clock,
                fixture.reads,
              ).replace(taskIdentity(fixture.employee), fixture.submission.id, {
                commandId: randomUUID(),
                expectedSubmissionVersion: 1,
                proofAssetId: fixture.replacement.id,
              }),
            ),
          ]);
          expect(
            [review, replacement].filter(
              (result) => result.status === "fulfilled",
            ),
          ).toHaveLength(1);
          if (review.status === "fulfilled") {
            expect(replacement).toMatchObject({
              status: "rejected",
              reason: { code: "EVIDENCE_CONFLICT" },
            });
            expect(await database.submissionEvidence.count()).toBe(1);
            expect(await database.finalReview.findFirstOrThrow()).toMatchObject(
              { evidenceVersion: 1 },
            );
          } else {
            expect(review).toMatchObject({
              reason: { code: "SUBMISSION_VERSION_CONFLICT" },
            });
            expect(await database.finalReview.count()).toBe(0);
            expect(
              await database.financialOperation.count({
                where: { businessNamespace: "p05.task-reward" },
              }),
            ).toBe(0);
            expect(await database.submissionEvidence.count()).toBe(2);
            await new TaskReviewService(
              database,
              fixture.clock,
              undefined,
              financialFixtureAdmission(database),
            ).review(taskIdentity(fixture.admin), fixture.submission.id, {
              ...fixture.intent,
              expectedSubmissionVersion: 2,
              expectedEvidenceVersion: 2,
            });
            expect(await database.finalReview.findFirstOrThrow()).toMatchObject(
              { evidenceVersion: 2, submissionVersion: 2 },
            );
          }
        });
      }),
    );
  });

  it("denies a waiting approval after current admin session revocation commits", async () => {
    await withTaskDatabase(async (database, url) =>
      withTaskFileFixture(async (root) => {
        const fixture = await acceptedReviewFixture(database, root);
        const before = await reviewState(database);
        await withIndependentTaskClients(url, async (first, second) => {
          let outcome: Promise<PromiseSettledResult<unknown>[]> | undefined;
          await first.$transaction(async (transaction) => {
            await transaction.$queryRaw`SELECT id FROM users WHERE id=${fixture.admin.user.id}::uuid FOR UPDATE`;
            const attempt = new TaskReviewService(
              second,
              fixture.clock,
              undefined,
              financialFixtureAdmission(second),
            ).review(
              taskIdentity(fixture.admin),
              fixture.submission.id,
              fixture.intent,
            );
            outcome = Promise.allSettled([attempt]);
            await waitForUserLock(database);
            await transaction.authSession.update({
              where: { id: fixture.admin.session.id },
              data: { revokedAt: fixture.clock() },
            });
          });
          expect(await outcome).toMatchObject([
            { status: "rejected", reason: { statusCode: 401 } },
          ]);
        });
        expect(await reviewState(database)).toEqual(before);
      }),
    );
  });
});

describe("US1 independent daily claim races", () => {
  it("samples cutoff after a blocked user lock and leaves no receipt or claim", async () => {
    await withTaskDatabase(async (database, url) =>
      withTaskFileFixture(async (root) => {
        const scenario = await createTaskScenario(database),
          asset = await createReadyProofFixture(database, scenario.employee);
        let now = new Date("2026-10-05T14:59:59.999Z");
        const clock = () => new Date(now);
        const reads = await submissionFixtureReads(database, root, clock, [
          asset,
        ]);
        await withIndependentTaskClients(url, async (first, second) =>
          withSubscriptionUserLock(
            first,
            scenario.employee.user.id,
            async (release) => {
              const attempt = new TaskSubmissionsService(
                second,
                clock,
                reads,
              ).create(taskIdentity(scenario.employee), {
                commandId: randomUUID(),
                taskId: scenario.task.id,
                expectedTaskRevision: 1,
                proofAssetId: asset.id,
                declaredExecuted: true,
              });
              const result = Promise.allSettled([attempt]);
              await waitForUserLock(database);
              now = new Date("2026-10-05T15:00:00Z");
              release();
              expect(await result).toMatchObject([
                { status: "rejected", reason: { code: "TASK_WINDOW_CLOSED" } },
              ]);
            },
          ),
        );
        expect(await database.taskSubmission.count()).toBe(0);
        expect(await database.submissionEvidence.count()).toBe(0);
        expect(await database.taskCommandRecord.count()).toBe(0);
      }),
    );
  });

  it.each(["content", "date"] as const)(
    "serializes a %s edit against first submission and preserves the winning snapshot",
    async (mode) => {
      await withTaskDatabase(async (database, url) =>
        withTaskFileFixture(async (root) => {
          const scenario = await createTaskScenario(database),
            asset = await createReadyProofFixture(database, scenario.employee);
          const reads = await submissionFixtureReads(
            database,
            root,
            scenario.clock,
            [asset],
          );
          await withIndependentTaskClients(url, async (first, second) => {
            const start = identityRaceBarrier(2);
            const results = await Promise.allSettled([
              start().then(() =>
                new TaskSubmissionsService(first, scenario.clock, reads).create(
                  taskIdentity(scenario.employee),
                  {
                    commandId: randomUUID(),
                    taskId: scenario.task.id,
                    expectedTaskRevision: 1,
                    proofAssetId: asset.id,
                    declaredExecuted: true,
                  },
                ),
              ),
              start().then(() =>
                new TaskPublicationService(second, scenario.clock).edit(
                  taskIdentity(scenario.admin),
                  scenario.task.id,
                  {
                    commandId: randomUUID(),
                    confirmed: true,
                    expectedTaskRevision: 1,
                    ...(mode === "date"
                      ? { publicationDate: "2026-10-06" }
                      : { title: "New revision" }),
                  },
                ),
              ),
            ]);
            const [acceptance, edit] = results;
            expect(
              results.some((result) => result.status === "fulfilled"),
            ).toBe(true);
            if (acceptance.status === "fulfilled") {
              const claim = await database.taskSubmission.findFirstOrThrow();
              expect(claim.capturedTaskContent).toMatchObject({
                title: scenario.task.title,
              });
              expect(claim.capturedTaskRevision).toBe(1);
              if (mode === "date")
                expect(edit).toMatchObject({
                  status: "rejected",
                  reason: { code: "TASK_DATE_LOCKED" },
                });
            } else {
              expect(edit.status).toBe("fulfilled");
              expect(acceptance).toMatchObject({
                status: "rejected",
                reason: {
                  code:
                    mode === "date"
                      ? "TASK_UNAVAILABLE"
                      : "TASK_REVISION_CONFLICT",
                },
              });
              expect(await database.taskSubmission.count()).toBe(0);
              expect(await database.submissionEvidence.count()).toBe(0);
            }
          });
        }),
      );
    },
  );

  it("serializes paid upgrade with acceptance and keeps the employee/date identity after upgrade", async () => {
    await withTaskDatabase(async (database, url) =>
      withTaskFileFixture(async (root) => {
        const scenario = await createTaskScenario(database),
          asset = await createReadyProofFixture(database, scenario.employee);
        await fundSubscriptionFixture(database, scenario.employee, {
          referral: "10",
          nonReferral: "600",
        });
        const identity = taskIdentity(scenario.employee),
          reads = await submissionFixtureReads(database, root, scenario.clock, [
            asset,
          ]);
        const quote = await new PurchaseQuoteService(
          database,
          scenario.clock,
        ).create(identity, { packageCode: "O1" });
        await withIndependentTaskClients(url, async (first, second) => {
          const start = identityRaceBarrier(2);
          const results = await Promise.allSettled([
            start().then(() =>
              new TaskSubmissionsService(first, scenario.clock, reads).create(
                identity,
                {
                  commandId: randomUUID(),
                  taskId: scenario.task.id,
                  expectedTaskRevision: 1,
                  proofAssetId: asset.id,
                  declaredExecuted: true,
                },
              ),
            ),
            start().then(() =>
              new SubscriptionPurchaseService(
                second,
                scenario.clock,
                financialFixtureAdmission(second),
              ).purchase(identity, { quoteId: quote.quoteId, confirmed: true }),
            ),
          ]);
          expect(results.map((result) => result.status)).toEqual([
            "fulfilled",
            "fulfilled",
          ]);
        });
        const claim = await database.taskSubmission.findFirstOrThrow();
        const captured = await database.subscription.findUniqueOrThrow({
          where: { id: claim.subscriptionId },
        });
        expect(claim.rewardUnits).toBe(captured.dailyRewardUnits);
        expect([2_000_000n, 16_000_000n]).toContain(claim.rewardUnits);
        expect(claim.capturedSubscriptionTerms).toEqual(captured.acceptedTerms);
        const wallet = await database.wallet.findFirstOrThrow({
          where: { ownerUserId: identity.userId },
        });
        expect(wallet).toMatchObject({
          availableReferralUnits: 0n,
          availableNonReferralUnits: 10_000_000n,
          reservedReferralUnits: 0n,
          reservedNonReferralUnits: 0n,
        });
        await expect(
          new TaskSubmissionsService(database, scenario.clock, reads).create(
            identity,
            {
              commandId: randomUUID(),
              taskId: scenario.task.id,
              expectedTaskRevision: 1,
              proofAssetId: asset.id,
              declaredExecuted: true,
            },
          ),
        ).rejects.toMatchObject({ code: "DAILY_CLAIM_EXISTS" });
        expect(await database.taskSubmission.count()).toBe(1);
      }),
    );
  });

  it("serializes first unlock versus date movement without orphaned participation", async () => {
    await withTaskDatabase(async (database, url) => {
      const scenario = await createTaskScenario(database);
      await database.task.update({
        where: { id: scenario.task.id },
        data: { isCodeRequired: true, revision: { increment: 1 } },
      });
      await new TaskCodesService(database, scenario.clock).create(
        taskIdentity(scenario.admin),
        {
          commandId: randomUUID(),
          confirmed: true,
          taskId: scenario.task.id,
          code: "DATE-RACE",
          state: "ENABLED",
        },
      );
      await withIndependentTaskClients(url, async (first, second) => {
        const start = identityRaceBarrier(2);
        const [unlock, move] = await Promise.allSettled([
          start().then(() =>
            new TaskUnlockService(first, scenario.clock).unlock(
              taskIdentity(scenario.employee),
              scenario.task.id,
              {
                commandId: randomUUID(),
                expectedTaskRevision: 2,
                code: "DATE-RACE",
              },
            ),
          ),
          start().then(() =>
            new TaskPublicationService(second, scenario.clock).edit(
              taskIdentity(scenario.admin),
              scenario.task.id,
              {
                commandId: randomUUID(),
                confirmed: true,
                expectedTaskRevision: 2,
                publicationDate: "2026-10-06",
              },
            ),
          ),
        ]);
        const task = await database.task.findUniqueOrThrow({
          where: { id: scenario.task.id },
        });
        if (unlock.status === "fulfilled") {
          expect(move).toMatchObject({
            status: "rejected",
            reason: { code: "TASK_DATE_LOCKED" },
          });
          expect(task.firstParticipationAt).not.toBeNull();
          expect(await database.taskUnlock.count()).toBe(1);
        } else {
          expect(move.status).toBe("fulfilled");
          expect(unlock).toMatchObject({
            reason: { code: "TASK_UNAVAILABLE" },
          });
          expect(task.firstParticipationAt).toBeNull();
          expect(await database.taskUnlock.count()).toBe(0);
        }
      });
      expect(await database.taskSubmission.count()).toBe(0);
    });
  });
  it("accepts exactly one competing device/key and leaves pending wallet sources unchanged", async () => {
    await withTaskDatabase(async (database, url) =>
      withTaskFileFixture(async (root) => {
        const scenario = await createTaskScenario(database);
        const secondSession = await database.authSession.create({
          data: {
            userId: scenario.employee.user.id,
            rememberMe: false,
            createdAt: scenario.clock(),
            expiresAt: new Date(scenario.clock().getTime() + 86_400_000),
          },
        });
        const asset = await createReadyProofFixture(
          database,
          scenario.employee,
        );
        const reads = await submissionFixtureReads(
          database,
          root,
          scenario.clock,
          [asset],
        );
        const wallet = await database.wallet.findFirstOrThrow({
          where: { ownerUserId: scenario.employee.user.id },
        });
        await withIndependentTaskClients(url, async (first, second) => {
          const barrier = identityRaceBarrier(2);
          const attempts = await Promise.allSettled(
            [first, second].map(async (client, index) => {
              await barrier();
              return new TaskSubmissionsService(
                client,
                scenario.clock,
                reads,
              ).create(
                index === 0
                  ? taskIdentity(scenario.employee)
                  : {
                      userId: scenario.employee.user.id,
                      sessionId: secondSession.id,
                    },
                {
                  commandId: randomUUID(),
                  taskId: scenario.task.id,
                  expectedTaskRevision: 1,
                  proofAssetId: asset.id,
                  declaredExecuted: true,
                },
              );
            }),
          );
          expect(
            attempts.filter((attempt) => attempt.status === "fulfilled"),
          ).toHaveLength(1);
          expect(
            attempts.filter((attempt) => attempt.status === "rejected"),
          ).toMatchObject([
            { status: "rejected", reason: { code: "DAILY_CLAIM_EXISTS" } },
          ]);
        });
        expect(await database.taskSubmission.count()).toBe(1);
        expect(await database.submissionEvidence.count()).toBe(1);
        expect(await database.taskCommandRecord.count()).toBe(1);
        expect(
          await database.wallet.findUniqueOrThrow({ where: { id: wallet.id } }),
        ).toEqual(wallet);
      }),
    );
  });
});
