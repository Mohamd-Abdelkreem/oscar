async (page) => {
  const evidence = [];
  const errors = [];
  const failed = [];
  const errorHandler = error=>errors.push(String(error));
  const failedHandler = request=>failed.push({url:request.url(),reason:request.failure()?.errorText});
  page.on('pageerror',errorHandler);
  page.on('requestfailed',failedHandler);
  for (const width of [390,1440]) {
    await page.setViewportSize({width,height:844});
    for (const route of ['/auth/login','/auth/register','/auth/forgot-password','/auth/reset-password','/auth/verify-email','/dashboard','/settings']) {
      const startErrors = errors.length;
      const startFailed = failed.length;
      const response = await page.goto('http://localhost:3000'+route);
      await page.locator('body').waitFor({state:'visible'});
      await page.screenshot({path:'output/playwright/audit-2026-10-01/legacy-'+route.slice(1).replaceAll('/','_')+'-'+width+'.png',fullPage:true});
      evidence.push({route,width,status:response.status(),url:page.url(),text:await page.locator('body').innerText(),errors:errors.slice(startErrors),failedRequests:failed.slice(startFailed)});
    }
  }
  page.off('pageerror',errorHandler);
  page.off('requestfailed',failedHandler);
  await page.goto('http://localhost:3000/admin');
  return evidence;
}
