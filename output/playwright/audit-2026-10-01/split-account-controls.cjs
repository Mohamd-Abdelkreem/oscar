const fs=require('node:fs');
const path=require('node:path');
const ts=require(path.resolve('apps/web/node_modules/typescript'));
const root='apps/web/src/features/admin/components';
function nodes(ast,predicate){const matches=[];function walk(n){if(predicate(n))matches.push(n);ts.forEachChild(n,walk)}walk(ast);return matches;}
function parse(file){const source=fs.readFileSync(file,'utf8');return{source,ast:ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)};}
function write(file,source,edits,imports){for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);const first=source.indexOf('interface EmployeeDetailScreenProps');fs.writeFileSync(file,source.slice(0,first)+imports+'\n'+source.slice(first));}
{
const file=root+'/employees/employee-detail-screen.tsx';
const {source,ast}=parse(file);
const edits=[];const imports=[];
const shared='"use client";\nimport { useState, type SyntheticEvent } from "react";\nimport { Banknote, CheckCircle2, Lock, ShieldAlert, Unlock, Wallet } from "lucide-react";\nimport { AdminButton } from "../common/admin-button";\nimport { AdminInput } from "../common/admin-input";\nimport { AdminConfirmDialog } from "../common/admin-confirm-dialog";\nimport type { AdminEmployee } from "../../types/admin.types";\nimport { useAdminState } from "../../context/admin-state.context";\n';
const fields={
  balance:{balanceAmount:'string',setBalanceAmount:'(amount: string) => void',balanceDirection:'"credit" | "debit"',setBalanceDirection:'(direction: "credit" | "debit") => void',balanceReason:'string',setBalanceReason:'(reason: string) => void'},
  address:{newAddress:'string',setNewAddress:'(address: string) => void',addressReason:'string',setAddressReason:'(reason: string) => void'}
};
for(const domain of ['balance','address']) {
  const condition=domain+'ModalOpen';
  const expression=nodes(ast,n=>ts.isJsxExpression(n)&&n.expression&&ts.isBinaryExpression(n.expression)&&n.expression.left.getText(ast)===condition)[0];
  const jsx=expression.expression.right.expression;
  const name='Employee'+domain[0].toUpperCase()+domain.slice(1)+'Dialog';
  const fieldNames=Object.keys(fields[domain]);
  const submit='handle'+domain[0].toUpperCase()+domain.slice(1)+'Submit';
  const setter='set'+domain[0].toUpperCase()+domain.slice(1)+'ModalOpen';
  let body=jsx.getText(ast).replaceAll(setter+'(false)','onClose()');
  fs.writeFileSync(root+'/employees/employee-'+domain+'-dialog.tsx',shared+
    `export function ${name}({employee,form,${submit},onClose}:{readonly employee:AdminEmployee;readonly form:{${fieldNames.map(n=>'readonly '+n+':'+fields[domain][n]).join(';')}};readonly ${submit}:(event:SyntheticEvent)=>void;readonly onClose:()=>void}) {const {${fieldNames.join(', ')}}=form;return (${body});}\n`);
  edits.push({start:expression.getStart(ast),end:expression.end,text:`{${condition} && <${name} employee={employee} form={{${fieldNames.join(', ')}}} ${submit}={${submit}} onClose={() => ${setter}(false)} />}`});
  imports.push(`import { ${name} } from "./employee-${domain}-dialog";`);
}
const restrictionStates=['accountStatusConfirmOpen','taskRestrictionConfirmOpen','withdrawalRestrictionConfirmOpen'];
const restrictionSetters=restrictionStates.map(n=>'set'+n[0].toUpperCase()+n.slice(1));
const restrictionActions=['toggleEmployeeAccountStatus','toggleEmployeeTaskRestriction','toggleEmployeeWithdrawalRestriction'];
const card=nodes(ast,n=>ts.isJsxElement(n) && n.openingElement.tagName.getText(ast)==='div' && n.getText(ast).includes('التحكم التشغيلي والقيود الإدارية المستقلة') && n.openingElement.attributes.getText(ast).includes('rounded-lg border border-slate-200 bg-white p-4 shadow-xs'))[0];
const dialogs=nodes(ast,n=>ts.isJsxSelfClosingElement(n) && n.tagName.getText(ast)==='AdminConfirmDialog' && n.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(ast)==='isOpen' && p.initializer && restrictionStates.some(s=>p.initializer.getText(ast)==='{'+s+'}')));
const stateNodes=nodes(ast,n=>ts.isVariableStatement(n) && n.declarationList.declarations.some(d=>ts.isArrayBindingPattern(d.name)&&restrictionStates.some(s=>d.name.elements[0]?.getText(ast)===s)));
const state=stateNodes.map(n=>n.getText(ast)).join('\n');
const controlBody=card.getText(ast)+'\n'+dialogs.map(n=>n.getText(ast)).join('\n');
fs.writeFileSync(root+'/employees/employee-restriction-controls.tsx',shared+
  `export function EmployeeRestrictionControls({employee,setFeedback}:{readonly employee:AdminEmployee;readonly setFeedback:(feedback:{success:boolean;message:string})=>void}) {const {${restrictionActions.join(', ')}}=useAdminState();\n${state}\nreturn (<>${controlBody}</>);}\n`);
edits.push({start:card.getStart(ast),end:card.end,text:'<EmployeeRestrictionControls employee={employee} setFeedback={setFeedback} />'});
for(const n of [...dialogs,...stateNodes])edits.push({start:n.getStart(ast),end:n.end,text:''});
let output=source;
for(const action of restrictionActions)output=output.replace('    '+action+',','');
for(const e of edits.sort((a,b)=>b.start-a.start)) {
  // Apply offsets to the original source; import cleanup happens after replacement.
}
write(file,source,edits,[...imports,'import { EmployeeRestrictionControls } from "./employee-restriction-controls";'].join('\n'));
output=fs.readFileSync(file,'utf8');
for(const action of restrictionActions)output=output.replace('    '+action+',','');
fs.writeFileSync(file,output);
}
{
const file=root+'/settings/admins-list-screen.tsx';
const {source,ast}=parse(file);const edits=[];const imports=[];
const shared='"use client";\nimport { X } from "lucide-react";\nimport type { SyntheticEvent } from "react";\nimport { AdminButton } from "../common/admin-button";\nimport type { AdminAccount } from "../../types/admin.types";\n';
for(const domain of ['add','edit']) {
  const condition=domain==='add'?'isAddModalOpen':'editingAdmin';
  const expression=nodes(ast,n=>ts.isJsxExpression(n)&&n.expression&&ts.isBinaryExpression(n.expression)&&n.expression.left.getText(ast)===condition)[0];
  const jsx=expression.expression.right.expression;
  const isAdd=domain==='add';
  const values=isAdd?['newName','newEmail','addError']:['editName','editEmail','editError'];
  const setters=isAdd?['setNewName','setNewEmail']:['setEditName','setEditEmail'];
  const submit=isAdd?'handleCreateAdmin':'handleUpdateAdmin';
  const close=isAdd?'setIsAddModalOpen(false)':'setEditingAdmin(null)';
  const formKeys=[...values,...setters];
  const propTypes=formKeys.map(n=>'readonly '+n+': '+(n.includes('Error')?'string | null':n.startsWith('set')?'(text:string)=>void':'string')).join(';');
  const name=isAdd?'CreateAdminDialog':'EditAdminDialog';
  const text=jsx.getText(ast).replaceAll(close,'onClose()');
  fs.writeFileSync(root+'/settings/'+domain+'-admin-dialog.tsx',shared+
    `export function ${name}({form,${submit},onClose${isAdd?'':',editingAdmin'}}: {readonly form:{${propTypes}};readonly ${submit}:(event:SyntheticEvent)=>void;readonly onClose:()=>void;${isAdd?'':'readonly editingAdmin:AdminAccount;'}}){const {${formKeys.join(', ')}}=form;return (${text});}\n`);
  edits.push({start:expression.getStart(ast),end:expression.end,text:`{${condition} && <${name} form={{${formKeys.join(', ')}}} ${submit}={${submit}} onClose={() => ${close}} ${isAdd?'':'editingAdmin={editingAdmin}'} />}`});
  imports.push(`import { ${name} } from "./${domain}-admin-dialog";`);
}
let output=source;for(const e of edits.sort((a,b)=>b.start-a.start))output=output.slice(0,e.start)+e.text+output.slice(e.end);
output=output.replace('export function AdminsListScreen',imports.join('\n')+'\n\nexport function AdminsListScreen');fs.writeFileSync(file,output);
}
