async (page) => {
  await page.screenshot({ path: "output/playwright/before/package-sheet-390x844.png", fullPage: true });
  return await page.getByRole("dialog").innerText();
}
