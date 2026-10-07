import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import {
  withAdmittedIndependentFinancialClients,
  financialRaceBarrier,
} from "../ledger/testing/financial-fixtures.js";
import {
  bindDepositAssignment,
  depositRecipient,
  rawDeposit,
  withDepositProvider,
} from "../deposits/testing/deposit-fixtures.js";
import { DepositVerifier } from "../deposits/deposit-verifier.js";
import { DepositCreditService } from "../deposits/deposit-credit.service.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  adminSubmissionDetailSchema,
  adminSubmissionPageSchema,
  commandObservationSchema,
  evidencePageSchema,
} from "@template/contracts";
import { Prisma } from "@template/database";
import { csrfConfig } from "../../core/config/csrf.config.js";
import {
  taskHttpApp,
  taskHttpToken,
  taskHttpEnvelope,
} from "../tasks/testing/task-http-fixtures.js";
import {
  acceptedReviewFixture,
  reviewState,
} from "./testing/review-fixtures.js";
import { TaskCommandService } from "../tasks/task-command.service.js";
import { SubmissionEvidenceService } from "./submission-evidence.service.js";
import { runLinuxProofProgram } from "../proofs/testing/linux-proof-runtime.js";
import {
  createTaskScenario,
  createReadyProofFixture,
  taskIdentity,
  withTaskDatabase,
  withTaskFileFixture,
} from "../tasks/testing/task-fixtures.js";
import { TaskSubmissionsService } from "./task-submissions.service.js";
import { submissionFixtureReads } from "./testing/submission-fixtures.js";
import { TaskReviewService } from "./task-review.service.js";

describe("US2 captured final review", () => {
  it("conserves an independently committed verified deposit and the captured reward exactly once", async () => {
    await withTaskDatabase(async (database, url) =>
      withTaskFileFixture(async (root) => {
        const fixture = await acceptedReviewFixture(database, root);
        if (fixture.employee.wallet === null) throw new Error("Missing wallet");
        const walletId = fixture.employee.wallet.id;
        const before = await database.wallet.findUniqueOrThrow({
          where: { id: walletId },
        });
        await withAdmittedIndependentFinancialClients(
          url,
          async (depositor, reviewer) => {
            await bindDepositAssignment(
              database,
              {
                ownerUserId: fixture.employee.user.id,
                wallet: { id: walletId },
              },
              depositRecipient,
              fixture.clock(),
            );
            const raw = rawDeposit();
            raw.block.block_header.raw_data.timestamp =
              fixture.clock().getTime() - 1000;
            raw.info.blockTimeStamp = raw.block.block_header.raw_data.timestamp;
            raw.solidified.block_header.raw_data.timestamp =
              raw.info.blockTimeStamp;
            await withDepositProvider(raw, async (provider, config) => {
              const start = financialRaceBarrier(2);
              const deposit = async () => {
                await start();
                return new DepositCreditService(
                  depositor,
                  new DepositVerifier(
                    depositor,
                    provider,
                    config,
                    fixture.clock,
                  ),
                  financialFixtureAdmission(depositor),
                  fixture.clock,
                ).process(raw.transactionId);
              };
              const review = async () => {
                await start();
                return new TaskReviewService(
                  reviewer,
                  fixture.clock,
                  fixture.reads,
                  financialFixtureAdmission(reviewer),
                ).review(
                  taskIdentity(fixture.admin),
                  fixture.submission.id,
                  fixture.intent,
                );
              };
              const [credited] = await Promise.all([deposit(), review()]);
              expect(credited.state).toBe("ACCOUNTED");
            });
          },
        );
        expect(
          await database.wallet.findUniqueOrThrow({ where: { id: walletId } }),
        ).toMatchObject({
          availableNonReferralUnits:
            before.availableNonReferralUnits +
            1000001n +
            fixture.submission.rewardUnits,
          availableReferralUnits: before.availableReferralUnits,
          reservedReferralUnits: before.reservedReferralUnits,
          reservedNonReferralUnits: before.reservedNonReferralUnits,
        });
        expect(await database.depositReceipt.count()).toBe(1);
        expect(
          await database.financialOperation.count({
            where: { businessNamespace: "p05.task-reward" },
          }),
        ).toBe(1);
        expect(await database.finalReview.count()).toBe(1);
      }),
    );
  });
  it("reviews actual canonical private proof through the emitted authenticated API and refreshes saved availability", async () => {
    await withTaskDatabase(async (database, url) => {
      const scenario = await createTaskScenario(database);
      const output = await runLinuxProofProgram(
        String.raw`
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,unlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
Object.assign(process.env,JSON.parse(await readFile('/fixture/environment.json','utf8')));
const fixture=JSON.parse(await readFile('/fixture/fixtures.json','utf8'));
const {createDatabaseClient}=await import('@template/database');const {createApp}=await import('./api/app.js');
const {FinancialRuntimeAdmission,acknowledgeFinancialBoot}=await import('./api/modules/custody/runtime-control.js');
const {ProofsRuntime}=await import('./api/modules/proofs/proofs.runtime.js');const {generateTokenPair}=await import('./api/infrastructure/security/jwt.service.js');
const {default:pino}=await import('pino');const {default:sharp}=await import('sharp');
const {adminSubmissionDetailSchema,commandObservationSchema}=await import('@template/contracts');
const database=createDatabaseClient(process.env.DATABASE_URL),root=await mkdtemp(join(tmpdir(),'p05-review-'));
const clock=()=>new Date(fixture.now);
const runtime=new ProofsRuntime(database,{storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000},clock,()=>{});
let server;
try {
 // Explicit protected admission of this fresh disposable process, never a reused parent UUID.
 assert.equal(await database.depositAddressAssignment.count(),0);assert.equal(await database.transferAttempt.count(),0);
 const financialAdmission=new FinancialRuntimeAdmission(database,'API');await financialAdmission.register();
 const cutoff=new Date(),reference='disposable-linux-review:'+financialAdmission.bootId;
 await acknowledgeFinancialBoot(database,{bootId:financialAdmission.bootId,operatorIdentity:'disposable-linux-fixture',reason:'Known disposable fixture history',evidence:{financialHistoryReference:reference,assignmentInventoryReference:reference,attemptInventoryReference:reference,reconciliationReference:reference,reconciliationCutoff:cutoff,financialHistoryRecoveredThrough:cutoff}});
 await runtime.start();server=createApp({database,logger:pino({level:'silent'}),proofs:runtime,financialClock:clock,financialAdmission}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port+'/api/v1';
 server.prependListener('request',(request,response)=>{if(request.headers['x-fixture-drop']==='review'){response.end=()=>{response.destroy();return response;};}});
 function token(identity,role){return generateTokenPair({...identity,role,tokenId:randomUUID(),email:'test@example.com',rememberMe:false,absoluteExpiresAt:new Date(Date.now()+86400000)}).accessToken;}
 const admin=token(fixture.admin,'ADMIN'),employee=token(fixture.employee,'USER');
 async function call(path,{method='GET',body,bearer=admin,drop=false}={}) {
  const headers={Authorization:'Bearer '+bearer};
  if(drop)headers['x-fixture-drop']='review';
  if(method!=='GET'){headers.Cookie='csrfToken=actual-review';headers['x-csrf-token']='actual-review';}
  if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
  const response=await fetch(base+path,{method,headers,body});return {status:response.status,json:await response.json()};
 }
 const png=await sharp({create:{width:3,height:2,channels:4,background:'#ee9988'}}).png().toBuffer();
 const upload=new FormData();upload.set('commandId',randomUUID());upload.set('file',new Blob([png],{type:'image/png'}),'synthetic.png');
 const file=await call('/proofs',{method:'POST',body:upload,bearer:employee});assert.equal(file.status,201);
 const claim=await call('/task-submissions',{method:'POST',bearer:employee,body:{commandId:randomUUID(),taskId:fixture.taskId,expectedTaskRevision:1,proofAssetId:file.json.data.id,declaredExecuted:true}});assert.equal(claim.status,201);
 const before=await database.wallet.findUniqueOrThrow({where:{ownerUserId:fixture.employee.userId}});
 const detail=adminSubmissionDetailSchema.parse((await call('/admin/task-submissions/'+claim.json.data.id)).json.data);assert.equal(detail.submission.evidence.asset.availability,'PRESENT');
 const content=await fetch(base+'/proofs/'+file.json.data.id+'/content',{headers:{Authorization:'Bearer '+admin}});assert.equal(content.status,200);assert.equal(content.headers.get('content-type'),'image/png');assert.equal(content.headers.get('cache-control'),'private, no-store');
 const bytes=Buffer.from(await content.arrayBuffer());assert.equal((await sharp(bytes).metadata()).width,3);
 const intent={commandId:randomUUID(),confirmed:true,expectedSubmissionVersion:detail.submission.version,expectedEvidenceVersion:detail.submission.currentEvidenceVersion,decision:'APPROVE',reason:'Inspected current canonical proof and declaration'};
 const endpoint='/admin/task-submissions/'+detail.submission.id+'/review';
 await assert.rejects(call(endpoint,{method:'POST',body:intent,drop:true}));
 const recovered=commandObservationSchema.parse((await call('/task-commands/'+intent.commandId+'?kind=FINAL_REVIEW')).json.data);assert.equal(recovered.state,'OBSERVED');
 const approved=adminSubmissionDetailSchema.parse(recovered.command.outcome);assert.equal(approved.submission.reward,'2');assert.equal(approved.submission.evidence.asset.availability,'PRESENT');assert.equal(approved.submission.status,'APPROVED');
 const operation=await database.financialOperation.findFirstOrThrow({where:{businessNamespace:'p05.task-reward'}});assert.equal(operation.magnitudeUnits,2000000n);
 const after=await database.wallet.findUniqueOrThrow({where:{id:before.id}});assert.deepEqual(after,{...before,updatedAt:after.updatedAt,availableNonReferralUnits:before.availableNonReferralUnits+2000000n});
 const asset=await database.imageAsset.findUniqueOrThrow({where:{id:file.json.data.id}});await unlink(join(root,'assets',asset.storageKey,'content.png'));
 const observed=commandObservationSchema.parse((await call('/task-commands/'+intent.commandId+'?kind=FINAL_REVIEW')).json.data);assert.equal(observed.command.outcome.submission.evidence.asset.availability,'STORAGE_UNAVAILABLE');
 const replay=adminSubmissionDetailSchema.parse((await call(endpoint,{method:'POST',body:intent})).json.data);assert.equal(replay.submission.evidence.asset.availability,'STORAGE_UNAVAILABLE');assert.equal(replay.submission.reward,'2');
 assert.equal((await call(endpoint,{method:'POST',body:{...intent,commandId:randomUUID(),decision:'REJECT'}})).json.code,'SUBMISSION_FINAL');
 assert.equal(await database.financialOperation.count({where:{businessNamespace:'p05.task-reward'}}),1);
 console.log(JSON.stringify({actualPrivateReview:true,capturedRewardOnce:true,truthfulReplayAvailability:true}));
} finally {if(server){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}await runtime.stop();await database.$disconnect();await rm(root,{recursive:true,force:true});}
`,
        url,
        {
          now: scenario.clock().toISOString(),
          taskId: scenario.task.id,
          admin: taskIdentity(scenario.admin),
          employee: taskIdentity(scenario.employee),
        },
      );
      expect(output).toContain('"actualPrivateReview":true');
      expect(output).toContain('"capturedRewardOnce":true');
      expect(output).toContain('"truthfulReplayAvailability":true');
    });
  });
  it.each(["APPROVE", "REJECT"] as const)(
    "denies new work or evidence edits after %s while retaining the daily claim",
    async (decision) => {
      await withTaskDatabase(async (database) =>
        withTaskFileFixture(async (root) => {
          const fixture = await acceptedReviewFixture(database, root);
          await new TaskReviewService(
            database,
            fixture.clock,
            undefined,
            financialFixtureAdmission(database),
          ).review(taskIdentity(fixture.admin), fixture.submission.id, {
            ...fixture.intent,
            decision,
          });
          const before = await reviewState(database);
          await expect(
            new SubmissionEvidenceService(
              database,
              fixture.clock,
              fixture.reads,
            ).replace(taskIdentity(fixture.employee), fixture.submission.id, {
              commandId: randomUUID(),
              expectedSubmissionVersion: 2,
              proofAssetId: fixture.replacement.id,
            }),
          ).rejects.toMatchObject({ code: "EVIDENCE_CONFLICT" });
          await expect(
            new TaskSubmissionsService(
              database,
              fixture.clock,
              fixture.reads,
            ).create(taskIdentity(fixture.employee), {
              commandId: randomUUID(),
              taskId: fixture.task.id,
              expectedTaskRevision: 1,
              proofAssetId: fixture.replacement.id,
              declaredExecuted: true,
            }),
          ).rejects.toMatchObject({ code: "DAILY_CLAIM_EXISTS" });
          expect(await reviewState(database)).toEqual(before);
        }),
      );
    },
  );
  it.each(["APPROVE", "REJECT"] as const)(
    "makes %s final, binds both versions and preserves the captured entitlement after ban",
    async (decision) => {
      await withTaskDatabase(async (database) =>
        withTaskFileFixture(async (root) => {
          const scenario = await createTaskScenario(database);
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
          await new TaskSubmissionsService(
            database,
            scenario.clock,
            reads,
          ).create(taskIdentity(scenario.employee), {
            commandId: randomUUID(),
            taskId: scenario.task.id,
            expectedTaskRevision: 1,
            proofAssetId: asset.id,
            declaredExecuted: true,
          });
          const claim = await database.taskSubmission.findFirstOrThrow();
          const wallet = await database.wallet.findUniqueOrThrow({
            where: { ownerUserId: scenario.employee.user.id },
          });
          await database.user.update({
            where: { id: scenario.employee.user.id },
            data: { status: "BANNED" },
          });
          const service = new TaskReviewService(
            database,
            scenario.clock,
            undefined,
            financialFixtureAdmission(database),
          );
          const identity = taskIdentity(scenario.admin);
          const intent = {
            commandId: randomUUID(),
            confirmed: true,
            expectedSubmissionVersion: 1,
            expectedEvidenceVersion: 1,
            decision,
            reason: "Inspected execution and current proof",
          };
          for (const invalid of [
            { ...intent, reason: " " },
            { ...intent, confirmed: false },
            { ...intent, expectedSubmissionVersion: 2 },
            { ...intent, expectedEvidenceVersion: 2 },
          ])
            await expect(
              service.review(identity, claim.id, invalid),
            ).rejects.toThrow();
          expect(await database.finalReview.count()).toBe(0);
          const accepted = await service.review(identity, claim.id, intent);
          expect(accepted).toMatchObject({
            state: "OBSERVED",
            command: {
              outcome: {
                submission: {
                  status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
                  reward: "2",
                  canReplace: false,
                },
                review: { reason: intent.reason },
              },
            },
          });
          expect(await service.review(identity, claim.id, intent)).toEqual(
            accepted,
          );
          await expect(
            service.review(identity, claim.id, {
              ...intent,
              reason: "Changed reason",
            }),
          ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
          await expect(
            service.review(identity, claim.id, {
              ...intent,
              commandId: randomUUID(),
              decision: decision === "APPROVE" ? "REJECT" : "APPROVE",
            }),
          ).rejects.toMatchObject({ code: "SUBMISSION_FINAL" });
          const after = await database.wallet.findUniqueOrThrow({
            where: { id: wallet.id },
          });
          expect(after).toEqual({
            ...wallet,
            updatedAt: after.updatedAt,
            availableNonReferralUnits:
              wallet.availableNonReferralUnits +
              (decision === "APPROVE" ? 2_000_000n : 0n),
          });
          if (decision === "REJECT") expect(after).toEqual(wallet);
          expect(await database.finalReview.count()).toBe(1);
          expect(
            await database.financialOperation.count({
              where: { businessNamespace: "p05.task-reward" },
            }),
          ).toBe(decision === "APPROVE" ? 1 : 0);
        }),
      );
    },
  );

  it("rolls back a real failure after the credit and final review writes, then safely retries the original key", async () => {
    await withTaskDatabase(async (database) =>
      withTaskFileFixture(async (root) => {
        const fixture = await acceptedReviewFixture(database, root);
        const before = await reviewState(database);
        await database.$executeRawUnsafe(
          `CREATE FUNCTION fail_review_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='FINAL_REVIEW' THEN RAISE EXCEPTION 'controlled receipt failure'; END IF; RETURN NEW; END $$`,
        );
        await database.$executeRawUnsafe(
          `CREATE TRIGGER fail_review_receipt BEFORE INSERT ON task_command_records FOR EACH ROW EXECUTE FUNCTION fail_review_receipt()`,
        );
        const service = new TaskReviewService(
          database,
          fixture.clock,
          undefined,
          financialFixtureAdmission(database),
        );
        try {
          await expect(
            service.review(
              taskIdentity(fixture.admin),
              fixture.submission.id,
              fixture.intent,
            ),
          ).rejects.toMatchObject({ code: "LEDGER_INTERNAL" });
          expect(await reviewState(database)).toEqual(before);
        } finally {
          await database.$executeRawUnsafe(
            `DROP TRIGGER fail_review_receipt ON task_command_records`,
          );
          await database.$executeRawUnsafe(
            `DROP FUNCTION fail_review_receipt()`,
          );
        }
        await service.review(
          taskIdentity(fixture.admin),
          fixture.submission.id,
          fixture.intent,
        );
        expect(await database.finalReview.count()).toBe(1);
      }),
    );
  });

  it("enforces authenticated review HTTP, original-key observation and immutable final actions", async () => {
    await withTaskDatabase(async (database) =>
      withTaskFileFixture(async (root) => {
        const fixture = await acceptedReviewFixture(database, root);
        const app = taskHttpApp(database, fixture.clock);
        const endpoint = `/api/v1/admin/task-submissions/${fixture.submission.id}/review`;
        const token = taskHttpToken(fixture.admin);
        const send = (body: object) =>
          request(app)
            .post(endpoint)
            .set("Authorization", `Bearer ${token}`)
            .set("Cookie", `${csrfConfig.cookieName}=review-csrf`)
            .set(csrfConfig.headerName, "review-csrf")
            .send(body);
        expect(
          (await request(app).post(endpoint).send(fixture.intent)).status,
        ).toBe(401);
        expect(
          (
            await request(app)
              .post(endpoint)
              .set("Authorization", `Bearer ${taskHttpToken(fixture.employee)}`)
              .send(fixture.intent)
          ).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .post(endpoint)
              .set("Authorization", `Bearer ${token}`)
              .send(fixture.intent)
          ).status,
        ).toBe(403);
        for (const body of [
          { ...fixture.intent, confirmed: false },
          { ...fixture.intent, reason: "" },
          { ...fixture.intent, reward: "200" },
          { ...fixture.intent, actorUserId: fixture.admin.user.id },
        ]) {
          expect((await send(body)).status).toBe(400);
        }
        expect(await database.finalReview.count()).toBe(0);
        const response = await send(fixture.intent);
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("private, no-store");
        const final = adminSubmissionDetailSchema.parse(
          taskHttpEnvelope(response).data,
        );
        expect(final.submission).toMatchObject({
          status: "APPROVED",
          reward: "2",
          canReplace: false,
        });
        expect(
          adminSubmissionDetailSchema.parse(
            taskHttpEnvelope(await send(fixture.intent)).data,
          ),
        ).toEqual(final);
        for (const body of [
          { ...fixture.intent, reason: "Different reason" },
          { ...fixture.intent, decision: "REJECT" },
          { ...fixture.intent, expectedEvidenceVersion: 2 },
        ])
          expect((await send(body)).status).toBe(409);
        expect(
          (await send({ ...fixture.intent, commandId: randomUUID() })).status,
        ).toBe(409);
        const observation = await request(app)
          .get(
            `/api/v1/task-commands/${fixture.intent.commandId}?kind=FINAL_REVIEW`,
          )
          .set("Authorization", `Bearer ${token}`);
        expect(
          commandObservationSchema.parse(taskHttpEnvelope(observation).data),
        ).toMatchObject({ state: "OBSERVED", command: { outcome: final } });
        const list = await request(app)
          .get("/api/v1/admin/task-submissions?status=APPROVED&limit=1")
          .set("Authorization", `Bearer ${token}`);
        expect(
          adminSubmissionPageSchema.parse(taskHttpEnvelope(list).data)
            .statusCounts,
        ).toEqual({ all: 1, pending: 0, approved: 1, rejected: 0 });
        const detail = await request(app)
          .get(`/api/v1/admin/task-submissions/${fixture.submission.id}`)
          .set("Authorization", `Bearer ${token}`);
        expect(
          adminSubmissionDetailSchema.parse(taskHttpEnvelope(detail).data),
        ).toEqual(final);
        const evidence = await request(app)
          .get(
            `/api/v1/admin/task-submissions/${fixture.submission.id}/evidence?limit=1`,
          )
          .set("Authorization", `Bearer ${token}`);
        expect(
          evidencePageSchema.parse(taskHttpEnvelope(evidence).data).pagination
            .total,
        ).toBe(1);
        for (const method of ["delete", "patch"] as const)
          expect(
            (
              await request(app)
                [method](
                  `/api/v1/admin/task-submissions/${fixture.submission.id}`,
                )
                .set("Authorization", `Bearer ${token}`)
                .send({ status: "PENDING" })
            ).status,
          ).toBe(404);
        await database.authSession.update({
          where: { id: fixture.admin.session.id },
          data: { revokedAt: fixture.clock() },
        });
        expect((await send(fixture.intent)).status).toBe(401);
        expect(
          await database.financialOperation.count({
            where: { businessNamespace: "p05.task-reward" },
          }),
        ).toBe(1);
      }),
    );
  });

  it("fences cancelled review keys and retains a committed credit on later cancellation", async () => {
    await withTaskDatabase(async (database) =>
      withTaskFileFixture(async (root) => {
        const fixture = await acceptedReviewFixture(database, root);
        const identity = taskIdentity(fixture.admin),
          commands = new TaskCommandService(database, fixture.clock);
        const lookup = {
          kind: "FINAL_REVIEW" as const,
          commandId: fixture.intent.commandId,
        };
        expect(await commands.observe(lookup, identity)).toMatchObject({
          state: "NOT_OBSERVED",
        });
        expect(
          await commands.cancel({ ...lookup, confirmed: true }, identity),
        ).toMatchObject({ state: "CANCELLED" });
        const before = await reviewState(database);
        const service = new TaskReviewService(
          database,
          fixture.clock,
          undefined,
          financialFixtureAdmission(database),
        );
        await expect(
          service.review(identity, fixture.submission.id, fixture.intent),
        ).rejects.toMatchObject({ code: "COMMAND_CANCELLED" });
        expect(await reviewState(database)).toEqual(before);
        const next = { ...fixture.intent, commandId: randomUUID() };
        const accepted = await service.review(
          identity,
          fixture.submission.id,
          next,
        );
        expect(
          await commands.cancel(
            { ...lookup, commandId: next.commandId, confirmed: true },
            identity,
          ),
        ).toEqual(accepted);
        expect(
          await database.financialOperation.count({
            where: { businessNamespace: "p05.task-reward" },
          }),
        ).toBe(1);
        await expect(
          database.$transaction(
            async (transaction) => {
              await transaction.finalReview.updateMany({
                data: { reason: "Rewritten" },
              });
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          ),
        ).rejects.toThrow();
      }),
    );
  });
});
