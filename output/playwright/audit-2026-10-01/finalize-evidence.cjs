const fs = require('node:fs');
const dir = 'output/playwright/audit-2026-10-01';
const readLog = file => {
  const buffer=fs.readFileSync(file);
  return buffer.toString(buffer[0]===255&&buffer[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');
};
const log = readLog(dir+'/after-browser.log');
const match = log.match(/### Result\r?\n([\s\S]*?)\r?\n### Ran Playwright code/);
if (!match) throw new Error('Missing successful browser result');
const result = JSON.parse(match[1]);
if (result.results.length !== 105) throw new Error('Incomplete final route matrix');
fs.writeFileSync(dir+'/after-routes.json',JSON.stringify(result,null,2));
for (const name of ['final-code-flow','final-dialog-flows','review-credit-flow','referral-interactions','task-image-flow','menu-check','legacy-route-check']) {
  const text=readLog(dir+'/'+name+'.log');
  const result=text.match(/### Result\r?\n([\s\S]*?)\r?\n### Ran Playwright code/);
  if(!result) throw new Error('Missing successful result: '+name);
  fs.writeFileSync(dir+'/'+name+'.json',JSON.stringify(JSON.parse(result[1]),null,2));
}
console.log('Final 105-route metadata and seven interaction results saved.');
