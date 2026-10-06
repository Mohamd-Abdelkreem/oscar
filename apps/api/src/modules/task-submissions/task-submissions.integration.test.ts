import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TaskSubmissionsService } from "./task-submissions.service.js";
import { EmployeeTasksService } from "../tasks/employee-tasks.service.js";
import {
  createTaskScenario,
  createReadyProofFixture,
  taskIdentity,
  withTaskDatabase,
  withTaskFileFixture,
} from "../tasks/testing/task-fixtures.js";
import { submissionFixtureReads } from "./testing/submission-fixtures.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { TaskSubmissionsQueries } from "./task-submissions.queries.js";
import { TaskCommandService } from "../tasks/task-command.service.js";
import { TaskPublicationService } from "../tasks/task-publication.service.js";
import { SubmissionEvidenceService } from "./submission-evidence.service.js";
import { TaskUnlockService } from "../task-codes/task-unlock.service.js";
import request from "supertest";
import {
  employeeTaskDaySchema,
  submissionPageSchema,
  evidencePageSchema,
  adminSubmissionPageSchema,
} from "@template/contracts";
import {
  taskHttpApp,
  taskHttpToken,
  taskHttpEnvelope,
} from "../tasks/testing/task-http-fixtures.js";
import { runLinuxProofProgram } from "../proofs/testing/linux-proof-runtime.js";

describe("US1 daily acceptance", () => {
  it("retains a rejected date claim and immutable history without permitting resubmission or evidence edits", async () => {
    await withTaskDatabase(async (database) =>
      withTaskFileFixture(async (root) => {
        const scenario = await createTaskScenario(database),
          asset = await createReadyProofFixture(database, scenario.employee);
        const reads = await submissionFixtureReads(
            database,
            root,
            scenario.clock,
            [asset],
          ),
          identity = taskIdentity(scenario.employee);
        const service = new TaskSubmissionsService(
          database,
          scenario.clock,
          reads,
        );
        const payload = {
          commandId: randomUUID(),
          taskId: scenario.task.id,
          expectedTaskRevision: 1,
          proofAssetId: asset.id,
          declaredExecuted: true,
        };
        await service.create(identity, payload);
        const claim = await database.taskSubmission.findFirstOrThrow();
        // A valid persisted final fixture verifies claim/read policy; US2 owns the review command acceptance.
        await database.$transaction(async (transaction) => {
          await transaction.taskSubmission.update({
            where: { id: claim.id },
            data: { status: "REJECTED", version: { increment: 1 } },
          });
          await transaction.finalReview.create({
            data: {
              submissionId: claim.id,
              employeeId: identity.userId,
              decision: "REJECTED",
              submissionVersion: 1,
              evidenceVersion: 1,
              actorUserId: scenario.admin.user.id,
              decidedAt: scenario.clock(),
              reason: "Synthetic final fixture",
            },
          });
        });
        await expect(
          service.create(identity, { ...payload, commandId: randomUUID() }),
        ).rejects.toMatchObject({ code: "DAILY_CLAIM_EXISTS" });
        const queries = new TaskSubmissionsQueries(
          database,
          scenario.clock,
          reads,
        );
        expect(await queries.detail(identity, claim.id)).toMatchObject({
          status: "REJECTED",
          canReplace: false,
          finalDecision: {
            decision: "REJECT",
            reason: "Synthetic final fixture",
          },
        });
        expect(
          await new EmployeeTasksService(database, scenario.clock, reads).today(
            identity,
          ),
        ).toMatchObject({
          canSubmit: false,
          canReplace: false,
          unavailableReason: "SUBMISSION_FINAL",
        });
        await expect(
          new SubmissionEvidenceService(
            database,
            scenario.clock,
            reads,
          ).replace(identity, claim.id, {
            commandId: randomUUID(),
            expectedSubmissionVersion: 2,
            proofAssetId: asset.id,
          }),
        ).rejects.toMatchObject({ code: "EVIDENCE_CONFLICT" });
        expect(await database.taskSubmission.count()).toBe(1);
        expect(await database.submissionEvidence.count()).toBe(1);
        expect(
          await queries.adminList(taskIdentity(scenario.admin), {
            status: "PENDING",
          }),
        ).toMatchObject({
          items: [],
          pagination: { total: 0 },
          statusCounts: { all: 1, pending: 0, approved: 0, rejected: 1 },
        });
      }),
    );
  });
  it("accepts actual uploaded PNG through authenticated HTTP, reconciles replay and keeps replacement snapshots and privacy", async () => {
    await withTaskDatabase(async (database, url) => {
      const scenario = await createTaskScenario(database);
      const output = await runLinuxProofProgram(
        String.raw`
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,unlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
Object.assign(process.env,JSON.parse(await readFile('/fixture/environment.json','utf8')));
const fixture=JSON.parse(await readFile('/fixture/fixtures.json','utf8'));
const {createDatabaseClient}=await import('@template/database');const {createApp}=await import('./api/app.js');
const {ProofsRuntime}=await import('./api/modules/proofs/proofs.runtime.js');const {generateTokenPair}=await import('./api/infrastructure/security/jwt.service.js');
const {default:pino}=await import('pino');const {default:sharp}=await import('sharp');
const {employeeTaskDaySchema,submissionDetailSchema,submissionPageSchema,evidencePageSchema,commandObservationSchema}=await import('@template/contracts');
const database=createDatabaseClient(process.env.DATABASE_URL),root=await mkdtemp(join(tmpdir(),'p05-acceptance-'));
let now=new Date(fixture.now);const clock=()=>new Date(now);
const runtime=new ProofsRuntime(database,{storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000},clock,()=>{});
let server;
try {
 await runtime.start();server=createApp({database,logger:pino({level:'silent'}),proofs:runtime,financialClock:clock}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port+'/api/v1';
 function token(identity,role){return generateTokenPair({...identity,role,tokenId:randomUUID(),email:'test@example.com',rememberMe:false,absoluteExpiresAt:new Date(Date.now()+86400000)}).accessToken;}
 const admin=token(fixture.admin,'ADMIN'),employee=token(fixture.employee,'USER');
 async function call(path,{method='GET',body,bearer=employee,csrf=true}={}) {
  const headers={Authorization:'Bearer '+bearer};
  if(method!=='GET'&&csrf){headers.Cookie='csrfToken=actual-claim';headers['x-csrf-token']='actual-claim';}
  if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
  const response=await fetch(base+path,{method,headers,body});return {status:response.status,json:await response.json(),cache:response.headers.get('cache-control')};
 }
 const png=await sharp({create:{width:3,height:2,channels:4,background:'#ee9988'}}).png().toBuffer();
 async function upload(path,bearer) {const body=new FormData();body.set('commandId',randomUUID());body.set('file',new Blob([png],{type:'image/png'}),'synthetic.png');return call(path,{method:'POST',body,bearer});}
 let day=await call('/tasks/today');assert.equal(day.status,200);assert.equal(day.cache,'private, no-store');assert.equal(employeeTaskDaySchema.parse(day.json.data).canSubmit,true);
 assert.equal((await call('/tasks/today?reward=900')).status,400);
 const edited=await call('/admin/tasks/'+fixture.taskId,{method:'PATCH',bearer:admin,body:{commandId:randomUUID(),confirmed:true,expectedTaskRevision:1,isCodeRequired:true}});assert.equal(edited.status,200);
 const code=await call('/admin/task-codes',{method:'POST',bearer:admin,body:{commandId:randomUUID(),confirmed:true,taskId:fixture.taskId,code:'REAL-CODE',state:'ENABLED'}});assert.equal(code.status,201);
 const file=await upload('/proofs',employee),illustration=await upload('/admin/task-illustrations',admin);assert.equal(file.status,201);assert.equal(illustration.status,201);
 const intent={commandId:randomUUID(),taskId:fixture.taskId,expectedTaskRevision:2,proofAssetId:file.json.data.id,declaredExecuted:true};
 assert.equal((await call('/task-submissions',{method:'POST',body:intent})).status,409);
 assert.equal((await call('/tasks/'+fixture.taskId+'/unlock',{method:'POST',body:{commandId:randomUUID(),expectedTaskRevision:2,code:'WRONG'}})).status,409);
 const unlock={commandId:randomUUID(),expectedTaskRevision:2,code:' real-code '};
 assert.equal((await call('/tasks/'+fixture.taskId+'/unlock',{method:'POST',body:unlock,csrf:false})).status,403);
 assert.equal((await call('/tasks/'+fixture.taskId+'/unlock',{method:'POST',body:unlock})).status,200);
 assert.equal((await call('/tasks/'+fixture.taskId+'/unlock',{method:'POST',body:unlock})).status,200);
 assert.equal((await call('/admin/task-codes/'+code.json.data.id+'/status',{method:'PATCH',bearer:admin,body:{commandId:randomUUID(),confirmed:true,expectedCodeVersion:1,state:'PAUSED'}})).status,200);
 assert.equal((await call('/task-submissions',{method:'POST',body:{...intent,declaredExecuted:false}})).status,400);
 assert.equal((await call('/task-submissions',{method:'POST',body:{...intent,reward:'900'}})).status,400);
 assert.equal((await call('/task-submissions',{method:'POST',body:{...intent,expectedTaskRevision:1}})).status,409);
 assert.equal((await call('/task-submissions',{method:'POST',body:{...intent,proofAssetId:illustration.json.data.id}})).status,404);
 assert.equal((await call('/task-submissions',{method:'POST',body:intent,bearer:admin})).status,403);
 assert.equal((await call('/task-submissions',{method:'POST',body:intent,csrf:false})).status,403);
 const before=await database.wallet.findUniqueOrThrow({where:{ownerUserId:fixture.employee.userId}}),operations=await database.financialOperation.count();
 const accepted=await call('/task-submissions',{method:'POST',body:intent});assert.equal(accepted.status,201);
 const detail=submissionDetailSchema.parse(accepted.json.data);assert.equal(detail.status,'PENDING');assert.equal(detail.reward,'2');assert.equal(detail.snapshot.declaredExecuted,true);assert.equal(detail.evidence.asset.availability,'PRESENT');
 const replay=await call('/task-submissions',{method:'POST',body:intent});assert.equal(replay.status,200);assert.deepEqual(replay.json.data,accepted.json.data);
 assert.equal((await call('/task-submissions',{method:'POST',body:{...intent,declaredExecuted:true,expectedTaskRevision:3}})).status,409);
 assert.equal((await call('/task-submissions',{method:'POST',body:{...intent,commandId:randomUUID()}})).json.code,'DAILY_CLAIM_EXISTS');
 const observed=commandObservationSchema.parse((await call('/task-commands/'+intent.commandId+'?kind=SUBMISSION_CREATE')).json.data);assert.equal(observed.state,'OBSERVED');assert.equal(observed.command.targetId,detail.id);
 const unused=randomUUID();assert.equal((await call('/task-commands/'+unused+'/cancel',{method:'POST',body:{kind:'SUBMISSION_CREATE',confirmed:true}})).json.data.state,'CANCELLED');
 assert.equal((await call('/task-submissions',{method:'POST',body:{...intent,commandId:unused}})).json.code,'COMMAND_CANCELLED');
 assert.equal((await call('/admin/tasks/'+fixture.taskId,{method:'PATCH',bearer:admin,body:{commandId:randomUUID(),confirmed:true,expectedTaskRevision:2,title:'Edited after acceptance',isCodeRequired:false}})).status,200);
 assert.equal((await call('/admin/tasks/'+fixture.taskId,{method:'PATCH',bearer:admin,body:{commandId:randomUUID(),confirmed:true,expectedTaskRevision:3,publicationDate:'2026-10-06'}})).json.code,'TASK_DATE_LOCKED');
 const replacement=await upload('/proofs',employee);assert.equal(replacement.status,201);
 const replaceIntent={commandId:randomUUID(),expectedSubmissionVersion:1,proofAssetId:replacement.json.data.id};
 const updated=await call('/task-submissions/'+detail.id+'/evidence',{method:'PATCH',body:replaceIntent});assert.equal(updated.status,200);assert.deepEqual(updated.json.data.snapshot,detail.snapshot);assert.equal(updated.json.data.currentEvidenceVersion,2);
 assert.equal((await call('/task-submissions/'+detail.id+'/evidence',{method:'PATCH',body:replaceIntent})).status,200);
 const evidence=evidencePageSchema.parse((await call('/task-submissions/'+detail.id+'/evidence?limit=1')).json.data);assert.equal(evidence.pagination.total,2);
 const history=submissionPageSchema.parse((await call('/task-submissions?status=PENDING&limit=1')).json.data);assert.equal(history.pagination.total,1);
 const binary=await fetch(base+'/proofs/'+file.json.data.id+'/content',{headers:{Authorization:'Bearer '+employee}});assert.equal(binary.status,200);assert.equal(binary.headers.get('content-type'),'image/png');assert.ok((await binary.arrayBuffer()).byteLength>0);
 now=new Date('2026-10-05T15:00:00Z');
 const late=await call('/task-submissions/'+detail.id+'/evidence',{method:'PATCH',body:{commandId:randomUUID(),expectedSubmissionVersion:2,proofAssetId:file.json.data.id}});assert.equal(late.status,409);
 assert.equal((await call('/tasks/today')).json.data.canReplace,false);
 const staleObservation=commandObservationSchema.parse((await call('/task-commands/'+intent.commandId+'?kind=SUBMISSION_CREATE')).json.data);assert.equal(staleObservation.command.outcome.canReplace,false);
 assert.deepEqual(await database.wallet.findUniqueOrThrow({where:{ownerUserId:fixture.employee.userId}}),before);assert.equal(await database.financialOperation.count(),operations);assert.equal(await database.taskSubmission.count(),1);assert.equal(await database.submissionEvidence.count(),2);assert.equal(await database.taskUnlock.count(),1);
 console.log(JSON.stringify({actualUploadAndClaim:true,retainedUnlock:true,replayAndCancellation:true,privateHistoryAndReplacement:true,noPendingMoney:true}));
} finally {if(server)await new Promise(resolve=>server.close(resolve));await runtime.stop();await database.$disconnect();await rm(root,{recursive:true,force:true});}
`,
        url,
        {
          now: scenario.clock().toISOString(),
          taskId: scenario.task.id,
          admin: taskIdentity(scenario.admin),
          employee: taskIdentity(scenario.employee),
        },
      );
      expect(output).toContain('"actualUploadAndClaim":true');
      expect(output).toContain('"noPendingMoney":true');
    });
  });
  it("derives opening/cutoff/holiday and opportunity states without browser authority", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database);
      await database.authSession.update({
        where: { id: scenario.employee.session.id },
        data: { expiresAt: new Date("2026-10-15T00:00:00Z") },
      });
      await new TaskPublicationService(database, scenario.clock).edit(
        taskIdentity(scenario.admin),
        scenario.task.id,
        {
          commandId: randomUUID(),
          confirmed: true,
          expectedTaskRevision: 1,
          publicationDate: "2026-10-06",
        },
      );
      for (const [instant, state, canSubmit] of [
        ["2026-10-06T08:59:59.999Z", "UPCOMING", false],
        ["2026-10-06T09:00:00Z", "OPEN", true],
        ["2026-10-06T14:59:59.999Z", "OPEN", true],
        ["2026-10-06T15:00:00Z", "CLOSED", false],
        ["2026-10-10T09:00:00Z", "HOLIDAY", false],
        ["2026-10-11T09:00:00Z", "HOLIDAY", false],
      ] as const) {
        const day = await new EmployeeTasksService(
          database,
          () => new Date(instant),
        ).today(taskIdentity(scenario.employee));
        expect(day).toMatchObject({
          calendarState: state,
          workEligibility: "ELIGIBLE",
          canSubmit,
        });
        if (state === "HOLIDAY") expect(day.task).toBeNull();
      }
      for (const publicationState of ["PAUSED", "CLOSED"] as const) {
        await database.task.update({
          where: { id: scenario.task.id },
          data: { publicationState, revision: { increment: 1 } },
        });
        expect(
          await new EmployeeTasksService(
            database,
            () => new Date("2026-10-06T09:00:00Z"),
          ).today(taskIdentity(scenario.employee)),
        ).toMatchObject({
          opportunityState: publicationState,
          canSubmit: false,
        });
      }
      expect(
        await new EmployeeTasksService(database, scenario.clock).today(
          taskIdentity(scenario.employee),
        ),
      ).toMatchObject({
        opportunityState: "NO_TASK",
        task: null,
        canSubmit: false,
      });
      expect(await database.taskSubmission.count()).toBe(0);
    });
  });

  it("preserves own captured history and replacement terms after content edits and task restriction", async () => {
    await withTaskDatabase(async (database) =>
      withTaskFileFixture(async (root) => {
        const scenario = await createTaskScenario(database);
        const first = await createReadyProofFixture(
            database,
            scenario.employee,
          ),
          second = await createReadyProofFixture(database, scenario.employee);
        const reads = await submissionFixtureReads(
          database,
          root,
          scenario.clock,
          [first, second],
        );
        const identity = taskIdentity(scenario.employee);
        await new TaskSubmissionsService(
          database,
          scenario.clock,
          reads,
        ).create(identity, {
          commandId: randomUUID(),
          taskId: scenario.task.id,
          expectedTaskRevision: 1,
          proofAssetId: first.id,
          declaredExecuted: true,
        });
        const claim = await database.taskSubmission.findFirstOrThrow();
        await new TaskPublicationService(database, scenario.clock).edit(
          taskIdentity(scenario.admin),
          scenario.task.id,
          {
            commandId: randomUUID(),
            confirmed: true,
            expectedTaskRevision: 1,
            title: "New instructions",
            isCodeRequired: true,
            publicationState: "PAUSED",
          },
        );
        const replacement = {
          commandId: randomUUID(),
          expectedSubmissionVersion: 1,
          proofAssetId: second.id,
        };
        const service = new SubmissionEvidenceService(
          database,
          scenario.clock,
          reads,
        );
        const receipt = await service.replace(identity, claim.id, replacement);
        expect(receipt.state).toBe("OBSERVED");
        expect(await service.replace(identity, claim.id, replacement)).toEqual(
          receipt,
        );
        const after = await database.taskSubmission.findUniqueOrThrow({
          where: { id: claim.id },
        });
        expect(after).toEqual({
          ...claim,
          version: 2,
          currentEvidenceVersion: 2,
        });
        const queries = new TaskSubmissionsQueries(
          database,
          scenario.clock,
          reads,
        );
        const evidence = evidencePageSchema.parse(
          await queries.evidence(identity, claim.id, { page: 1, limit: 1 }),
        );
        expect(evidence.pagination.total).toBe(2);
        expect(evidence.items[0]?.assetId).toBe(second.id);
        const adminPage = adminSubmissionPageSchema.parse(
          await queries.adminList(taskIdentity(scenario.admin), {
            status: "PENDING",
            employeeId: identity.userId,
            limit: 1,
          }),
        );
        expect(adminPage.statusCounts).toEqual({
          all: 1,
          pending: 1,
          approved: 0,
          rejected: 0,
        });
        const detail = await queries.detail(identity, claim.id);
        expect(detail).toMatchObject({
          taskTitle: scenario.task.title,
          reward: "2",
          snapshot: { declaredExecuted: true, capturedTaskRevision: 1 },
          evidence: { version: 2, asset: { availability: "PRESENT" } },
        });
        expect(detail).not.toHaveProperty("employee");
        expect(detail).not.toHaveProperty("review");
        const foreign = await createIdentityFixture(database, {
          now: scenario.clock(),
        });
        await expect(
          queries.detail(taskIdentity(foreign), claim.id),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(
          queries.evidence(taskIdentity(foreign), claim.id, {}),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await database.user.update({
          where: { id: identity.userId },
          data: { tasksBlocked: true },
        });
        expect(await queries.detail(identity, claim.id)).toMatchObject({
          canReplace: false,
          reward: "2",
        });
        expect(
          await new EmployeeTasksService(database, scenario.clock, reads).today(
            identity,
          ),
        ).toMatchObject({
          workEligibility: "TASK_RESTRICTED",
          submission: { reward: "2" },
          canReplace: false,
        });
        await expect(
          service.replace(identity, claim.id, {
            ...replacement,
            commandId: randomUUID(),
            expectedSubmissionVersion: 2,
          }),
        ).rejects.toMatchObject({ code: "TASK_WORK_UNAVAILABLE" });
        expect(await database.submissionEvidence.count()).toBe(2);
        const app = taskHttpApp(database, scenario.clock),
          token = taskHttpToken(scenario.employee);
        const history = await request(app)
          .get("/api/v1/task-submissions?status=PENDING&limit=1")
          .set("Authorization", `Bearer ${token}`);
        expect(history.status).toBe(200);
        expect(
          submissionPageSchema.parse(taskHttpEnvelope(history).data).pagination
            .total,
        ).toBe(1);
        expect(history.headers["cache-control"]).toBe("private, no-store");
        const day = await request(app)
          .get("/api/v1/tasks/today")
          .set("Authorization", `Bearer ${token}`);
        expect(
          employeeTaskDaySchema.parse(taskHttpEnvelope(day).data).submission
            ?.id,
        ).toBe(claim.id);
        expect(
          (
            await request(app)
              .get("/api/v1/tasks/today?reward=200")
              .set("Authorization", `Bearer ${token}`)
          ).status,
        ).toBe(400);
        expect(
          (
            await request(app)
              .post(`/api/v1/tasks/${scenario.task.id}/unlock`)
              .set("Authorization", `Bearer ${token}`)
              .send({
                commandId: randomUUID(),
                expectedTaskRevision: 2,
                code: "ANY",
              })
          ).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .get("/api/v1/task-submissions")
              .set("Authorization", `Bearer ${taskHttpToken(scenario.admin)}`)
          ).status,
        ).toBe(403);
      }),
    );
  });

  it("denies foreign/wrong-purpose/unready proofs, task blocks and stale sessions without accepting work", async () => {
    await withTaskDatabase(async (database) =>
      withTaskFileFixture(async (root) => {
        const scenario = await createTaskScenario(database),
          foreign = await createIdentityFixture(database, {
            now: new Date("2026-10-05T09:00:00Z"),
          });
        const own = await createReadyProofFixture(database, scenario.employee),
          other = await createReadyProofFixture(database, foreign);
        const reads = await submissionFixtureReads(
          database,
          root,
          scenario.clock,
          [own, other],
        );
        const service = new TaskSubmissionsService(
            database,
            scenario.clock,
            reads,
          ),
          identity = taskIdentity(scenario.employee);
        const intent = {
          commandId: randomUUID(),
          taskId: scenario.task.id,
          expectedTaskRevision: 1,
          proofAssetId: own.id,
          declaredExecuted: true,
        };
        await expect(
          service.create(identity, { ...intent, proofAssetId: other.id }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        const staging = await database.imageAsset.create({
          data: {
            ownerUserId: identity.userId,
            purpose: "PROOF",
            uploadCommandId: randomUUID(),
            receivedAt: scenario.clock(),
            uploadedBySessionId: identity.sessionId,
            storageKey: randomUUID(),
            state: "STAGING",
            processingLeaseId: randomUUID(),
            processingLeaseExpiresAt: new Date("2026-10-05T09:02:00Z"),
          },
        });
        await expect(
          service.create(identity, { ...intent, proofAssetId: staging.id }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await database.user.update({
          where: { id: identity.userId },
          data: { tasksBlocked: true },
        });
        await expect(service.create(identity, intent)).rejects.toMatchObject({
          code: "TASK_ELIGIBILITY_DENIED",
        });
        await database.user.update({
          where: { id: identity.userId },
          data: { tasksBlocked: false, withdrawalsBlocked: true },
        });
        expect(
          await new EmployeeTasksService(database, scenario.clock).today(
            identity,
          ),
        ).toMatchObject({ canSubmit: true, workEligibility: "ELIGIBLE" });
        await database.authSession.update({
          where: { id: identity.sessionId },
          data: { revokedAt: scenario.clock() },
        });
        await expect(service.create(identity, intent)).rejects.toMatchObject({
          statusCode: 401,
        });
        expect(await database.taskSubmission.count()).toBe(0);
        expect(await database.taskUnlock.count()).toBe(0);
      }),
    );
  });

  it("reports Free/expired entitlement and rejects invalid authority while unused cancellation fences delayed delivery", async () => {
    await withTaskDatabase(async (database) => {
      const scenario = await createTaskScenario(database),
        free = await createIdentityFixture(database, { now: scenario.clock() });
      const days = new EmployeeTasksService(database, scenario.clock);
      expect(await days.today(taskIdentity(free))).toMatchObject({
        workEligibility: "FREE",
        currentEntitlement: { effective: false, dailyReward: null },
        canSubmit: false,
      });
      await database.authSession.update({
        where: { id: scenario.employee.session.id },
        data: {
          expiresAt: new Date(
            scenario.subscription.expiresAt.getTime() + 86_400_000,
          ),
        },
      });
      expect(
        await new EmployeeTasksService(
          database,
          () => scenario.subscription.expiresAt,
        ).today(taskIdentity(scenario.employee)),
      ).toMatchObject({
        workEligibility: "EXPIRED",
        currentEntitlement: { effective: false },
      });
      const unverified = await createIdentityFixture(database, {
        now: scenario.clock(),
        status: "PENDING_VERIFICATION",
      });
      await expect(days.today(taskIdentity(unverified))).rejects.toMatchObject({
        statusCode: 401,
      });
      await database.user.update({
        where: { id: scenario.employee.user.id },
        data: { status: "BANNED" },
      });
      await expect(
        days.today(taskIdentity(scenario.employee)),
      ).rejects.toMatchObject({ statusCode: 401 });
      const commandId = randomUUID(),
        commands = new TaskCommandService(database, scenario.clock);
      expect(
        await commands.cancel(
          { kind: "SUBMISSION_CREATE", commandId, confirmed: true },
          taskIdentity(free),
        ),
      ).toMatchObject({ state: "CANCELLED" });
      await expect(
        new TaskSubmissionsService(database, scenario.clock).create(
          taskIdentity(free),
          {
            commandId,
            taskId: scenario.task.id,
            expectedTaskRevision: 1,
            proofAssetId: randomUUID(),
            declaredExecuted: true,
          },
        ),
      ).rejects.toMatchObject({ code: "COMMAND_CANCELLED" });
      expect(await database.taskSubmission.count()).toBe(0);
      await expect(
        new TaskUnlockService(database, scenario.clock).unlock(
          taskIdentity(free),
          scenario.task.id,
          { commandId: randomUUID(), expectedTaskRevision: 1, code: "INVALID" },
        ),
      ).rejects.toMatchObject({ code: "TASK_ELIGIBILITY_DENIED" });
    });
  });
  it("captures declared S1 work once without posting pending money", async () => {
    await withTaskDatabase(async (database) =>
      withTaskFileFixture(async (root) => {
        const scenario = await createTaskScenario(database);
        const asset = await createReadyProofFixture(
          database,
          scenario.employee,
        );
        const identity = taskIdentity(scenario.employee);
        const service = new TaskSubmissionsService(
          database,
          scenario.clock,
          await submissionFixtureReads(database, root, scenario.clock, [asset]),
        );
        const intent = {
          commandId: randomUUID(),
          taskId: scenario.task.id,
          expectedTaskRevision: 1,
          proofAssetId: asset.id,
          declaredExecuted: true,
        };
        const wallet = await database.wallet.findFirstOrThrow({
          where: { ownerUserId: identity.userId },
        });
        const operations = await database.financialOperation.count();
        const accepted = await service.create(identity, intent);
        expect(accepted.replayed).toBe(false);
        expect(await service.create(identity, intent)).toMatchObject({
          replayed: true,
          observation: accepted.observation,
        });
        const claim = await database.taskSubmission.findFirstOrThrow();
        expect(claim).toMatchObject({
          status: "PENDING",
          rewardUnits: 2_000_000n,
          executionDeclared: true,
          subscriptionId: scenario.subscription.id,
          deadlineAt: new Date("2026-10-05T15:00:00Z"),
        });
        expect(await database.submissionEvidence.count()).toBe(1);
        expect(await database.financialOperation.count()).toBe(operations);
        expect(
          await database.wallet.findUniqueOrThrow({ where: { id: wallet.id } }),
        ).toEqual(wallet);
        await expect(
          service.create(identity, { ...intent, commandId: randomUUID() }),
        ).rejects.toMatchObject({ code: "DAILY_CLAIM_EXISTS" });
        const day = await new EmployeeTasksService(
          database,
          scenario.clock,
        ).today(identity);
        expect(day).toMatchObject({
          canSubmit: false,
          canReplace: true,
          submission: { reward: "2", status: "PENDING" },
        });
      }),
    );
  });

  it("rejects stale work and invalid declaration without consuming a claim", async () => {
    await withTaskDatabase(async (database) =>
      withTaskFileFixture(async (root) => {
        const scenario = await createTaskScenario(database);
        const asset = await createReadyProofFixture(
          database,
          scenario.employee,
        );
        const service = new TaskSubmissionsService(
          database,
          scenario.clock,
          await submissionFixtureReads(database, root, scenario.clock, [asset]),
        );
        const intent = {
          commandId: randomUUID(),
          taskId: scenario.task.id,
          expectedTaskRevision: 2,
          proofAssetId: asset.id,
          declaredExecuted: true,
        };
        await expect(
          service.create(taskIdentity(scenario.employee), intent),
        ).rejects.toMatchObject({ code: "TASK_REVISION_CONFLICT" });
        await expect(
          service.create(taskIdentity(scenario.employee), {
            ...intent,
            expectedTaskRevision: 1,
            declaredExecuted: false,
          }),
        ).rejects.toThrow();
        expect(await database.taskSubmission.count()).toBe(0);
        expect(await database.taskCommandRecord.count()).toBe(0);
      }),
    );
  });
});
