const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../../apps/web/node_modules/typescript');
function fixtures(path) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports });
  return exports;
}
const before = fixtures('output/playwright/baseline-code/feature-employee/fixtures/employee.fixtures.ts');
const after = {};
for (const file of fs.readdirSync('apps/web/src/features/employee/fixtures')) {
  Object.assign(after, fixtures('apps/web/src/features/employee/fixtures/' + file));
}
const results = Object.keys(before).map(name => ({ name, identical: JSON.stringify(before[name]) === JSON.stringify(after[name]) }));
fs.writeFileSync('output/playwright/fixture-comparison.json', JSON.stringify(results, null, 2));
console.log(results);
if (results.some(result => !result.identical)) process.exitCode = 1;
