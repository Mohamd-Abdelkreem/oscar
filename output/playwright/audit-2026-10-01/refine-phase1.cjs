const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(path.resolve('apps/web/node_modules/typescript'));
const root = 'apps/web/src/features/admin';
for(const name of fs.readdirSync(root+'/context/actions')) {
  const file = root+'/context/actions/'+name;
  let source = fs.readFileSync(file,'utf8');
  const ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const edits=[];
  const visit=node=>{
    if(ts.isCallExpression(node) && node.expression.getText(ast)==='useCallback' && node.arguments.length===2) {
      const setters = new Set();
      const find=n=>{if(ts.isIdentifier(n) && /^set[A-Z]/.test(n.text))setters.add(n.text);ts.forEachChild(n,find)};
      find(node.arguments[0]);
      if(setters.size) {
        const deps=node.arguments[1];
        const existing = deps.elements.map(e=>e.getText(ast));
        edits.push({start:deps.getStart(ast),end:deps.end,text:'['+[...new Set([...existing,...setters])].join(', ')+']'});
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(ast);
  for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
  source=source.replace(/^\s*\/\/ (?:\d+\. |Check |Find |Verify |Target |Create |Update |Ledger |Credit |Release |Final |Mark |Add |Write |Get |Toggle |Append |Reverse )[^\n]*\n/gm,'\n');
  source=source.replace('${additionalHours}', '${String(additionalHours)}').replace('${newCumulativeAdded}', '${String(newCumulativeAdded)}');
  if(name==='use-withdrawal-actions.ts') {
    source=source.replace('withdrawal?: AdminWithdrawal }','withdrawal?: AdminWithdrawal | undefined }');
    source=source.replace('import { useCallback } from "react";', 'import { useCallback } from "react";\nimport { computeExtendedDueAt } from "../../utils/time.utils";');
    const start=source.indexOf('      const currentDueAtMs =');
    const end=source.indexOf('      const baseHours =',start);
    source=source.slice(0,start)+`      const extension = computeExtendedDueAt(wth.dueAt, additionalHours);
      if (!extension.valid) return { success: false, message: extension.error };
      const newDueAtIso = extension.newDueAtIso;

`+source.slice(end);
  }
  fs.writeFileSync(file,source);
}
const fixedNow=Date.UTC(2026,9,1,11);
class FixedDate extends Date {constructor(...args){super(...(args.length ? args : [fixedNow]));}static now(){return fixedNow;}}
const evaluate=source=>{const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date:FixedDate});return exports;};
const before=evaluate(fs.readFileSync(path.join(process.env.TEMP,'oscar-audit-baseline-20261001/admin.fixtures.ts'),'utf8'));
const after=Object.assign({},...fs.readdirSync(root+'/fixtures').map(n=>evaluate(fs.readFileSync(root+'/fixtures/'+n,'utf8'))));
const comparison=Object.keys(before).map(name=>({name,equal:JSON.stringify(before[name])===JSON.stringify(after[name])}));
fs.writeFileSync('output/playwright/audit-2026-10-01/fixture-comparison.json',JSON.stringify(comparison,null,2));
if(comparison.some(c=>!c.equal))throw new Error('Fixture values changed');
console.log({fixtureExports:comparison.length,allEqual:true});
