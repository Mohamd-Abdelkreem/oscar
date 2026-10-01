const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.resolve('apps/web/node_modules/typescript'));
const root = 'apps/web/src/features/admin';
const contextPath = root + '/context/admin-state.context.tsx';
const source = fs.readFileSync(contextPath,'utf8');
const ast = ts.createSourceFile(contextPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const provider = ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text==='AdminStateProvider');
const contract = ast.statements.find(s => ts.isInterfaceDeclaration(s));
const imports = ast.statements.filter(ts.isImportDeclaration);
const domainImports = imports.filter(s => !/react|fixtures/.test(s.moduleSpecifier.text));
const domainTypes = domainImports.filter(s => s.importClause?.isTypeOnly).map(s=>s.getText(ast)).join('\n');
const stateNames = ['employees','packages','tasks','codes','codeUsages','submissions','deposits','withdrawals','financeTransactions','referralMembers','referralCommissions','auditLogs','settings','admins'];
const setterNames = stateNames.map(n=>'set'+n[0].toUpperCase()+n.slice(1));
const possible = [...stateNames,...setterNames,'addAuditLog'];
const groups = {
  'task-code': ['isTaskUnlockedForEmployee','unlockTaskWithCode','createCode','toggleCodeStatus','getDistinctCodeUsersCount','getDistinctTaskUnlocksCount'],
  'task': ['createTask','updateTask','toggleTaskStatus'],
  'submission-review': ['approveSubmission','rejectSubmission'],
  'employee-restriction': ['toggleEmployeeAccountStatus','toggleEmployeeTaskRestriction','toggleEmployeeWithdrawalRestriction'],
  'employee-account': ['adjustEmployeeBalance','updateEmployeeWithdrawalAddress','deleteEmployeeAccount'],
  'package': ['updatePackage'],
  'deposit': ['manualCreditDeposit'],
  'withdrawal': ['holdWithdrawal','releaseWithdrawal','rejectWithdrawal','completeWithdrawal','extendWithdrawalSchedule'],
  'settings': ['updateSettings','createAdminAccount','toggleAdminStatus','updateAdminAccount'],
};
const statements = provider.body.statements;
const actions = new Map(statements.filter(ts.isVariableStatement).flatMap(s => s.declarationList.declarations
  .filter(d=>ts.isIdentifier(d.name)).map(d=>[d.name.text,s])));
fs.mkdirSync(root+'/context/actions',{recursive:true});
const backup = path.join(process.env.TEMP,'oscar-audit-baseline-20261001');
fs.mkdirSync(backup,{recursive:true});
fs.writeFileSync(path.join(backup,'admin-state.context.tsx'),source);
fs.writeFileSync(path.join(backup,'admin.fixtures.ts'),fs.readFileSync(root+'/fixtures/admin.fixtures.ts'));
const runtimeHelpers = ast.statements.filter(s => ts.isFunctionDeclaration(s) && ['getNowTimestamp','generateId'].includes(s.name?.text));
fs.writeFileSync(root+'/utils/admin-records.ts',runtimeHelpers.map(s=>'export '+s.getText(ast)).join('\n\n')+'\n');
fs.writeFileSync(root+'/context/admin-state.types.ts',domainTypes+'\nimport type { Dispatch, SetStateAction } from "react";\nimport { CURRENT_ADMIN } from "../constants/admin.constants";\n\nexport '+contract.getText(ast)+
  '\n\nexport type AdminStateData = Pick<AdminStateContextValue, '+stateNames.map(n=>JSON.stringify(n)).join(' | ')+'>;\n'+
  'type AdminStateSetters = { [Key in keyof AdminStateData as `set${Capitalize<Key>}`]: Dispatch<SetStateAction<AdminStateData[Key]>> };\n'+
  'export type AdminActionDependencies = AdminStateData & AdminStateSetters & { addAuditLog: (entry: Omit<AdminAuditLog, "id" | "adminName" | "adminEmail" | "timestamp">) => void };\n');
const calls = [];
const hookImports = [];
for(const [domain,names] of Object.entries(groups)) {
  const body = names.map(n=>actions.get(n).getText(ast)).join('\n\n');
  const hook = 'use'+domain.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('')+'Actions';
  const identifiers = new Set();
  const scan=n=>{if(ts.isIdentifier(n))identifiers.add(n.text);ts.forEachChild(n,scan)};
  for(const name of names) scan(actions.get(name));
  const deps = possible.filter(n=>identifiers.has(n));
  const external = domainImports.filter(s=>s.importClause && !s.moduleSpecifier.text.includes('constants') && s.importClause.isTypeOnly);
  let hookSource = '"use client";\n\nimport { useCallback } from "react";\n'+external.map(s=>s.getText(ast).replace(/from "\.\.\//g,'from "../../')).join('\n')+
    '\nimport { CURRENT_ADMIN } from "../../constants/admin.constants";\nimport { generateId, getNowTimestamp } from "../../utils/admin-records";\nimport type { AdminActionDependencies } from "../admin-state.types";\n\n'+
    `export function ${hook}({${deps.join(', ')}}: Pick<AdminActionDependencies, ${deps.map(n=>JSON.stringify(n)).join(' | ')}>) {\n${body}\nreturn {${names.join(', ')}};\n}\n`;
  fs.writeFileSync(root+'/context/actions/use-'+domain+'-actions.ts',hookSource);
  hookImports.push(`import { ${hook} } from "./actions/use-${domain}-actions";`);
  calls.push(`const {${names.join(', ')}} = ${hook}({${deps.join(', ')}});`);
}
const first = actions.get('isTaskUnlockedForEmployee');
const last = actions.get('updateAdminAccount');
let rewritten = source.slice(0,first.getFullStart())+'\n'+calls.join('\n')+'\n'+source.slice(last.end);
for(const node of [...runtimeHelpers,contract].sort((a,b)=>b.pos-a.pos)) {
  const original = node.getText(ast);
  rewritten=rewritten.replace(original,'');
}
rewritten = rewritten.replace(/\s*\/\/ \d+\.[^\r\n]*\r?\n/g,'\n').replace('  // Append audit entry helper\n','');
rewritten = rewritten.replace('export const AdminStateContext',hookImports.join('\n')+'\nimport type { AdminStateContextValue } from "./admin-state.types";\nimport { generateId, getNowTimestamp } from "../utils/admin-records";\n\nexport const AdminStateContext');
const fixturesPath = root+'/fixtures/admin.fixtures.ts';
const fixtureSource = fs.readFileSync(fixturesPath,'utf8');
const fixtureAst = ts.createSourceFile(fixturesPath,fixtureSource,ts.ScriptTarget.Latest,true);
const fixtureGroups = {
  package:['SEED_PACKAGES'],employee:['SEED_EMPLOYEES'],task:['SEED_TASKS'],
  code:['SEED_CODES','SEED_CODE_USAGES'],submission:['SEED_SUBMISSIONS'],deposit:['SEED_DEPOSITS'],
  withdrawal:['nowMs','msPerHour','SEED_WITHDRAWALS'],finance:['SEED_FINANCE_TRANSACTIONS'],
  referral:['SEED_REFERRAL_MEMBERS','SEED_COMMISSIONS'],account:['SEED_ADMINS'],audit:['SEED_AUDIT_LOGS']
};
const fixtureImports = [];
for(const [domain,names] of Object.entries(fixtureGroups)) {
  const selected = fixtureAst.statements.filter(s=>ts.isVariableStatement(s) && s.declarationList.declarations.some(d=>names.includes(d.name.getText(fixtureAst))));
  const text = selected.map(s=>s.getFullText(fixtureAst)).join('\n');
  fs.writeFileSync(root+'/fixtures/'+domain+'.fixtures.ts',fixtureAst.statements[0].getText(fixtureAst)+'\n'+text+'\n');
  fixtureImports.push(`import { ${names.filter(n=>n.startsWith('SEED_')).join(', ')} } from "../fixtures/${domain}.fixtures";`);
}
rewritten=rewritten.replace(/import \{\s*SEED_ADMINS,[\s\S]*?from "\.\.\/fixtures\/admin.fixtures";/,fixtureImports.join('\n'));
fs.writeFileSync(contextPath,rewritten);
fs.unlinkSync(fixturesPath);
console.log(JSON.stringify({backup,groups:Object.keys(groups),fixtureDomains:Object.keys(fixtureGroups)}));
