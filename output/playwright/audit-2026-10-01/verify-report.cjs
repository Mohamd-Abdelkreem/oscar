const fs=require('node:fs');
const path=require('node:path');
const dir='output/playwright/audit-2026-10-01';
const missing=[];
for(const name of ['AUDIT.md','COVERAGE.md','LIBRARIES.md','MODULES.md']){
  const source=fs.readFileSync(dir+'/'+name,'utf8');
  for(const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
    if(/^https?:/.test(match[1]))continue;
    const target=path.resolve(dir,match[1]);
    if(!fs.existsSync(target))missing.push({file:name,target:match[1]});
  }
}
if(missing.length)throw new Error(JSON.stringify(missing));
const final=JSON.parse(fs.readFileSync(dir+'/after-routes.json','utf8'));
const evidence=JSON.parse(fs.readFileSync(dir+'/audit-evidence.json','utf8'));
console.log(JSON.stringify({reportLinks:'all exist',routes:new Set(final.results.map(f=>f.route)).size,captures:final.results.length,apiRequests:final.requests.length,textDifferences:JSON.parse(fs.readFileSync(dir+'/content-comparison.json','utf8')).length,pixelComparison:evidence.screenshots,protectedChanged:evidence.protectedFiles.filter(f=>!f.unchanged).length},null,2));
