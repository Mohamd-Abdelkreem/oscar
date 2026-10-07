import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  createTaskScenario,
  createPendingTaskFixture,
  taskIdentity,
  withTaskDatabase,
} from "../tasks/testing/task-fixtures.js";
import { runLinuxProofProgram } from "./testing/linux-proof-runtime.js";

it("serializes real retained-file cleanup against both pending attachment race winners", async () => {
  await withTaskDatabase(async (database, url) => {
    const scenario = await createTaskScenario(database);
    const pending = await createPendingTaskFixture(database, scenario);
    const output = await runLinuxProofProgram(
      String.raw`
import assert from 'node:assert/strict';import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
Object.assign(process.env,JSON.parse(await readFile('/fixture/environment.json','utf8')));const fixture=JSON.parse(await readFile('/fixture/fixtures.json','utf8'));
const {createDatabaseClient}=await import('@template/database');const {ProofsRuntime}=await import('./api/modules/proofs/proofs.runtime.js');const {SubmissionEvidenceService}=await import('./api/modules/task-submissions/submission-evidence.service.js');const {default:sharp}=await import('sharp');
const database=createDatabaseClient(process.env.DATABASE_URL),blockerDatabase=createDatabaseClient(process.env.DATABASE_URL);const now=new Date(fixture.now),old=new Date(now.getTime()-30*86400000);const root=await mkdtemp(join(tmpdir(),'p05-file-race-'));const failures=[];
const runtime=new ProofsRuntime(database,{storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000},()=>now,code=>failures.push(code));await runtime.start();await runtime.lifecycle.stop();const service=new SubmissionEvidenceService(database,()=>now,runtime.reads);
const bytes=await sharp({create:{width:3,height:2,channels:4,background:'#234567'}}).png().toBuffer();
// These are saved historical assets with real synthetic bytes, not new intake acceptance claims.
async function historicalAsset(){const key=randomUUID();const asset=await database.imageAsset.create({data:{ownerUserId:fixture.employee.userId,purpose:'PROOF',uploadCommandId:randomUUID(),state:'STAGING',receivedAt:old,uploadedBySessionId:fixture.employee.sessionId,storageKey:key,processingLeaseId:randomUUID(),processingLeaseExpiresAt:new Date(old.getTime()+120000)}});await mkdir(join(root,'assets',key),{mode:448});await writeFile(join(root,'assets',key,'content.png'),bytes,{mode:384});return database.imageAsset.update({where:{id:asset.id},data:{state:'READY',uploadedAt:old,readyAt:old,uploadIntentHash:'a'.repeat(64),inputByteCount:bytes.length,storedByteCount:bytes.length,format:'PNG',width:3,height:2,contentHash:createHash('sha256').update(bytes).digest('hex'),processingLeaseId:null,processingLeaseExpiresAt:null}});}
async function race(asset,attachmentWins,expectedVersion){let lockReady,release;const locked=new Promise(resolve=>lockReady=resolve),released=new Promise(resolve=>release=resolve);let pid;
const holding=blockerDatabase.$transaction(async transaction=>{pid=(await transaction.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid;await transaction.$queryRawUnsafe('SELECT id FROM image_assets WHERE id=$1::uuid FOR UPDATE',asset.id);lockReady();await released;},{timeout:15000});await locked;
async function waitFor(count){for(let attempt=0;attempt<100;attempt++){const waiters=await database.$queryRawUnsafe('WITH RECURSIVE waiting AS (SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1::int=ANY(pg_blocking_pids(pid)) UNION SELECT activity.pid FROM pg_stat_activity activity JOIN waiting ON waiting.pid=ANY(pg_blocking_pids(activity.pid)) WHERE activity.datname=current_database()) SELECT DISTINCT pid FROM waiting',pid);if(waiters.length>=count)return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('Expected database race waiter did not reach the lock');}
let replacing,cleaning;const replace=()=>service.replace(fixture.employee,fixture.submissionId,{commandId:randomUUID(),expectedSubmissionVersion:expectedVersion,proofAssetId:asset.id}).catch(error=>error);
if(attachmentWins){replacing=replace();await waitFor(1);cleaning=runtime.lifecycle.scan();}else{cleaning=runtime.lifecycle.scan();await waitFor(1);replacing=replace();}try {await waitFor(2);} finally {release();}await holding;const [result]=await Promise.all([replacing,cleaning]);return result;}
try {
 const wallet=await database.wallet.findUniqueOrThrow({where:{ownerUserId:fixture.employee.userId}}),operations=await database.financialOperation.count();const first=await historicalAsset();
 assert.equal((await race(first,true,1)).state,'OBSERVED');assert.equal((await database.imageAsset.findUniqueOrThrow({where:{id:first.id}})).state,'READY');const file=await runtime.reads.content(fixture.employee,'PROOF',first.id);assert.deepEqual(await file.file.readFile(),bytes);await file.file.close();
 await runtime.lifecycle.scan();const second=await historicalAsset();const rejected=await race(second,false,2);assert.equal(rejected.statusCode,404);assert.equal((await database.imageAsset.findUniqueOrThrow({where:{id:second.id}})).state,'DELETED');assert.equal((await database.taskSubmission.findUniqueOrThrow({where:{id:fixture.submissionId}})).currentEvidenceVersion,2);assert.equal(await database.submissionEvidence.count({where:{submissionId:fixture.submissionId}}),2);assert.equal((await database.imageAsset.findUniqueOrThrow({where:{id:first.id}})).state,'READY');
 assert.deepEqual(await database.wallet.findUniqueOrThrow({where:{ownerUserId:fixture.employee.userId}}),wallet);assert.equal(await database.financialOperation.count(),operations);assert.deepEqual(failures,[]);console.log(JSON.stringify({races:'passed'}));
} finally {await runtime.stop();await blockerDatabase.$disconnect();await database.$disconnect();await rm(root,{recursive:true,force:true});}
`,
      url,
      {
        employee: taskIdentity(scenario.employee),
        now: scenario.clock().toISOString(),
        submissionId: pending.submission.id,
      },
    );
    expect(JSON.parse(output)).toEqual({ races: "passed" });
  });
}, 300_000);

// Node's Windows directory handles cannot fsync. Exercise the emitted adapter on
// an actual Linux filesystem rather than replacing its durability boundary.
async function linuxStorageAssertions(png: Buffer) {
  const apiDist = fileURLToPath(new URL("../../../dist", import.meta.url));
  const containerName = `oscar-p05-storage-${randomUUID()}`;
  const program = `
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, open, writeFile, readFile, readdir, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import crypto, {randomUUID} from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import {PrivateImageStorage} from '/api/infrastructure/files/private-image-storage.js';
const root=await mkdtemp(join(tmpdir(),'p05-storage-'));
const png=Buffer.from(${JSON.stringify(png.toString("base64"))},'base64');
const config={storageRoot:root,processingSlots:2,uploadReservationBytes:41943040,stagingMaxBytes:268435456,inputDeadlineMs:30000};
const storage=new PrivateImageStorage(config);
try {
  await assert.rejects(storage.reserve(), {code:'STORAGE_UNAVAILABLE'});
  await storage.initialize();
  const first=await storage.reserve();
  const second=await storage.reserve();
  await assert.rejects(storage.reserve(), {code:'PROOF_PROCESSING_BUSY'});
  const received=await storage.receive(first,Readable.from([png]),png.length,new AbortController().signal);
  assert.equal(received.byteCount,png.length);
  assert.match(received.contentHash,/^[a-f0-9]{64}$/);
  await assert.rejects(storage.receive(first,Readable.from([png]),png.length,new AbortController().signal),{code:'EEXIST'});
  const canonical=await storage.writeCanonical(first,Readable.from([png.subarray(0,10),png.subarray(10)]),png.length,new AbortController().signal);
  assert.equal(canonical.byteCount,png.length);
  assert.equal(canonical.contentHash,received.contentHash);
  await storage.publish(first,png.length);
  await assert.rejects(storage.publish(first,png.length),{code:'ENOENT'});
  await storage.releaseAccepted(first);
  const content=await storage.content(first.storageKey,png.length);
  try {assert.deepEqual(await content.readFile(),png);} finally {await content.close();}
  assert.deepEqual(await readdir(join(root,'staging',second.storageKey)),[]);
  await assert.rejects(storage.content(first.storageKey,png.length-1),{code:'STORAGE_UNAVAILABLE'});
  await assert.rejects(storage.content('../escape',png.length),{code:'STORAGE_UNAVAILABLE'});
  await assert.rejects(storage.content('/tmp/escape',png.length),{code:'STORAGE_UNAVAILABLE'});
  await storage.discard(second);
  assert.deepEqual(await readdir(join(root,'staging')),[]);
  const oversize=await storage.reserve();
  await assert.rejects(storage.receive(oversize,Readable.from([png]),png.length-1,new AbortController().signal),{code:'UPLOAD_TOO_LARGE'});
  await storage.discard(oversize);
  const oversizedOutput=await storage.reserve();
  await assert.rejects(storage.writeCanonical(oversizedOutput,Readable.from([png]),png.length-1,new AbortController().signal),{code:'INVALID_IMAGE'});
  assert.equal((await readFile(oversizedOutput.outputPath)).length,0);
  await storage.discard(oversizedOutput);
  async function* outputChunks(extra=false){const chunk=Buffer.alloc(65536);for(let index=0;index<512;index++)yield chunk;if(extra)yield Buffer.alloc(1);}
  const exactOutput=await storage.reserve();assert.equal((await storage.writeCanonical(exactOutput,Readable.from(outputChunks()),33554432,new AbortController().signal)).byteCount,33554432);await storage.discard(exactOutput);
  const plusOneOutput=await storage.reserve();await assert.rejects(storage.writeCanonical(plusOneOutput,Readable.from(outputChunks(true)),33554432,new AbortController().signal),{code:'INVALID_IMAGE'});assert.equal((await readFile(plusOneOutput.outputPath)).length,33554432);await storage.discard(plusOneOutput);
  const empty=await storage.reserve();
  await assert.rejects(storage.receive(empty,Readable.from([]),png.length,new AbortController().signal),{code:'INVALID_IMAGE'});
  await storage.discard(empty);
  const collision=await storage.reserve();
  await writeFile(collision.outputPath,png,{flag:'wx',mode:0o600});
  await writeFile(join(root,'assets',collision.storageKey,'content.png'),Buffer.from('retained'),{flag:'wx',mode:0o600});
  await assert.rejects(storage.publish(collision,png.length),{code:'STORAGE_UNAVAILABLE'});
  assert.equal(await readFile(join(root,'assets',collision.storageKey,'content.png'),'utf8'),'retained');
  await assert.rejects(storage.discard(collision),{code:'ENOTEMPTY'});
  assert.equal(await readFile(join(root,'assets',collision.storageKey,'content.png'),'utf8'),'retained');
  await rm(join(root,'assets',collision.storageKey,'content.png'));
  await storage.discard(collision);
  const linked=await storage.reserve();
  await symlink(join(root,'assets',first.storageKey,'content.png'),linked.outputPath);
  await assert.rejects(storage.publish(linked,png.length),{code:'INVALID_IMAGE'});
  await storage.discard(linked);
  assert.deepEqual(await readFile(join(root,'assets',first.storageKey,'content.png')),png);
  const occupiedKey=randomUUID();
  await mkdir(join(root,'staging',occupiedKey),{mode:0o700});
  await writeFile(join(root,'staging',occupiedKey,'input'),'existing',{mode:0o600});
  const originalUUID=crypto.randomUUID;
  crypto.randomUUID=()=>occupiedKey;
  syncBuiltinESMExports();
  try {await assert.rejects(storage.reserve(),{code:'EEXIST'});} finally {crypto.randomUUID=originalUUID;syncBuiltinESMExports();}
  assert.equal(await readFile(join(root,'staging',occupiedKey,'input'),'utf8'),'existing');
  await rm(join(root,'staging',occupiedKey),{recursive:true});
  const leftoverKey=randomUUID();
  await mkdir(join(root,'staging',leftoverKey),{mode:0o700});
  const leftover=await open(join(root,'staging',leftoverKey,'input'),'wx',0o600);
  try {await leftover.truncate(268435456-41943040+1);} finally {await leftover.close();}
  const recovered=new PrivateImageStorage(config);
  await recovered.initialize();
  await assert.rejects(recovered.reserve(),{code:'STORAGE_UNAVAILABLE'});
  await rm(join(root,'staging',leftoverKey),{recursive:true});
  const restarted=new PrivateImageStorage(config);
  await restarted.initialize();
  const afterRestart=await restarted.reserve();
  await restarted.discard(afterRestart);
  const renamedOrphan=randomUUID();
  await mkdir(join(root,'assets',renamedOrphan),{mode:0o700});
  const orphanFile=await open(join(root,'assets',renamedOrphan,'content.png'),'wx',0o600);
  await orphanFile.truncate(268435456);await orphanFile.close();
  await assert.rejects(new PrivateImageStorage(config).initialize(),{code:'STORAGE_UNAVAILABLE'});
  await rm(join(root,'assets',renamedOrphan),{recursive:true});
  const acceptedRestart=new PrivateImageStorage(config);
  await acceptedRestart.initialize(async keys=>new Map(keys.filter(key=>key===first.storageKey).map(key=>[key,'RETAINED'])));
  const acceptedSlot=await acceptedRestart.reserve();
  await acceptedRestart.discard(acceptedSlot);
  const rootAlias=join(root,'alias');
  await symlink(root,rootAlias,'dir');
  await assert.rejects(new PrivateImageStorage({...config,storageRoot:rootAlias}).initialize(),{code:'STORAGE_UNAVAILABLE'});
  console.log(JSON.stringify({storage:'passed',platform:process.platform}));
} finally {await rm(root,{recursive:true});}
`;
  const child = spawn(
    "docker",
    [
      "run",
      "--name",
      containerName,
      "-i",
      "--network",
      "none",
      "--mount",
      `type=bind,source=${apiDist},target=/api,readonly`,
      "--entrypoint",
      "node",
      "node:24.18.1-bookworm-slim",
      "--input-type=module",
    ],
    { windowsHide: true },
  );
  let output = "";
  let diagnostics = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    output += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    diagnostics += chunk;
  });
  const completion = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  child.stdin.end(program);
  const deadline = setTimeout(() => {
    child.kill();
  }, 30_000);
  try {
    const exitCode = await completion;
    if (exitCode !== 0)
      throw new Error(
        `Linux storage acceptance failed (${String(exitCode)}): ${diagnostics}`,
      );
    return JSON.parse(output) as unknown;
  } finally {
    clearTimeout(deadline);
    const cleanup = spawn("docker", ["rm", "--force", containerName], {
      windowsHide: true,
      stdio: "ignore",
      timeout: 10_000,
    });
    await new Promise<void>((resolve, reject) => {
      cleanup.once("error", reject);
      cleanup.once("close", (exitCode) => {
        if (exitCode === 0) resolve();
        else
          reject(
            new Error("Private storage acceptance container cleanup failed."),
          );
      });
    });
  }
}

describe("private image storage filesystem boundary", () => {
  it("persists without overwrite or escape, bounds admission, and accounts for crash leftovers", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 4, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    expect(await linuxStorageAssertions(png)).toEqual({
      storage: "passed",
      platform: "linux",
    });
  });
});
