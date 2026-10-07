export const linuxTreasuryProgram = String.raw`
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createDatabaseClient } from '@template/database';
import { CustodyKeyStorage } from './apps/api/dist/infrastructure/custody/key-storage.js';
import { SshRecoveryStore } from './apps/api/dist/infrastructure/custody/recovery-store.js';
import { parseSignerCustodyEnvironment } from './apps/api/dist/core/config/custody.config.js';
import { CustodyRecovery } from './apps/api/dist/modules/custody/custody-recovery.js';
import { TreasuryRecovery } from './apps/api/dist/modules/treasury/treasury-recovery.js';
import { signedAttemptSchema } from './apps/api/dist/modules/treasury/treasury-attempts.js';
import { FinancialRuntimeAdmission } from './apps/api/dist/modules/custody/runtime-control.js';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { acknowledgeFinancialBoot } from './apps/api/dist/modules/custody/runtime-control.js';
const f = JSON.parse(await readFile('/primary/fixtures.json', 'utf8'));
const base = { CUSTODY_OPERATOR_IDENTITY: 'disposable-recovery-owner', CUSTODY_KEY_ID: 'test-only', CUSTODY_KEY_FILE: '/primary/encryption.key', CUSTODY_STORAGE_ROOT: '/primary/keys', CUSTODY_SSH_CONFIG_FILE: '/primary/ssh_config', CUSTODY_SSH_KNOWN_HOSTS_FILE: '/primary/known_hosts', CUSTODY_RECOVERY_HOST: 'recovery' };
if (f.step === 'fair-signer') {
  await mkdir('/primary/keys',{mode:0o700});
  await writeFile('/primary/encryption.key',Buffer.from(f.key,'base64'),{mode:0o600});
  await writeFile('/primary/provider.key','isolated-provider',{mode:0o600});
  const config=parseSignerCustodyEnvironment(base,'/opt/oscar');
  const keys=new CustodyKeyStorage({storageRoot:config.storageRoot,currentKeyId:config.keyId,keyFiles:config.keyFiles,projectRoot:'/opt/oscar'});
  const archive=new SshRecoveryStore(config);
  for(const envelope of f.envelopes){await keys.storeRecord(envelope);await archive.put(envelope);}
  await writeFile('/primary/fair-preload.mjs', 'import {writeFileSync} from "node:fs"; const fixed='+JSON.stringify(f.now)+'; const NativeDate=Date; globalThis.Date=class extends NativeDate {constructor(...args){if(args.length===0)super(fixed);else super(...args);}static now(){return new NativeDate(fixed).getTime();}}; const counts={}; globalThis.fetch='+ (async(url,options)=>{
    const request=new URL(url); if(request.origin!=='https://nile.trongrid.io')throw new Error('EGRESS_DENIED');
    const path=request.pathname; counts[path]=(counts[path]??0)+1; writeFileSync('/primary/egress-counts.json',JSON.stringify(counts),{mode:0o600});
    const body=JSON.parse(options?.body??'{}');let response;
    if(path.endsWith('getblockbynum'))response={blockID:'ab'.repeat(32),block_header:{raw_data:{number:body.num,timestamp:body.num===0?1:1000}}};
    else if(path.endsWith('getnowblock'))response={blockID:'ab'.repeat(32),block_header:{raw_data:{number:100,timestamp:1000}}};
    else if(path.endsWith('getaccountresource'))response={EnergyLimit:100000,EnergyUsed:0};
    else if(path.endsWith('getchainparameters'))response={chainParameter:[{key:'getEnergyFee',value:100},{key:'getTransactionFee',value:1}]};
    else if(path.endsWith('getaccount'))response={address:body.address,balance:0,owner_permission:{threshold:1,keys:[{address:body.address,weight:1}]}};
    else if(path==='/walletsolidity/triggerconstantcontract')response={result:{result:true},constant_result:[body.function_selector==='decimals()'?'0'.repeat(63)+'6':(100000000n).toString(16).padStart(64,'0')]};
    else if(path==='/wallet/triggerconstantcontract')response={result:{result:true},energy_used:1,transaction:{ret:[{contractRet:'SUCCESS'}]},logs:[{address:body.contract_address.slice(2).toLowerCase(),topics:['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',body.owner_address.slice(2).toLowerCase().padStart(64,'0'),body.parameter.slice(0,64).toLowerCase()],data:body.parameter.slice(64)}]};
    else throw new Error('UNAUTHORIZED_SIGN_OR_BROADCAST');
    return new Response(JSON.stringify(response));
  }).toString(),{mode:0o600});
  const child=spawn('node',['/opt/oscar/apps/api/dist/signer.js'],{env:{...process.env,...base,...f.environment,DATABASE_URL:f.signerUrl,NODE_OPTIONS:'--import /primary/fair-preload.mjs'},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>262144)child.kill('SIGKILL');});child.stderr.on('data',()=>{});
  const closed=new Promise(resolve=>child.once('close',resolve));
  const database=createDatabaseClient(f.ownerUrl);
  async function until(work){const deadline=Date.now()+20000;while(Date.now()<deadline){const observed=await work();if(observed)return observed;await delay(20);}throw new Error('FAIR_SIGNER_TIMEOUT');}
  try {
    const boot=await until(async()=>{const line=output.split('\n')[0];return line?JSON.parse(line):null;});
    assert.equal(boot.state,'REQUESTED');
    const NativeDate=Date;
    globalThis.Date=class extends NativeDate{constructor(...args){if(args.length===0)super(f.now);else super(...args);}static now(){return new NativeDate(f.now).getTime();}};
    try {
      const cutoff=new Date();
      await acknowledgeFinancialBoot(database,{bootId:boot.bootId,operatorIdentity:'test-only',reason:'Known isolated policy fixture',evidence:{financialHistoryReference:'test-only',assignmentInventoryReference:'test-only',attemptInventoryReference:'test-only',reconciliationReference:'test-only',reconciliationCutoff:cutoff,financialHistoryRecoveredThrough:cutoff}});
    } finally {globalThis.Date=NativeDate;}
    let attempt;
    try {attempt=await until(async()=>{const row=await database.transferAttempt.findUnique({where:{sweepId:f.validId}});return row?.lastErrorCode==='TREASURY_RESOURCE_SHORTFALL'?row:null;});}
    catch(failure){const row=await database.transferAttempt.findUnique({where:{sweepId:f.validId}});const conflicts=await database.treasurySweep.count({where:{lastErrorCode:'TREASURY_POLICY_CONFLICT'}});process.stderr.write(JSON.stringify({state:row?.state??null,code:row?.lastErrorCode??null,conflicts,events:output.split('\n').filter(Boolean).map(line=>{const parsed=JSON.parse(line);return {event:parsed.event,code:parsed.code};})}));throw failure;}
    assert.equal(attempt.state,'SIGNING');
    assert.equal(await database.transferAttempt.count(),1);
    const conflicts=await database.treasurySweep.findMany({where:{id:{in:f.conflictIds}}});
    assert.equal(conflicts.length,20);assert.equal(conflicts.every(row=>row.currentAttemptId===null&&row.lastErrorCode==='TREASURY_POLICY_CONFLICT'&&row.nextAttemptAt.getTime()===new Date(f.now).getTime()+300000),true);
    assert.equal(output.includes('"event":"EVIDENCE_CONFLICT"'),true);
    child.kill('SIGTERM');assert.equal(await closed,0);
    const counts=JSON.parse(await readFile('/primary/egress-counts.json','utf8'));assert.equal(counts['/wallet/triggersmartcontract'],undefined);assert.equal(counts['/wallet/broadcasttransaction'],undefined);
    assert.equal(await database.financialOperation.count(),0);assert.equal(await database.depositReceipt.count(),0);
    process.stdout.write(JSON.stringify({state:'FAIR_SIGNER_PROGRESS',policyConflicts:20,validSourceWaitingForResources:true,unauthorizedSigningDenied:true}));
  } finally {if(child.exitCode===null){child.kill('SIGTERM');await closed;}await database.$disconnect();}
  process.exit(0);
}
if (f.step === 'archive') {
  await mkdir('/primary/keys', {mode: 0o700});
  await writeFile('/primary/encryption.key', Buffer.from(f.key, 'base64'), {mode: 0o600});
}
const config = parseSignerCustodyEnvironment({...base, CUSTODY_KEY_FILE: f.step === 'archive' ? '/primary/encryption.key' : '/primary/escrow.key'}, '/opt/oscar');
const archive = new SshRecoveryStore(config);
const keys = new CustodyKeyStorage({storageRoot: config.storageRoot, currentKeyId: config.keyId, keyFiles: config.keyFiles, projectRoot: '/opt/oscar'});
if (f.step === 'archive') {
  for (const envelope of f.envelopes) {
    await keys.storeRecord(envelope);
    const ack = await archive.put(envelope);
    assert.equal((await archive.get(envelope.objectId, 1)).digest, ack.digest);
  }
  assert.equal((await archive.list(undefined, 'SIGNED_ATTEMPT')).records.length, 1);
  assert.equal((await archive.list(undefined, 'BROADCAST_INTENT')).records.length, 1);
  process.stdout.write(JSON.stringify({state:'ARCHIVED'}));
} else {
  const db = createDatabaseClient(f.operatorUrl);
  try {
    await new CustodyRecovery(db, keys, archive).restoreInventory();
    assert.equal(await new TreasuryRecovery(db, keys, archive).restoreInventory(), 1);
    const attempt = await db.transferAttempt.findUniqueOrThrow({where:{sweepId:f.sweepId}});
    assert.equal(attempt.transactionId, f.transactionId);
    assert.equal(attempt.state, 'UNKNOWN');
    assert.equal(attempt.broadcastIntentId, f.broadcastIntentId);
    const retained = signedAttemptSchema.parse(keys.openRecord((await archive.get(attempt.id,1)).envelope));
    assert.equal(retained.transaction.txID, f.transactionId);
    const boot = new FinancialRuntimeAdmission(db, 'SIGNER');
    await boot.register();
    // Restoring authority never acknowledges a new boot or opens dispatch.
    await assert.rejects(db.$transaction(tx => boot.assertDispatchAdmission(tx)));
    assert.equal((await db.financialRuntimeControl.findUniqueOrThrow({where:{id:1}})).financialWritesFenced, true);
    process.stdout.write(JSON.stringify({state:'RESTORED_FENCED',transactionId:attempt.transactionId}));
  } finally { await db.$disconnect(); }
}
`;
