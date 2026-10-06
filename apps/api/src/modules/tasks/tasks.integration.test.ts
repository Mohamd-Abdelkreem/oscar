import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  adminTaskDetailSchema,
  adminTaskPageSchema,
  commandObservationSchema,
  commandCancellationOutcomeSchema,
  TASK_COMMAND_ROLES,
} from "@template/contracts";
import {
  taskHttpApp,
  taskHttpToken,
  taskHttpEnvelope,
  taskHttpError,
} from "./testing/task-http-fixtures.js";
import {
  createIdentityFixture,
  identityRaceBarrier,
} from "../auth/testing/identity-fixtures.js";
import { TaskPublicationService } from "./task-publication.service.js";
import { TasksService } from "./tasks.service.js";
import { runLinuxProofProgram } from "../proofs/testing/linux-proof-runtime.js";
import {
  createTaskScenario,
  createPendingTaskFixture,
  taskIdentity,
  withTaskDatabase,
  withIndependentTaskClients,
} from "./testing/task-fixtures.js";

const publication = (date = "2026-10-06") => ({
  commandId: randomUUID(),
  confirmed: true,
  title: "Published task",
  description: "Do the work",
  platform: "Other platform",
  targetUrl: "https://example.com/work",
  publicationDate: date,
  publicationState: "PUBLISHED",
  isCodeRequired: false,
  illustrationAssetId: null,
});

describe("US4 task publication", () => {
  it("attaches actual canonical illustrations and reports missing retained bytes without admitting new attachments", async () => {
    await withTaskDatabase(async (database, url) => {
      const scenario = await createTaskScenario(database);
      const output = await runLinuxProofProgram(
        String.raw`
import assert from 'node:assert/strict';
import {readFile,mkdtemp,unlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
Object.assign(process.env,JSON.parse(await readFile('/fixture/environment.json','utf8')));
const fixture=JSON.parse(await readFile('/fixture/fixtures.json','utf8'));
const {createDatabaseClient}=await import('@template/database');const {createApp}=await import('./api/app.js');
const {ProofsRuntime}=await import('./api/modules/proofs/proofs.runtime.js');
const {generateTokenPair}=await import('./api/infrastructure/security/jwt.service.js');
const {default:pino}=await import('pino');const {default:sharp}=await import('sharp');
const database=createDatabaseClient(process.env.DATABASE_URL);
const root=await mkdtemp(join(tmpdir(),'p05-publication-'));
const clock=()=>new Date(fixture.now);
const runtime=new ProofsRuntime(database,{storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000},clock,()=>{});
let server;
try {
 await runtime.start();
 server=createApp({database,logger:pino({level:'silent'}),proofs:runtime,financialClock:clock}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api/v1';
 function token(identity,role){return generateTokenPair({...identity,role,tokenId:randomUUID(),email:'test@example.com',rememberMe:false,absoluteExpiresAt:new Date(Date.now()+86400000)}).accessToken;}
 const admin=token(fixture.admin,'ADMIN'),employee=token(fixture.employee,'USER');
 async function call(path,{method='GET',body,bearer=admin}={}) {
  const headers={Authorization:'Bearer '+bearer};
  if(method!=='GET'){headers.Cookie='csrfToken=task-files';headers['x-csrf-token']='task-files';}
  if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
  const response=await fetch(base+path,{method,headers,body});return {status:response.status,json:await response.json()};
 }
 const png=await sharp({create:{width:2,height:2,channels:4,background:'#ffcc88'}}).png().toBuffer();
 async function upload(path,bearer) {const form=new FormData();form.set('commandId',randomUUID());form.set('file',new Blob([png],{type:'image/png'}),'synthetic.png');return call(path,{method:'POST',body:form,bearer});}
 const illustration=await upload('/admin/task-illustrations',admin);assert.equal(illustration.status,201);assert.equal(illustration.json.data.availability,'PRESENT');
 const proof=await upload('/proofs',employee);assert.equal(proof.status,201);
 const payload={commandId:randomUUID(),confirmed:true,title:'Actual illustration',description:'Synthetic work',platform:'Test',targetUrl:'https://example.com/task',publicationDate:'2026-10-06',publicationState:'PUBLISHED',isCodeRequired:false,illustrationAssetId:illustration.json.data.id};
 const invalid=await call('/admin/tasks',{method:'POST',body:{...payload,commandId:randomUUID(),illustrationAssetId:proof.json.data.id}});assert.equal(invalid.status,404);
 const created=await call('/admin/tasks',{method:'POST',body:payload});assert.equal(created.status,201);assert.equal(created.json.data.illustration.availability,'PRESENT');
 const detail=await call('/admin/tasks/'+created.json.data.id);assert.equal(detail.json.data.illustration.availability,'PRESENT');
 const list=await call('/admin/tasks?search=Actual');assert.equal(list.json.data.items[0].illustration.availability,'PRESENT');
 const unused=await upload('/admin/task-illustrations',admin);assert.equal(unused.status,201);
 const missing=await database.imageAsset.findUniqueOrThrow({where:{id:unused.json.data.id}});
 await unlink(join(root,'assets',missing.storageKey,'content.png'));
 const denied=await call('/admin/tasks/'+created.json.data.id,{method:'PATCH',body:{commandId:randomUUID(),confirmed:true,expectedTaskRevision:1,illustrationAssetId:missing.id}});assert.equal(denied.status,503);
 assert.equal((await database.task.findUniqueOrThrow({where:{id:created.json.data.id}})).revision,1);
 const attached=await database.imageAsset.findUniqueOrThrow({where:{id:illustration.json.data.id}});
 await unlink(join(root,'assets',attached.storageKey,'content.png'));
 const unavailable=await call('/admin/tasks/'+created.json.data.id);assert.equal(unavailable.json.data.illustration.availability,'STORAGE_UNAVAILABLE');
 const replay=await call('/admin/tasks',{method:'POST',body:payload});assert.equal(replay.status,200);assert.equal(replay.json.data.illustration.availability,'STORAGE_UNAVAILABLE');
 const observed=await call('/task-commands/'+payload.commandId+'?kind=TASK_CREATE');assert.equal(observed.json.data.command.outcome.illustration.availability,'STORAGE_UNAVAILABLE');
 assert.equal(await database.task.count(),2);assert.equal(await database.taskCommandRecord.count({where:{terminalState:'COMMITTED'}}),1);
 console.log(JSON.stringify({actualIllustrationPublication:true,missingAttachmentDenied:true,retainedMissingAvailability:true}));
} finally {
 if(server)await new Promise(resolve=>server.close(resolve));await runtime.stop();await database.$disconnect();await rm(root,{recursive:true,force:true});
}
`,
        url,
        {
          now: scenario.clock().toISOString(),
          admin: taskIdentity(scenario.admin),
          employee: taskIdentity(scenario.employee),
        },
      );
      expect(output).toContain('"actualIllustrationPublication":true');
      expect(output).toContain('"missingAttachmentDenied":true');
    });
  });
  it("authenticates actual publication routes, strict confirmation, replay, audit and private filtered DTOs", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const app = taskHttpApp(database, scenario.clock);
      const token = taskHttpToken(scenario.admin);
      const post = (body: object, bearer = token) =>
        request(app)
          .post("/api/v1/admin/tasks")
          .auth(bearer, { type: "bearer" })
          .set("Cookie", "csrfToken=task-test")
          .set("X-CSRF-Token", "task-test")
          .send(body);
      const payload = publication();
      expect(
        (await request(app).post("/api/v1/admin/tasks").send(payload)).status,
      ).toBe(401);
      expect(
        (await post(payload, taskHttpToken(scenario.employee))).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/tasks")
            .auth(token, { type: "bearer" })
            .send(payload)
        ).status,
      ).toBe(403);
      for (const invalid of [
        { ...payload, confirmed: false },
        { ...payload, reward: "999" },
        { ...payload, createdByUserId: scenario.employee.user.id },
        { ...payload, startTime: "11:00" },
      ])
        expect((await post(invalid)).status).toBe(400);
      const created = await post(payload);
      expect(created.status).toBe(201);
      const detail = adminTaskDetailSchema.parse(
        taskHttpEnvelope(created).data,
      );
      expect(detail).toMatchObject({
        revision: 1,
        dateEditable: true,
        displayStatus: "SCHEDULED",
        window: { opensAt: "2026-10-06T09:00:00.000Z" },
      });
      expect(created.headers["cache-control"]).toBe("private, no-store");
      expect((await post(payload)).status).toBe(200);
      const mismatch = await post({ ...payload, title: "Changed" });
      expect(mismatch.status).toBe(409);
      expect(taskHttpError(mismatch).code).toBe("IDEMPOTENCY_CONFLICT");
      const observed = await request(app)
        .get(`/api/v1/task-commands/${payload.commandId}`)
        .query({ kind: "TASK_CREATE" })
        .auth(token, { type: "bearer" });
      expect(
        commandObservationSchema.parse(taskHttpEnvelope(observed).data),
      ).toMatchObject({
        state: "OBSERVED",
        command: {
          targetId: detail.id,
          committedAt: scenario.clock().toISOString(),
        },
      });
      const list = await request(app)
        .get("/api/v1/admin/tasks")
        .query({ search: "Published", limit: 1 })
        .auth(token, { type: "bearer" });
      const page = adminTaskPageSchema.parse(taskHttpEnvelope(list).data);
      expect(page.pagination).toEqual(taskHttpEnvelope(list).paginationMeta);
      expect(page.pagination.total).toBe(1);
      expect(JSON.stringify(list.body)).not.toMatch(
        /passwordHash|storageKey|intentHash|safeOutcome|sessionId/,
      );
      expect(
        (
          await request(app)
            .get("/api/v1/admin/tasks")
            .query({ limit: 101 })
            .auth(token, { type: "bearer" })
        ).status,
      ).toBe(400);
      const status = {
        commandId: randomUUID(),
        confirmed: true,
        expectedTaskRevision: 1,
        publicationState: "CLOSED",
      };
      const patch = () =>
        request(app)
          .patch(`/api/v1/admin/tasks/${detail.id}/status`)
          .auth(token, { type: "bearer" })
          .set("Cookie", "csrfToken=task-test")
          .set("X-CSRF-Token", "task-test")
          .send(status);
      expect((await patch()).status).toBe(200);
      expect(
        adminTaskDetailSchema.parse(taskHttpEnvelope(await patch()).data)
          .revision,
      ).toBe(2);
      const audit = await database.taskCommandRecord.findFirstOrThrow({
        where: { commandId: status.commandId },
      });
      expect(audit).toMatchObject({
        actorUserId: scenario.admin.user.id,
        occurredAt: scenario.clock(),
        reason: null,
        beforeSnapshot: { revision: 1 },
        afterSnapshot: { revision: 2 },
      });
      expect(
        await database.financialOperation.count({
          where: { businessNamespace: "p05.task-reward" },
        }),
      ).toBe(0);
      await database.authSession.update({
        where: { id: scenario.admin.session.id },
        data: { revokedAt: scenario.clock() },
      });
      expect((await post({ ...publication("2026-10-07") })).status).toBe(401);
    });
  });

  it("enforces the cancellation role matrix and own keys over actual HTTP without reversing committed effects", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const other = await createIdentityFixture(database, {
        role: "ADMIN",
        now: scenario.clock(),
      });
      const app = taskHttpApp(database, scenario.clock);
      const adminToken = taskHttpToken(scenario.admin),
        employeeToken = taskHttpToken(scenario.employee);
      const cancel = (
        key: string,
        kind: string,
        bearer: string,
        body: object = { kind, confirmed: true },
      ) =>
        request(app)
          .post(`/api/v1/task-commands/${key}/cancel`)
          .auth(bearer, { type: "bearer" })
          .set("Cookie", "csrfToken=task-test")
          .set("X-CSRF-Token", "task-test")
          .send(body);
      for (const [kind, role] of Object.entries(TASK_COMMAND_ROLES)) {
        const key = randomUUID();
        const allowed = role === "ADMIN" ? adminToken : employeeToken;
        const wrong = role === "ADMIN" ? employeeToken : adminToken;
        expect((await cancel(key, kind, wrong)).status).toBe(403);
        const response = await cancel(key, kind, allowed);
        expect(response.status).toBe(200);
        expect(
          commandCancellationOutcomeSchema.parse(
            taskHttpEnvelope(response).data,
          ),
        ).toMatchObject({ state: "CANCELLED", commandId: key, kind });
        expect(taskHttpEnvelope(await cancel(key, kind, allowed)).data).toEqual(
          taskHttpEnvelope(response).data,
        );
      }
      const key = randomUUID();
      for (const body of [
        { kind: "TASK_CREATE" },
        { kind: "TASK_CREATE", confirmed: false },
        { kind: "TASK_CREATE", confirmed: true, actorUserId: other.user.id },
      ])
        expect(
          (await cancel(key, "TASK_CREATE", adminToken, body)).status,
        ).toBe(400);
      expect(
        (
          await request(app)
            .post(`/api/v1/task-commands/${key}/cancel`)
            .auth(adminToken, { type: "bearer" })
            .send({ kind: "TASK_CREATE", confirmed: true })
        ).status,
      ).toBe(403);
      await cancel(key, "TASK_CREATE", adminToken);
      const late = await request(app)
        .post("/api/v1/admin/tasks")
        .auth(adminToken, { type: "bearer" })
        .set("Cookie", "csrfToken=task-test")
        .set("X-CSRF-Token", "task-test")
        .send({ ...publication(), commandId: key });
      expect(late.status).toBe(409);
      expect(taskHttpError(late).code).toBe("COMMAND_CANCELLED");
      expect(await database.task.count()).toBe(1);
      const foreign = await request(app)
        .get(`/api/v1/task-commands/${key}`)
        .auth(taskHttpToken(other), { type: "bearer" })
        .query({ kind: "TASK_CREATE" });
      expect(taskHttpEnvelope(foreign).data).toEqual({
        state: "NOT_OBSERVED",
        kind: "TASK_CREATE",
        commandId: key,
      });
      const created = await new TaskPublicationService(
        database,
        scenario.clock,
      ).create(taskIdentity(scenario.admin), publication());
      if (created.observation.state !== "OBSERVED")
        throw new Error("Missing committed test command");
      const committed = created.observation.command;
      const resolved = await cancel(
        committed.commandId,
        "TASK_CREATE",
        adminToken,
      );
      expect(taskHttpEnvelope(resolved).data).toMatchObject({
        state: "OBSERVED",
        command: { targetId: committed.targetId },
      });
      expect(await database.task.count()).toBe(2);
      await database.authSession.update({
        where: { id: scenario.employee.session.id },
        data: { revokedAt: scenario.clock() },
      });
      expect(
        (await cancel(randomUUID(), "TASK_UNLOCK", employeeToken)).status,
      ).toBe(401);
      expect(await database.taskUnlock.count()).toBe(0);
      expect(await database.taskSubmission.count()).toBe(0);
      expect(
        await database.financialOperation.count({
          where: { businessNamespace: "p05.task-reward" },
        }),
      ).toBe(0);
    });
  });
  it("retains occupied dates across states, checks revisions and keeps captured work immutable", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const identity = taskIdentity(scenario.admin);
      const service = new TaskPublicationService(database, scenario.clock);
      const created = await service.create(identity, publication());
      expect(created.observation.state).toBe("OBSERVED");
      const record = await database.task.findUniqueOrThrow({
        where: { publicationDate: new Date("2026-10-06") },
      });
      await expect(
        service.create(identity, publication()),
      ).rejects.toMatchObject({ code: "TASK_DATE_OCCUPIED" });
      await expect(
        service.create(identity, publication("2026-10-10")),
      ).rejects.toThrow();
      await expect(
        service.create(identity, {
          ...publication("2026-10-07"),
          targetUrl: "http://127.0.0.1/x",
        }),
      ).rejects.toThrow();
      await expect(
        service.status(identity, record.id, {
          commandId: randomUUID(),
          confirmed: false,
          expectedTaskRevision: 1,
          publicationState: "PAUSED",
        }),
      ).rejects.toThrow();
      await service.status(identity, record.id, {
        commandId: randomUUID(),
        confirmed: true,
        expectedTaskRevision: 1,
        publicationState: "PAUSED",
      });
      await expect(
        service.create(identity, publication()),
      ).rejects.toMatchObject({ code: "TASK_DATE_OCCUPIED" });
      await expect(
        service.edit(identity, record.id, {
          commandId: randomUUID(),
          confirmed: true,
          expectedTaskRevision: 1,
          title: "Stale",
        }),
      ).rejects.toMatchObject({ code: "TASK_REVISION_CONFLICT" });
      await service.edit(identity, record.id, {
        commandId: randomUUID(),
        confirmed: true,
        expectedTaskRevision: 2,
        publicationDate: "2026-10-07",
      });
      const { submission } = await createPendingTaskFixture(database, scenario);
      await service.edit(identity, scenario.task.id, {
        commandId: randomUUID(),
        confirmed: true,
        expectedTaskRevision: 1,
        title: "New instructions",
        illustrationAssetId: null,
      });
      await expect(
        service.edit(identity, scenario.task.id, {
          commandId: randomUUID(),
          confirmed: true,
          expectedTaskRevision: 2,
          publicationDate: "2026-10-08",
        }),
      ).rejects.toMatchObject({ code: "TASK_DATE_LOCKED" });
      expect(
        await database.taskSubmission.findUniqueOrThrow({
          where: { id: submission.id },
        }),
      ).toMatchObject({
        capturedTaskRevision: 1,
        capturedTaskContent: submission.capturedTaskContent,
        rewardUnits: submission.rewardUnits,
      });
      const detail = await new TasksService(database, scenario.clock).detail(
        identity,
        scenario.task.id,
      );
      expect(detail).toMatchObject({
        firstParticipationAt: scenario.clock().toISOString(),
        dateEditable: false,
        submissionCount: 1,
        approvedSubmissionCount: 0,
        revision: 2,
      });
      expect(
        await database.taskCommandRecord.count({
          where: { terminalState: "COMMITTED" },
        }),
      ).toBe(4);
    });
  });

  it("chooses one retained date and one edit across independent simultaneous administrators", async () => {
    await withTaskDatabase(async (database, url) => {
      const scenario = await createTaskScenario(database);
      const second = await createIdentityFixture(database, {
        role: "ADMIN",
        now: scenario.clock(),
      });
      await withIndependentTaskClients(
        url,
        async (firstClient, secondClient) => {
          const first = new TaskPublicationService(firstClient, scenario.clock);
          const other = new TaskPublicationService(
            secondClient,
            scenario.clock,
          );
          let barrier = identityRaceBarrier(2);
          const dates = await Promise.allSettled([
            barrier().then(() =>
              first.create(taskIdentity(scenario.admin), publication()),
            ),
            barrier().then(() =>
              other.create(taskIdentity(second), publication()),
            ),
          ]);
          expect(
            dates.filter((attempt) => attempt.status === "fulfilled"),
          ).toHaveLength(1);
          expect(
            dates.find((attempt) => attempt.status === "rejected")?.reason,
          ).toMatchObject({ code: "TASK_DATE_OCCUPIED" });
          expect(
            await database.task.count({
              where: { publicationDate: new Date("2026-10-06") },
            }),
          ).toBe(1);
          barrier = identityRaceBarrier(2);
          const edits = await Promise.allSettled([
            barrier().then(() =>
              first.edit(taskIdentity(scenario.admin), scenario.task.id, {
                commandId: randomUUID(),
                confirmed: true,
                expectedTaskRevision: 1,
                title: "First",
              }),
            ),
            barrier().then(() =>
              other.edit(taskIdentity(second), scenario.task.id, {
                commandId: randomUUID(),
                confirmed: true,
                expectedTaskRevision: 1,
                title: "Second",
              }),
            ),
          ]);
          expect(
            edits.filter((attempt) => attempt.status === "fulfilled"),
          ).toHaveLength(1);
          expect(
            edits.find((attempt) => attempt.status === "rejected")?.reason,
          ).toMatchObject({ code: "TASK_REVISION_CONFLICT" });
          expect(
            await database.taskCommandRecord.count({
              where: { kind: "TASK_EDIT" },
            }),
          ).toBe(1);
        },
      );
    });
  });

  it("keeps rows and totals in one snapshot during a concurrent publication", async () => {
    await withTaskDatabase(async (database, databaseUrl) => {
      const scenario = await createTaskScenario(database);
      await withIndependentTaskClients(databaseUrl, async (locker, reader) => {
        let release = () => {};
        let ready = () => {};
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        const locked = new Promise<void>((resolve) => {
          ready = resolve;
        });
        const holding = locker.$transaction(
          async (transaction) => {
            await transaction.$executeRaw`LOCK TABLE task_codes IN ACCESS EXCLUSIVE MODE`;
            ready();
            await released;
          },
          { timeout: 15_000 },
        );
        await locked;
        const reads = new TasksService(reader, scenario.clock);
        const page = reads.list(taskIdentity(scenario.admin), {});
        try {
          // The aggregate query waits after the authority read has established its snapshot.
          const deadline = Date.now() + 5_000;
          let blocked = false;
          while (Date.now() < deadline && !blocked) {
            const waiters = await database.$queryRaw<{ blocked: boolean }[]>`
              SELECT EXISTS(SELECT 1 FROM pg_stat_activity
                WHERE wait_event_type='Lock' AND query LIKE '%"tasks"%'
                AND pid <> pg_backend_pid()) AS blocked`;
            blocked = waiters[0]?.blocked === true;
          }
          expect(blocked).toBe(true);
          await database.task.create({
            data: {
              ...scenario.task,
              id: randomUUID(),
              publicationDate: new Date("2026-10-06T00:00:00Z"),
              title: "Concurrent publication",
            },
          });
        } finally {
          release();
          await holding;
        }
        const snapshot = await page;
        expect(snapshot.items.map((task) => task.id)).toEqual([
          scenario.task.id,
        ]);
        expect(snapshot.pagination.total).toBe(1);
        expect(
          (await reads.list(taskIdentity(scenario.admin), {})).pagination.total,
        ).toBe(2);
      });
    });
  });

  it("filters server display states with complete totals and denies employee reads", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      const identity = taskIdentity(scenario.admin);
      const publications = new TaskPublicationService(database, scenario.clock);
      await publications.create(identity, publication());
      await publications.create(identity, {
        ...publication("2026-10-07"),
        publicationState: "PAUSED",
      });
      const reads = new TasksService(database, scenario.clock);
      expect(await reads.list(identity, { limit: "1" })).toMatchObject({
        pagination: { total: 3 },
        items: [{ displayStatus: "PAUSED" }],
      });
      expect(
        await reads.list(identity, {
          displayStatus: "SCHEDULED",
          platform: "Other platform",
        }),
      ).toMatchObject({
        pagination: { total: 1 },
        items: [{ publicationDate: "2026-10-06" }],
      });
      expect(
        await reads.list(identity, {
          search: "Task fixture",
          dateFrom: "2026-10-05",
          dateTo: "2026-10-05",
        }),
      ).toMatchObject({
        pagination: { total: 1 },
        items: [{ displayStatus: "ACTIVE" }],
      });
      expect(await reads.list(identity, { search: "no match" })).toMatchObject({
        pagination: { total: 0, totalPages: 0 },
        items: [],
      });
      await expect(
        reads.list(taskIdentity(scenario.employee), {}),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
