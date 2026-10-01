async (page) => {
  const origin = "http://localhost:3101";
  const routes = [
    ["home", "/employee"], ["tasks", "/employee/tasks"],
    ["packages", "/employee/packages"], ["team", "/employee/team"],
    ["wallet", "/employee/wallet"], ["deposit", "/employee/deposit"],
    ["withdraw", "/employee/withdraw"], ["account", "/employee/account"],
    ["login", "/employee/auth/login"], ["register", "/employee/auth/register"],
    ["verify-email", "/employee/auth/verify-email"],
    ["forgot-password", "/employee/auth/forgot-password"],
    ["reset-password", "/employee/auth/reset-password"],
    ["support", "/employee/support"], ["terms", "/employee/terms"],
    ["privacy", "/employee/privacy"], ["faq", "/employee/faq"],
  ];
  const sizes = [[430,932]];
  const main = new Set(["home", "tasks", "packages", "wallet", "withdraw", "account", "login"]);
  const report = []; const errors = []; const backendRequests = []; page.on("pageerror", error => errors.push(error.message)); page.on("request", request => { if(request.url().includes("/api/") || request.url().includes(":4000")) backendRequests.push(request.url()); });
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const [name, path] of routes) {
      if (width !== 390 && !main.has(name)) continue;
      const response = await page.goto(origin + path, { waitUntil: "domcontentloaded" });
      await page.locator(".employee-scope h1, .employee-scope h2").first().waitFor(); await page.waitForLoadState("networkidle");
      const widthInfo = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      await page.screenshot({ path: `output/playwright/before-replayed/${name}-${width}x${height}.png`, fullPage: true });
      report.push({ name, path, width, height, status: response?.status(), overflow: widthInfo.scroll > widthInfo.client });
    }
  }
  return { routes: report, errors, backendRequests };
}
