import { mkdir, readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import {
  employeeSignIn,
  reviewPurchase,
  reviewConfiguration,
  confirmPurchase,
  financeState,
  editFutureTerms,
  blockWithdrawals,
} from "./support/p04-finance";
import {
  managementActor,
  managementSignIn,
  reviewInvitation,
} from "./support/admin-management";

const observeUi = (page: Page) => {
  let failed = false;
  page.on("pageerror", () => {
    failed = true;
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const expectedDenial =
      /Failed to load resource:.*status of (?:400|401)/u.test(message.text());
    const favicon =
      message.location().url.endsWith("/favicon.ico") &&
      /status of 404/u.test(message.text());
    if (!expectedDenial && !favicon) failed = true;
  });
  return () => {
    expect(failed).toBe(false);
  };
};

const waitForFinancialContent = async (page: Page) => {
  const route = new URL(page.url()).pathname;
  if (route === "/employee/packages") {
    await expect(page.getByText(/شروط الكتالوج الحالية/u)).toHaveCount(5);
    await expect(page.getByLabel("شروط الاشتراك المحفوظة")).toBeVisible();
  } else if (route === "/employee/wallet") {
    await expect(page.getByText(/المحجوز الإحالي:/u)).toContainText("28.00");
    await expect(page.getByText(/المحجوز غير الإحالي:/u)).toContainText(
      "1,000.00",
    );
    await expect(
      page.getByRole("button", { name: /حجز رصيد/u }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/السحب محظور حالياً على الحساب/u),
    ).toBeVisible();
  } else if (route === "/employee/team") {
    await expect(
      page.getByRole("heading", { name: "رابط وكود الدعوة الخاص بك" }),
    ).toBeVisible();
    await expect(
      page
        .getByText("كود الدعوة:", { exact: true })
        .locator("..")
        .locator("bdi"),
    ).not.toBeEmpty();
  } else if (route === "/employee/account") {
    await expect(page.getByLabel("شروط الاشتراك المحفوظة")).toBeVisible();
    await expect(page.getByText("112.00", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "P04 buyer" }),
    ).toBeVisible();
  } else if (route === "/admin/packages") {
    await expect(page.locator("tbody tr")).toHaveCount(5);
    await expect(page.locator("tbody tr").first()).toContainText("61.000001");
  } else if (route === "/admin/finance") {
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(page.getByText("28 عملية", { exact: true })).toBeVisible();
  } else if (route === "/admin/referrals") {
    await expect(
      page
        .getByRole("button")
        .filter({ has: page.getByText("P04 buyer", { exact: true }) }),
    ).toBeVisible();
    await expect(
      page.getByText("الحساب المختار: فريق P04 ancestor 0", { exact: true }),
    ).toBeVisible();
  } else {
    throw new Error("P04_UNEXPECTED_FINANCIAL_SURFACE");
  }
  await expect(
    page.getByText("جارٍ تحميل البيانات المالية…", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
};

const captureSurface = async (
  page: Page,
  name: string,
  scope?: string,
  ready?: () => Promise<void>,
) => {
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await ready?.();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .getByRole("dialog")
        .evaluateAll((dialogs) =>
          dialogs.every((dialog) => dialog.scrollWidth <= dialog.clientWidth),
        ),
    ).toBe(true);
    expect(
      await page.locator('[role="dialog"] bdi').evaluateAll((values) =>
        values.every((value) => {
          const box = value.getBoundingClientRect();
          return box.left >= 0 && box.right <= innerWidth;
        }),
      ),
    ).toBe(true);
    if (scope !== undefined) {
      await expect(page.locator(scope).first()).toHaveAttribute("dir", "rtl");
      expect(
        await page
          .locator(scope)
          .evaluateAll((elements) =>
            elements.every(
              (element) =>
                getComputedStyle(element).fontFamily.includes("Cairo") &&
                getComputedStyle(element).direction === "rtl",
            ),
          ),
      ).toBe(true);
      expect(
        await page
          .locator(scope)
          .evaluateAll((elements) =>
            elements.every(
              (element) => getComputedStyle(element).colorScheme !== "dark",
            ),
          ),
      ).toBe(true);
    }
    expect(
      await page
        .locator("input:not([type=hidden])")
        .evaluateAll((inputs) =>
          inputs.every(
            (input) =>
              input instanceof HTMLInputElement &&
              ((input.labels?.length ?? 0) > 0 ||
                Boolean(input.getAttribute("aria-label")?.trim())),
          ),
        ),
    ).toBe(true);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `../../output/playwright/p03/p03-final-${name}-${String(width)}.png`,
      fullPage: true,
      mask: [
        page.locator("input"),
        page.locator("bdi"),
        page.locator("[title]"),
      ],
    });
  }
};

test("P04 loading feedback remains distinct from populated wallet acceptance", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "wallet" });
  await employeeSignIn(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/wallet/me", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto("/employee/wallet");
    await expect(
      page.getByText("جارٍ تحميل البيانات المالية…", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(/المحجوز الإحالي:/u)).toHaveCount(0);
    await mkdir("../../output/playwright/p03", { recursive: true });
    await page.screenshot({
      path: "../../output/playwright/p03/p03-final-p04-wallet-loading-320.png",
      mask: [
        page.locator("input"),
        page.locator("bdi"),
        page.locator("[title]"),
      ],
    });
  } finally {
    release();
  }
  await expect(page.getByText(/المحجوز الإحالي:/u)).toContainText("28.00");
  await expect(
    page.getByText("جارٍ تحميل البيانات المالية…", { exact: true }),
  ).toHaveCount(0);
});

test("P04 existing financial surfaces retain narrow layouts, typography and dialog focus", async ({
  page,
  request,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "wallet" });
  const checkDiagnostics = observeUi(page);
  await employeeSignIn(page);
  await reviewPurchase(page);
  await confirmPurchase(page);
  await expect(page.getByRole("dialog")).toContainText(
    "تم تفعيل المنصب وتسجيل الشراء",
  );
  await editFutureTerms(request, "61.000001");
  await blockWithdrawals(request, (await financeState(scenario)).employeeId);
  const ready = () => waitForFinancialContent(page);
  for (const route of ["packages", "wallet", "team", "account"]) {
    await page.goto(`/employee/${route}`);
    await expect(page.locator("main")).toBeVisible();
    await captureSurface(
      page,
      `p04-employee-${route}`,
      ".employee-scope",
      ready,
    );
  }
  await page.goto("/employee/wallet");
  const walletDetail = page.getByRole("button", { name: /حجز رصيد/u }).first();
  await walletDetail.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  await expect(page.getByRole("dialog")).toContainText("المحجوز");
  await captureSurface(page, "p04-wallet-detail", undefined, ready);
  await page.keyboard.press("Escape");
  await expect(walletDetail).toBeFocused();
  await reviewPurchase(page, "S2");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  expect(
    await sheet.evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  await captureSurface(page, "p04-purchase-review", undefined, ready);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page.locator("#upgrade-btn-S2")).toBeFocused();
  await managementSignIn(page);
  for (const route of ["packages", "finance", "referrals"]) {
    await page.goto(`/admin/${route}`);
    await expect(page.locator("main")).toBeVisible();
    if (route === "referrals") {
      await page.getByLabel("بحث عن الحساب الجذر").fill("P04 ancestor 0");
      await page
        .getByRole("combobox", { name: "اختر عضو لحساب فريقه" })
        .click();
      await page.getByRole("option", { name: /P04 ancestor 0/u }).click();
    }
    await captureSurface(page, `p04-admin-${route}`, ".admin-scope", ready);
  }
  await page.goto("/admin/finance");
  await page
    .getByRole("button", { name: "تفاصيل", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("المبلغ الصافي:");
  await captureSurface(page, "p04-finance-detail", undefined, ready);
  await page.keyboard.press("Escape");
  await reviewConfiguration(page, "61");
  const dialog = page.getByRole("dialog");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await captureSurface(page, "p04-configuration-review", undefined, ready);
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  checkDiagnostics();
});

test("US2-06 P03-final all public authentication peers preserve normal narrow layouts and credential privacy", async ({
  page,
  request,
  scenario,
}) => {
  const checkDiagnostics = observeUi(page);
  let privilegedRead = false;
  let leakedReferrer = false;
  page.on("request", (request) => {
    if (/\/api\/v1\/(?:admin|users)\//u.test(request.url()))
      privilegedRead = true;
    if (request.headers()["referer"]?.includes("token=")) leakedReferrer = true;
  });
  for (const [name, path, scope] of [
    ["employee-login", "/employee/auth/login", ".employee-scope"],
    ["employee-register", "/employee/auth/register", ".employee-scope"],
    ["employee-forgot", "/employee/auth/forgot-password", ".employee-scope"],
    ["shared-forgot", "/auth/forgot-password", undefined],
    ["admin-login", "/admin/auth/login", ".admin-scope"],
  ] as const) {
    await page.goto(path);
    await expect(page.locator("form")).toBeVisible();
    await captureSurface(page, name, scope);
  }
  const api = "http://127.0.0.1:4103/api/v1";
  expect(
    (
      await request.post(`${api}/auth/resend-verification`, {
        data: { email: "pending@p03.test" },
      })
    ).status(),
  ).toBe(200);
  const verification = await scenario.command({
    command: "mail",
    email: "pending@p03.test",
  });
  expect(
    (
      await request.post(`${api}/auth/forgot-password`, {
        data: { email: "employee@p03.test" },
      })
    ).status(),
  ).toBe(200);
  const reset = await scenario.command({
    command: "mail",
    email: "employee@p03.test",
  });
  const actor = await managementActor(request);
  expect(
    (
      await request.post(`${api}/admin/invitations`, {
        headers: actor.headers,
        data: {
          fullName: "مسؤول اختبار",
          email: "ui-recipient@p03.test",
          reason: "P03 UI preview acceptance",
          confirmed: true,
        },
      })
    ).status(),
  ).toBe(201);
  const invitation = await scenario.command({
    command: "mail",
    email: "ui-recipient@p03.test",
  });
  for (const [name, path, mail, action, scope] of [
    [
      "employee-verify",
      "/employee/auth/verify-email",
      verification,
      "تأكيد تفعيل البريد الإلكتروني",
      ".employee-scope",
    ],
    [
      "shared-verify",
      "/auth/verify-email",
      verification,
      "تأكيد تفعيل البريد الإلكتروني",
      undefined,
    ],
    [
      "employee-reset",
      "/employee/auth/reset-password",
      reset,
      "حفظ كلمة المرور الجديدة",
      ".employee-scope",
    ],
    [
      "shared-reset",
      "/auth/reset-password",
      reset,
      "حفظ كلمة المرور الجديدة",
      undefined,
    ],
    [
      "admin-accept",
      "/admin/auth/accept-invitation",
      invitation,
      "قبول الدعوة",
      ".admin-scope",
    ],
  ] as const) {
    if (mail === null || !("url" in mail) || mail.url === null)
      throw new Error("P03_MAIL_MISSING");
    const link = new URL(mail.url);
    link.pathname = path;
    const response = await page.goto(link.href);
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(page).not.toHaveURL(/token=/u);
    await expect(
      page.getByRole("button", { name: action, exact: true }),
    ).toBeEnabled();
    await captureSurface(page, name, scope);
  }
  expect(
    await scenario.command({ command: "state", email: "pending@p03.test" }),
  ).toMatchObject({ user: { verified: false, sessions: 0 } });
  expect(
    await scenario.command({
      command: "state",
      email: "ui-recipient@p03.test",
    }),
  ).toMatchObject({ user: null });
  expect(privilegedRead).toBe(false);
  expect(leakedReferrer).toBe(false);
  checkDiagnostics();
});

test("US6-07 P03-final account header management and invitation dialogs preserve mixed identity keyboard and pending dismissal", async ({
  page,
  scenario,
}) => {
  const checkDiagnostics = observeUi(page);
  await scenario.command({ command: "display-fixtures" });
  await page.goto("/employee/auth/login");
  await page.getByLabel("البريد الإلكتروني للعمل").fill("employee@p03.test");
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("P03 test password only!");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page).toHaveURL("/employee");
  await page.goto("/employee/account");
  await expect(
    page.getByRole("heading", { name: /Mixed Direction Identity/u }),
  ).toBeVisible();
  await captureSurface(page, "account-long", ".employee-scope");
  await page.getByRole("button", { name: "تسجيل الخروج من الحساب" }).click();
  await expect(page).toHaveURL(/\/employee\/auth\/login/u);
  await managementSignIn(page);
  await page.goto("/admin/settings/admins");
  await expect(
    page.getByRole("banner").getByText(/Mixed Direction Identity/u),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "إضافة مسؤول جديد" }),
  ).toBeEnabled();
  await captureSurface(page, "management-long", ".admin-scope");
  const opener = page.getByRole("button", { name: "إضافة مسؤول جديد" });
  await opener.click();
  const close = page.getByRole("button", {
    name: "إغلاق النافذة",
    exact: true,
  });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "مراجعة الدعوة" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await captureSurface(page, "invitation-draft", ".admin-scope");
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await reviewInvitation(page, "ui-pending@p03.test");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: /سبب الإجراء/u })
    .fill("P03 pending dismissal acceptance");
  await captureSurface(page, "invitation-review", ".admin-scope");
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/admin/invitations", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  try {
    const dispatch = page.waitForRequest(
      (request) =>
        request.url().endsWith("/admin/invitations") &&
        request.method() === "POST",
    );
    await dialog.getByRole("button", { name: "تأكيد إرسال الدعوة" }).click();
    await dispatch;
    await expect(
      dialog.getByRole("button", { name: "تأكيد إرسال الدعوة" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  } finally {
    release?.();
  }
  await expect(
    page.getByText("تم تسجيل الدعوة. لا يصبح المستلم مسؤولاً حتى يقبلها."),
  ).toBeVisible();
  checkDiagnostics();
});

test("US4-07 recovery and password surfaces retain Cairo RTL narrow layouts focus and private history", async ({
  page,
  scenario,
}) => {
  let unexpectedError = false;
  page.on("pageerror", () => {
    unexpectedError = true;
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const deniedRestore =
      /Failed to load resource:.*status of (?:400|401)/u.test(message.text());
    const missingFavicon =
      message.location().url === "http://127.0.0.1:3103/favicon.ico" &&
      /status of 404/u.test(message.text());
    if (!deniedRestore && !missingFavicon) unexpectedError = true;
  });
  await page.goto("/employee/auth/forgot-password");
  await page.getByLabel("البريد الإلكتروني المسجل").fill("employee@p03.test");
  await page.getByRole("button", { name: "إرسال رابط إعادة التعيين" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const mail = await scenario.command({
    command: "mail",
    email: "employee@p03.test",
  });
  if (mail === null || !("url" in mail) || mail.url === null)
    throw new Error("P03_MAIL_MISSING");
  const link = new URL(mail.url);
  link.pathname = "/employee/auth/reset-password";
  const secret = link.searchParams.get("token");
  if (secret === null) throw new Error("P03_CREDENTIAL_MISSING");
  await page.goto(link.href);
  await expect(page).not.toHaveURL(/token=/u);
  await expect(
    page.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
  ).toBeEnabled();
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.locator(".employee-scope")).toHaveAttribute("dir", "rtl");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".employee-scope")
        .evaluate((element) =>
          getComputedStyle(element).fontFamily.includes("Cairo"),
        ),
    ).toBe(true);
    await page.screenshot({
      path: `../../output/playwright/p03/us4-reset-${String(width)}.png`,
      mask: [page.locator("input")],
    });
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "رابط إعادة التعيين غير صالح أو منتهي" }),
  ).toBeVisible();
  expect(
    await page.evaluate((sentinel) => {
      const state: unknown = history.state;
      return JSON.stringify({
        history: state,
        location: location.href,
        local: Object.entries(localStorage),
        session: Object.entries(sessionStorage),
      }).includes(sentinel);
    }, secret),
  ).toBe(false);
  await page.goto("/employee/auth/login");
  await page.getByLabel("البريد الإلكتروني للعمل").fill("employee@p03.test");
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("P03 test password only!");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page).toHaveURL("/employee");
  await page.goto("/employee/account");
  const opener = page.getByRole("button", { name: /تغيير كلمة المرور/u });
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const close = page.getByRole("button", { name: "إغلاق النافذة" });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "إلغاء", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../../output/playwright/p03/us4-change-${String(width)}.png`,
      mask: [page.locator("input")],
    });
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  for (const surface of ["reset", "change"]) {
    for (const width of [320, 390, 430, 1280]) {
      const artifact = await readFile(
        `../../output/playwright/p03/us4-${surface}-${String(width)}.png`,
      );
      expect(artifact.includes(Buffer.from(secret))).toBe(false);
      expect(artifact.includes(Buffer.from("P03 test password only!"))).toBe(
        false,
      );
    }
  }
  expect(unexpectedError).toBe(false);
});
