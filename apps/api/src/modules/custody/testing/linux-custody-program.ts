export const linuxCustodyProgram = String.raw`
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createDatabaseClient } from '@template/database';
import { CustodyKeyStorage, envelopeDigest } from './apps/api/dist/infrastructure/custody/key-storage.js';
import { SshRecoveryStore } from './apps/api/dist/infrastructure/custody/recovery-store.js';
import { parseSignerCustodyEnvironment } from './apps/api/dist/core/config/custody.config.js';
import { CustodyProvisioner } from './apps/api/dist/modules/custody/custody.provisioner.js';
import { CustodyRecovery } from './apps/api/dist/modules/custody/custody-recovery.js';
import { FinancialRuntimeAdmission, acknowledgeFinancialBoot } from './apps/api/dist/modules/custody/runtime-control.js';
import { financialHistoryDigest } from './apps/api/dist/modules/custody/recovery-history.js';
import { assertSessionAuthority } from './apps/api/dist/modules/auth/session-authority.js';
const fixtures = JSON.parse(await readFile('/primary/fixtures.json', 'utf8'));
let stage = 'setup';
function invoke(path, input, environment) {
  const child = spawn('node', [path], { env: environment, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = ''; let diagnostics=''; let bytes = 0;
  child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 262144) child.kill(); else output += chunk.toString(); });
  child.stderr.on('data', chunk=>{ bytes+=chunk.length; if(bytes>262144)child.kill();else diagnostics+=chunk.toString(); });
  const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => { clearTimeout(timer); resolve({ code, output, diagnostics }); }); });
  child.stdin.end(JSON.stringify(input));
  return done;
}
async function main() {
  const base = { ...process.env, NODE_ENV: 'test', CUSTODY_KEY_ID: 'test-v1', CUSTODY_KEY_FILE: '/primary/encryption.key', CUSTODY_RECOVERY_KEY_FILE: '/primary/escrow.key', CUSTODY_STORAGE_ROOT: '/primary/keys', CUSTODY_SSH_CONFIG_FILE: '/primary/ssh_config', CUSTODY_SSH_KNOWN_HOSTS_FILE: '/primary/known_hosts', CUSTODY_RECOVERY_HOST: 'recovery', CUSTODY_OPERATOR_IDENTITY: 'disposable-recovery-owner', TRON_NETWORK: 'TRON_NILE', TRON_TOKEN_CONTRACT: fixtures.token, TRON_EXPECTED_GENESIS_BLOCK_ID: 'ab'.repeat(32), TRON_PROVIDER_URL: 'https://nile.trongrid.io', TRON_PROVIDER_API_KEY_FILE: '/primary/provider.key', TRON_TREASURY_ADDRESS: fixtures.treasury, TRON_MAX_SWEEP_UNITS: '1000000', TRON_ENERGY_FEE_LIMIT_SUN: '100', TRON_MAX_COMPANY_COST_SUN: '200', TRON_MAX_MANUAL_FUNDING_SUN: '300' };
  if (fixtures.step === 'prepare') {
    await mkdir('/primary/keys', { mode: 0o700 });
    await writeFile('/primary/encryption.key', randomBytes(32), { mode: 0o600 });
    await writeFile('/primary/provider.key', 'test-only-provider-sentinel', { mode: 0o600 });
    process.stdout.write(JSON.stringify({ state: 'PREPARED' })); return;
  }
  if (fixtures.step === 'provision') {
    const database = createDatabaseClient(fixtures.ownerUrl);
    try {
      const before = {boots:await database.financialRuntimeAdmission.count(),assignments:await database.depositAddressAssignment.findMany({orderBy:{id:'asc'}}),sweeps:await database.treasurySweep.count(),attempts:await database.transferAttempt.count(),operations:await database.financialOperation.count()};
      for (const rejected of fixtures.signerRejections) {
        stage='unsafe-signer-'+rejected.scenario;
        const unsafeUrl=new URL(rejected.databaseUrl); unsafeUrl.hostname=new URL(fixtures.signerUrl).hostname;
        const denied=await invoke('/opt/oscar/apps/api/dist/signer.js',{}, {...base,DATABASE_URL:unsafeUrl.toString()});
        assert.equal(denied.code,1,rejected.scenario);
        assert.equal(denied.output,'');
        assert.equal(denied.diagnostics,'CUSTODY_STARTUP_UNAVAILABLE\n');
        assert.deepEqual({boots:await database.financialRuntimeAdmission.count(),assignments:await database.depositAddressAssignment.findMany({orderBy:{id:'asc'}}),sweeps:await database.treasurySweep.count(),attempts:await database.transferAttempt.count(),operations:await database.financialOperation.count()},before,rejected.scenario);
        assert.deepEqual(await readdir('/primary/keys'),[]);
      }
    } finally { await database.$disconnect(); }
    stage = 'actual-signer-closed-boot';
    const child = spawn('node', ['/opt/oscar/apps/api/dist/signer.js'], { env: { ...base, DATABASE_URL: fixtures.signerUrl }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stderr.on('data', () => {});
    const boot = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('startup timeout')); }, 10000);
      child.stdout.on('data', chunk => { output += chunk.toString(); if (output.includes('\n')) { clearTimeout(timer); resolve(JSON.parse(output.split('\n')[0])); } });
      child.once('error', reject); child.once('exit', code => { if (!output.includes('\n')) { clearTimeout(timer); reject(new Error('startup exit')); } });
    });
    assert.equal(boot.state, 'REQUESTED');
    const signerDb = createDatabaseClient(fixtures.signerUrl); const operatorDb = createDatabaseClient(fixtures.operatorUrl);
    try {
      const closed = await signerDb.financialRuntimeAdmission.findUniqueOrThrow({ where: { bootId: boot.bootId } });
      assert.equal(closed.acknowledgedGeneration, null);
      stage = 'nonowner-self-approval-denied'; const control=await signerDb.financialRuntimeControl.findUniqueOrThrow({where:{id:1}}); await assert.rejects(signerDb.financialRuntimeAdmission.update({ where: { bootId: boot.bootId }, data: { acknowledgedGeneration: control.generation,acknowledgedAt:new Date(),operatorIdentity:'unsafe-self-approval',evidenceReference:'unsafe-self-approval' } })); await assert.rejects(signerDb.financialRuntimeControl.update({ where: { id: 1 }, data: { financialWritesFenced: false,version:{increment:1} } }));
      child.kill('SIGTERM'); const stopped = await new Promise(resolve => child.once('close', resolve)); assert.equal(stopped, 0);
      stage = 'forced-ssh-provision';
      const config = parseSignerCustodyEnvironment(base, '/opt/oscar');
      const archive = new SshRecoveryStore(config); const keys = new CustodyKeyStorage({ storageRoot: config.storageRoot, currentKeyId: config.keyId, keyFiles: config.keyFiles, projectRoot: '/opt/oscar' });
      stage = 'verify-forced-ssh'; await archive.list();
      stage = 'signer-admission'; const admission = new FinancialRuntimeAdmission(signerDb, 'SIGNER'); await admission.register();
      const cutoff = new Date(); const reference = 'disposable-current-history';
      await acknowledgeFinancialBoot(operatorDb, { bootId: admission.bootId, operatorIdentity: 'test-recovery', reason: 'Known disposable history', evidence: { financialHistoryReference: reference, assignmentInventoryReference: reference, attemptInventoryReference: reference, reconciliationReference: reference, reconciliationCutoff: cutoff, financialHistoryRecoveredThrough: cutoff } });
      let generationCount = 0;
      const provisioner = new CustodyProvisioner(signerDb, { network: 'TRON_NILE', token: { symbol: 'USDT', contract: fixtures.token, decimals: 6 } }, admission, { keys, recovery: archive, provider: { solidifiedFloor: async () => { generationCount++; return { number: 123, id: 'ab'.repeat(32), timestamp: 1000 }; } } });
      stage = 'provision-first'; await provisioner.provisionNext(); stage = 'provision-second'; await provisioner.provisionNext();
      const assignments = await signerDb.depositAddressAssignment.findMany({ orderBy: { id: 'asc' } });
      assert.equal(assignments.length, 2); assert.equal(generationCount, 2);
      assert.equal(assignments.every(row => row.state === 'READY' && row.scanBoundaryTimestamp === 1000n), true);
      assert.equal(new Set(assignments.map(row => row.address)).size, 2);
      stage = 'private-file-symlink';
      const { symlink } = await import('node:fs/promises'); const aliasId = '8eaa27ee-f169-4b81-b364-d9da391f23ae';
      await symlink('/primary/encryption.key', '/primary/keys/' + aliasId + '.1.json');
      await assert.rejects(keys.read(aliasId, 1), error => error.code === 'CUSTODY_STORAGE_UNAVAILABLE');
      await rm('/primary/keys/' + aliasId + '.1.json');
      stage = 'ack-replay-integrity';
      const record = assignments[0]; const envelope = await keys.read(record.keyRecordId, 1);
      const first = await archive.put(envelope); const replay = await archive.put(envelope);
      assert.equal(first.ackId === replay.ackId && first.digest === replay.digest, true);
      const changed = { ...envelope, tag: '11'.repeat(16) };
      await assert.rejects(archive.put(changed), error => error.code === 'CUSTODY_EVIDENCE_CONFLICT');
      const publicInventory = await archive.list(); assert.equal(publicInventory.records.length, 2);
      stage = 'pinned-host-key';
      const differentValidKey = (await readFile('/primary/identity.pub', 'utf8')).trim().split(' ').slice(0, 2).join(' '); await writeFile('/primary/bad-known-hosts', 'recovery ' + differentValidKey + '\n', { mode: 0o600 });
      await assert.rejects(new SshRecoveryStore({ ...config, knownHostsFile: '/primary/bad-known-hosts', maximumAttempts: 1 }).list(), error => error.code === 'RECOVERY_UNAVAILABLE');
      stage = 'secret-free-output';
      assert.equal(output.includes(envelope.ciphertext) || output.includes(keys.decrypt(envelope).privateKey), false);
      process.stdout.write(JSON.stringify({ state: 'PROVISIONED', assignments: 2, actualSignerBootClosed: true, replayStable: true, pinnedHostDenied: true, unsafeSignerCredentialsDenied: fixtures.signerRejections.length }));
    } finally { child.kill('SIGTERM'); await signerDb.$disconnect(); await operatorDb.$disconnect(); }
    return;
  }
  stage = 'primary-host-loss-recovery';
  const evidence = { financialHistoryReference: 'disposable-recovered-history', assignmentInventoryReference: 'independent-ssh-inventory', attemptInventoryReference: 'disposable-empty-attempts', reconciliationReference: 'disposable-reconciled-history', reconciliationCutoff: new Date().toISOString(), financialHistoryRecoveredThrough: new Date().toISOString() };
  if (fixtures.step === 'authority-history') {
    const owner = createDatabaseClient(fixtures.ownerUrl);
    try {
      await writeFile('/primary/recovery-preload.mjs', 'globalThis.fetch='+ (async (url, options) => {
        const request=new URL(url); if(request.origin!=='https://nile.trongrid.io') throw new Error('EGRESS_DENIED');
        const path=request.pathname; const body=JSON.parse(options?.body??'{}');
        let response;
        if(path.startsWith('/v1/')) response={success:true,data:[],meta:{}};
        else if(path.endsWith('triggerconstantcontract')) response={result:{result:true},constant_result:['0'.repeat(63)+'6']};
        else response={blockID:'ab'.repeat(32),block_header:{raw_data:{number:body.num??123,timestamp:body.num===0?1:1000}}};
        return new Response(JSON.stringify(response));
      }).toString(), {mode:0o600});
      for (const [index,status] of ['BANNED','DEACTIVATED','ACTIVE'].entries()) {
        const {userId,sessionId}=fixtures.authorities[index];
        const originalUser = await owner.user.findUniqueOrThrow({where:{id:userId}});
        const originalSession = await owner.authSession.findUniqueOrThrow({where:{id:sessionId}});
        stage='authority-'+status;
        const revokedAt=new Date();
        stage='authority-update-'+status;
        const authoritativeUser=await owner.user.update({where:{id:userId},data:{status,accountVersion:originalUser.accountVersion+(status==='ACTIVE'?0:1),updatedAt:status==='ACTIVE'?originalUser.updatedAt:revokedAt}});
        const authoritativeSession=await owner.authSession.update({where:{id:sessionId},data:{revokedAt:status==='ACTIVE'?revokedAt:originalSession.revokedAt}});
        const through=new Date().toISOString();
        const retainedEvidence={...evidence,reconciliationCutoff:through,financialHistoryRecoveredThrough:through};
        stage='authority-digest-'+status;
        await writeFile('/primary/history.json',JSON.stringify({reference:retainedEvidence.financialHistoryReference,recoveredThrough:through,digest:await financialHistoryDigest(owner)}),{mode:0o600});
        stage='authority-stale-restore-'+status;
        await owner.user.update({where:{id:userId},data:{status:originalUser.status,accountVersion:originalUser.accountVersion,updatedAt:originalUser.updatedAt}});
        // Reinsert the retained snapshot row; ordinary UPDATE cannot undo an immutable revocation.
        if(status==='ACTIVE') await owner.$transaction(async tx => {await tx.authSession.delete({where:{id:sessionId}});await tx.authSession.create({data:originalSession});});
        const boot=new FinancialRuntimeAdmission(owner,'API'); await boot.register();
        stage='authority-denied-ack-'+status;
        const command={operation:'ACKNOWLEDGE',bootId:boot.bootId,reason:'Retained account authority',evidence:retainedEvidence};
        const env={...base,DATABASE_URL:fixtures.operatorUrl,CUSTODY_FINANCIAL_HISTORY_FILE:'/primary/history.json',NODE_OPTIONS:'--import /primary/recovery-preload.mjs'};
        const fenced=await invoke('/opt/oscar/apps/api/dist/modules/custody/recovery.cli.js',{operation:'FENCE',reason:'Simulated stale authority restore'},env);
        assert.equal(fenced.code,0);
        const denied=await invoke('/opt/oscar/apps/api/dist/modules/custody/recovery.cli.js',command,env);
        assert.equal(denied.code,1);
        assert.equal((await owner.financialRuntimeControl.findUniqueOrThrow({where:{id:1}})).financialWritesFenced,true);
        assert.equal((await owner.financialRuntimeAdmission.findUniqueOrThrow({where:{bootId:boot.bootId}})).acknowledgedGeneration,null);
        await owner.user.update({where:{id:userId},data:{status:authoritativeUser.status,accountVersion:authoritativeUser.accountVersion,updatedAt:authoritativeUser.updatedAt}});
        await owner.authSession.update({where:{id:sessionId},data:{revokedAt:authoritativeSession.revokedAt}});
        stage='authority-correct-ack-'+status;
        const admitted=await invoke('/opt/oscar/apps/api/dist/modules/custody/recovery.cli.js',command,env);
        if(admitted.code!==0) throw Object.assign(new Error('Recovery acknowledgement failed'),{code:admitted.code===null?'CUSTODY_TEST_CHILD_TIMEOUT':'CUSTODY_TEST_ACK_REJECTED'});
        assert.equal(admitted.code,0);
        assert.equal(JSON.parse(admitted.output).state,'ACKNOWLEDGED');
        const restoredUser=await owner.user.findUniqueOrThrow({where:{id:userId}});
        const restoredSession=await owner.authSession.findUniqueOrThrow({where:{id:sessionId}});
        assert.throws(()=>assertSessionAuthority(restoredUser,restoredSession,new Date()));
      }
      process.stdout.write(JSON.stringify({state:'AUTHORITY_RESTORE_VERIFIED',staleAcknowledgementsDenied:3,revokedSessionDenied:true}));
    } finally {await owner.$disconnect();}
    return;
  }
  if (fixtures.step === 'rotate') {
    const database = createDatabaseClient(fixtures.operatorUrl);
    try {
    const config = parseSignerCustodyEnvironment({...base,CUSTODY_KEY_FILE:'/primary/escrow.key'},'/opt/oscar');
    const keys = new CustodyKeyStorage({storageRoot:config.storageRoot,currentKeyId:config.keyId,keyFiles:config.keyFiles,projectRoot:'/opt/oscar'});
    const archive = new SshRecoveryStore(config);
    const original = await database.depositAddressAssignment.findUniqueOrThrow({where:{id:fixtures.assignmentId}});
    const retained = await keys.rotate((await archive.get(original.keyRecordId,1)).envelope);
    const retainedBytes = await readFile('/primary/keys/'+original.keyRecordId+'.2.json');
    // Local publication survives interruption before SSH. The retry also survives a real PUT with a lost ACK.
    const lostAck = new CustodyRecovery(database,keys,{get:archive.get.bind(archive),list:archive.list.bind(archive),put:async envelope=>{await archive.put(envelope);throw new Error('TEST_LOST_ROTATION_ACK');}});
    await assert.rejects(lostAck.rotate(fixtures.assignmentId),/TEST_LOST_ROTATION_ACK/);
    assert.equal((await database.depositAddressAssignment.findUniqueOrThrow({where:{id:fixtures.assignmentId}})).keyVersion,1);
    assert.deepEqual(await readFile('/primary/keys/'+original.keyRecordId+'.2.json'),retainedBytes);
    const rotated = await invoke('/opt/oscar/apps/api/dist/modules/custody/recovery.cli.js', { operation: 'ROTATE', assignmentId: fixtures.assignmentId }, { ...base, DATABASE_URL: fixtures.operatorUrl });
    assert.equal(rotated.code, 0);
      const assignment = await database.depositAddressAssignment.findUniqueOrThrow({ where: { id: fixtures.assignmentId } });
      assert.equal(assignment.keyVersion, 2); assert.equal(assignment.address, fixtures.originalAddress);
      assert.equal(assignment.keyEnvelopeDigest,retained.digest);
      assert.deepEqual(await readFile('/primary/keys/'+original.keyRecordId+'.2.json'),retainedBytes);
      assert.equal(keys.decrypt((await archive.get(original.keyRecordId,1)).envelope).privateKey,keys.decrypt(retained.envelope).privateKey);
      process.stdout.write(JSON.stringify({ state: 'ROTATED_ORIGINAL_KEY' }));
    } finally { await database.$disconnect(); }
    return;
  }
  if (fixtures.step === 'missing-inventory') {
    const database = createDatabaseClient(fixtures.operatorUrl);
    try {
      const boot = await database.financialRuntimeAdmission.findFirstOrThrow({ where: { processKind: 'SIGNER' } });
      const denied = await invoke('/opt/oscar/apps/api/dist/modules/custody/recovery.cli.js', { operation: 'ACKNOWLEDGE', bootId: boot.bootId, reason: 'Inventory must be complete', evidence }, { ...base, DATABASE_URL: fixtures.operatorUrl });
      assert.equal(denied.code, 1);
      const control = await database.financialRuntimeControl.findUniqueOrThrow({ where: { id: 1 } });
      assert.equal(control.financialWritesFenced, true);
      process.stdout.write(JSON.stringify({ state: 'MISSING_INVENTORY_DENIED' }));
    } finally { await database.$disconnect(); }
    return;
  }
  const restored = await invoke('/opt/oscar/apps/api/dist/modules/custody/recovery.cli.js', { operation: 'RESTORE', evidence }, { ...base, DATABASE_URL: fixtures.operatorUrl });
  assert.equal(restored.code, 0); assert.equal(JSON.parse(restored.output).state, 'RECOVERED_FENCED');
  const operatorDb = createDatabaseClient(fixtures.operatorUrl);
  try {
    const assignments = await operatorDb.depositAddressAssignment.findMany({ orderBy: { id: 'asc' } });
    assert.equal(assignments.every(row => row.state === 'READY'), true);
    const keys = new CustodyKeyStorage({ storageRoot: '/primary/keys', currentKeyId: 'test-v1', keyFiles: { 'test-v1': '/primary/escrow.key' }, projectRoot: '/opt/oscar' });
    for (const row of assignments) { const envelope = await keys.read(row.keyRecordId, row.keyVersion); const payload = keys.decrypt(envelope); assert.equal(payload.address === row.address && payload.employeeId === row.employeeId && envelopeDigest(envelope) === row.keyEnvelopeDigest, true); }
    const control = await operatorDb.financialRuntimeControl.findUniqueOrThrow({ where: { id: 1 } }); assert.equal(control.financialWritesFenced, true);
    stage = 'missing-escrow-denied';
    const denied = await invoke('/opt/oscar/apps/api/dist/modules/custody/recovery.cli.js', { operation: 'RESTORE', evidence }, { ...base, DATABASE_URL: fixtures.operatorUrl, CUSTODY_RECOVERY_KEY_FILE: '/primary/absent.key' }); assert.equal(denied.code, 1);
    stage = 'fence-without-escrow'; const emergency = await invoke('/opt/oscar/apps/api/dist/modules/custody/recovery.cli.js', { operation: 'FENCE', reason: 'Missing escrow must not prevent an emergency fence' }, { ...base, DATABASE_URL: fixtures.operatorUrl, CUSTODY_RECOVERY_KEY_FILE: '/primary/absent.key', CUSTODY_STORAGE_ROOT: '/primary/absent-directory' }); assert.equal(emergency.code, 0); assert.equal(JSON.parse(emergency.output).state, 'FENCED');
    process.stdout.write(JSON.stringify({ state: 'RESTORED_FENCED', assignments: assignments.length, originalBindingsRetained: true, missingEscrowDenied: true }));
  } finally { await operatorDb.$disconnect(); }
}
main().catch(failure => { const code = typeof failure?.code === 'string' && /^(?:CUSTODY_[A-Z_]+|RECOVERY_[A-Z_]+|P[0-9]{4})$/.test(failure.code) ? failure.code : 'SAFE_FAILURE'; process.stderr.write('CUSTODY_LINUX_ACCEPTANCE_FAILED:' + stage + ':' + code); process.exitCode = 1; });
`;
