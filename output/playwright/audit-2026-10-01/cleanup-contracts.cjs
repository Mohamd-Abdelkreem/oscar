const fs=require('node:fs');
const path=require('node:path');
const ts=require(path.resolve('apps/web/node_modules/typescript'));
const admin='apps/web/src/features/admin';
function update(file,transform){fs.writeFileSync(file,transform(fs.readFileSync(file,'utf8')));}
update(admin+'/components/codes/codes-list-screen.tsx',s=>s.replaceAll('AdminCode','TaskUnlockCode'));
const files=fs.readdirSync(admin,{recursive:true}).filter(n=>/\.tsx?$/.test(n));
for(const relative of files) {
  const file=admin+'/'+relative;let source=fs.readFileSync(file,'utf8');
  source=source.replaceAll('ariaLabel=','aria-label=');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const edits=[];
  const visit=n=>{
    if(ts.isJsxAttribute(n) && n.name.getText(ast)==='affectedRecord' && !relative.replaceAll('\\','/').startsWith('components/employees/'))edits.push({start:n.getStart(ast),end:n.end,text:''});
    if(ts.isTemplateExpression(n)) {
      for(const span of n.templateSpans) {
        const e=span.expression;const text=e.getText(ast);
        if(/^(additionalHours|newCumulativeAdded|remainingHours|remainingMinutes|filteredTotalCount|hierarchy.totalTeamCount|totalInLvl|totalScheduleHours|lvl|membersInLvl.length|withdrawals.length|withdrawals.filter\(.*\.length)$/.test(text))edits.push({start:e.getStart(ast),end:e.end,text:'String('+text+')'});
      }
    }
    ts.forEachChild(n,visit);
  };visit(ast);
  for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
  if(relative.replaceAll('\\','/').includes('components/referrals/'))source=source.replace('filteredLevels[lvl] || []','filteredLevels[lvl]');
  fs.writeFileSync(file,source);
}
update(admin+'/components/common/admin-select.tsx',s=>s.replace('disabled={opt.disabled}','disabled={opt.disabled ?? false}'));
update(admin+'/components/common/admin-input.tsx',s=>s.replace('ChangeEvent, ',''));
for(const relative of ['components/common/admin-confirm-dialog.tsx','components/withdrawals/extend-schedule-dialog.tsx']) {
  update(admin+'/'+relative,s=>s.replace('onClick={handleConfirm}','onClick={() => { void handleConfirm(); }}'));
}
update(admin+'/utils/referral.utils.ts',s=>s.replace('while (queue.length > 0) {\n    const current = queue.shift()!;','for (const current of queue) {'));
update(admin+'/utils/referral.utils.test.ts',s=>s.replace(/(\s+packageId:)/g,'\n    level: 5,$1'));
update(admin+'/types/admin.types.ts',s=>s.replace(/export interface AdminBanner \{[\s\S]*?\n\}\n\n/,''));
const oldHook='apps/web/src/features/employee/hooks/use-managed-timeout.ts';
const newHook='apps/web/src/shared/hooks/use-managed-timeout.ts';
fs.mkdirSync(path.dirname(newHook),{recursive:true});
fs.renameSync(oldHook,newHook);
fs.renameSync('apps/web/src/features/employee/hooks/use-managed-timeout.test.tsx','apps/web/src/shared/hooks/use-managed-timeout.test.tsx');
for(const relative of fs.readdirSync('apps/web/src',{recursive:true}).filter(n=>/\.tsx?$/.test(n))) {
  const file='apps/web/src/'+relative;
  update(file,s=>s.replace(/from "(?:\.\.\/)+hooks\/use-managed-timeout"/g,'from "@/shared/hooks/use-managed-timeout"'));
}
for(const relative of ['components/codes/codes-list-screen.tsx','components/codes/code-detail-screen.tsx','components/codes/code-create-screen.tsx','components/deposits/deposits-screen.tsx','components/settings/admins-list-screen.tsx','components/settings/settings-screen.tsx','components/tasks/task-form-screen.tsx']) {
  update(admin+'/'+relative,s=>{
    const functionMatch=s.match(/export function [^\n]+\{\n/);
    if(!s.includes('setTimeout('))return s;
    s=s.replace('"use client";','"use client";\n\nimport { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";');
    if(!functionMatch) {
      const index=s.indexOf('  const router =');
      if(index<0)throw new Error('No hook insertion point: '+relative);
      s=s.slice(0,index)+'  const scheduleTimeout = useManagedTimeout();\n'+s.slice(index);
    } else s=s.replace(functionMatch[0],functionMatch[0]+'  const scheduleTimeout = useManagedTimeout();\n');
    return s.replaceAll('setTimeout(', 'scheduleTimeout(');
  });
}
