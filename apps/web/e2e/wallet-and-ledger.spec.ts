import { test, expect } from "./support/fixtures";
import {
  employeeSignIn,
  financeState,
  reviewPurchase,
  confirmPurchase,
  blockWithdrawals,
} from "./support/p04-finance";
import { managementSignIn } from "./support/admin-management";

test.use({ actionTimeout: 15000, navigationTimeout: 20000 });

test("P04 old wallet detail cannot complete into another account and ownership is denied", async ({
  page,
  request,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "wallet" });
  await employeeSignIn(page);
  await page.goto("/employee/wallet");
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/wallet\/me\/ledger\/[0-9a-f-]+$/u, async (route) => {
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  const detailRequest = page.waitForRequest((outgoing) =>
    /\/wallet\/me\/ledger\/[0-9a-f-]+$/u.test(new URL(outgoing.url()).pathname),
  );
  await page
    .getByRole("button", { name: /حجز رصيد/u })
    .first()
    .click();
  const original = await detailRequest;
  try {
    await page.goto("/employee/account");
    await page
      .getByRole("button", { name: "تسجيل الخروج من الحساب", exact: true })
      .click();
    await expect(page).toHaveURL(/\/employee\/auth\/login/u);
    await employeeSignIn(page, "other@p04.test");
    const walletRequest = page.waitForRequest((outgoing) =>
      new URL(outgoing.url()).pathname.endsWith("/wallet/me"),
    );
    await page.goto("/employee/wallet");
    const current = await walletRequest;
    const forbidden = await request.get(original.url(), {
      headers: { authorization: current.headers()["authorization"] ?? "" },
    });
    expect(forbidden.status()).toBe(404);
    await expect(
      page.getByText("لا توجد عمليات مسجلة تحت هذا التصنيف.", { exact: true }),
    ).toBeVisible();
  } finally {
    release?.();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await financeState(scenario)).wallet.total).toBe("1200");
  expect((await financeState(scenario, "other@p04.test")).wallet.total).toBe(
    "0",
  );
});

test("P04 a denied wallet read survives the route check and remount until explicit retry", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "wallet" });
  await employeeSignIn(page);
  let reads = 0;
  await page.route("**/wallet/me", async (route) => {
    reads++;
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        statusCode: 403,
        code: "FORBIDDEN",
      }),
    });
  });
  await page.goto("/employee/wallet");
  await expect(
    page.getByRole("alert").filter({ hasText: "غير مسموح بالوصول" }),
  ).toBeVisible();
  expect(reads).toBe(1);
  await page.getByRole("link", { name: /حسابي/u }).last().click();
  await expect(page).toHaveURL("/employee/account");
  await expect(
    page.getByRole("alert").filter({ hasText: "غير مسموح بالوصول" }),
  ).toBeVisible();
  expect(reads).toBe(1);
  await page.unroute("**/wallet/me");
  await page
    .getByRole("button", { name: "إعادة المحاولة", exact: true })
    .click();
  await expect(page.getByText("172.00", { exact: true }).first()).toBeVisible();
});

test("P04 paid activation unlocks only available referral funds and release preserves each reserved source", async ({
  page,
  request,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "wallet" });
  await blockWithdrawals(request, (await financeState(scenario)).employeeId);
  await employeeSignIn(page);
  await reviewPurchase(page);
  await expect(page.getByRole("dialog")).toContainText("172.00");
  await confirmPurchase(page);
  await expect(page.getByRole("dialog")).toContainText(
    "تم تفعيل المنصب وتسجيل الشراء",
  );
  const paid = await financeState(scenario);
  expect(paid.wallet).toEqual({
    availableReferral: "112",
    availableNonReferral: "0",
    reservedReferral: "28",
    reservedNonReferral: "1000",
    total: "1140",
  });
  await page.goto("/employee/wallet");
  await expect(page.getByText("112.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/السحب محظور حالياً على الحساب/u)).toBeVisible();
  await expect(page.getByText(/المحجوز الإحالي:/u)).toContainText("28.00");
  await expect(page.getByText(/المحجوز غير الإحالي:/u)).toContainText(
    "1,000.00",
  );
  await scenario.command({ command: "p04-release", email: "buyer@p04.test" });
  const released = await financeState(scenario);
  expect(released.wallet).toEqual({
    availableReferral: "113",
    availableNonReferral: "1000",
    reservedReferral: "27",
    reservedNonReferral: "0",
    total: "1140",
  });
  await page.reload();
  await expect(
    page
      .getByText("الأموال المؤهلة للسحب حسب المصدر", { exact: true })
      .locator(".."),
  ).toContainText("1,113.00");
  await expect(page.getByText(/المحجوز الإحالي:/u)).toContainText("27.00");
  await expect(page.getByText(/المحجوز غير الإحالي:/u)).toContainText("0.00");
  await expect(
    page.getByText("المتاح الإحالي", { exact: true }).locator(".."),
  ).toContainText("113.00");
  await expect(
    page.getByText("المتاح غير الإحالي", { exact: true }).locator(".."),
  ).toContainText("1,000.00");
  const releaseEntry = page
    .getByRole("button", { name: /فك حجز الرصيد/u })
    .first();
  const nextHistoryPage = page.getByRole("button", {
    name: "التالي",
    exact: true,
  });
  await expect(nextHistoryPage).toBeEnabled();
  // Fixed fixture timestamps let the UUID tie-break place release on either page.
  if ((await releaseEntry.count()) === 0) await nextHistoryPage.click();
  await releaseEntry.click();
  await expect(page.getByRole("dialog")).toContainText("0.00");
  await page.keyboard.press("Escape");
  if (paid.expiresAt === null) throw new Error("P04_MISSING_EXPIRY");
  await scenario.command({ command: "p04-clock", instant: paid.expiresAt });
  await page.reload();
  await expect(
    page.getByText("1,000.00", { exact: true }).first(),
  ).toBeVisible();
  expect((await financeState(scenario)).wallet).toEqual(released.wallet);
  await expect(
    page.getByText("إحالات غير مؤهلة للسحب", { exact: true }).locator(".."),
  ).toContainText("113.00");
  await expect(page.getByText(/السحب محظور حالياً على الحساب/u)).toBeVisible();
  await reviewPurchase(page);
  await confirmPurchase(page);
  await expect(page.getByRole("dialog")).toContainText(
    "تم تفعيل المنصب وتسجيل الشراء",
  );
  await page.goto("/employee/wallet");
  await expect(
    page.getByText("إحالات غير مؤهلة للسحب", { exact: true }).locator(".."),
  ).toContainText("0.00");
  await expect(page.getByText(/المحجوز الإحالي:/u)).toContainText("27.00");
  await expect(page.getByText(/السحب محظور حالياً على الحساب/u)).toBeVisible();
  expect((await financeState(scenario)).wallet).toEqual({
    ...released.wallet,
    availableReferral: "53",
    total: "1080",
  });
});

test("P04 reserved sources remain owned and neutral history is server paged", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "wallet" });
  const state = await financeState(scenario);
  expect(state.wallet).toEqual({
    availableReferral: "172",
    availableNonReferral: "0",
    reservedReferral: "28",
    reservedNonReferral: "1000",
    total: "1200",
  });
  await employeeSignIn(page);
  await page.goto("/employee/wallet");
  await expect(
    page.getByText("1,200.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("1,028.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await expect(page.getByText(/2.*2/u).last()).toBeVisible();
  expect((await financeState(scenario)).wallet).toEqual(state.wallet);
  await page.goto("/employee/account");
  await expect(page.getByText("172.00", { exact: true }).first()).toBeVisible();
});

test("P04 finance neutral metric covers both pages and changes with SQL search", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "wallet" });
  await managementSignIn(page);
  await page.goto("/admin/finance");
  await page.getByLabel("بحث في السجل المالي").fill("P04 buyer");
  await expect(page.getByText("28 عملية", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await expect(page.getByText("28 عملية", { exact: true })).toBeVisible();
  await page.getByLabel("بحث في السجل المالي").fill("no-matching-p04-employee");
  await expect(
    page.getByText("لا توجد عمليات مالية مطابقة", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0 عملية", { exact: true })).toBeVisible();
});
