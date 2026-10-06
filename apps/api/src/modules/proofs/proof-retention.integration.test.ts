import { expect, it } from "vitest";
import {
  createTaskScenario,
  createPendingTaskFixture,
  taskIdentity,
  withTaskDatabase,
} from "../tasks/testing/task-fixtures.js";
import { runLinuxProofProgram } from "./testing/linux-proof-runtime.js";

it("preserves every pending evidence version and snapshots through replacement, then retries leased deletion at exact age", async () => {
  await withTaskDatabase(async (database, url) => {
    const scenario = await createTaskScenario(database);
    const pending = await createPendingTaskFixture(database, scenario);
    const output = await runLinuxProofProgram(
      String.raw`
import assert from 'node:assert/strict';import {readFile,mkdtemp,readdir,rm,unlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Readable} from 'node:stream';import {randomUUID} from 'node:crypto';
Object.assign(process.env,JSON.parse(await readFile('/fixture/environment.json','utf8')));const fixture=JSON.parse(await readFile('/fixture/fixtures.json','utf8'));
const {createDatabaseClient}=await import('@template/database');const {ProofsRuntime}=await import('./api/modules/proofs/proofs.runtime.js');const {SubmissionEvidenceService}=await import('./api/modules/task-submissions/submission-evidence.service.js');const {default:sharp}=await import('sharp');
const database=createDatabaseClient(process.env.DATABASE_URL),other=createDatabaseClient(process.env.DATABASE_URL);let now=new Date(fixture.now);const root=await mkdtemp(join(tmpdir(),'p05-retention-'));const failures=[];
const runtime=new ProofsRuntime(database,{storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000},()=>now,code=>failures.push(code));await runtime.start();
const replacements=new SubmissionEvidenceService(database,()=>now,runtime.reads);
const png=await sharp({create:{width:4,height:3,channels:4,background:'#345678'}}).png().toBuffer();
function input(format='png'){return Readable.from([Buffer.concat([Buffer.from('--retention\r\nContent-Disposition: form-data; name="commandId"\r\n\r\n'+randomUUID()+'\r\n--retention\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n'),png,Buffer.from('\r\n--retention--\r\n')])]);}
async function upload(purpose='PROOF'){return runtime.uploads.upload(purpose==='PROOF'?fixture.employee:fixture.admin,purpose,{source:input(),headers:{'content-type':'multipart/form-data; boundary=retention'},signal:new AbortController().signal});}
async function asset(id){return database.imageAsset.findUniqueOrThrow({where:{id}});}
async function drain(){for(let index=0;index<3;index++)await runtime.lifecycle.scan();}
try {
 const before=await database.taskSubmission.findUniqueOrThrow({where:{id:fixture.submissionId}}),wallet=await database.wallet.findUniqueOrThrow({where:{ownerUserId:fixture.employee.userId}});const operations=await database.financialOperation.count();
 const fresh=await upload(),unattached=await upload(),illustration=await upload('TASK_ILLUSTRATION');
 // Advance the injected clock only after PostgreSQL proves replacement is waiting on the asset lock.
 let locked,release;const lockedBarrier=new Promise(resolve=>locked=resolve),releaseBarrier=new Promise(resolve=>release=resolve);let blockerPid;
 const blocker=other.$transaction(async transaction=>{blockerPid=(await transaction.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid;await transaction.$queryRawUnsafe('SELECT id FROM image_assets WHERE id=$1::uuid FOR UPDATE',unattached.id);locked();await releaseBarrier;},{timeout:15000});await lockedBarrier;
 const lateReplacement=replacements.replace(fixture.employee,before.id,{commandId:randomUUID(),expectedSubmissionVersion:1,proofAssetId:unattached.id}).catch(error=>error);
 let waiting=false;for(let attempt=0;attempt<100;attempt++){const rows=await database.$queryRawUnsafe('SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1::int=ANY(pg_blocking_pids(pid))',blockerPid);if(rows.length){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(waiting,true);
 now=new Date(before.deadlineAt);release();await blocker;assert.equal((await lateReplacement).code,'EVIDENCE_CONFLICT');now=new Date(fixture.now);
 await database.task.update({where:{id:before.taskId},data:{illustrationAssetId:illustration.id,illustrationPurpose:'TASK_ILLUSTRATION',revision:{increment:1},updatedAt:now}});
 const key=randomUUID();const receipt=await replacements.replace(fixture.employee,before.id,{commandId:key,expectedSubmissionVersion:1,proofAssetId:fresh.id});assert.equal(receipt.state,'OBSERVED');assert.equal(receipt.command.outcome.currentEvidenceVersion,2);
 const after=await database.taskSubmission.findUniqueOrThrow({where:{id:before.id}});assert.deepEqual({...after,version:before.version,currentEvidenceVersion:before.currentEvidenceVersion},before);assert.equal(await database.submissionEvidence.count({where:{submissionId:before.id}}),2);
 assert.deepEqual(await replacements.replace(fixture.employee,before.id,{commandId:key,expectedSubmissionVersion:1,proofAssetId:fresh.id}),receipt);
 await assert.rejects(replacements.replace(fixture.employee,before.id,{commandId:randomUUID(),expectedSubmissionVersion:1,proofAssetId:unattached.id}),{code:'EVIDENCE_CONFLICT'});
 now=new Date(before.deadlineAt);await assert.rejects(replacements.replace(fixture.employee,before.id,{commandId:randomUUID(),expectedSubmissionVersion:2,proofAssetId:unattached.id}),{code:'EVIDENCE_CONFLICT'});assert.equal((await database.taskSubmission.findUniqueOrThrow({where:{id:before.id}})).currentEvidenceVersion,2);
 await database.authSession.updateMany({data:{expiresAt:new Date(new Date(fixture.now).getTime()+40*86400000)}});
 now=new Date(new Date(fixture.now).getTime()+30*86400000-1);await drain();assert.equal((await asset(unattached.id)).state,'READY');
 now=new Date(now.getTime()+1);await drain();assert.equal((await asset(unattached.id)).state,'DELETED');assert.equal((await asset(fresh.id)).state,'READY');assert.equal((await asset(fixture.oldAssetId)).state,'READY');assert.equal((await asset(illustration.id)).state,'READY');
 assert.equal((await runtime.reads.metadata(fixture.employee,'PROOF',unattached.id)).availability,'REMOVED');await assert.rejects(runtime.reads.content(fixture.employee,'PROOF',unattached.id),{statusCode:410});
 await unlink(join(root,'assets',fresh.storageKey,'content.png'));assert.equal((await runtime.reads.metadata(fixture.employee,'PROOF',fresh.id)).availability,'STORAGE_UNAVAILABLE');await assert.rejects(runtime.reads.content(fixture.employee,'PROOF',fresh.id),{statusCode:503});
 // Finality releases all historical pending exemptions. No reward is posted for rejection.
 await database.$transaction(async transaction=>{await transaction.taskSubmission.update({where:{id:before.id},data:{status:'REJECTED',version:3}});await transaction.finalReview.create({data:{submissionId:before.id,employeeId:before.employeeId,decision:'REJECTED',submissionVersion:2,evidenceVersion:2,actorUserId:fixture.admin.userId,decidedAt:now,reason:'Synthetic retained evidence review'}});});
 const remove=runtime.storage.removeContent.bind(runtime.storage);runtime.storage.removeContent=async()=>{throw new Error('Synthetic unlink failure');};await drain();assert.equal((await asset(fresh.id)).state,'DELETING');assert.ok(failures.includes('PROOF_UNLINK_FAILED'));const failedLease=(await asset(fresh.id)).deletionLeaseId;
 runtime.storage.removeContent=remove;now=new Date(now.getTime()+120000);await drain();assert.equal((await asset(fresh.id)).state,'DELETED');assert.equal((await asset(fixture.oldAssetId)).state,'DELETED');assert.equal((await asset(illustration.id)).state,'READY');assert.notEqual(failedLease,null);
 now=new Date(fixture.now);await assert.rejects(replacements.replace(fixture.employee,before.id,{commandId:randomUUID(),expectedSubmissionVersion:3,proofAssetId:fresh.id}),{code:'EVIDENCE_CONFLICT'});
 assert.deepEqual(await database.wallet.findUniqueOrThrow({where:{ownerUserId:fixture.employee.userId}}),wallet);assert.equal(await database.financialOperation.count(),operations);
 console.log(JSON.stringify({retention:'passed'}));
} finally {await runtime.stop();await other.$disconnect();await database.$disconnect();await rm(root,{recursive:true,force:true});}
`,
      url,
      {
        employee: taskIdentity(scenario.employee),
        admin: taskIdentity(scenario.admin),
        now: scenario.clock().toISOString(),
        submissionId: pending.submission.id,
        oldAssetId: pending.asset.id,
      },
    );
    expect(JSON.parse(output)).toEqual({ retention: "passed" });
  });
}, 300_000);
