const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = 'output/playwright/audit-2026-10-01';
const read = file => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const inventory = read(dir+'/source-inventory.json');
const baseline = read(dir+'/baseline-inventory.json');
const base = new Map(baseline.map(f=>[f.path.replaceAll('\\','/'),f]));
const lines = file => {const text=fs.readFileSync(file,'utf8');return text.split('\n').length-(text.endsWith('\n')?1:0);};
const area = file => {
  if(file.startsWith('apps/web/src/app/'))return 'Web routes/framework';
  if(file.startsWith('apps/web/src/features/admin/'))return 'Admin frontend';
  if(file.startsWith('apps/web/src/features/employee/'))return 'Employee frontend';
  if(file.startsWith('apps/web/src/features/'))return 'Legacy web features';
  if(file.startsWith('apps/web/'))return 'Web shared/transport/styles/config';
  if(file.startsWith('apps/api/'))return 'API';
  if(file.startsWith('packages/contracts/'))return 'Contracts';
  if(file.startsWith('packages/database/'))return 'Database';
  if(file.startsWith('scripts/'))return 'Scripts';
  return 'Shared tooling';
};
const coverage = Object.entries(Object.groupBy(inventory,f=>area(f.path))).map(([name,files])=>({name,files:files.length,lines:files.reduce((n,f)=>n+lines(f.path),0),paths:files.map(f=>f.path)}));
const leads = [
  'features/admin/context/admin-state.context.tsx',
  'features/admin/fixtures/admin.fixtures.ts',
  'features/admin/components/employees/employee-detail-screen.tsx',
  'features/admin/components/referrals/referrals-screen.tsx',
  'features/admin/components/withdrawals/withdrawals-screen.tsx',
  'features/admin/components/settings/admins-list-screen.tsx',
  'features/employee/context/employee-state.context.tsx',
  'features/admin/components/submissions/submissions-screen.tsx',
  'features/admin/components/finance/finance-ledger-screen.tsx',
  'features/admin/components/codes/code-detail-screen.tsx',
  'features/admin/components/tasks/task-form-screen.tsx',
  'features/admin/components/deposits/deposits-screen.tsx',
  'styles/globals.css'
].map(relative=>{const file='apps/web/src/'+relative;return {path:file,before:base.get(file)?.lines??null,after:fs.existsSync(file)?lines(file):null};});
const protectedAreas = ['apps/api/','packages/','scripts/','apps/web/src/services/','apps/web/src/features/auth/','apps/web/src/features/account/','apps/web/src/features/users/','apps/web/src/styles/'];
const protectedFiles = baseline.filter(f=>protectedAreas.some(prefix=>f.path.replaceAll('\\','/').startsWith(prefix))).map(f=>{
  const file=f.path.replaceAll('\\','/');
  return {path:file,unchanged:fs.existsSync(file)&&crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===f.sha256.toLowerCase()};
});
const pixels=read(dir+'/screenshot-comparison.json');
const afterCapture=read(dir+'/after-routes.json');
const after=afterCapture.results;
const before=read(dir+'/before-routes.json').results;
const summary = {
  authoredFiles:inventory.length,coverage,leads,
  protectedFiles,
  screenshots:{pairs:pixels.length,identical:pixels.filter(f=>f.differentPixels===0).length,different:pixels.filter(f=>f.differentPixels!==0).length,sameGeometry:pixels.every(f=>f.beforeSize===f.afterSize),maximumDifferencePercent:Math.max(...pixels.map(f=>f.differencePercent))},
  browser:{after:after.length,before:before.length,afterErrors:after.filter(f=>f.errors?.length).map(f=>({route:f.route,width:f.width,errors:f.errors})),overflow:after.filter(f=>f.overflow),apiRequests:afterCapture.requests},
  managedTimeoutConsumers:inventory.filter(f=>f.imports.some(i=>i.module==='@/shared/hooks/use-managed-timeout')).map(f=>f.path)
};
fs.writeFileSync(dir+'/audit-evidence.json',JSON.stringify(summary,null,2));
fs.writeFileSync(dir+'/COVERAGE.md','# Authored source coverage inventory\n\n'+coverage.map(c=>`## ${c.name}\n\n${c.files} files; ${c.lines} physical lines. Inventory/AST inspection is distinguished from focused manual and runtime review in AUDIT.md.\n\n`+c.paths.map(p=>`- \`${p}\``).join('\n')).join('\n\n')+'\n');
const libraries=read(dir+'/libraries.json');
fs.writeFileSync(dir+'/LIBRARIES.md','# Manifest and import inventory\n\nInstalled metadata was read from workspace-resolved package.json files. This lists 99 manifest entries, including repeated dependencies across workspaces and tooling. It is not 99 distinct runtime libraries. Import consumers come from authored AST imports; CSS imports, command-line tools and generated Prisma imports are supplemented in AUDIT.md. A zero-consumer row alone is not proof that a package is unused.\n\n| Workspace | Package | Requested | Installed | Authored import consumers |\n| --- | --- | --- | --- | --- |\n'+libraries.map(l=>`| ${l.workspace} | ${l.name} | ${l.requested} | ${l.installed??'workspace/local; see manifest'} | ${l.consumers.length?l.consumers.map(c=>'`'+c+'`').join('<br>'):'CSS/CLI/config or no direct AST import; see AUDIT.md'} |`).join('\n')+'\n');
console.log(JSON.stringify({files:inventory.length,coverage:coverage.map(({name,files,lines})=>({name,files,lines})),leads,screenshots:summary.screenshots,protected:protectedFiles.length,protectedChanged:protectedFiles.filter(f=>!f.unchanged),timeoutConsumers:summary.managedTimeoutConsumers.length,browserErrors:summary.browser.afterErrors.map(e=>({route:e.route,width:e.width,count:e.errors.length}))},null,2));
