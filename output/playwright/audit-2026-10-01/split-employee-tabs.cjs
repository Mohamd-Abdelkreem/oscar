const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.resolve('apps/web/node_modules/typescript'));
const root = 'apps/web/src/features/admin/components/employees';
const file = root+'/employee-detail-screen.tsx';
const source = fs.readFileSync(file,'utf8');
fs.writeFileSync(path.join(process.env.TEMP,'oscar-audit-baseline-20261001/employee-detail-screen.tsx'),source);
const ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const types={employee:'AdminEmployee',employeePackage:'AdminPackage | undefined',
  employeeTransactions:'readonly AdminFinanceTransaction[]',employeeSubmissions:'readonly AdminSubmission[]',
  employeeDeposits:'readonly AdminDeposit[]',employeeWithdrawals:'readonly AdminWithdrawal[]',
  employeeReferrals:'readonly AdminReferralMember[]',employeeCodeUsages:'readonly CodeUsageRecord[]',
  employeeAuditLogs:'readonly AdminAuditLog[]'};
const edits=[];
const imports=[];
const existingImports=ast.statements.filter(ts.isImportDeclaration).filter(s=>!['react','../../context/admin-state.context'].includes(s.moduleSpecifier.text));
function visit(node){
  if(ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)) {
    const condition=node.expression;
    if(condition.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken && ts.isBinaryExpression(condition.left) && condition.left.left.getText(ast)==='activeTab') {
      const tab=condition.left.right.text;
      const jsx=ts.isParenthesizedExpression(condition.right) ? condition.right.expression : condition.right;
      const name='Employee'+tab[0].toUpperCase()+tab.slice(1)+'Tab';
      const ids=new Set();const scan=n=>{if(ts.isIdentifier(n))ids.add(n.text);ts.forEachChild(n,scan)};scan(jsx);
      const props=Object.keys(types).filter(n=>ids.has(n));
      const typeImports=[...new Set(props.flatMap(n=>types[n].match(/\b(?:Admin\w+|CodeUsageRecord)\b/g)??[]))];
      const output='"use client";\n\n'+existingImports.map(s=>s.getText(ast)).join('\n')+
        '\nimport type { '+typeImports.join(', ')+' } from "../../types/admin.types";\n\n'+
        `export function ${name}({${props.join(', ')}}: {${props.map(n=>'readonly '+n+': '+types[n]).join('; ')}}) {\nreturn (${jsx.getText(ast)});\n}\n`;
      fs.writeFileSync(root+'/employee-'+tab+'-tab.tsx',output);
      imports.push(`import { ${name} } from "./employee-${tab}-tab";`);
      edits.push({start:node.getStart(ast),end:node.end,text:`{activeTab === "${tab}" && <${name} ${props.map(n=>n+'={'+n+'}').join(' ')} />}`});
      return;
    }
  }
  ts.forEachChild(node,visit);
}
visit(ast);
let output=source;
for(const edit of edits.sort((a,b)=>b.start-a.start))output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);
output=output.replace('interface EmployeeDetailScreenProps',imports.join('\n')+'\n\ninterface EmployeeDetailScreenProps');
output=output.replace(/\s*\{\/\* Tab \d+:[\s\S]*?\*\/\}/g,'');
fs.writeFileSync(file,output);
console.log({tabs:edits.length});
