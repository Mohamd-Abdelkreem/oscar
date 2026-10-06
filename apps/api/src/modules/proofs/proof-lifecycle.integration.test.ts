import { expect, it } from "vitest";
import {
  createTaskScenario,
  createPendingTaskFixture,
  taskIdentity,
  withTaskDatabase,
} from "../tasks/testing/task-fixtures.js";
import { runLinuxProofProgram } from "./testing/linux-proof-runtime.js";

it("recovers real files and durable upload fences across intake, child, publication, database and shutdown failures", async () => {
  await withTaskDatabase(async (database, url) => {
    const scenario = await createTaskScenario(database);
    const output = await runLinuxProofProgram(
      String.raw`
import assert from 'node:assert/strict';import {readFile,writeFile,mkdtemp,mkdir,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Readable} from 'node:stream';import {randomUUID} from 'node:crypto';import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
Object.assign(process.env,JSON.parse(await readFile('/fixture/environment.json','utf8')));const fixture=JSON.parse(await readFile('/fixture/fixtures.json','utf8'));
const {createDatabaseClient}=await import('@template/database');const {ProofsRuntime}=await import('./api/modules/proofs/proofs.runtime.js');const {ProofUploadService}=await import('./api/modules/proofs/proof-upload.service.js');const {default:sharp}=await import('sharp');
const database=createDatabaseClient(process.env.DATABASE_URL),other=createDatabaseClient(process.env.DATABASE_URL);let now=new Date(fixture.now);const root=await mkdtemp(join(tmpdir(),'p05-lifecycle-'));const metrics=[];const config={storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000};
let runtime=new ProofsRuntime(database,config,()=>now,()=>{},metric=>metrics.push(metric));await runtime.start();const identity=fixture.employee;
const png=await sharp({create:{width:12,height:5,channels:4,background:'white'}}).png().toBuffer();
function body(key,bytes=png){return Buffer.concat([Buffer.from('--lifecycle\r\nContent-Disposition: form-data; name="commandId"\r\n\r\n'+key+'\r\n--lifecycle\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n'),bytes,Buffer.from('\r\n--lifecycle--\r\n')]);}
function upload(key=randomUUID(),source=Readable.from([body(key)]),signal=new AbortController().signal){return runtime.uploads.upload(identity,'PROOF',{source,headers:{'content-type':'multipart/form-data; boundary=lifecycle'},signal});}
async function empty(){assert.deepEqual(await readdir(join(root,'staging')),[]);const reservation=await runtime.storage.reserve();await runtime.storage.discard(reservation);}
async function observed(key){return runtime.uploads.observe(identity,'PROOF',key);}
const originalFork=childProcess.fork;
try {
 // Only the deliberate intake-stall probe uses a shorter deadline. Real cancellation waits retain the documented budget.
 const shortIntake=new ProofUploadService(database,runtime.storage,()=>now,50);await assert.rejects(shortIntake.upload(identity,'PROOF',{source:new Readable({read(){}}),headers:{'content-type':'multipart/form-data; boundary=lifecycle'},signal:new AbortController().signal}),{code:'UPLOAD_INTERRUPTED'});await shortIntake.stop();await empty();assert.equal(await database.imageAsset.count(),0);
 const disconnected=new AbortController();const interrupted=upload(randomUUID(),new Readable({read(){disconnected.abort();}}),disconnected.signal);await assert.rejects(interrupted);await empty();
 const unused=randomUUID();await runtime.uploads.cancel(identity,'PROOF',unused,{confirmed:true});await assert.rejects(upload(unused),{code:'UPLOAD_CANCELLED'});await empty();assert.equal((await observed(unused)).state,'FAILED');
 // A cancellation before multipart registration fences a later original arrival.
 const late=randomUUID();let intakeEntered;const entered=new Promise(resolve=>intakeEntered=resolve);const lateSource=new Readable({read(){intakeEntered();}});const lateJob=upload(late,lateSource).catch(error=>error);await entered;await runtime.uploads.cancel(identity,'PROOF',late,{confirmed:true});lateSource.push(body(late));lateSource.push(null);assert.equal((await lateJob).code,'UPLOAD_CANCELLED');await empty();
 for(const method of ['receive','writeCanonical','publish']) {
  const original=runtime.storage[method].bind(runtime.storage);const key=randomUUID();runtime.storage[method]=async(...args)=>{await original(...args);throw new Error('Synthetic '+method+' durability failure');};
  await assert.rejects(upload(key));runtime.storage[method]=original;await empty();const failed=await observed(key);if(failed!==null)assert.equal(failed.state,'FAILED');
 }
 // A native crash is actually reaped; it cannot leave a ready asset or slot.
 const stub=join(root,'crashing-decoder.mjs');await writeFile(stub,"process.once('message',()=>process.kill(process.pid,'SIGKILL'));\n");
 childProcess.fork=(entry,args,options)=>originalFork(stub,args,options);syncBuiltinESMExports();const crashed=randomUUID();await assert.rejects(upload(crashed),{code:'IMAGE_PROCESSING_UNAVAILABLE'});childProcess.fork=originalFork;syncBuiltinESMExports();assert.equal((await observed(crashed)).state,'FAILED');assert.equal(metrics.at(-1).partial,true);await empty();
 const stalledChild=join(root,'stalled-decoder.mjs');await writeFile(stalledChild,"process.once('message',()=>{process.send({type:'rss',pid:process.pid,bytes:process.memoryUsage.rss()});setInterval(()=>{},1000);});\n");childProcess.fork=(entry,args,options)=>originalFork(stalledChild,args,options);syncBuiltinESMExports();const deadlineStart=Date.now();await assert.rejects(upload(),{code:'IMAGE_PROCESSING_UNAVAILABLE'});assert.ok(Date.now()-deadlineStart>=9500);assert.ok(Date.now()-deadlineStart<12000);childProcess.fork=originalFork;syncBuiltinESMExports();assert.equal(metrics.at(-1).partial,true);assert.ok(metrics.at(-1).sampledRssBytes>0);await empty();
 // Cancel while a real child is running and prove reap before capacity is reused.
 let enteredChild;const childEntered=new Promise(resolve=>enteredChild=resolve);let gatedChild;
 childProcess.fork=(entry,args,options)=>{const child=originalFork(entry,args,options);gatedChild=child;const send=child.send.bind(child);child.send=(message,...rest)=>{if(message.type==='decode'){enteredChild();return true;}return send(message,...rest);};return child;};syncBuiltinESMExports();const decoding=randomUUID();const decodingJob=upload(decoding).catch(error=>error);await childEntered;const cancelled=await runtime.uploads.cancel(identity,'PROOF',decoding,{confirmed:true});assert.equal(cancelled.state,'FAILED');await decodingJob;assert.notEqual(gatedChild.signalCode,null);childProcess.fork=originalFork;syncBuiltinESMExports();await empty();
 const publish=runtime.storage.publish.bind(runtime.storage);
 const failedCommit=randomUUID();runtime.storage.publish=async(...args)=>{await publish(...args);const transact=database.$transaction.bind(database);database.$transaction=async(...parameters)=>{database.$transaction=transact;throw new Error('Synthetic READY commit failure');};};await assert.rejects(upload(failedCommit));runtime.storage.publish=publish;assert.equal((await observed(failedCommit)).state,'FAILED');await empty();
 const lostCommit=randomUUID();runtime.storage.publish=async(...args)=>{await publish(...args);const transact=database.$transaction.bind(database);database.$transaction=async(...parameters)=>{database.$transaction=transact;await transact(...parameters);throw new Error('Synthetic lost READY commit response');};};const reconciled=await upload(lostCommit);runtime.storage.publish=publish;assert.equal(reconciled.state,'READY');assert.equal((await observed(lostCommit)).id,reconciled.id);await empty();
 const renamed=randomUUID();runtime.storage.publish=async(...args)=>{await publish(...args);await runtime.uploads.cancel(identity,'PROOF',renamed,{confirmed:true});};await assert.rejects(upload(renamed),{code:'UPLOAD_INTERRUPTED'});runtime.storage.publish=publish;assert.equal((await observed(renamed)).state,'FAILED');await empty();
 // A lost READY response remains observable and accepted cancellation cannot unlink it.
 const readyKey=randomUUID();const accepted=await upload(readyKey);assert.equal((await observed(readyKey)).id,accepted.id);assert.equal((await runtime.uploads.cancel(identity,'PROOF',readyKey,{confirmed:true})).state,'READY');const file=await runtime.reads.content(identity,'PROOF',accepted.id);await file.file.close();await empty();
 assert.equal((await upload(readyKey)).id,accepted.id);const changed=await sharp({create:{width:12,height:5,channels:4,background:'blue'}}).png().toBuffer();await assert.rejects(upload(readyKey,Readable.from([body(readyKey,changed)])),{code:'UPLOAD_INTENT_CONFLICT'});assert.equal((await observed(readyKey)).uploadedAt.toISOString(),accepted.uploadedAt.toISOString());await empty();
 const releaseAccepted=runtime.storage.releaseAccepted.bind(runtime.storage);const retainedAfterCleanupFailure=randomUUID();runtime.storage.releaseAccepted=async()=>{throw new Error('Synthetic post-READY cleanup failure');};await assert.rejects(upload(retainedAfterCleanupFailure),{code:'STORAGE_UNAVAILABLE'});assert.equal((await observed(retainedAfterCleanupFailure)).state,'READY');runtime.storage.releaseAccepted=releaseAccepted;await runtime.lifecycle.scan();await empty();assert.deepEqual(runtime.storage.abandonedStorageKeys(),[]);
 const revoked=randomUUID();runtime.storage.publish=async(...args)=>{await publish(...args);await other.authSession.update({where:{id:identity.sessionId},data:{revokedAt:now}});};await assert.rejects(upload(revoked),{statusCode:401});runtime.storage.publish=publish;assert.equal((await database.imageAsset.findFirstOrThrow({where:{uploadCommandId:revoked}})).state,'FAILED');await empty();
 const replacementSession=await database.authSession.create({data:{userId:identity.userId,rememberMe:false,expiresAt:new Date(Date.now()+40*86400000)}});identity.sessionId=replacementSession.id;
 // Startup counts and removes ownerless pre/post-rename bytes while preserving accepted bytes.
 await runtime.stop();const orphan=randomUUID();await mkdir(join(root,'assets',orphan),{mode:448});await writeFile(join(root,'assets',orphan,'content.png'),png,{mode:384});const staging=randomUUID();await mkdir(join(root,'staging',staging),{mode:448});await writeFile(join(root,'staging',staging,'input'),png,{mode:384});
 const stale=await database.imageAsset.create({data:{ownerUserId:identity.userId,purpose:'PROOF',uploadCommandId:randomUUID(),state:'STAGING',receivedAt:now,uploadedBySessionId:identity.sessionId,storageKey:randomUUID(),processingLeaseId:randomUUID(),processingLeaseExpiresAt:new Date(now.getTime()+120000)}});await mkdir(join(root,'staging',stale.storageKey),{mode:448});await writeFile(join(root,'staging',stale.storageKey,'input'),png,{mode:384});
 const boundaries=[];for(const position of ['reserved','output','published','cancelled']){const key=randomUUID();const saved=await database.imageAsset.create({data:{ownerUserId:identity.userId,purpose:'PROOF',uploadCommandId:randomUUID(),state:'STAGING',receivedAt:now,uploadedAt:position==='reserved'?null:now,uploadIntentHash:position==='reserved'?null:'a'.repeat(64),inputByteCount:position==='reserved'?null:png.length,uploadedBySessionId:identity.sessionId,storageKey:key,processingLeaseId:randomUUID(),processingLeaseExpiresAt:new Date(now.getTime()+120000)}});boundaries.push(saved);const folder=position==='published'?'assets':'staging';await mkdir(join(root,folder,key),{mode:448});if(position!=='reserved'){await writeFile(join(root,folder,key,position==='published'?'content.png':'input'),png,{mode:384});if(position==='output')await writeFile(join(root,folder,key,'output.png'),png,{mode:384});}if(position==='cancelled')await database.imageAsset.update({where:{id:saved.id},data:{state:'FAILED',failureCode:'UPLOAD_CANCELLED',failedAt:now,processingLeaseId:null,processingLeaseExpiresAt:null}});}
 now=new Date(now.getTime()+3600000);runtime=new ProofsRuntime(database,config,()=>now,()=>{});await runtime.start();await empty();assert.equal((await database.imageAsset.findUniqueOrThrow({where:{id:stale.id}})).state,'FAILED');assert.ok(!(await readdir(join(root,'assets'))).includes(orphan));assert.ok((await readdir(join(root,'assets'))).includes(accepted.storageKey));
 for(const boundary of boundaries){const recovered=await database.imageAsset.findUniqueOrThrow({where:{id:boundary.id}});assert.equal(recovered.state,'FAILED');assert.equal(recovered.uploadedAt?.toISOString(),boundary.uploadedAt?.toISOString());assert.ok(!(await readdir(join(root,'assets'))).includes(boundary.storageKey));}await assert.rejects(upload(boundaries.at(-1).uploadCommandId),{code:'UPLOAD_CANCELLED'});await empty();
 let shutdownEntered;const shutdownBarrier=new Promise(resolve=>shutdownEntered=resolve);const shutdownJob=upload(randomUUID(),new Readable({read(){shutdownEntered();}})).catch(error=>error);await shutdownBarrier;
 let shutdownChildEntered;const shutdownChildBarrier=new Promise(resolve=>shutdownChildEntered=resolve);let shutdownChild;childProcess.fork=(entry,args,options)=>{const child=originalFork(entry,args,options);shutdownChild=child;const send=child.send.bind(child);child.send=(message,...rest)=>{if(message.type==='decode'){shutdownChildEntered();return true;}return send(message,...rest);};return child;};syncBuiltinESMExports();const shutdownDecode=upload().catch(error=>error);await shutdownChildBarrier;await runtime.stop();await Promise.all([shutdownJob,shutdownDecode]);assert.notEqual(shutdownChild.signalCode,null);childProcess.fork=originalFork;syncBuiltinESMExports();await assert.rejects(upload(),{statusCode:503});await empty();assert.equal(await database.taskSubmission.count(),0);
 console.log(JSON.stringify({lifecycle:'passed',metrics}));
} finally {childProcess.fork=originalFork;syncBuiltinESMExports();await runtime.stop();await other.$disconnect();await database.$disconnect();await rm(root,{recursive:true,force:true});}
`,
      url,
      {
        employee: taskIdentity(scenario.employee),
        now: scenario.clock().toISOString(),
      },
    );
    expect(JSON.parse(output)).toMatchObject({ lifecycle: "passed" });
  });
}, 300_000);

it("finishes bounded startup batches and fails closed on incomplete accounting", async () => {
  await withTaskDatabase(async (database, url) => {
    const scenario = await createTaskScenario(database);
    const pending = await createPendingTaskFixture(database, scenario);
    const output = await runLinuxProofProgram(
      String.raw`
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,open,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
Object.assign(process.env,JSON.parse(await readFile('/fixture/environment.json','utf8')));
const fixture=JSON.parse(await readFile('/fixture/fixtures.json','utf8'));
const {createDatabaseClient}=await import('@template/database');
const {ProofsRuntime}=await import('./api/modules/proofs/proofs.runtime.js');
const database=createDatabaseClient(process.env.DATABASE_URL);
const now=new Date(fixture.now),root=await mkdtemp(join(tmpdir(),'p05-startup-'));
const config={storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000};
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
let runtime;
async function file(folder,key,content=bytes){await mkdir(join(root,folder,key),{recursive:true,mode:448});await writeFile(join(root,folder,key,folder==='assets'?'content.png':'input'),content,{mode:384});}
async function ready(uploadedAt=now){
 const key=randomUUID();
 const asset=await database.imageAsset.create({data:{ownerUserId:fixture.employee.userId,purpose:'PROOF',uploadCommandId:randomUUID(),state:'STAGING',receivedAt:uploadedAt,uploadedBySessionId:fixture.employee.sessionId,storageKey:key,processingLeaseId:randomUUID(),processingLeaseExpiresAt:new Date(now.getTime()+120000)}});
 await file('assets',key);
 return database.imageAsset.update({where:{id:asset.id},data:{state:'READY',uploadedAt,readyAt:uploadedAt,uploadIntentHash:'a'.repeat(64),inputByteCount:bytes.length,storedByteCount:bytes.length,format:'PNG',width:1,height:1,contentHash:createHash('sha256').update(bytes).digest('hex'),processingLeaseId:null,processingLeaseExpiresAt:null}});
}
const query=database.imageAsset.findMany.bind(database.imageAsset);
let batches=0,failBatch=0;
database.imageAsset.findMany=async parameters=>{
 assert.ok(parameters.take>0 && parameters.take<=100,'Every startup/maintenance lookup must be bounded');
 if(parameters.where?.storageKey?.in){assert.ok(parameters.where.storageKey.in.length<=100);batches++;if(batches===failBatch)throw new Error('Synthetic interrupted database lookup');}
 return query(parameters);
};
try {
 await mkdir(join(root,'assets'),{mode:448});await mkdir(join(root,'staging'),{mode:448});
 await file('assets',fixture.pendingKey);
 const assets=[];for(let index=0;index<105;index++)assets.push(await ready(index===104?new Date(now.getTime()-31*86400000):now));
 const removed=assets.at(-1);
 await database.imageAsset.update({where:{id:removed.id},data:{state:'DELETING',deletionLeaseId:randomUUID(),deletionLeaseExpiresAt:new Date(now.getTime()+120000)}});
 await database.imageAsset.update({where:{id:removed.id},data:{state:'DELETED',deletedAt:now,deletionLeaseId:null,deletionLeaseExpiresAt:null}});
 const orphan=randomUUID();await file('assets',orphan);
 const stagingKey=randomUUID();await database.imageAsset.create({data:{ownerUserId:fixture.employee.userId,purpose:'PROOF',uploadCommandId:randomUUID(),state:'STAGING',receivedAt:now,uploadedBySessionId:fixture.employee.sessionId,storageKey:stagingKey,processingLeaseId:randomUUID(),processingLeaseExpiresAt:new Date(now.getTime()+120000)}});await file('staging',stagingKey);
 runtime=new ProofsRuntime(database,config,()=>now,()=>{});failBatch=2;
 await assert.rejects(runtime.start(),{code:'STORAGE_UNAVAILABLE'});
 await assert.rejects(runtime.storage.reserve(),{code:'STORAGE_UNAVAILABLE'});
 assert.deepEqual(await readFile(join(root,'assets',fixture.pendingKey,'content.png')),bytes);
 await runtime.stop();batches=0;failBatch=4;
 runtime=new ProofsRuntime(database,config,()=>now,()=>{});
 await assert.rejects(runtime.start(),{code:'STORAGE_UNAVAILABLE'});
 await assert.rejects(runtime.storage.reserve(),{code:'STORAGE_UNAVAILABLE'});
 assert.deepEqual(await readFile(join(root,'assets',fixture.pendingKey,'content.png')),bytes);
 await runtime.stop();batches=0;failBatch=0;
 runtime=new ProofsRuntime(database,config,()=>now,()=>{});await runtime.start();await runtime.lifecycle.stop();
 assert.ok(batches>=4,'Accounting and reconciliation must each finish multiple batches');
 for(const asset of assets.slice(0,-1)){assert.deepEqual(await readFile(join(root,'assets',asset.storageKey,'content.png')),bytes);assert.equal((await database.imageAsset.findUniqueOrThrow({where:{id:asset.id}})).uploadedAt.toISOString(),now.toISOString());}
 assert.deepEqual(await readFile(join(root,'assets',fixture.pendingKey,'content.png')),bytes);
 assert.ok(!(await readdir(join(root,'assets'))).includes(orphan));assert.ok(!(await readdir(join(root,'assets'))).includes(removed.storageKey));
 assert.deepEqual(await readFile(join(root,'staging',stagingKey,'input')),bytes);
 const slot=await runtime.storage.reserve();await runtime.storage.discard(slot);await runtime.stop();
 // More than one batch of sparse orphan files exceeds the budget only after 100 entries.
 for(let index=0;index<105;index++){const key=randomUUID();await mkdir(join(root,'staging',key),{mode:448});const input=await open(join(root,'staging',key,'input'),'wx',384);try{await input.truncate(2621440);}finally{await input.close();}}
 runtime=new ProofsRuntime(database,config,()=>now,()=>{});await assert.rejects(runtime.start(),{code:'STORAGE_UNAVAILABLE'});await assert.rejects(runtime.storage.reserve(),{code:'STORAGE_UNAVAILABLE'});
 assert.equal((await readdir(join(root,'staging'))).length,106);
 assert.deepEqual(await readFile(join(root,'assets',fixture.pendingKey,'content.png')),bytes);
 assert.equal(await database.taskSubmission.count(),1);assert.equal(await database.financialOperation.count({where:{businessNamespace:'p05.task-reward'}}),0);
 console.log(JSON.stringify({startup:'passed'}));
} finally {await runtime?.stop();await database.$disconnect();await rm(root,{recursive:true,force:true});}
`,
      url,
      {
        employee: taskIdentity(scenario.employee),
        now: scenario.clock().toISOString(),
        pendingKey: pending.asset.storageKey,
      },
    );
    expect(JSON.parse(output)).toEqual({ startup: "passed" });
  });
}, 300_000);
