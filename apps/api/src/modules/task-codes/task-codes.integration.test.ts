import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  taskCodeSummarySchema,
  taskCodePageSchema,
  taskCodeUsagePageSchema,
  taskCodeAuditPageSchema,
} from "@template/contracts";
import {
  taskHttpApp,
  taskHttpToken,
  taskHttpEnvelope,
  taskHttpError,
} from "../tasks/testing/task-http-fixtures.js";
import {
  createIdentityFixture,
  identityRaceBarrier,
} from "../auth/testing/identity-fixtures.js";
import { TaskCodesService } from "./task-codes.service.js";
import { TaskCodesQueries } from "./task-codes.queries.js";
import { TaskUnlockService } from "./task-unlock.service.js";
import {
  createTaskScenario,
  createPendingTaskFixture,
  taskIdentity,
  withTaskDatabase,
  withIndependentTaskClients,
} from "../tasks/testing/task-fixtures.js";

describe("US4 retained task codes", () => {
  it("keeps one successful unlock after code pause, rejects new employees and never claims or credits", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      await database.task.update({
        where: { id: scenario.task.id },
        data: { isCodeRequired: true, revision: { increment: 1 } },
      });
      const codes = new TaskCodesService(database, scenario.clock),
        unlocks = new TaskUnlockService(database, scenario.clock),
        admin = taskIdentity(scenario.admin),
        employee = taskIdentity(scenario.employee);
      await codes.create(admin, {
        commandId: randomUUID(),
        confirmed: true,
        taskId: scenario.task.id,
        code: "  VALID-رمز  ",
        state: "ENABLED",
      });
      const code = await database.taskCode.findFirstOrThrow();
      const payload = {
        commandId: randomUUID(),
        expectedTaskRevision: 2,
        code: " valid-رمز ",
      };
      const operations = await database.financialOperation.count();
      await expect(
        unlocks.unlock(employee, scenario.task.id, {
          ...payload,
          code: "WRONG",
        }),
      ).rejects.toMatchObject({ code: "TASK_UNAVAILABLE" });
      const accepted = await unlocks.unlock(
        employee,
        scenario.task.id,
        payload,
      );
      expect(accepted.observation).toMatchObject({
        state: "OBSERVED",
        command: {
          outcome: {
            day: { canSubmit: true, unlock: { taskId: scenario.task.id } },
          },
        },
      });
      await codes.status(admin, code.id, {
        commandId: randomUUID(),
        confirmed: true,
        expectedCodeVersion: 1,
        state: "PAUSED",
      });
      expect(
        await unlocks.unlock(employee, scenario.task.id, payload),
      ).toMatchObject({ replayed: true, observation: accepted.observation });
      await unlocks.unlock(employee, scenario.task.id, {
        ...payload,
        commandId: randomUUID(),
        code: "ANOTHER",
      });
      expect(await database.taskUnlock.count()).toBe(1);
      expect(await database.taskSubmission.count()).toBe(0);
      expect(await database.financialOperation.count()).toBe(operations);
      const usages = await new TaskCodesQueries(
        database,
        scenario.clock,
      ).usages(admin, code.id, {});
      expect(usages.pagination.total).toBe(1);
      const later = await createIdentityFixture(database, {
        now: scenario.clock(),
      });
      const { fundSubscriptionFixture, activateSubscriptionFixture } =
        await import("../subscriptions/testing/subscription-fixtures.js");
      await fundSubscriptionFixture(database, later, {
        nonReferral: "60",
        referral: "0",
      });
      await activateSubscriptionFixture(database, later);
      await expect(
        unlocks.unlock(taskIdentity(later), scenario.task.id, {
          ...payload,
          commandId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "TASK_UNAVAILABLE" });
      expect(await database.taskUnlock.count()).toBe(1);
    });
  });
  it("serializes code pause against first unlock with no failed-use inflation", async () => {
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
          code: "PAUSE-RACE",
          state: "ENABLED",
        },
      );
      const code = await database.taskCode.findFirstOrThrow();
      await withIndependentTaskClients(url, async (first, second) => {
        const start = identityRaceBarrier(2);
        const [unlock, pause] = await Promise.allSettled([
          start().then(() =>
            new TaskUnlockService(first, scenario.clock).unlock(
              taskIdentity(scenario.employee),
              scenario.task.id,
              {
                commandId: randomUUID(),
                expectedTaskRevision: 2,
                code: "PAUSE-RACE",
              },
            ),
          ),
          start().then(() =>
            new TaskCodesService(second, scenario.clock).status(
              taskIdentity(scenario.admin),
              code.id,
              {
                commandId: randomUUID(),
                confirmed: true,
                expectedCodeVersion: 1,
                state: "PAUSED",
              },
            ),
          ),
        ]);
        expect(pause.status).toBe("fulfilled");
        if (unlock.status === "fulfilled")
          expect(await database.taskUnlock.count()).toBe(1);
        else {
          expect(unlock.reason).toMatchObject({ code: "TASK_UNAVAILABLE" });
          expect(await database.taskUnlock.count()).toBe(0);
        }
        expect(await database.taskSubmission.count()).toBe(0);
      });
    });
  });
  it("validates authenticated code commands, versions, immutable fields and bounded safe HTTP history", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const app = taskHttpApp(database, scenario.clock),
        token = taskHttpToken(scenario.admin);
      const payload = {
        commandId: randomUUID(),
        confirmed: true,
        taskId: scenario.task.id,
        code: " abc-رمز ",
        state: "ENABLED",
      };
      const post = (body: object, bearer = token) =>
        request(app)
          .post("/api/v1/admin/task-codes")
          .auth(bearer, { type: "bearer" })
          .set("Cookie", "csrfToken=code-test")
          .set("X-CSRF-Token", "code-test")
          .send(body);
      expect(
        (await post(payload, taskHttpToken(scenario.employee))).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/task-codes")
            .auth(token, { type: "bearer" })
            .send(payload)
        ).status,
      ).toBe(403);
      for (const invalid of [
        { ...payload, confirmed: false },
        { ...payload, ownerUserId: scenario.employee.user.id },
        { ...payload, maxUses: 1 },
        { ...payload, expiresAt: scenario.clock().toISOString() },
      ])
        expect((await post(invalid)).status).toBe(400);
      const created = await post(payload);
      expect(created.status).toBe(201);
      const code = taskCodeSummarySchema.parse(taskHttpEnvelope(created).data);
      expect(code).toMatchObject({
        normalizedText: "ABC-رمز",
        creator: { id: scenario.admin.user.id },
        successfulUsageCount: 0,
      });
      expect((await post({ ...payload, code: "ABC-رمز" })).status).toBe(200);
      expect(
        taskHttpError(await post({ ...payload, commandId: randomUUID() })).code,
      ).toBe("CODE_ALREADY_EXISTS");
      const patch = (body: object) =>
        request(app)
          .patch(`/api/v1/admin/task-codes/${code.id}/status`)
          .auth(token, { type: "bearer" })
          .set("Cookie", "csrfToken=code-test")
          .set("X-CSRF-Token", "code-test")
          .send(body);
      const status = {
        commandId: randomUUID(),
        confirmed: true,
        expectedCodeVersion: 1,
        state: "PAUSED",
      };
      expect((await patch({ ...status, code: "NEW" })).status).toBe(400);
      expect((await patch({ ...status, taskId: randomUUID() })).status).toBe(
        400,
      );
      expect((await patch(status)).status).toBe(200);
      expect(
        taskHttpError(await patch({ ...status, commandId: randomUUID() })).code,
      ).toBe("CODE_VERSION_CONFLICT");
      for (const [path, schema] of [
        ["/admin/task-codes", taskCodePageSchema],
        [`/admin/task-codes/${code.id}/usages`, taskCodeUsagePageSchema],
        [`/admin/task-codes/${code.id}/changes`, taskCodeAuditPageSchema],
      ] as const) {
        const response = await request(app)
          .get(`/api/v1${path}`)
          .auth(token, { type: "bearer" })
          .query({ limit: 1 });
        expect(response.status).toBe(200);
        expect(
          schema.parse(taskHttpEnvelope(response).data).pagination,
        ).toEqual(taskHttpEnvelope(response).paginationMeta);
        expect(JSON.stringify(response.body)).not.toMatch(
          /passwordHash|intentHash|safeOutcome|storageKey|sessionId/,
        );
        expect(response.headers["cache-control"]).toBe("private, no-store");
      }
      const audit = await database.taskCommandRecord.findFirstOrThrow({
        where: { commandId: status.commandId },
      });
      expect(audit).toMatchObject({
        actorUserId: scenario.admin.user.id,
        occurredAt: scenario.clock(),
        reason: null,
      });
      expect(
        await database.taskCommandRecord.count({ where: { codeId: code.id } }),
      ).toBe(2);
    });
  });
  it("normalizes globally including Unicode and paused identities; replays do not inflate audit", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      let acceptedAt = scenario.clock();
      const clock = () => acceptedAt;
      const service = new TaskCodesService(database, clock);
      const identity = taskIdentity(scenario.admin);
      const payload = {
        commandId: randomUUID(),
        confirmed: true,
        taskId: scenario.task.id,
        code: "  straße-رمز  ",
        state: "ENABLED",
        description: null,
      };
      const created = await service.create(identity, payload);
      expect(created.replayed).toBe(false);
      expect(
        (await service.create(identity, { ...payload, code: "STRASSE-رمز" }))
          .replayed,
      ).toBe(true);
      const code = await database.taskCode.findUniqueOrThrow({
        where: { normalizedText: "STRASSE-رمز" },
      });
      await expect(
        service.create(identity, { ...payload, state: "PAUSED" }),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      acceptedAt = new Date(acceptedAt.getTime() + 1000);
      await service.status(identity, code.id, {
        commandId: randomUUID(),
        confirmed: true,
        expectedCodeVersion: 1,
        state: "PAUSED",
      });
      await expect(
        service.create(identity, { ...payload, commandId: randomUUID() }),
      ).rejects.toMatchObject({ code: "CODE_ALREADY_EXISTS" });
      await expect(
        service.status(identity, code.id, {
          commandId: randomUUID(),
          confirmed: true,
          expectedCodeVersion: 1,
          state: "ENABLED",
        }),
      ).rejects.toMatchObject({ code: "CODE_VERSION_CONFLICT" });
      const reads = new TaskCodesQueries(database, clock);
      expect(
        await reads.changes(identity, code.id, { limit: "1" }),
      ).toMatchObject({
        pagination: { total: 2 },
        items: [
          {
            action: "CODE_STATUS",
            before: { state: "ENABLED", version: 1 },
            after: { state: "PAUSED", version: 2 },
          },
        ],
      });
      expect(
        await reads.list(identity, {
          search: "strasse",
          state: "PAUSED",
          taskId: scenario.task.id,
        }),
      ).toMatchObject({
        pagination: { total: 1 },
        items: [{ successfulUsageCount: 0, normalizedText: "STRASSE-رمز" }],
      });
      expect(
        await database.taskCode.findUniqueOrThrow({ where: { id: code.id } }),
      ).toMatchObject({
        taskId: scenario.task.id,
        normalizedText: "STRASSE-رمز",
      });
    });
  });
  it("permits one normalized winner across separate clients and different tasks", async () => {
    await withTaskDatabase(async (database, url) => {
      const scenario = await createTaskScenario(database);
      const otherAdmin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: scenario.clock(),
      });
      const otherTask = await database.task.create({
        data: {
          ...scenario.task,
          id: randomUUID(),
          publicationDate: new Date("2026-10-06"),
        },
      });
      await withIndependentTaskClients(url, async (first, second) => {
        const barrier = identityRaceBarrier(2);
        const outcomes = await Promise.allSettled([
          barrier().then(() =>
            new TaskCodesService(first, scenario.clock).create(
              taskIdentity(scenario.admin),
              {
                commandId: randomUUID(),
                confirmed: true,
                taskId: scenario.task.id,
                code: "  café ",
                state: "ENABLED",
              },
            ),
          ),
          barrier().then(() =>
            new TaskCodesService(second, scenario.clock).create(
              taskIdentity(otherAdmin),
              {
                commandId: randomUUID(),
                confirmed: true,
                taskId: otherTask.id,
                code: "CAFÉ",
                state: "PAUSED",
              },
            ),
          ),
        ]);
        expect(
          outcomes.filter((outcome) => outcome.status === "fulfilled"),
        ).toHaveLength(1);
        expect(
          outcomes.find((outcome) => outcome.status === "rejected")?.reason,
        ).toMatchObject({ code: "CODE_ALREADY_EXISTS" });
        expect(await database.taskCode.count()).toBe(1);
        expect(
          await database.taskCommandRecord.count({
            where: { kind: "CODE_CREATE" },
          }),
        ).toBe(1);
      });
    });
  });
  it("pages successful unlocks without assuming submissions and counts beyond the page", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const identity = taskIdentity(scenario.admin);
      await new TaskCodesService(database, scenario.clock).create(identity, {
        commandId: randomUUID(),
        confirmed: true,
        taskId: scenario.task.id,
        code: "USAGES",
        state: "ENABLED",
      });
      const code = await database.taskCode.findUniqueOrThrow({
        where: { normalizedText: "USAGES" },
      });
      const second = await createIdentityFixture(database, {
        now: scenario.clock(),
      });
      await createPendingTaskFixture(database, scenario);
      for (const employee of [scenario.employee, second])
        await database.taskUnlock.create({
          data: {
            employeeId: employee.user.id,
            taskId: scenario.task.id,
            codeId: code.id,
            businessDate: scenario.task.publicationDate,
            unlockedAt: scenario.clock(),
          },
        });
      const reads = new TaskCodesQueries(database, scenario.clock);
      expect(await reads.detail(identity, code.id)).toMatchObject({
        successfulUsageCount: 2,
        distinctSuccessfulEmployeeCount: 2,
      });
      expect(
        await reads.usages(identity, code.id, { limit: "1" }),
      ).toMatchObject({
        pagination: { total: 2 },
        items: [{ taskId: scenario.task.id }],
      });
      expect(
        await reads.usages(identity, code.id, {
          search: scenario.employee.user.email,
        }),
      ).toMatchObject({
        pagination: { total: 1 },
        items: [
          {
            employee: { id: scenario.employee.user.id },
            submissionStatus: "PENDING",
          },
        ],
      });
      expect(
        await reads.usages(identity, code.id, { search: second.user.email }),
      ).toMatchObject({ items: [{ submissionStatus: null }] });
      await expect(
        reads.detail(taskIdentity(scenario.employee), code.id),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
