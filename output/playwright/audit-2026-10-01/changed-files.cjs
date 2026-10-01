const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const baseline = JSON.parse(fs.readFileSync('output/playwright/audit-2026-10-01/baseline-inventory.json','utf8').replace(/^\uFEFF/,''));
const hashes = new Map(baseline.map(f => [f.path.replaceAll('\\','/'), f.sha256.toLowerCase()]));
const files = [];
for (const area of ['apps','packages','scripts']) {
  for (const relative of fs.readdirSync(area,{recursive:true})) {
    const file = area+'/'+relative.replaceAll('\\','/');
    if (/(^|\/)(node_modules|dist|\.next|generated|coverage)(\/|$)/.test(file) || !/\.(tsx?|m?js|cjs|json|css|md)$/.test(file) || !fs.statSync(file).isFile()) continue;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (!hashes.has(file) || hashes.get(file) !== hash) files.push(file);
  }
}
fs.writeFileSync('output/playwright/audit-2026-10-01/changed-files.json',JSON.stringify(files,null,2));
fs.writeFileSync('output/playwright/audit-2026-10-01/changed-files.txt', files.join('\n'));
console.log(files.length+' audit-changed/new authored files');
