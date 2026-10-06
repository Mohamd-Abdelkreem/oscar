import { expect, it } from "vitest";
import {
  createTaskScenario,
  taskIdentity,
  withTaskDatabase,
} from "../tasks/testing/task-fixtures.js";
import { runLinuxProofProgram } from "./testing/linux-proof-runtime.js";

it("serves actual canonical files privately and fences both purpose-specific cancellation HTTP routes", async () => {
  await withTaskDatabase(async (database, url) => {
    const scenario = await createTaskScenario(database);
    const output = await runLinuxProofProgram(
      String.raw`
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
Object.assign(process.env,JSON.parse(await readFile('/fixture/environment.json','utf8')));
const fixture=JSON.parse(await readFile('/fixture/fixtures.json','utf8'));
const {createDatabaseClient}=await import('@template/database');
const {createApp}=await import('./api/app.js');
const {ProofsRuntime}=await import('./api/modules/proofs/proofs.runtime.js');
const {generateTokenPair}=await import('./api/infrastructure/security/jwt.service.js');
const {default:pino}=await import('pino');
const {default:sharp}=await import('sharp');
const database=createDatabaseClient(process.env.DATABASE_URL);
const root=await mkdtemp(join(tmpdir(),'p05-http-'));
const runtime=new ProofsRuntime(database,{storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000},()=>new Date(fixture.now),()=>{});
await runtime.start();
const app=createApp({database,logger:pino({level:'silent'}),proofs:runtime,financialClock:()=>new Date(fixture.now)});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port+'/api/v1';
function token(identity,role='USER'){return generateTokenPair({userId:identity.userId,sessionId:identity.sessionId,role,tokenId:randomUUID(),email:'test@example.com',rememberMe:false,absoluteExpiresAt:new Date(Date.now()+86400000)}).accessToken;}
const employeeToken=token(fixture.employee),adminToken=token(fixture.admin,'ADMIN');
async function request(path,{bearer=employeeToken,method='GET',body,csrf=true}={}) {
 const headers={};if(bearer)headers.Authorization='Bearer '+bearer;
 if(method!=='GET'&&csrf){headers.Cookie='csrfToken=p05-test';headers['x-csrf-token']='p05-test';}
 if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
 const response=await fetch(base+path,{method,headers,body});
 const bytes=Buffer.from(await response.arrayBuffer());
 let json;try{json=JSON.parse(bytes.toString());}catch{}
 return {status:response.status,headers:response.headers,bytes,json};
}
function multipart(bytes,commandId=randomUUID()){const body=new FormData();body.set('commandId',commandId);body.set('file',new Blob([bytes],{type:'image/png'}),'fixture.png');return body;}
try {
 const png=await sharp({create:{width:9,height:4,channels:4,background:'#113355'}}).png().toBuffer();
 for(const [options,status] of [[{bearer:null},401],[{csrf:false},403],[{bearer:adminToken},403]]) {
   const response=await request('/proofs',{method:'POST',body:multipart(png),...options});assert.equal(response.status,status);
 }
 assert.equal(await database.imageAsset.count(),0);assert.deepEqual(await readdir(join(root,'staging')),[]);
 const commandId=randomUUID();
 const accepted=await request('/proofs',{method:'POST',body:multipart(png,commandId)});assert.equal(accepted.status,201,JSON.stringify(accepted.json));
 const asset=accepted.json.data;assert.equal(asset.purpose,'PROOF');assert.equal(asset.availability,'PRESENT');assert.equal(asset.width,9);
 const binary=await request('/proofs/'+asset.id+'/content');assert.equal(binary.status,200);assert.equal(binary.headers.get('content-type'),'image/png');assert.equal(binary.headers.get('cache-control'),'private, no-store');assert.equal(binary.headers.get('x-content-type-options'),'nosniff');assert.match(binary.headers.get('content-disposition'),/^inline;/);assert.equal(binary.bytes.length,asset.byteCount);assert.ok(binary.bytes.length<=33554432);
 assert.equal((await request('/proofs/'+asset.id,{bearer:null})).status,401);
 assert.equal((await request('/task-illustrations/'+asset.id)).status,404);
 assert.equal((await request('/proofs/'+randomUUID()+'/content')).status,404);
 assert.equal((await request('/uploads/'+asset.id+'/content.png')).status,404);
 const foreign=await database.user.create({data:{email:randomUUID()+'@example.com',fullName:'Foreign',passwordHash:'test-only',role:'USER',status:'ACTIVE',emailVerifiedAt:new Date(fixture.now)}});
 const foreignSession=await database.authSession.create({data:{userId:foreign.id,rememberMe:false,expiresAt:new Date(Date.now()+86400000)}});
 const foreignToken=token({userId:foreign.id,sessionId:foreignSession.id});
 assert.equal((await request('/proofs/'+asset.id,{bearer:foreignToken})).status,404);
 assert.equal((await request('/proofs/'+asset.id+'/content',{bearer:foreignToken})).status,404);
 const illustration=await request('/admin/task-illustrations',{method:'POST',bearer:adminToken,body:multipart(png)});assert.equal(illustration.status,201);const illustrationId=illustration.json.data.id;
 assert.equal((await request('/task-illustrations/'+illustrationId)).status,404);assert.equal((await request('/task-illustrations/'+illustrationId+'/content',{bearer:adminToken})).status,200);assert.equal((await request('/proofs/'+illustrationId,{bearer:adminToken})).status,404);
 await database.task.update({where:{id:fixture.taskId},data:{illustrationAssetId:illustrationId,illustrationPurpose:'TASK_ILLUSTRATION',revision:{increment:1},updatedAt:new Date(fixture.now)}});assert.equal((await request('/task-illustrations/'+illustrationId+'/content')).status,200);
 await database.user.update({where:{id:fixture.employee.userId},data:{tasksBlocked:true}});
 assert.equal((await request('/proofs/'+asset.id+'/content')).status,200);
 const originalNow=fixture.now;await database.authSession.update({where:{id:fixture.employee.sessionId},data:{expiresAt:new Date(new Date(fixture.subscriptionExpiresAt).getTime()+86400000)}});fixture.now=new Date(new Date(fixture.subscriptionExpiresAt).getTime()+1).toISOString();assert.equal((await request('/proofs/'+asset.id+'/content')).status,200);fixture.now=originalNow;
 for(const [prefix,purpose,bearer] of [['/proofs','PROOF',employeeToken],['/admin/task-illustrations','TASK_ILLUSTRATION',adminToken]]) {
   const key=randomUUID();
   for(const [options,status] of [[{csrf:false,body:{confirmed:true}},403],[{body:{confirmed:false}},400],[{body:{confirmed:true,ownerUserId:fixture.admin.userId}},400]]) assert.equal((await request(prefix+'/uploads/'+key+'/cancel',{method:'POST',bearer,...options})).status,status);
   const cancelled=await request(prefix+'/uploads/'+key+'/cancel',{method:'POST',bearer,body:{confirmed:true}});assert.equal(cancelled.status,200);assert.deepEqual(Object.keys(cancelled.json.data).sort(),['commandId','failedAt','failureCode','purpose','state']);assert.equal(cancelled.json.data.commandId,key);assert.equal(cancelled.json.data.purpose,purpose);assert.equal(cancelled.json.data.failureCode,'UPLOAD_CANCELLED');
   const repeat=await request(prefix+'/uploads/'+key+'/cancel',{method:'POST',bearer,body:{confirmed:true}});assert.deepEqual(repeat.json.data,cancelled.json.data);
   const observed=await request(prefix+'/uploads/'+key,{bearer});assert.deepEqual(observed.json.data,cancelled.json.data);
 }
 const cancelReady=await request('/proofs/uploads/'+commandId+'/cancel',{method:'POST',body:{confirmed:true}});assert.equal(cancelReady.json.data.state,'READY');assert.equal(cancelReady.json.data.asset.id,asset.id);assert.equal((await request('/proofs/'+asset.id+'/content')).status,200);
 assert.equal((await request('/admin/task-illustrations/uploads/'+randomUUID()+'/cancel',{method:'POST',body:{confirmed:true}})).status,403);
 await database.user.update({where:{id:fixture.employee.userId},data:{status:'BANNED'}});
 assert.equal((await request('/proofs/'+asset.id+'/content',{bearer:adminToken})).status,200);
 assert.equal((await request('/proofs/'+asset.id+'/content')).status,401);
 await database.authSession.update({where:{id:fixture.admin.sessionId},data:{revokedAt:new Date(fixture.now)}});
 const denied=await request('/proofs/'+asset.id+'/content',{bearer:adminToken});assert.equal(denied.status,401);assert.doesNotMatch(denied.bytes.toString(),/storageKey|contentHash|inputPath|\/tmp\/|SQL|passwordHash/);
 assert.equal(await database.taskSubmission.count(),0);
 console.log(JSON.stringify({http:'passed'}));
} finally {await runtime.stop();await new Promise(resolve=>server.close(resolve));await database.$disconnect();await rm(root,{recursive:true,force:true});}
`,
      url,
      {
        employee: taskIdentity(scenario.employee),
        admin: taskIdentity(scenario.admin),
        now: scenario.clock().toISOString(),
        taskId: scenario.task.id,
        subscriptionExpiresAt: scenario.subscription.expiresAt.toISOString(),
      },
    );
    expect(JSON.parse(output)).toEqual({ http: "passed" });
  });
}, 300_000);
