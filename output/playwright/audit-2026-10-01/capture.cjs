const fs = require('node:fs');
const path = require('node:path');
const mode = process.argv[2];
const root = process.cwd();
const destination = path.join(root, 'output/playwright/audit-2026-10-01');
const pages = fs.readdirSync(path.join(root, 'apps/web/src/app'), {recursive:true})
  .filter(p => p.endsWith('page.tsx') && /^(admin|employee)[\\/]/.test(p));
const routes = pages.map(p => '/' + p.replace(/\\/g,'/').replace(/\/page.tsx$/, '')
  .split('/').filter(s => !s.startsWith('(')).join('/')
  .replace('[employeeId]', 'usr_9981').replace('[taskId]', 'tsk_today_1001')
  .replace('[codeId]', 'cod_2026_01')).sort();
fs.writeFileSync(path.join(destination,'routes.json'), JSON.stringify(routes,null,2));
const highRisk = ['/admin/employees/usr_9981', '/admin/referrals', '/admin/withdrawals',
  '/admin/submissions', '/admin/finance', '/admin/codes', '/admin/tasks/new',
  '/admin/settings/admins', '/employee/tasks', '/employee/packages', '/employee/wallet'];
const matrix = routes.flatMap(route => [390,1440].map(width => ({route,width})));
for (const route of highRisk) for (const width of [320,768,1280]) matrix.push({route,width});
fs.mkdirSync(path.join(destination,mode),{recursive:true});
const code = `async (page) => {
  const results = [];
  const errors = [];
  const requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/api\\/v1/.test(r.url())) requests.push(r.url()); });
  for (const entry of ${JSON.stringify(matrix)}) {
    const errorStart = errors.length;
    await page.setViewportSize({width:entry.width,height:844});
    const response = await page.goto('http://localhost:3000' + entry.route);
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {await document.fonts.ready});
    const inspection = await page.evaluate(() => ({
      title:document.querySelector('h1')?.textContent,
      overflow:document.documentElement.scrollWidth > innerWidth,
      pageWidth:document.documentElement.scrollWidth,
      direction:getComputedStyle(document.querySelector('.admin-scope, .employee-scope') ?? document.body).direction,
      font:getComputedStyle(document.querySelector('h1') ?? document.body).fontFamily,
      text:(document.querySelector('main') ?? document.body).innerText
    }));
    const name = entry.route.slice(1).replaceAll('/','_') + '-' + entry.width;
    await page.screenshot({path:${JSON.stringify(path.join(destination,mode))} + '/' + name + '.png',fullPage:true});
    results.push({...entry,status:response?.status(),...inspection,errors:errors.slice(errorStart)});
  }
  return {results,errors,requests};
}`;
fs.writeFileSync(path.join(destination,mode+'-capture.js'),code);
