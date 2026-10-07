import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adminTaskDetailSchema,
  packageTermsSchema,
  type AdminTaskDetail,
} from "@template/contracts";
import { createDatabaseClient, Prisma, type Task } from "@template/database";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import { LedgerService } from "../ledger/ledger.service.js";
import type { LedgerGuardScope } from "../ledger/ledger.types.js";
import { formatUsdtAmount } from "../../core/financial/money.js";
import {
  TaskCommandService,
  type TaskCommandWork,
} from "./task-command.service.js";
import {
  createPendingTaskFixture,
  createTaskScenario,
  taskIdentity,
  P05_FIXTURE_NOW,
  withTaskDatabase,
  withTaskFileFixture,
  withIndependentTaskClients,
} from "./testing/task-fixtures.js";
import { runTaskTransaction } from "./task-transaction.js";

function taskDetail(task: Task): AdminTaskDetail {
  const date = task.publicationDate.toISOString().slice(0, 10);
  return adminTaskDetailSchema.parse({
    id: task.id,
    revision: task.revision,
    publicationDate: date,
    title: task.title,
    description: task.description,
    targetUrl: task.targetUrl,
    platform: task.platform,
    isCodeRequired: task.isCodeRequired,
    illustration: null,
    window: {
      opensAt: `${date}T09:00:00Z`,
      closesAt: `${date}T15:00:00Z`,
      nextOpeningAt: "2026-10-06T09:00:00Z",
    },
    publicationState: task.publicationState,
    displayStatus: "ACTIVE",
    linkedCodeCount: 0,
    distinctUnlockedEmployeeCount: 0,
    submissionCount: 0,
    approvedSubmissionCount: 0,
    firstParticipationAt: task.firstParticipationAt?.toISOString() ?? null,
    dateEditable: task.firstParticipationAt === null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
}
function editIntent(task: Task) {
  return {
    kind: "TASK_EDIT",
    targetId: task.id,
    payload: {
      commandId: randomUUID(),
      confirmed: true,
      expectedTaskRevision: task.revision,
      title: "Committed title",
    },
  };
}
const editWork: TaskCommandWork = {
  lock: async (transaction, intent) => {
    await transaction.$queryRaw`SELECT id FROM tasks WHERE id=${intent.targetId}::uuid FOR UPDATE`;
  },
  commit: async (transaction, { intent, now }) => {
    if (intent.kind !== "TASK_EDIT")
      throw new Error("Edit fixture requires task edit intent.");
    const before = await transaction.task.findUniqueOrThrow({
      where: { id: intent.targetId },
    });
    if (before.revision !== intent.payload.expectedTaskRevision)
      throw new Error("Stale task revision.");
    const after = await transaction.task.update({
      where: { id: before.id },
      data: {
        title: intent.payload.title ?? before.title,
        revision: { increment: 1 },
        updatedAt: now,
      },
    });
    return {
      taskId: before.id,
      outcome: taskDetail(after),
      beforeSnapshot: { title: before.title, revision: before.revision },
      afterSnapshot: { title: after.title, revision: after.revision },
    };
  },
};

async function withCancellationInsertBarrier<T>(
  url: string,
  work: (
    waitUntilBlocked: () => Promise<void>,
    release: () => Promise<void>,
  ) => Promise<T>,
): Promise<T> {
  const barrierDatabase = createDatabaseClient(url);
  await barrierDatabase.$executeRawUnsafe(
    `CREATE FUNCTION p05_test_cancel_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.terminal_state='CANCELLED' THEN PERFORM pg_advisory_xact_lock(505,14); END IF; RETURN NEW; END $$`,
  );
  await barrierDatabase.$executeRawUnsafe(
    "CREATE TRIGGER p05_test_cancel_barrier BEFORE INSERT ON task_command_records FOR EACH ROW EXECUTE FUNCTION p05_test_cancel_barrier()",
  );
  let announce: () => void = () => {};
  let unlock: () => void = () => {};
  const acquired = new Promise<void>((resolve) => {
    announce = resolve;
  });
  const held = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const holding = barrierDatabase.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(505,14)`;
    announce();
    await held;
  });
  const release = async () => {
    unlock();
    await holding;
  };
  const waitUntilBlocked = async () => {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const observed = await barrierDatabase.$queryRaw<
        { waiting: boolean }[]
      >`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=505 AND objid=14 AND NOT granted) AS waiting`;
      if (observed[0]?.waiting === true) return;
    }
    throw new Error("Cancellation never reached the actual database barrier.");
  };
  try {
    await Promise.race([acquired, holding]);
    return await work(waitUntilBlocked, release);
  } finally {
    try {
      await release();
      await barrierDatabase.$executeRawUnsafe(
        "DROP TRIGGER p05_test_cancel_barrier ON task_command_records",
      );
      await barrierDatabase.$executeRawUnsafe(
        "DROP FUNCTION p05_test_cancel_barrier()",
      );
    } finally {
      await barrierDatabase.$disconnect();
    }
  }
}

describe("P05 command terminal identity", () => {
  it("commits an attributable edit once, replays before stale checks and binds all consequential intent", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const identity = taskIdentity(scenario.admin);
      const service = new TaskCommandService(database, scenario.clock);
      const intent = editIntent(scenario.task);
      const accepted = await service.execute(intent, identity, editWork);
      expect(accepted.state).toBe("OBSERVED");
      expect(await service.execute(intent, identity, editWork)).toEqual(
        accepted,
      );
      expect(
        await service.observe(
          { kind: intent.kind, commandId: intent.payload.commandId },
          identity,
        ),
      ).toEqual(accepted);
      expect(
        await service.cancel(
          {
            kind: intent.kind,
            commandId: intent.payload.commandId,
            confirmed: true,
          },
          identity,
        ),
      ).toEqual(accepted);
      for (const patch of [
        { title: "Changed payload" },
        { expectedTaskRevision: 2 },
      ])
        await expect(
          service.execute(
            { ...intent, payload: { ...intent.payload, ...patch } },
            identity,
            editWork,
          ),
        ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      const receipt = await database.taskCommandRecord.findFirstOrThrow();
      expect(receipt.actorUserId).toBe(identity.userId);
      expect(receipt.occurredAt).toEqual(P05_FIXTURE_NOW);
      expect(receipt.beforeSnapshot).toEqual({
        title: scenario.task.title,
        revision: 1,
      });
      expect(receipt.afterSnapshot).toEqual({
        title: "Committed title",
        revision: 2,
      });
      expect(await database.taskCommandRecord.count()).toBe(1);
    });
  });
  it("filters foreign outcomes and denies revoked/current wrong-role authority", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const foreign = await createIdentityFixture(database, {
        role: "ADMIN",
        now: P05_FIXTURE_NOW,
      });
      const service = new TaskCommandService(database, scenario.clock);
      const intent = editIntent(scenario.task);
      await service.execute(intent, taskIdentity(scenario.admin), editWork);
      const lookup = { commandId: intent.payload.commandId, kind: intent.kind };
      expect(await service.observe(lookup, taskIdentity(foreign))).toEqual({
        state: "NOT_OBSERVED",
        ...lookup,
      });
      await expect(
        service.observe(lookup, taskIdentity(scenario.employee)),
      ).rejects.toMatchObject({ statusCode: 403 });
      await database.authSession.update({
        where: { id: scenario.admin.session.id },
        data: { revokedAt: P05_FIXTURE_NOW },
      });
      await expect(
        service.observe(lookup, taskIdentity(scenario.admin)),
      ).rejects.toMatchObject({ statusCode: 401 });
      await expect(
        service.cancel(
          { ...lookup, confirmed: true },
          taskIdentity(scenario.admin),
        ),
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });
  it("fences dropped, rejected and rolled-back requests without business changes", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const service = new TaskCommandService(database, scenario.clock);
      const identity = taskIdentity(scenario.admin);
      const intent = editIntent(scenario.task);
      const lookup = { commandId: intent.payload.commandId, kind: intent.kind };
      expect(await service.observe(lookup, identity)).toEqual({
        state: "NOT_OBSERVED",
        ...lookup,
      });
      await expect(
        service.execute(intent, identity, {
          ...editWork,
          commit: async (transaction, accepted) => {
            await editWork.commit(transaction, accepted);
            throw new Error("Injected service failure after domain write");
          },
        }),
      ).rejects.toThrow("Injected service failure");
      expect(
        (
          await database.task.findUniqueOrThrow({
            where: { id: scenario.task.id },
          })
        ).revision,
      ).toBe(1);
      expect(await database.taskCommandRecord.count()).toBe(0);
      const cancelled = await service.cancel(
        { ...lookup, confirmed: true },
        identity,
      );
      expect(cancelled.state).toBe("CANCELLED");
      expect(
        await service.cancel({ ...lookup, confirmed: true }, identity),
      ).toEqual(cancelled);
      expect(await service.observe(lookup, identity)).toEqual(cancelled);
      await expect(
        service.execute(intent, identity, editWork),
      ).rejects.toMatchObject({ code: "COMMAND_CANCELLED" });
      await expect(
        service.execute(
          {
            ...intent,
            payload: { ...intent.payload, title: "Late different intent" },
          },
          identity,
          editWork,
        ),
      ).rejects.toMatchObject({ code: "COMMAND_CANCELLED" });
      const marker = await database.taskCommandRecord.findFirstOrThrow();
      expect(marker.intentHash).toBeNull();
      expect(marker.taskId).toBeNull();
      expect(marker.safeOutcome).toBeNull();
    });
  });
  it("lets cancellation win a real lock race and forbids delayed execution", async () => {
    await withTaskDatabase(async (database, url) => {
      const scenario = await createTaskScenario(database);
      const intent = editIntent(scenario.task);
      const identity = taskIdentity(scenario.admin);
      await withIndependentTaskClients(url, async (first, second) => {
        await withCancellationInsertBarrier(url, async (blocked, release) => {
          const cancel = new TaskCommandService(first, scenario.clock).cancel(
            {
              kind: intent.kind,
              commandId: intent.payload.commandId,
              confirmed: true,
            },
            identity,
          );
          await blocked();
          const execute = new TaskCommandService(
            second,
            scenario.clock,
          ).execute(intent, identity, editWork);
          const execution = expect(execute).rejects.toMatchObject({
            code: "COMMAND_CANCELLED",
          });
          await release();
          expect((await cancel).state).toBe("CANCELLED");
          await execution;
        });
      });
      expect(await database.taskCommandRecord.count()).toBe(1);
      expect(
        (
          await database.task.findUniqueOrThrow({
            where: { id: scenario.task.id },
          })
        ).revision,
      ).toBe(1);
    });
  });
  it("lets execution win a real lock race and concurrent cancellation returns its saved result", async () => {
    await withTaskDatabase(async (database, url) => {
      const scenario = await createTaskScenario(database);
      const intent = editIntent(scenario.task);
      const identity = taskIdentity(scenario.admin);
      let announce: () => void = () => {};
      let release: () => void = () => {};
      const acquired = new Promise<void>((resolve) => {
        announce = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await withIndependentTaskClients(url, async (first, second) => {
        const execution = new TaskCommandService(first, scenario.clock).execute(
          intent,
          identity,
          {
            ...editWork,
            lock: async (transaction, accepted) => {
              await editWork.lock(transaction, accepted);
              announce();
              await held;
            },
          },
        );
        await acquired;
        const cancel = new TaskCommandService(second, scenario.clock).cancel(
          {
            kind: intent.kind,
            commandId: intent.payload.commandId,
            confirmed: true,
          },
          identity,
        );
        release();
        const [committed, observed] = await Promise.all([execution, cancel]);
        expect(observed).toEqual(committed);
        expect(observed.state).toBe("OBSERVED");
      });
      expect(await database.taskCommandRecord.count()).toBe(1);
    });
  });
  it("deduplicates two lost/concurrent cancellation requests and permits unused employee cancellation after task restrictions", async () => {
    await withTaskDatabase(async (database, url) => {
      const scenario = await createTaskScenario(database);
      const identity = taskIdentity(scenario.employee);
      await database.user.update({
        where: { id: identity.userId },
        data: { tasksBlocked: true, accountVersion: { increment: 1 } },
      });
      const cancellation = {
        commandId: randomUUID(),
        kind: "TASK_UNLOCK",
        confirmed: true,
      };
      await withIndependentTaskClients(url, async (first, second) => {
        const [one, two] = await Promise.all([
          new TaskCommandService(first, scenario.clock).cancel(
            cancellation,
            identity,
          ),
          new TaskCommandService(second, scenario.clock).cancel(
            cancellation,
            identity,
          ),
        ]);
        expect(two).toEqual(one);
        expect(one.state).toBe("CANCELLED");
      });
      expect(await database.taskCommandRecord.count()).toBe(1);
    });
  });
  it("samples the phase clock after a consequential lock and refuses expiry without a receipt", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      let now = P05_FIXTURE_NOW;
      const service = new TaskCommandService(database, () => new Date(now));
      await expect(
        service.execute(
          editIntent(scenario.task),
          taskIdentity(scenario.admin),
          {
            ...editWork,
            lock: async (transaction, intent) => {
              await editWork.lock(transaction, intent);
              now = scenario.admin.session.expiresAt;
            },
          },
        ),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(await database.taskCommandRecord.count()).toBe(0);
    });
  });
  it("cancellation preserves a committed captured reward and changed review reasons conflict", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const { submission, asset } = await createPendingTaskFixture(
        database,
        scenario,
      );
      const identity = taskIdentity(scenario.admin);
      const service = new TaskCommandService(database, scenario.clock);
      const ledger = new LedgerService(
        database,
        {
          businessNamespaces: ["p05.task-reward"],
          processIds: [],
        },
        financialFixtureAdmission(database),
      );
      const intent = {
        kind: "FINAL_REVIEW" as const,
        targetId: submission.id,
        payload: {
          commandId: randomUUID(),
          confirmed: true as const,
          expectedSubmissionVersion: 1,
          expectedEvidenceVersion: 1,
          decision: "APPROVE" as const,
          reason: "Actual inspected evidence",
        },
      };
      const guard = async (scope: LedgerGuardScope) => {
        await readSessionAuthority(
          scope.transaction,
          identity,
          scenario.clock(),
          "ADMIN",
        );
      };
      if (scenario.employee.wallet === null)
        throw new Error("Employee fixture requires a wallet.");
      const walletId = scenario.employee.wallet.id;
      const before = await database.wallet.findUniqueOrThrow({
        where: { id: walletId },
      });
      const accepted = await ledger.runInTransaction(
        {
          actor: { type: "USER", userId: identity.userId },
          walletIds: [walletId],
          clock: scenario.clock,
          observe: guard,
          mutate: guard,
        },
        async (transaction, financial) =>
          service.executeInTransaction(
            transaction,
            { identity, intent },
            {
              otherUserIds: [scenario.employee.user.id],
              lock: async (client) => {
                await client.$queryRaw`SELECT id FROM tasks WHERE id=${scenario.task.id}::uuid FOR UPDATE`;
                await client.$queryRaw`SELECT id FROM task_submissions WHERE id=${submission.id}::uuid FOR UPDATE`;
              },
              commit: async (client, { now }) => {
                const credit = await financial.credit({
                  kind: "CREDIT",
                  walletId,
                  businessNamespace: "p05.task-reward",
                  businessKey: submission.id,
                  amount: formatUsdtAmount(submission.rewardUnits),
                  source: "NON_REFERRAL",
                  origin: "TASK_REWARD",
                });
                await client.taskSubmission.update({
                  where: { id: submission.id },
                  data: { status: "APPROVED", version: 2 },
                });
                await client.finalReview.create({
                  data: {
                    submissionId: submission.id,
                    employeeId: submission.employeeId,
                    decision: "APPROVED",
                    submissionVersion: 1,
                    evidenceVersion: 1,
                    actorUserId: identity.userId,
                    decidedAt: now,
                    reason: intent.payload.reason,
                    walletId,
                    approvalOperationId: credit.result.operationId,
                  },
                });
                const outcome = {
                  submission: {
                    id: submission.id,
                    taskId: submission.taskId,
                    businessDate: "2026-10-05",
                    taskTitle: scenario.task.title,
                    reward: formatUsdtAmount(submission.rewardUnits),
                    submittedAt: submission.submittedAt.toISOString(),
                    status: "APPROVED",
                    version: 2,
                    currentEvidenceVersion: 1,
                    snapshot: {
                      taskId: submission.taskId,
                      businessDate: "2026-10-05",
                      capturedTaskRevision: 1,
                      capturedTaskContent: submission.capturedTaskContent,
                      subscriptionId: submission.subscriptionId,
                      capturedSubscriptionTerms: packageTermsSchema.parse(
                        submission.capturedSubscriptionTerms,
                      ),
                      reward: formatUsdtAmount(submission.rewardUnits),
                      declaredExecuted: true,
                      submittedAt: submission.submittedAt.toISOString(),
                      deadlineAt: submission.deadlineAt.toISOString(),
                    },
                    evidence: {
                      id: submission.evidence.id,
                      version: 1,
                      assetId: asset.id,
                      acceptedAt: now.toISOString(),
                      asset: {
                        id: asset.id,
                        purpose: "PROOF",
                        uploadedAt: now.toISOString(),
                        width: 1,
                        height: 1,
                        contentType: "image/png",
                        byteCount: 70,
                        availability: "PRESENT",
                      },
                    },
                    finalDecision: {
                      decision: "APPROVE",
                      decidedAt: now.toISOString(),
                      reviewedSubmissionVersion: 1,
                      reviewedEvidenceVersion: 1,
                    },
                    canReplace: false,
                  },
                  employee: {
                    id: scenario.employee.user.id,
                    fullName: scenario.employee.user.fullName,
                    email: scenario.employee.user.email,
                  },
                  review: {
                    reason: intent.payload.reason,
                    actor: {
                      id: scenario.admin.user.id,
                      fullName: scenario.admin.user.fullName,
                      email: scenario.admin.user.email,
                    },
                  },
                };
                return {
                  taskId: scenario.task.id,
                  submissionId: submission.id,
                  outcome,
                  beforeSnapshot: { status: "PENDING", version: 1 },
                  afterSnapshot: { status: "APPROVED", version: 2 },
                };
              },
            },
          ),
      );
      const cancellation = {
        kind: intent.kind,
        commandId: intent.payload.commandId,
        confirmed: true,
      };
      expect(await service.cancel(cancellation, identity)).toEqual(accepted);
      await expect(
        service.execute(
          {
            ...intent,
            payload: { ...intent.payload, reason: "Another reason" },
          },
          identity,
          editWork,
        ),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      const after = await database.wallet.findUniqueOrThrow({
        where: { id: walletId },
      });
      expect(after.availableNonReferralUnits).toBe(
        before.availableNonReferralUnits + submission.rewardUnits,
      );
      expect(after.reservedNonReferralUnits).toBe(
        before.reservedNonReferralUnits,
      );
      expect(after.availableReferralUnits).toBe(before.availableReferralUnits);
      expect(after.reservedReferralUnits).toBe(before.reservedReferralUnits);
      expect(
        await database.financialOperation.count({
          where: {
            businessNamespace: "p05.task-reward",
            businessKey: submission.id,
          },
        }),
      ).toBe(1);
      expect(
        (
          await database.taskSubmission.findUniqueOrThrow({
            where: { id: submission.id },
          })
        ).status,
      ).toBe("APPROVED");
    });
  });
  it("retries recognized serialization conflicts three times, and never retries an ordinary domain rejection", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      let attempts = 0;
      const transient = () =>
        new Prisma.PrismaClientKnownRequestError(
          "Test serialization conflict",
          { code: "P2034", clientVersion: Prisma.prismaVersion.client },
        );
      await expect(
        runTaskTransaction(
          database,
          { identity: taskIdentity(scenario.admin) },
          () => {
            attempts += 1;
            return Promise.reject(transient());
          },
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(attempts).toBe(3);
      attempts = 0;
      await expect(
        runTaskTransaction(
          database,
          { identity: taskIdentity(scenario.admin) },
          () => {
            attempts += 1;
            return Promise.reject(new Error("Nonretryable domain rejection"));
          },
        ),
      ).rejects.toThrow("Nonretryable domain rejection");
      expect(attempts).toBe(1);
    });
  });
  it("keeps actual synthetic file fixtures outside public roots and tears them down", async () => {
    let path = "";
    await withTaskFileFixture(async (root, png) => {
      path = join(root, "fixture.png");
      expect(await readFile(path)).toEqual(png);
    });
    await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
