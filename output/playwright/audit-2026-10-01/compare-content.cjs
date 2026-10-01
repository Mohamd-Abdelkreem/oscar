const fs=require('node:fs');
const read=file=>JSON.parse(fs.readFileSync('output/playwright/audit-2026-10-01/'+file,'utf8').replace(/^\uFEFF/,''));
const before=read('before-routes.json').results;
const after=read('after-routes.json').results;
const mismatches=[];
for(let i=0;i<before.length;i++) {
  const a=before[i];const b=after[i];
  if(a.route!==b.route)throw new Error('Route order changed');
  if(a.text!==b.text){
    let prefix=0;while(a.text[prefix]===b.text[prefix]&&prefix<a.text.length)prefix++;
    mismatches.push({route:b.route,width:b.width,before:a.text.slice(Math.max(0,prefix-40),prefix+160),after:b.text.slice(Math.max(0,prefix-40),prefix+160)});
  }
}
fs.writeFileSync('output/playwright/audit-2026-10-01/content-comparison.json',JSON.stringify(mismatches,null,2));
console.log(JSON.stringify(mismatches));
