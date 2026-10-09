// HTTP and clocks are controlled. Built runtimes, protobuf/signature validation,
// PostgreSQL authority, protected files and the pinned SSH archive execute normally.
export const linuxPayoutArchiveClock = String.raw`
const fs=require('node:fs');
const instant=Number(process.argv[1]);
if(!Number.isFinite(instant))throw new Error('MISSING_TEST_CLOCK');
const offset=instant-Date.now();
fs.writeFileSync('/opt/oscar/p08-test-clock.mjs',"const RealDate=Date;function ControlledDate(...args){if(new.target)return new RealDate(...(args.length?args:[ControlledDate.now()]));return new RealDate(ControlledDate.now()).toString();}Object.setPrototypeOf(ControlledDate,RealDate);ControlledDate.prototype=RealDate.prototype;ControlledDate.now=()=>RealDate.now()+"+offset+";globalThis.Date=ControlledDate;",{mode:0o644});
const path='/home/escrow/.ssh/authorized_keys';
fs.writeFileSync(path,fs.readFileSync(path,'utf8').replaceAll('/usr/bin/env CUSTODY_', '/usr/bin/env NODE_OPTIONS=--import=/opt/oscar/p08-test-clock.mjs CUSTODY_'));
`;

export const linuxPayoutProvider = String.raw`
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire('/opt/oscar/package.json');
const {utils}=require('tronweb');
const {createDatabaseClient}=await import(require.resolve('@template/database'));
import {CustodyKeyStorage} from '/opt/oscar/apps/api/dist/infrastructure/custody/key-storage.js';
import {SshRecoveryStore} from '/opt/oscar/apps/api/dist/infrastructure/custody/recovery-store.js';
import {parseSignerCustodyEnvironment} from '/opt/oscar/apps/api/dist/core/config/custody.config.js';
const root=process.env.CUSTODY_STORAGE_ROOT.replace(/\/keys$/,'');
const timestamp=Number(process.env.P08_PROVIDER_TIMESTAMP);
// Test-only preload: align every built child with the disposable SQL clock.
const RealDate=Date;
const clockTimestamp=Number(process.env.P08_CLOCK_TIMESTAMP);
const hostTimestamp=Number(process.env.P08_CLOCK_HOST_TIMESTAMP);
if(!Number.isFinite(clockTimestamp)||!Number.isFinite(hostTimestamp))throw new Error('MISSING_TEST_CLOCK');
const clockOffset=clockTimestamp-hostTimestamp;
function ControlledDate(...args){
  if(new.target)return new RealDate(...(args.length?args:[ControlledDate.now()]));
  return new RealDate(ControlledDate.now()).toString();
}
Object.setPrototypeOf(ControlledDate,RealDate);
ControlledDate.prototype=RealDate.prototype;
ControlledDate.now=()=>Math.floor(RealDate.now()+clockOffset);
globalThis.Date=ControlledDate;
if(process.env.P08_CRASH_BEFORE_BROADCAST_RECORD==='YES'){
  const obtain=CustodyKeyStorage.prototype.obtainRecord;
  CustodyKeyStorage.prototype.obtainRecord=async function(envelope){
    if(envelope.type==='PAYOUT_BROADCAST_INTENT'){
      await writeFile('/primary/broadcast-gap.json',JSON.stringify({objectId:envelope.objectId}),{mode:0o600});
      await new Promise(()=>{});
    }
    return obtain.call(this,envelope);
  };
}
const initial={number:100,id:'ab'.repeat(32),timestamp};
const final={number:101,id:'cd'.repeat(32),timestamp:timestamp+1};
let expected=process.env.P08_CANONICAL_TX_ID;
const retryOriginal=process.env.P08_RETRY_ORIGINAL==='YES';
let rejectedBody=null;
const block=(floor,members=[])=>({blockID:floor.id,block_header:{raw_data:{number:floor.number,timestamp:floor.timestamp}},transactions:members.map(txID=>({txID}))});
async function retained(){
  const db=createDatabaseClient(process.env.DATABASE_URL);
  try{
    const attempt=await db.withdrawalAttempt.findUniqueOrThrow({where:{withdrawalId:process.env.P08_REQUEST_ID}});
    const config=parseSignerCustodyEnvironment(process.env,'/opt/oscar');
    const keys=new CustodyKeyStorage({storageRoot:config.storageRoot,currentKeyId:config.keyId,keyFiles:config.keyFiles,projectRoot:'/opt/oscar'});
    const archive=new SshRecoveryStore(config);
    const envelope=await keys.readRecord(attempt.signedRecordId)??(await archive.get(attempt.signedRecordId,1)).envelope;
    return keys.openRecord(envelope).transaction;
  } finally {await db.$disconnect();}
}
async function record(kind,id){
  const path=root+'/network-counts.json';let counts={builds:0,sends:[]};
  try{counts=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(kind==='build')counts.builds++;else counts.sends.push(id);
  await writeFile(path,JSON.stringify(counts),{mode:0o600});
}
async function finalFloor(){return expected?{...final,timestamp:(await retained()).raw_data.timestamp+1}:final;}
globalThis.fetch=async(url,options)=>{
  const request=new URL(url);if(request.origin!=='https://nile.trongrid.io')throw new Error('EGRESS_DENIED');
  const path=request.pathname;const body=JSON.parse(options?.body??'{}');let response;
  if(path.endsWith('getblockbynum'))response=block(body.num===0?{...initial,number:0,timestamp:1}:body.num===100?initial:await finalFloor(),expected?[expected]:[]);
  else if(path.endsWith('getnowblock'))response=block(expected?await finalFloor():initial,expected?[expected]:[]);
  else if(path.endsWith('getaccountresource'))response={EnergyLimit:100000,EnergyUsed:0};
  else if(path.endsWith('getchainparameters'))response={chainParameter:[{key:'getEnergyFee',value:100},{key:'getTransactionFee',value:1}]};
  else if(path.endsWith('getaccount'))response={address:body.address,balance:10000000,owner_permission:{threshold:1,keys:[{address:body.address,weight:1}]}};
  else if(path==='/walletsolidity/triggerconstantcontract')response={result:{result:true},constant_result:[body.function_selector==='decimals()'?'0'.repeat(63)+'6':(500000000n).toString(16).padStart(64,'0')]};
  else if(path==='/wallet/triggerconstantcontract')response={result:{result:true},energy_used:1,transaction:{ret:[{contractRet:'SUCCESS'}]},logs:[{address:body.contract_address.slice(2).toLowerCase(),topics:['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',body.owner_address.slice(2).toLowerCase().padStart(64,'0'),body.parameter.slice(0,64).toLowerCase()],data:body.parameter.slice(64)}]};
  else if(path==='/wallet/triggersmartcontract'){
    const now=Date.now();const transaction={visible:false,txID:'',raw_data_hex:'',raw_data:{contract:[{type:'TriggerSmartContract',parameter:{type_url:'type.googleapis.com/protocol.TriggerSmartContract',value:{owner_address:body.owner_address,contract_address:body.contract_address,data:'a9059cbb'+body.parameter}}}],ref_block_bytes:'0064',ref_block_hash:'ab'.repeat(8),timestamp:now,expiration:now+600000,fee_limit:body.fee_limit}};
    const pb=utils.transaction.txJsonToPb(transaction);transaction.raw_data_hex=utils.transaction.txPbToRawDataHex(pb).toLowerCase();transaction.txID=utils.transaction.txPbToTxID(pb).replace(/^0x/,'');
    await record('build');response={result:{result:true},transaction};
  }
  else if(path==='/wallet/broadcasttransaction'){
    if(retryOriginal){
      const serialized=JSON.stringify(body);
      if(rejectedBody===null){rejectedBody=serialized;throw new TypeError('CONTROLLED_FAILURE_BEFORE_ACCEPTANCE');}
      if(serialized!==rejectedBody)throw new Error('ORIGINAL_PAYOUT_BYTES_CHANGED');
      expected=body.txID;
    }
    await record('send',body.txID);throw new TypeError('CONTROLLED_LOST_BROADCAST_REPLY');
  }
  else if(path.endsWith('gettransactionbyid'))response=expected&&body.value===expected?{...await retained(),ret:[{contractRet:'SUCCESS'}]}:{};
  else if(path.endsWith('gettransactioninfobyid')){
    if(!expected||body.value!==expected)response={};
    else{
      const signed=await retained();const transfer=signed.raw_data.contract[0].parameter.value;
      response={id:expected,blockNumber:final.number,blockTimeStamp:(await finalFloor()).timestamp,fee:11,receipt:{result:'SUCCESS'},log:[{address:transfer.contract_address.slice(2).toLowerCase(),topics:['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',transfer.owner_address.slice(2).toLowerCase().padStart(64,'0'),transfer.data.slice(8,72)],data:transfer.data.slice(72)}]};
      try{if(await readFile('/primary/receipt-conflict','utf8')==='MALFORMED')response.log[0].data='invalid-receipt-data';}catch(error){if(error.code!=='ENOENT'&&error.code!=='EACCES')throw error;}
    }
  }else throw new Error('UNAUTHORIZED_PROVIDER_REQUEST');
  return new Response(JSON.stringify(response));
};
`;

export const linuxPayoutProgram = String.raw`
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open,access,lstat} from 'node:fs/promises';
import {userInfo} from 'node:os';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const user=process.getuid()===1000?'custody':userInfo().username;
const f=JSON.parse(await readFile(user==='custody'?'/primary/fixtures.json':'/home/'+user+'/fixtures.json','utf8'));
const root=user==='custody'?'/primary':user==='recoveryowner'?'/operator':'/home/'+user;
const base={NODE_ENV:'test',CUSTODY_OPERATOR_IDENTITY:'isolated-payout-operator',CUSTODY_KEY_ID:'test-only',CUSTODY_KEY_FILE:root+'/encryption.key',CUSTODY_RECOVERY_KEY_FILE:'/operator/encryption.key',CUSTODY_STORAGE_ROOT:root+'/keys',CUSTODY_SSH_CONFIG_FILE:root+'/ssh_config',CUSTODY_SSH_KNOWN_HOSTS_FILE:root+'/known_hosts',CUSTODY_RECOVERY_HOST:'recovery'};
const environment={...process.env,...base,...f.environment,DATABASE_URL:f.databaseUrl,TRON_PROVIDER_API_KEY_FILE:root+'/provider.key',P08_PROVIDER_TIMESTAMP:String(f.timestamp),P08_CLOCK_TIMESTAMP:String(f.clockTimestamp),P08_CLOCK_HOST_TIMESTAMP:String(f.clockHostTimestamp),P08_REQUEST_ID:f.requestId,...(f.transactionId?{P08_CANONICAL_TX_ID:f.transactionId}:{}),...(f.retryOriginal?{P08_RETRY_ORIGINAL:'YES'}:{}),...(f.crashBeforeBroadcastRecord?{P08_CRASH_BEFORE_BROADCAST_RECORD:'YES'}:{}),NODE_OPTIONS:'--import '+root+'/provider-preload.mjs'};
async function counts(){try{return JSON.parse(await readFile('/primary/network-counts.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return {builds:0,sends:[]};}}
async function until(work){const deadline=Date.now()+60000;while(Date.now()<deadline){const found=await work();if(found)return found;await delay(50);}throw new Error('PAYOUT_PROCESS_TIMEOUT');}
async function invoke(entry,input){
  const child=spawn('node',['/opt/oscar/apps/api/dist/'+entry],{env:environment,stdio:['pipe','pipe','pipe']});let output='';let diagnostics='';
  child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>262144)child.kill('SIGKILL');});child.stderr.on('data',chunk=>{diagnostics+=chunk.toString();if(diagnostics.length>262144)child.kill('SIGKILL');});
  const closed=new Promise(resolve=>child.once('close',resolve));child.stdin.end(JSON.stringify(input));
  const code=await closed;return {code,output,diagnostics};
}
if(f.step==='PREPARE'){
  await mkdir('/primary/keys',{mode:0o700});await writeFile('/primary/encryption.key',Buffer.from(f.encryptionKey,'base64'),{mode:0o600});
  process.stdout.write(JSON.stringify({state:'PREPARED'}));
}else if(f.step==='PRIVATE_ACCESS'){
  for(const path of f.deniedPaths)await assert.rejects(access(path),error=>error.code==='EACCES');
  process.stdout.write(JSON.stringify({state:'ACCESS_DENIED',user}));
}else if(f.step==='PUBLIC_PROCESS_OUTAGE'){
  const {createDatabaseClient}=await import('@template/database');const db=createDatabaseClient(f.databaseUrl);
  const kind=user==='worker'?'DEPOSIT_WORKER':'API';
  const before=await db.financialRuntimeAdmission.findMany({where:{processKind:kind},select:{bootId:true}});
  const previous=new Set(before.map(boot=>boot.bootId));
  await writeFile(root+'/provider.key','isolated-provider',{mode:0o600});await writeFile(root+'/provider-preload.mjs',f.preload,{mode:0o600});
  environment.WITHDRAWAL_REDIS_URL='redis://127.0.0.1:1/0';environment.WITHDRAWAL_PRODUCER_TIMEOUT_MS='100';environment.AUTH_JWT_SECRET='disposable-linux-api-authentication-key';environment.PROOF_STORAGE_ROOT='/home/api/proofs';
  let diagnostics='';
  const child=spawn('node',['/opt/oscar/apps/api/dist/'+(user==='worker'?'worker.js':'server.js')],{env:environment,stdio:['ignore','pipe','pipe']});
  const capture=chunk=>{diagnostics=(diagnostics+chunk.toString()).slice(-65536);};
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  const closed=new Promise(resolve=>child.once('close',resolve));
  try{
    const boot=await until(async()=>{
      if(child.exitCode!==null){
        const codes=[...new Set(diagnostics.match(/\b(?:ERR_[A-Z_]+|MODULE_NOT_FOUND|EACCES|(?:CUSTODY|TRON|FINANCIAL|PAYOUT|API_DATABASE|PROOF)_[A-Z_]+)\b/g)??[])];
        const types=[...new Set(diagnostics.match(/\b[A-Za-z]+Error\b/g)??[])];
        const paths=[...new Set([...diagnostics.matchAll(/"path":\s*\[\s*"([A-Z_]+)"/g)].map(match=>match[1]))];
        const missingExport=diagnostics.match(/does not provide an export named ['"]([A-Za-z0-9_]+)['"]/);
        throw new Error('PUBLIC_PROCESS_EXITED '+JSON.stringify({kind,exitCode:child.exitCode,codes,types,paths,missingExport:missingExport?.[1]}));
      }
      return (await db.financialRuntimeAdmission.findMany({where:{processKind:kind}})).find(boot=>!previous.has(boot.bootId));
    });
    assert.equal(boot.acknowledgedGeneration,null);
    if(child.exitCode===null)child.kill('SIGTERM');await closed;
    process.stdout.write(JSON.stringify({state:'PUBLIC_PROCESS_STOPPED',user,bootId:boot.bootId}));
  }finally{if(child.exitCode===null){child.kill('SIGKILL');await closed;}await db.$disconnect();}
}else if(f.step==='PROVISION'){
  await writeFile(root+'/provider.key','isolated-provider',{mode:0o600});await writeFile(root+'/provider-preload.mjs',f.preload,{mode:0o600});
  const result=await invoke('modules/treasury/treasury.cli.js',{operation:'PROVISION_PAYOUT_KEY',privateKey:f.privateKey,reason:'Disposable Linux payout source'});
  assert.equal(result.code,0,result.diagnostics);const outcome=JSON.parse(result.output);assert.equal(outcome.state,'RECOVERY_ACKED');
  assert.equal((await lstat(root+'/encryption.key')).mode&0o777,0o600);
  process.stdout.write(JSON.stringify(outcome));
}else if(f.step==='START_SIGNER'){
  await writeFile('/primary/provider.key','isolated-provider',{mode:0o600});await writeFile('/primary/provider-preload.mjs',f.preload,{mode:0o600});
  const stdout=await open('/primary/signer.stdout','w',0o600);const stderr=await open('/primary/signer.stderr','w',0o600);
  try{
    const child=spawn('node',['/opt/oscar/apps/api/dist/signer.js'],{env:environment,detached:true,stdio:['ignore',stdout.fd,stderr.fd]});child.unref();
    await writeFile('/primary/signer.pid',String(child.pid),{mode:0o600});
    const boot=await until(async()=>{const line=(await readFile('/primary/signer.stdout','utf8')).split('\n')[0];return line?JSON.parse(line):null;});
    assert.equal(boot.state,'REQUESTED');process.stdout.write(JSON.stringify({state:'REQUESTED',bootId:boot.bootId}));
  }finally{await stdout.close();await stderr.close();}
}else if(f.step==='WAIT_BROADCAST_GAP'){
  const marker=await until(async()=>{try{return JSON.parse(await readFile('/primary/broadcast-gap.json','utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}});
  assert.match(marker.objectId,/^[0-9a-f-]{36}$/);
  const {parseSignerCustodyEnvironment}=await import('/opt/oscar/apps/api/dist/core/config/custody.config.js');
  const {SshRecoveryStore}=await import('/opt/oscar/apps/api/dist/infrastructure/custody/recovery-store.js');
  const archive=new SshRecoveryStore(parseSignerCustodyEnvironment(base,'/opt/oscar'));
  await assert.rejects(access('/primary/keys/'+marker.objectId+'.1.json'),error=>error.code==='ENOENT');
  await assert.rejects(archive.get(marker.objectId,1),error=>error.code==='RECOVERY_NOT_FOUND');
  process.stdout.write(JSON.stringify({state:'PRE_FILE_GAP',objectId:marker.objectId}));
}else if(f.step==='WAIT_RECORD'){
  assert.match(f.recordId,/^[0-9a-f-]{36}$/);
  if(f.archived){
    const {parseSignerCustodyEnvironment}=await import('/opt/oscar/apps/api/dist/core/config/custody.config.js');
    const {SshRecoveryStore}=await import('/opt/oscar/apps/api/dist/infrastructure/custody/recovery-store.js');
    const archive=new SshRecoveryStore(parseSignerCustodyEnvironment(base,'/opt/oscar'));
    await until(async()=>{try{await archive.get(f.recordId,1);return true;}catch(error){if(error.code==='RECOVERY_NOT_FOUND')return false;throw error;}});
  }else await until(async()=>{try{await access('/primary/keys/'+f.recordId+'.1.json');return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}});
  process.stdout.write(JSON.stringify({state:'RETAINED'}));
}else if(f.step==='RECEIPT_EVIDENCE'){
  await writeFile('/primary/receipt-conflict',f.malformed?'MALFORMED':'VALID',{mode:0o600});
  process.stdout.write(JSON.stringify({state:'EVIDENCE_SET'}));
}else if(f.step==='READ_SIGNER_DIAGNOSTICS'){
  const pid=Number(await readFile('/primary/signer.pid','utf8'));
  assert.doesNotMatch(await readFile('/proc/'+pid+'/stat','utf8'),/\) Z /);
  const stderr=await readFile('/primary/signer.stderr','utf8');assert.doesNotMatch(stderr,/CUSTODY_STARTUP_UNAVAILABLE/);
  const output=await readFile('/primary/signer.stdout','utf8');assert.doesNotMatch(output,/raw_data|signature|privateKey|proofHash|databaseUrl|password/);
  const events=output.split('\n').filter(Boolean).map(line=>{const event=JSON.parse(line);return {event:event.event,state:event.state,code:event.code,withdrawalId:event.withdrawalId,ageMs:event.ageMs};});
  process.stdout.write(JSON.stringify({state:'RUNNING',events}));
}else if(f.step==='READ_COUNTS'){
  process.stdout.write(JSON.stringify(await counts()));
}else if(f.step==='STOP_SIGNER'){
  const pid=Number(await readFile('/primary/signer.pid','utf8'));
  const alive=async()=>{try{const stat=await readFile('/proc/'+pid+'/stat','utf8');return !/\) Z /.test(stat);}catch(error){if(error.code==='ENOENT')return false;throw error;}};
  if(await alive())process.kill(pid,f.crash?'SIGKILL':'SIGTERM');await until(async()=>!await alive());
  const diagnostics=f.diagnostics?{crashed:(await readFile('/primary/signer.stderr','utf8')).includes('CUSTODY_STARTUP_UNAVAILABLE'),events:(await readFile('/primary/signer.stdout','utf8')).split('\n').filter(Boolean).map(line=>{const event=JSON.parse(line);return {event:event.event,state:event.state,code:event.code};})}:{};
  process.stdout.write(JSON.stringify({state:'STOPPED',...await counts(),...diagnostics}));
}else if(f.step==='ACKNOWLEDGE'||f.step==='RESTORE'){
  await writeFile(root+'/provider.key','isolated-provider',{mode:0o600});await writeFile(root+'/provider-preload.mjs',f.preload,{mode:0o600});
  const cutoff=new Date(f.clockTimestamp).toISOString();const reference='isolated-linux-payout-history';
  await writeFile('/operator/history.json',JSON.stringify({reference,recoveredThrough:cutoff,digest:f.historyDigest}),{mode:0o600});environment.CUSTODY_FINANCIAL_HISTORY_FILE='/operator/history.json';
  const evidence={financialHistoryReference:reference,assignmentInventoryReference:'pinned-independent-archive',attemptInventoryReference:'payout-original',reconciliationReference:'controlled-http-boundary',reconciliationCutoff:cutoff,financialHistoryRecoveredThrough:cutoff};
  const result=await invoke('modules/custody/recovery.cli.js',f.step==='RESTORE'?{operation:'RESTORE',evidence}:{operation:'ACKNOWLEDGE',bootId:f.bootId,reason:'Actual isolated payout recovery',evidence});
  if(f.reject){assert.notEqual(result.code,0);assert.match(result.diagnostics,/"event":"(?:EVIDENCE_CONFLICT|RECOVERY_UNAVAILABLE)"/);assert.doesNotMatch(result.diagnostics,/raw_data|signature|privateKey|proofHash|databaseUrl|password/);process.stdout.write(JSON.stringify({state:'REJECTED_FENCED'}));}
  else{
    assert.equal(result.code,0,result.diagnostics);
    const state=f.step==='RESTORE'?'RECOVERED_FENCED':'ACKNOWLEDGED';assert.equal(JSON.parse(result.output).state,state);
    if(f.step==='ACKNOWLEDGE'){const resume=await invoke('modules/treasury/treasury.cli.js',{operation:'PAUSE',action:'RESUME',reason:'Admitted original payout only'});assert.equal(resume.code,0);}
    process.stdout.write(JSON.stringify({state}));
  }
}else throw new Error('UNKNOWN_TEST_STEP');
`;
