const fs=require('node:fs');
const path=require('node:path');
const ts=require(path.resolve('apps/web/node_modules/typescript'));
const root='apps/web/src/features/admin/components';
function parse(relative){const file=root+'/'+relative;const source=fs.readFileSync(file,'utf8');return {file,source,ast:ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)};}
function find(ast,predicate){let found;function visit(n){if(!found && predicate(n))found=n;ts.forEachChild(n,visit)}visit(ast);return found;}
function importsFor(ast,extra){return '"use client";\n\n'+ast.statements.filter(ts.isImportDeclaration).filter(s=>!['react','../../context/admin-state.context'].includes(s.moduleSpecifier.text)).map(s=>s.getText(ast)).join('\n')+'\n'+extra+'\n';}
function rewrite(file,source,edits,imports){for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);const first=source.indexOf('export function');source=source.slice(0,first)+imports+'\n'+source.slice(first);fs.writeFileSync(file,source);}
{
  const {file,source,ast}=parse('referrals/referrals-screen.tsx');
  const edits=[];const imports=[];
  const details=find(ast,n=>ts.isJsxExpression(n) && n.expression && ts.isConditionalExpression(n.expression) && n.expression.condition.getText(ast)==='selectedMember');
  const body=details.expression.getText(ast).replaceAll('hierarchy.root','root');
  fs.writeFileSync(root+'/referrals/referral-commission-details.tsx',importsFor(ast,'import type { AdminReferralCommission } from "../../types/admin.types";')+
    'export function ReferralCommissionDetails({selectedMember, selectedMemberCommissions, root, rootCommissions}: {readonly selectedMember: AdminReferralMember | null; readonly selectedMemberCommissions: readonly AdminReferralCommission[]; readonly root: AdminReferralMember | null; readonly rootCommissions: readonly AdminReferralCommission[]}) {return ('+body+');}\n');
  edits.push({start:details.getStart(ast),end:details.end,text:'<ReferralCommissionDetails selectedMember={selectedMember} selectedMemberCommissions={selectedMemberCommissions} root={hierarchy.root} rootCommissions={rootCommissions} />'});
  imports.push('import { ReferralCommissionDetails } from "./referral-commission-details";');
  const map=find(ast,n=>ts.isCallExpression(n) && n.expression.getText(ast)==='[1, 2, 3, 4, 5].map');
  const callback=map.arguments[0];
  const returned=callback.body.statements.find(ts.isReturnStatement).expression;
  const jsx=ts.isParenthesizedExpression(returned)?returned.expression:returned;
  const propTypes={lvl:'1 | 2 | 3 | 4 | 5',membersInLvl:'readonly RelativeReferralNode[]',totalInLvl:'number',isExpanded:'boolean | undefined',withinTeamQuery:'string',settings:'AdminSystemSettings',selectedMember:'AdminReferralMember | null',toggleLevel:'(level: number) => void',setSelectedMember:'(member: AdminReferralMember) => void'};
  const propNames=Object.keys(propTypes);
  fs.writeFileSync(root+'/referrals/referral-level.tsx',importsFor(ast,'import type { AdminSystemSettings } from "../../types/admin.types";')+
    `export function ReferralLevel({${propNames.join(', ')}}: {${propNames.map(n=>'readonly '+n+': '+propTypes[n]).join('; ')}}) {return (${jsx.getText(ast).replace('key={lvl}','')});}\n`);
  edits.push({start:returned.getStart(ast),end:returned.end,text:'<ReferralLevel />'});
  edits.pop();
  edits.push({start:jsx.getStart(ast),end:jsx.end,text:'<ReferralLevel key={lvl} '+propNames.map(n=>n+'={'+n+'}').join(' ')+' />'});
  imports.push('import { ReferralLevel } from "./referral-level";');
  rewrite(file,source,edits,imports.join('\n'));
}
{
  const {file,source,ast}=parse('withdrawals/withdrawals-screen.tsx');
  const map=find(ast,n=>ts.isCallExpression(n) && n.expression.getText(ast)==='paginatedWithdrawals.map');
  const callback=map.arguments[0];
  const body=callback.body.getText(ast);
  let rowBody=body.replace('const statusMeta = statusBadgeMap[wth.status];','const statusMeta = WITHDRAWAL_STATUS_LABELS[wth.status];');
  const pairs=[['setExtendModalOpen','onExtend'],['setReleaseModalOpen','onRelease'],['setCompleteConfirmOpen','onComplete'],['setRejectModalOpen','onReject']];
  for(const [setter,action]of pairs) rowBody=rowBody.replace(new RegExp('setSelectedWithdrawal\\(wth\\);\\s*'+setter+'\\(true\\);','g'),action+'(wth);');
  const status=find(ast,n=>ts.isVariableDeclaration(n) && n.name.getText(ast)==='statusBadgeMap');
  const declarations='const WITHDRAWAL_STATUS_LABELS'+source.slice(status.name.end,status.end)+';\n';
  fs.writeFileSync(root+'/withdrawals/withdrawal-row.tsx',importsFor(ast,'')+declarations+
    'export function WithdrawalRow({wth,currentTimeMs,onExtend,onRelease,onComplete,onReject}: {readonly wth: AdminWithdrawal;readonly currentTimeMs:number;readonly onExtend:(withdrawal:AdminWithdrawal)=>void;readonly onRelease:(withdrawal:AdminWithdrawal)=>void;readonly onComplete:(withdrawal:AdminWithdrawal)=>void;readonly onReject:(withdrawal:AdminWithdrawal)=>void}) '+rowBody+'\n');
  const props=pairs.map(([setter,action])=>`${action}={(withdrawal) => {setSelectedWithdrawal(withdrawal); ${setter}(true);}}`).join(' ');
  const edits=[{start:map.getStart(ast),end:map.end,text:`paginatedWithdrawals.map((wth) => <WithdrawalRow key={wth.id} wth={wth} currentTimeMs={currentTimeMs} ${props} />)`},
    {start:status.parent.parent.getStart(ast),end:status.parent.parent.end,text:''}];
  rewrite(file,source,edits,'import { WithdrawalRow } from "./withdrawal-row";');
}
