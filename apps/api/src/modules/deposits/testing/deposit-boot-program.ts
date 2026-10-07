export const depositBootProgram = String.raw`
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, chown, cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createDatabaseClient } from '@template/database';
const fixtures = JSON.parse(await readFile('/fixture/fixtures.json', 'utf8'));
const environment = JSON.parse(await readFile('/fixture/environment.json', 'utf8'));
Object.assign(process.env, environment);
const { acknowledgeFinancialBoot, fenceFinancialRuntime } = await import('./api/modules/custody/runtime-control.js');
const database = createDatabaseClient(environment.DATABASE_URL);
const children = [];
const diagnostics = [];
function start(file, env, args=[]) {
  const child = spawn('node', [...args, file], { uid: 1000, gid: 1000, env: { ...process.env, ...env }, stdio: ['ignore','pipe','pipe'] });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => diagnostics.push('CHILD_DIAGNOSTIC'));
  children.push(child);
  return child;
}
async function until(work) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const found = await work();
    if (found) return found;
    await delay(10);
  }
  throw new Error('BOOT_ACCEPTANCE_TIMEOUT');
}
const originalBoots = new Set((await database.financialRuntimeAdmission.findMany()).map(row => row.bootId));
async function boot(kind) {
  return until(async () => (await database.financialRuntimeAdmission.findMany({ where: { processKind: kind } })).find(row => !originalBoots.has(row.bootId)));
}
async function approve(bootId, additionalBootIds) {
  const cutoff = new Date();
  const control = await database.financialRuntimeControl.findUniqueOrThrow({where:{id:1}});
  await acknowledgeFinancialBoot(database, { bootId, additionalBootIds, expectedGeneration:control.generation, expectedFencedVersion:control.version, operatorIdentity:'isolated-test-operator', reason:'Known disposable migrated history', evidence: { financialHistoryReference:'isolated-current-history', assignmentInventoryReference:'isolated-bound-assignments', attemptInventoryReference:'isolated-empty-attempts', reconciliationReference:'isolated-inbound-evidence', reconciliationCutoff:cutoff, financialHistoryRecoveredThrough:cutoff } });
}
async function http(path, token, body) {
  const response = await fetch('http://127.0.0.1:4147/api/v1'+path, { method:body===undefined?'GET':'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json', Cookie:'csrfToken=p06-test', 'X-CSRF-Token':'p06-test' }, ...(body===undefined?{}:{body:JSON.stringify(body)}) });
  return { status:response.status, body:await response.json() };
}
try {
  await mkdir('/work/apps/api', { recursive:true });
  await cp('/work/api','/work/apps/api/dist',{recursive:true});
  await mkdir('/tmp/p06-proof', { mode:0o700 }); await chown('/tmp/p06-proof',1000,1000);
  await mkdir('/tmp/p06-provider', { mode:0o700 }); await chown('/tmp/p06-provider',1000,1000);
  await writeFile('/tmp/p06-provider/key','isolated-test-provider',{mode:0o600}); await chown('/tmp/p06-provider/key',1000,1000);
  const apiUrl = new URL(environment.DATABASE_URL); apiUrl.username=fixtures.apiRole; apiUrl.password=fixtures.password;
  const workerUrl = new URL(environment.DATABASE_URL); workerUrl.username=fixtures.workerRole; workerUrl.password=fixtures.password;
  const workerEnvironment = { LOG_LEVEL:'silent', TRON_NETWORK:'TRON_NILE',TRON_TOKEN_CONTRACT:fixtures.token, TRON_EXPECTED_GENESIS_BLOCK_ID:'cd'.repeat(32), TRON_PROVIDER_URL:'https://nile.trongrid.io',TRON_PROVIDER_API_KEY_FILE:'/tmp/p06-provider/key' };
  const beforeDenied = await database.financialRuntimeAdmission.count();
  for (const role of [null, fixtures.recoveryRole, fixtures.signerRole, fixtures.workerRole, fixtures.tableOwnerRole]) {
    const unsafeUrl = new URL(environment.DATABASE_URL);
    if (role !== null) { unsafeUrl.username=role; unsafeUrl.password=fixtures.password; }
    const denied = start('/work/apps/api/dist/server.js', { DATABASE_URL:unsafeUrl.toString(), API_PORT:'4147', API_HOST:'127.0.0.1', PROOF_STORAGE_ROOT:'/tmp/p06-proof' });
    const exited = await new Promise((resolve, reject) => {
      const timer=setTimeout(()=>{denied.kill('SIGKILL');reject(new Error('UNSAFE_API_STARTED'));},15000);
      denied.once('error',reject); denied.once('close',code=>{clearTimeout(timer);resolve(code);});
    });
    assert.equal(exited,1);
    children.splice(children.indexOf(denied),1);
    assert.equal(await database.financialRuntimeAdmission.count(),beforeDenied);
    await assert.rejects(fetch('http://127.0.0.1:4147/api/v1/subscriptions/me'));
  }
  const beforeWorkerDenial = {
    boots:await database.financialRuntimeAdmission.count(),
    operations:await database.financialOperation.count(),
    receipts:await database.depositReceipt.count(),
    candidates:await database.depositCandidate.count(),
    scans:await database.depositScanProgress.count()
  };
  for (const rejected of fixtures.workerRejections) {
    const unsafeUrl = new URL(rejected.databaseUrl); unsafeUrl.hostname=workerUrl.hostname;
    const denied = start('/work/apps/api/dist/worker.js', { ...workerEnvironment, DATABASE_URL:unsafeUrl.toString() });
    let output='';
    for (const stream of [denied.stdout,denied.stderr]) stream.on('data',chunk=>{output+=chunk.toString();if(output.length>16384)denied.kill('SIGKILL');});
    const exited = await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{denied.kill('SIGKILL');reject(new Error('UNSAFE_WORKER_STARTED'));},15000);
      denied.once('error',error=>{clearTimeout(timer);reject(error);});
      denied.once('close',code=>{clearTimeout(timer);resolve(code);});
    });
    assert.equal(exited,1,rejected.scenario);
    assert.equal(output.includes(unsafeUrl.password),false,rejected.scenario);
    assert.doesNotMatch(output,/postgres(?:ql)?:|isolated-test-provider/u);
    children.splice(children.indexOf(denied),1);
    assert.deepEqual({boots:await database.financialRuntimeAdmission.count(),operations:await database.financialOperation.count(),receipts:await database.depositReceipt.count(),candidates:await database.depositCandidate.count(),scans:await database.depositScanProgress.count()},beforeWorkerDenial,rejected.scenario);
  }
  // Egress is replaced at the network boundary in the actual built worker process.
  await writeFile('/tmp/p06-provider/preload.mjs', 'const raw='+JSON.stringify(fixtures.raw)+'; globalThis.fetch='+ (async (url,options)=>{ const request=new URL(url); if(request.origin!=='https://nile.trongrid.io') throw new Error('EGRESS_DENIED'); const path=request.pathname; const body=options?.body===undefined?{}:JSON.parse(options.body); let response; if(path.startsWith('/v1/')) response={success:true,data:[{transaction_id:raw.transactionId,block_timestamp:raw.info.blockTimeStamp}],meta:{}}; else if(path.endsWith('triggerconstantcontract')) response={result:{result:true},constant_result:['0'.repeat(63)+'6']}; else if(path.endsWith('gettransactioninfobyid')) response=raw.info; else if(path.endsWith('gettransactionbyid')) response=raw.transaction; else if(path.endsWith('getblockbynum')&&body.num===0) response={blockID:'cd'.repeat(32),block_header:{raw_data:{number:0,timestamp:1}}}; else if(path.endsWith('getnowblock')) response=raw.solidified; else response=raw.block; return new Response(JSON.stringify(response)); }).toString());
  start('/work/apps/api/dist/server.js', { DATABASE_URL:apiUrl.toString(), API_PORT:'4147', API_HOST:'127.0.0.1', PROOF_STORAGE_ROOT:'/tmp/p06-proof', FINANCIAL_BOOT_ID:fixtures.oldBootId });
  const apiBoot = await boot('API'); assert.notEqual(apiBoot.bootId,fixtures.oldBootId); assert.equal(apiBoot.acknowledgedGeneration,null);
  await until(async()=>{try{return (await http('/subscriptions/me',fixtures.buyerToken)).status===200;}catch(error){if(error instanceof TypeError)return false;throw error;}});
  const quote = await http('/subscriptions/purchase-quotes',fixtures.buyerToken,{packageCode:'S1'}); assert.equal(quote.status,201);
  const purchaseBody={quoteId:quote.body.data.quoteId,confirmed:true};
  const deniedPurchase=await http('/subscriptions/purchases',fixtures.buyerToken,purchaseBody); assert.equal(deniedPurchase.body.code,'FINANCIAL_WRITES_FENCED');
  const deniedReward=await http('/admin/task-submissions/'+fixtures.submissionId+'/review',fixtures.adminToken,fixtures.review); assert.equal(deniedReward.body.code,'FINANCIAL_WRITES_FENCED');
  start('/work/apps/api/dist/worker.js',{ ...workerEnvironment, DATABASE_URL:workerUrl.toString(), FINANCIAL_BOOT_ID:fixtures.oldBootId },['--import','/tmp/p06-provider/preload.mjs']);
  const workerBoot=await boot('DEPOSIT_WORKER'); assert.equal(workerBoot.acknowledgedGeneration,null);
  const workerDb = createDatabaseClient(workerUrl.toString());
  try {
    const control=await workerDb.financialRuntimeControl.findUniqueOrThrow({where:{id:1}});
    await assert.rejects(workerDb.financialRuntimeAdmission.update({where:{bootId:workerBoot.bootId},data:{acknowledgedGeneration:control.generation,acknowledgedAt:new Date(),operatorIdentity:'unsafe-self-approval',evidenceReference:'unsafe-self-approval'}}));
    await assert.rejects(workerDb.financialRuntimeControl.update({where:{id:1},data:{financialWritesFenced:false,version:{increment:1}}}));
    assert.equal((await workerDb.financialRuntimeAdmission.findUniqueOrThrow({where:{bootId:workerBoot.bootId}})).acknowledgedGeneration,null);
  } finally { await workerDb.$disconnect(); }
  assert.equal(await database.depositReceipt.count(),0);
  await fenceFinancialRuntime(database,{operatorIdentity:'isolated-recovery',reason:'Validate both selected current boots'});
  await approve(apiBoot.bootId,[workerBoot.bootId]);
  const bought=await http('/subscriptions/purchases',fixtures.buyerToken,purchaseBody); assert.equal(bought.status,201);
  await until(async()=>await database.depositReceipt.count()===1);
  assert.equal(await database.financialOperation.count({where:{businessNamespace:'p06.deposit'}}),1);
  await fenceFinancialRuntime(database,{operatorIdentity:'isolated-recovery',reason:'Restore invalidates both actual boots'});
  const restored=await http('/subscriptions/purchases',fixtures.buyerToken,purchaseBody); assert.equal(restored.body.code,'FINANCIAL_WRITES_FENCED');
  assert.equal((await http('/subscriptions/me',fixtures.buyerToken)).status,200);
  assert.equal(await database.finalReview.count(),0);
  for(const child of children) child.kill('SIGTERM');
  const exits=await Promise.all(children.map(child=>new Promise(resolve=>child.once('close',resolve))));
  assert.deepEqual(exits,[0,0]);
  process.stdout.write(JSON.stringify({state:'ACTUAL_BOOTS_FENCED',purchaseDenied:true,rewardDenied:true,depositDeniedBeforeAcknowledgement:true,admittedPurchaseAndDeposit:true,restoreInvalidated:true,observationsAvailable:true,cleanShutdown:true,unsafeCredentialsDenied:true,unsafeWorkerCredentialsDenied:fixtures.workerRejections.length}));
} finally {
  for(const child of children) if(child.exitCode===null) child.kill('SIGTERM');
  await database.$disconnect();
}
`;
