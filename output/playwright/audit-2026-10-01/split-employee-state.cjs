const fs=require('node:fs');
const path=require('node:path');
const ts=require(path.resolve('apps/web/node_modules/typescript'));
const root='apps/web/src/features/employee';
const file=root+'/context/employee-state.context.tsx';
const source=fs.readFileSync(file,'utf8');
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const contract=ast.statements.find(ts.isInterfaceDeclaration);
const provider=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EmployeeStateProvider');
const imports=ast.statements.filter(ts.isImportDeclaration);
const domainImports=imports.filter(n=>!['react'].includes(n.moduleSpecifier.text)&&!n.moduleSpecifier.text.includes('fixtures/'));
const groups={task:['submitTask','replaceTaskScreenshot','setTaskScenario'],package:['upgradeToPackage'],wallet:['setupWithdrawalAddress','requestWithdrawal','checkDepositStatus','simulateRejectPendingWithdrawal','simulateApprovePendingWithdrawal']};
const states=['user','balance','task','withdrawals','deposits','transactions'];
const setters=states.map(n=>'set'+n[0].toUpperCase()+n.slice(1)).concat('setCurrentPackageId');
const possible=[...states,...setters,'currentPackageId','currentPackage','pendingWithdrawal','hasPendingWithdrawal'];
const actions=new Map(provider.body.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations.filter(d=>ts.isIdentifier(d.name)).map(d=>[d.name.text,s])));
fs.copyFileSync(file,path.join(process.env.TEMP,'oscar-audit-baseline-20261001','employee-state.context.tsx'));
fs.mkdirSync(root+'/context/actions',{recursive:true});
const typeImports=imports.filter(n=>n.importClause?.isTypeOnly).map(n=>n.getText(ast)).join('\n');
fs.writeFileSync(root+'/context/employee-state.types.ts',typeImports+'\nimport type { Dispatch, SetStateAction } from "react";\n\nexport '+contract.getText(ast)+'\n'+
  'type EmployeeStateData = Pick<EmployeeContextValue, '+states.map(n=>JSON.stringify(n)).join('|')+'> & { readonly currentPackageId: PackageId };\n'+
  'type EmployeeStateSetters = { [Key in keyof EmployeeStateData as `set${Capitalize<Key>}`]: Dispatch<SetStateAction<EmployeeStateData[Key]>> };\n'+
  'export type EmployeeActionDependencies = EmployeeStateData & EmployeeStateSetters & Pick<EmployeeContextValue, "currentPackage"|"pendingWithdrawal"|"hasPendingWithdrawal">;\n');
const hookImports=[];const calls=[];
for(const [domain,names] of Object.entries(groups)) {
  const identifiers=new Set();
  function visit(n){if(ts.isIdentifier(n))identifiers.add(n.text);ts.forEachChild(n,visit);}
  for(const name of names)visit(actions.get(name));
  const deps=possible.filter(n=>identifiers.has(n));
  let body=names.map(n=>actions.get(n).getText(ast)).join('\n\n');
  const bodyAst=ts.createSourceFile('actions.ts',body,ts.ScriptTarget.Latest,true);
  const edits=[];
  function addSetterDeps(n){
    if(ts.isCallExpression(n)&&n.expression.getText(bodyAst)==='useCallback') {
      const callback=n.arguments[0];const array=n.arguments[1];
      const used=new Set();
      function scan(v){if(ts.isIdentifier(v))used.add(v.text);ts.forEachChild(v,scan);}
      scan(callback);
      const existing=array.elements.map(v=>v.getText(bodyAst));
      const extra=setters.filter(v=>used.has(v)&&!existing.includes(v));
      edits.push({start:array.getStart(bodyAst),end:array.end,text:'['+[...existing,...extra].join(', ')+']'});
    }
    ts.forEachChild(n,addSetterDeps);
  }
  addSetterDeps(bodyAst);
  for(const edit of edits.sort((a,b)=>b.start-a.start))body=body.slice(0,edit.start)+edit.text+body.slice(edit.end);
  body=body.replace(/^[ \t]*\/\/ (?:Deduct upgrade cost|Unlock reservation:[^\n]*|Completed:[^\n]*)\r?\n/gm,'');
  const hook='useEmployee'+domain[0].toUpperCase()+domain.slice(1)+'Actions';
  const extra=domain==='package'?'import { PACKAGES } from "../../fixtures/package.fixtures";\n':'';
  fs.writeFileSync(root+'/context/actions/use-employee-'+domain+'-actions.ts','"use client";\nimport { useCallback } from "react";\n'+extra+domainImports.map(n=>n.getText(ast).replaceAll('from "../','from "../../')).join('\n')+'\nimport type { EmployeeActionDependencies } from "../employee-state.types";\n\n'+
    `export function ${hook}({${deps.join(', ')}}: Pick<EmployeeActionDependencies, ${deps.map(n=>JSON.stringify(n)).join(' | ')}>) {\n${body}\nreturn {${names.join(', ')}};\n}\n`);
  hookImports.push(`import { ${hook} } from "./actions/use-employee-${domain}-actions";`);
  calls.push(`const { ${names.join(', ')} } = ${hook}({ ${deps.join(', ')} });`);
}
let rewritten=source.slice(0,actions.get('submitTask').getFullStart())+'\n'+calls.join('\n')+'\n'+source.slice(actions.get('simulateApprovePendingWithdrawal').end);
rewritten=rewritten.replace(contract.getText(ast),'').replace('const EmployeeStateContext',hookImports.join('\n')+'\nimport type { EmployeeContextValue } from "./employee-state.types";\n\nconst EmployeeStateContext');
fs.writeFileSync(file,rewritten);
console.log('Employee state owner preserved; task/package/wallet action bodies extracted');
