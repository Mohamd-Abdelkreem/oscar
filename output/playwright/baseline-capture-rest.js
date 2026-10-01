async (page) => {
  const origin = "http://localhost:3001";
  const routes = [
    ["home", "/employee"], ["tasks", "/employee/tasks"],
    ["packages", "/employee/packages"], ["wallet", "/employee/wallet"],
    ["withdraw", "/employee/withdraw"], ["account", "/employee/account"],
    ["login", "/employee/auth/login"],
  ];
  const report = [];
  for (const [width, height] of [[768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const [name, path] of routes) {
      const response = await page.goto(origin + path, { waitUntil: "domcontentloaded" });
      await page.screenshot({ path: `output/playwright/before/${name}-${width}x${height}.png`, fullPage: true });
      report.push({ name, width, height, status: response?.status(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) });
    }
  }
  return report;
}
