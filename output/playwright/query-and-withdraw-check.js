async (page) => {
  const origin = 'http://localhost:3100';
  const scenarios = [];
  await page.setViewportSize({ width: 390, height: 844 });
  for (const scenario of ['open','free','before_window','closed','submitted','approved','rejected','unknown']) {
    await page.goto(origin + '/employee/tasks?scenario=' + scenario);
    await page.getByRole('heading', { name: 'المهام اليومية', exact: true }).waitFor();
    await page.locator('.employee-scope h2').first().waitFor();
    scenarios.push({ scenario, heading: await page.locator('.employee-scope h2').first().innerText(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  }
  await page.goto(origin + '/employee/withdraw');
  await page.locator('#withdraw-amount-input').fill('30');
  await page.getByRole('button', { name: 'متابعة تأكيد طلب السحب' }).click();
  const sheet = await page.getByRole('dialog').innerText();
  const feeAndNetPreserved = sheet.includes('6.30') && sheet.includes('23.70');
  await page.getByRole('button', { name: 'تأكيد طلب السحب وحجز الرصيد' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('navigation').getByRole('link', { name: 'الرئيسية', exact: true }).click();
  await page.waitForURL(origin + '/employee');
  const reservedBalanceSurvivesNavigation = (await page.locator('body').innerText()).includes('10.00');
  return { scenarios, feeAndNetPreserved, reservedBalanceSurvivesNavigation };
}
