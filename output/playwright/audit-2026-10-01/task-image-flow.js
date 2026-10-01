async (page) => {
  await page.goto('http://localhost:3000/admin/tasks/new');
  await page.getByLabel('عنوان المهمة').fill('Audit image ownership');
  await page.getByLabel('وصف المهمة وتوجيهات التنفيذ').fill('Local browser characterization');
  await page.locator('input[type="file"]').setInputFiles('apps/web/public/employee/task-preview.svg');
  const preview = page.getByRole('img',{name:'معاينة الصورة',exact:true});
  const blob = await preview.getAttribute('src');
  const before = await preview.evaluate(img=>({src:img.src,complete:img.complete,width:img.naturalWidth}));
  await page.getByRole('button',{name:'إنشاء المهمة',exact:true}).click();
  await page.waitForURL(/\/admin\/tasks\/(?!new)[^/]+$/);
  const after = await page.locator('img').evaluateAll(imgs=>imgs.map(img=>({src:img.src,complete:img.complete,width:img.naturalWidth,alt:img.alt})));
  const available = await page.evaluate(async url=>{try {return {status:(await fetch(url)).status};} catch(error) {return {error:String(error)};}},blob);
  await page.screenshot({path:'output/playwright/audit-2026-10-01/task-image-after-submit.png',fullPage:true});
  return {flow:'task image owner after form unmount',url:page.url(),before,after,blobFetch:available};
}
