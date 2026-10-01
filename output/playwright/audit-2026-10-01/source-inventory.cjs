const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ts=require(path.resolve('apps/web/node_modules/typescript'));
const area=process.argv[2];
const inventory=[];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  if(['node_modules','.next','dist','generated','coverage','.turbo'].includes(entry.name))return[];
  const file=dir+'/'+entry.name;return entry.isDirectory()?walk(file):[file];
});}
for(const file of ['apps','packages','scripts'].flatMap(walk)){
  if(!/\.(?:tsx?|m?js|cjs|json|css|prisma|sql|md|toml|yml|yaml)$/.test(file))continue;
  const source=fs.readFileSync(file,'utf8');
  const imports=[];const functions=[];const risks=[];const tests=[];
  if(/\.(?:tsx?|m?js|cjs)$/.test(file)){
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    for(const node of ast.statements)if(ts.isImportDeclaration(node))imports.push({module:node.moduleSpecifier.text,symbols:node.importClause?.getText(ast)});
    function visit(node){
      const text=node.getText(ast);
      const line=ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1;
      if((ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node))&&node.body){
        functions.push({name:node.name?.getText(ast),line,lines:text.split('\n').length,params:node.parameters.length});
      }
      if(ts.isCallExpression(node)){
        const called=node.expression.getText(ast);
        if(/^(?:useEffect|useEffectEvent|setTimeout|setInterval|URL\.|window\.|document\.|fetch|localStorage\.|sessionStorage\.)/.test(called))risks.push({line,kind:called,source:text});
        if(/(?:^|\.)(?:it|test|describe)(?:\.each)?$/.test(called))tests.push({line,kind:called,name:node.arguments[0]?.getText(ast)});
        if(/^(?:vi|jest)\.(?:mock|spyOn|stubGlobal)/.test(called))risks.push({line,kind:called,source:text});
      }
      if(ts.isCatchClause(node)||ts.isAsExpression(node)||ts.isNonNullExpression(node))risks.push({line,kind:ts.SyntaxKind[node.kind],source:text});
      ts.forEachChild(node,visit);
    }visit(ast);
  }
  inventory.push({path:file,lines:source.split('\n').length,sha256:crypto.createHash('sha256').update(source).digest('hex'),imports,functions,risks,tests});
}
const libraries=[];
for(const dir of ['apps/web','apps/api','packages/contracts','packages/database','packages/eslint-config','packages/prettier-config','.']){
  const manifest=JSON.parse(fs.readFileSync(dir+'/package.json','utf8'));
  for(const [name,requested]of Object.entries({...manifest.dependencies,...manifest.devDependencies})){
    const installed=dir+'/node_modules/'+name+'/package.json';
    const meta=fs.existsSync(installed)?JSON.parse(fs.readFileSync(installed,'utf8')):null;
    const consumers=inventory.filter(f=>f.path.startsWith(dir==='.'?'':dir+'/') && f.imports.some(i=>i.module===name||i.module.startsWith(name+'/'))).map(f=>f.path);
    libraries.push({workspace:manifest.name,name,requested,installed:meta?.version??null,consumers});
  }
}
fs.writeFileSync('output/playwright/audit-2026-10-01/source-inventory.json',JSON.stringify(inventory,null,2));
fs.writeFileSync('output/playwright/audit-2026-10-01/libraries.json',JSON.stringify(libraries,null,2));
if(area){for(const f of inventory.filter(f=>f.path.startsWith(area)))console.log(JSON.stringify({path:f.path,lines:f.lines,imports:f.imports,functions:f.functions,risks:f.risks,tests:f.tests}));}
else console.log(JSON.stringify({files:inventory.length,libraries:libraries.length}));
