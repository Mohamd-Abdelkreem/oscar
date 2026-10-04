import { mkdir } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import {
  confirmManagement,
  managementSignIn,
  reviewInvitation,
} from "./support/admin-management";

test("US1-10 P03-final first eligible login succeeds in an independent process", async ({
  page,
  scenario,
}) => {
  await page.goto("/employee/auth/login");
  await page.getByLabel("البريد الإلكتروني للعمل").fill("employee@p03.test");
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("P03 test password only!");
  const response = page.waitForResponse((reply) =>
    reply.url().endsWith("/auth/login"),
  );
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL("/employee");
  expect(
    await scenario.command({ command: "state", email: "employee@p03.test" }),
  ).toMatchObject({ user: { sessions: 1 } });
});

test("US1-09 P03-final unchanged limiter returns real 429 without replay in one process", async ({
  page,
  scenario,
}) => {
  await page.goto("/employee/auth/login");
  const statuses: number[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/auth/login"))
      statuses.push(response.status());
  });
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.getByLabel("البريد الإلكتروني للعمل").fill("employee@p03.test");
    await page.getByLabel("كلمة المرور", { exact: true }).fill("incorrect");
    const response = page.waitForResponse((reply) =>
      reply.url().endsWith("/auth/login"),
    );
    await page
      .getByRole("button", { name: "تسجيل الدخول", exact: true })
      .click();
    expect((await response).status()).toBe(attempt < 5 ? 401 : 429);
    await expect(page.locator("p[role=alert]")).toBeVisible();
  }
  await expect(page.locator("p[role=alert]")).toContainText("محاولات كثيرة");
  expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  expect(
    await scenario.command({ command: "state", email: "employee@p03.test" }),
  ).toMatchObject({ user: { sessions: 0 } });
});

test("US4-12 P03-final missing duplicate oversized and malformed links cannot consume credentials", async ({
  page,
}) => {
  // Absent/empty/ambiguous/over-limit input must never reach a preview or write.
  // A bounded malformed input may reach the real validator, but never consumption.
  let consumed = false;
  let previews = 0;
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4103/api/v1/auth/")) return;
    if (
      /validate-(?:verification-token|reset-token|admin-invitation)/u.test(
        request.url(),
      )
    )
      previews++;
    if (request.method() !== "GET" && !request.url().endsWith("/refresh"))
      consumed = true;
  });
  for (const path of [
    "/employee/auth/verify-email",
    "/auth/reset-password",
    "/admin/auth/accept-invitation",
  ]) {
    for (const query of [
      "",
      "?token=",
      "?token=a&token=b",
      `?token=${"x".repeat(4097)}`,
    ]) {
      await page.goto(`${path}${query}`);
      await expect(page).not.toHaveURL(/token=/u);
      if (path === "/employee/auth/verify-email") {
        await expect(
          page.getByRole("button", {
            name: "تأكيد تفعيل البريد الإلكتروني",
            exact: true,
          }),
        ).toBeDisabled();
        await expect(page.getByRole("textbox")).toBeVisible();
      } else {
        await expect(
          page.getByRole("heading", { name: /غير صالح|غير صالحة/u }),
        ).toBeVisible();
      }
    }
  }
  expect(previews).toBe(0);
  for (const path of [
    "/employee/auth/verify-email",
    "/auth/reset-password",
    "/admin/auth/accept-invitation",
  ]) {
    await page.goto(`${path}?token=malformed`);
    await expect(page).not.toHaveURL(/token=/u);
    await expect(
      page.getByRole("heading", { name: /غير صالح|غير صالحة/u }),
    ).toBeVisible();
  }
  expect(previews).toBe(3);
  expect(consumed).toBe(false);
});

declare global {
  interface Window {
    observeCredentialMessage: (data: unknown) => Promise<void>;
  }
}

test("US6-01 bounded management invitation acceptance separate sign-in lifecycle audit and responsive views", async ({
  page,
  browser,
  scenario,
}) => {
  await scenario.command({ command: "management-fixtures" });
  await managementSignIn(page);
  await page.goto("/admin/settings/admins");
  await expect(
    page.getByPlaceholder("بحث بالاسم أو البريد الإلكتروني..."),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "تصفية الحالة غير متاحة" }),
  ).toBeDisabled();
  const invites = page.getByRole("region", { name: "دعوات المسؤولين" });
  await expect(invites.getByText("إجمالي الدعوات: 26")).toBeVisible();
  await invites.getByRole("button", { name: "التالي" }).click();
  await expect(invites.getByRole("button", { name: "التالي" })).toBeDisabled();
  await expect(invites.getByRole("row")).toHaveCount(2);
  const adminPages = page.getByRole("region", { name: "صفحات المسؤولين" });
  await adminPages.getByRole("button", { name: "التالي" }).click();
  await expect(
    adminPages.getByRole("button", { name: "التالي" }),
  ).toBeDisabled();
  await invites.getByRole("button", { name: "السابق" }).click();
  await adminPages.getByRole("button", { name: "السابق" }).click();
  await expect(
    invites.getByText("لم تتم محاولة الإرسال").first(),
  ).toBeVisible();
  const email = "accepted-admin@p03.test";
  await reviewInvitation(page, email);
  await confirmManagement(page, "تأكيد إرسال الدعوة");
  await expect(
    page.getByText("تم تسجيل الدعوة. لا يصبح المستلم مسؤولاً حتى يقبلها."),
  ).toBeVisible();
  const invitationRow = invites.getByRole("row").filter({ hasText: email });
  await expect(invitationRow).toContainText("بانتظار القبول");
  await expect(invitationRow).toContainText(
    "قبل مزود البريد الإرسال؛ لا يؤكد وصوله",
  );
  await invitationRow
    .getByRole("button", { name: "قراءة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(email);
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  const delivered = await scenario.command({ command: "mail", email });
  if (delivered === null || !("url" in delivered) || delivered.url === null)
    throw new Error("P03_MAIL_MISSING");
  const recipientContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3103",
  });
  try {
    const recipient = await recipientContext.newPage();
    await recipient.goto(delivered.url);
    await expect(recipient).not.toHaveURL(/token=/u);
    await expect(
      recipient.getByRole("button", { name: "قبول الدعوة" }),
    ).toBeEnabled();
    await mkdir("../../output/playwright/p03", { recursive: true });
    for (const width of [320, 1280]) {
      await recipient.setViewportSize({ width, height: 850 });
      expect(
        await recipient.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await recipient.screenshot({
        path: `../../output/playwright/p03/us6-acceptance-${String(width)}.png`,
        mask: [recipient.locator("input")],
      });
    }
    expect(await scenario.command({ command: "state", email })).toMatchObject({
      user: null,
    });
    await recipient.getByLabel(/^كلمة المرور الجديدة/u).fill(password);
    await recipient
      .getByLabel("تأكيد كلمة المرور", { exact: true })
      .fill(password);
    await recipient.getByRole("button", { name: "قبول الدعوة" }).click();
    await expect(
      recipient.getByText("تم قبول الدعوة", { exact: true }),
    ).toBeVisible();
    expect(await scenario.command({ command: "state", email })).toMatchObject({
      user: { role: "ADMIN", status: "ACTIVE", sessions: 0 },
    });
    await recipient.goto(delivered.url);
    await expect(
      recipient.getByText("رابط الدعوة غير صالح أو منتهي"),
    ).toBeVisible();
    await managementSignIn(recipient, email, password);
    await page.reload();
    const accountRow = page
      .getByRole("table", { name: "حسابات المسؤولين" })
      .getByRole("row")
      .filter({ hasText: email });
    await accountRow
      .getByRole("button", { name: "تعطيل", exact: true })
      .click();
    await confirmManagement(page, "تأكيد التعطيل");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await scenario.command({ command: "state", email })).toMatchObject({
      user: { status: "DEACTIVATED", sessions: 0 },
    });
    await accountRow
      .getByRole("button", { name: "تفعيل", exact: true })
      .click();
    await confirmManagement(page, "تأكيد التفعيل");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await recipient.goto("/admin");
    await expect(recipient).toHaveURL(/\/admin\/auth\/login/u);
    expect(await scenario.command({ command: "state", email })).toMatchObject({
      user: { status: "ACTIVE", sessions: 0 },
    });
    const persisted = await scenario.command({
      command: "management-state",
      email,
    });
    if (persisted === null || !("audits" in persisted))
      throw new Error("P03_AUDIT_MISSING");
    expect(persisted.invitation).toMatchObject({
      accepted: true,
      revoked: false,
      deliveryStatus: "ACKNOWLEDGED",
    });
    expect(
      persisted.audits.filter(
        (audit) => audit.reason === "P03 reviewed management request",
      ),
    ).toHaveLength(3);
  } finally {
    await recipientContext.close();
  }
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".admin-scope")
        .first()
        .evaluate((element) =>
          getComputedStyle(element).fontFamily.includes("Cairo"),
        ),
    ).toBe(true);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `../../output/playwright/p03/us6-management-${String(width)}.png`,
      fullPage: true,
      mask: [page.locator('[dir="ltr"]')],
    });
  }
  await reviewInvitation(page, "focus@p03.test");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByLabel(/^الاسم الكامل/u)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "إضافة مسؤول جديد" }),
  ).toBeFocused();
});

test("US6-02 replacement cooldown collision revocation expiry and delivery evidence remain distinct", async ({
  page,
  browser,
  scenario,
}) => {
  await managementSignIn(page);
  await page.goto("/admin/settings/admins");
  await reviewInvitation(page, "employee@p03.test");
  await confirmManagement(page, "تأكيد إرسال الدعوة");
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  await expect(page.getByLabel(/^البريد الإلكتروني/u)).toHaveValue(
    "employee@p03.test",
  );
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  const email = "replaced@p03.test";
  await scenario.command({ command: "delivery", outcome: "rejected" });
  await reviewInvitation(page, email);
  await confirmManagement(page, "تأكيد إرسال الدعوة");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "تعذر تأكيد نتيجة الطلب",
  );
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  const row = page
    .getByRole("region", { name: "دعوات المسؤولين" })
    .getByRole("row")
    .filter({ hasText: email });
  await expect(row).toContainText("رفض مزود البريد الإرسال");
  const oldMail = await scenario.command({ command: "mail", email });
  if (oldMail === null || !("url" in oldMail) || oldMail.url === null)
    throw new Error("P03_MAIL_MISSING");
  await row.getByRole("button", { name: "إعادة الإصدار", exact: true }).click();
  await confirmManagement(page, "تأكيد إعادة الإصدار");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "تغير السجل أو تعذر تنفيذ الإجراء",
  );
  await scenario.command({ command: "invitation-cooldown", email });
  await scenario.command({ command: "delivery", outcome: "acknowledged" });
  await confirmManagement(page, "تأكيد إعادة الإصدار");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toContainText("قبل مزود البريد الإرسال؛ لا يؤكد وصوله");
  const replacedMail = await scenario.command({ command: "mail", email });
  if (
    replacedMail === null ||
    !("url" in replacedMail) ||
    replacedMail.url === null
  )
    throw new Error("P03_MAIL_MISSING");
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3103",
  });
  try {
    const recipient = await context.newPage();
    await recipient.goto(oldMail.url);
    await expect(
      recipient.getByText("رابط الدعوة غير صالح أو منتهي"),
    ).toBeVisible();
    await recipient.goto(replacedMail.url);
    await expect(
      recipient.getByRole("button", { name: "قبول الدعوة" }),
    ).toBeEnabled();
    await row
      .getByRole("button", { name: "إلغاء الدعوة", exact: true })
      .click();
    await confirmManagement(page, "تأكيد إلغاء الدعوة");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await recipient.getByLabel(/^كلمة المرور الجديدة/u).fill(password);
    await recipient
      .getByLabel("تأكيد كلمة المرور", { exact: true })
      .fill(password);
    await recipient.getByRole("button", { name: "قبول الدعوة" }).click();
    await expect(
      recipient.getByText("رابط الدعوة غير صالح أو منتهي"),
    ).toBeVisible();
    expect(await scenario.command({ command: "state", email })).toMatchObject({
      user: null,
    });
  } finally {
    await context.close();
  }
  const state = await scenario.command({ command: "management-state", email });
  expect(state).toMatchObject({
    invitation: {
      tokenVersion: 2,
      revoked: true,
      accepted: false,
      deliveryStatus: "ACKNOWLEDGED",
    },
  });
  const expiryEmail = email;
  await scenario.command({ command: "invitation-cooldown", email });
  await row.getByRole("button", { name: "إعادة الإصدار", exact: true }).click();
  await confirmManagement(page, "تأكيد إعادة الإصدار");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const expiredState = await scenario.command({
    command: "management-state",
    email: expiryEmail,
  });
  if (
    expiredState === null ||
    !("invitation" in expiredState) ||
    expiredState.invitation === null
  )
    throw new Error("P03_INVITATION_MISSING");
  const expiredMail = await scenario.command({
    command: "mail",
    email: expiryEmail,
  });
  if (
    expiredMail === null ||
    !("url" in expiredMail) ||
    expiredMail.url === null
  )
    throw new Error("P03_MAIL_MISSING");
  const expiryContext = await browser.newContext();
  try {
    const recipient = await expiryContext.newPage();
    await recipient.goto(expiredMail.url);
    await expect(
      recipient.getByRole("button", { name: "قبول الدعوة" }),
    ).toBeEnabled();
    await scenario.command({
      command: "expire",
      purpose: "invitation",
      targetId: expiredState.invitation.id,
    });
    await recipient.getByLabel(/^كلمة المرور الجديدة/u).fill(password);
    await recipient
      .getByLabel("تأكيد كلمة المرور", { exact: true })
      .fill(password);
    await recipient.getByRole("button", { name: "قبول الدعوة" }).click();
    await expect(
      recipient.getByText("رابط الدعوة غير صالح أو منتهي"),
    ).toBeVisible();
  } finally {
    await expiryContext.close();
  }
});

test("US6-03 lost issuance without ID stays unresolved across bounded read failure and dialog remount", async ({
  page,
  scenario,
}) => {
  await managementSignIn(page);
  await page.goto("/admin/settings/admins");
  const email = "unknown-issue@p03.test";
  let writes = 0;
  await page.route(`${apiUrl}/admin/invitations*`, async (route) => {
    if (route.request().method() === "POST") {
      writes++;
      await route.fetch();
      await route.abort("failed");
    } else
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
  });
  await reviewInvitation(page, email);
  await confirmManagement(page, "تأكيد إرسال الدعوة");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "تعذر تأكيد نتيجة الطلب",
  );
  await expect(
    page.getByRole("button", { name: "تأكيد إرسال الدعوة" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  await page.getByRole("button", { name: "إضافة مسؤول جديد" }).click();
  await expect(
    page.getByRole("button", { name: "مراجعة الدعوة" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  expect(
    await scenario.command({ command: "management-state", email }),
  ).toMatchObject({
    invitation: { accepted: false, revoked: false, tokenVersion: 1 },
  });
  await page.unroute(`${apiUrl}/admin/invitations*`);
});

test("US6-06 provider response loss retains pending intent and unknown delivery without apparent success", async ({
  page,
  scenario,
}) => {
  await managementSignIn(page);
  await page.goto("/admin/settings/admins");
  await scenario.command({ command: "delivery", outcome: "unknown" });
  const email = "unknown-provider@p03.test";
  await reviewInvitation(page, email);
  await confirmManagement(page, "تأكيد إرسال الدعوة");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "تعذر تأكيد نتيجة الطلب",
  );
  await expect(
    page.getByRole("button", { name: "تأكيد إرسال الدعوة" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  const row = page
    .getByRole("region", { name: "دعوات المسؤولين" })
    .getByRole("row")
    .filter({ hasText: email });
  await expect(row).toContainText("بانتظار القبول");
  await expect(row).toContainText("نتيجة الإرسال غير مؤكدة");
  expect(
    await scenario.command({ command: "management-state", email }),
  ).toMatchObject({
    invitation: {
      tokenVersion: 1,
      accepted: false,
      revoked: false,
      deliveryStatus: "UNKNOWN",
    },
  });
  expect(await scenario.command({ command: "state", email })).toMatchObject({
    user: null,
  });
});

test("US6-05 lost known-target status result reads persisted state without attributing success or replaying", async ({
  page,
  scenario,
}) => {
  await managementSignIn(page);
  await page.goto("/admin/settings/admins");
  const row = page.getByRole("row").filter({ hasText: "admin2@p03.test" });
  let writes = 0;
  await page.route(`${apiUrl}/admin/admins/*/status`, async (route) => {
    writes++;
    await route.fetch();
    await route.abort("failed");
  });
  await row.getByRole("button", { name: "تعطيل", exact: true }).click();
  await confirmManagement(page, "تأكيد التعطيل");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "الحالة المقروءة لا تثبت أن هذا الطلب هو الذي غيرها",
  );
  await expect(
    page.getByRole("button", { name: "تأكيد التعطيل" }),
  ).toBeDisabled();
  expect(
    await scenario.command({ command: "state", email: "admin2@p03.test" }),
  ).toMatchObject({ user: { status: "DEACTIVATED", sessions: 0 } });
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "تفعيل", exact: true }),
  ).toBeVisible();
  await row.getByRole("button", { name: "تفعيل", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "تأكيد التفعيل" }),
  ).toBeDisabled();
  expect(writes).toBe(1);
});

const browserErrors = new WeakMap<
  Page,
  { unexpected: boolean; expectedResponseLoss: boolean }
>();
test.beforeEach(({ page }) => {
  const observation = { unexpected: false, expectedResponseLoss: false };
  browserErrors.set(page, observation);
  page.on("pageerror", () => {
    observation.unexpected = true;
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const expectedBoundary =
      /Failed to load resource:.*(?:status of (?:400|401|403|409|429|503)|net::ERR_FAILED)/u.test(
        message.text(),
      );
    const missingFavicon =
      message.location().url === "http://127.0.0.1:3103/favicon.ico" &&
      /status of 404/u.test(message.text());
    const injectedCorsLoss =
      observation.expectedResponseLoss &&
      message.text().includes("blocked by CORS policy");
    if (!expectedBoundary && !missingFavicon && !injectedCorsLoss) {
      observation.unexpected = true;
    }
  });
});
test.afterEach(({ page }) => {
  expect(browserErrors.get(page)?.unexpected).toBe(false);
});

const apiUrl = "http://127.0.0.1:4103/api/v1";
const password = "P03 new password only!";
const register = async (page: Page, email: string, referral = "") => {
  await page.goto("/employee/auth/register");
  await page.getByLabel("الاسم الكامل").fill("موظف جديد للاختبار");
  await page.getByLabel("البريد الإلكتروني للعمل").fill(email);
  await page.getByLabel("كلمة المرور (15 - 128 حرفاً)").fill(password);
  await page.getByLabel("تأكيد كلمة المرور").fill(password);
  await page.getByLabel("كود الدعوة (اختياري)").fill(referral);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
};
const openMail = async (page: Page, url: string) => {
  await page.goto(url);
  await expect(page).not.toHaveURL(/token=/u);
};
const confirm = (page: Page) =>
  page.getByRole("button", {
    name: "تأكيد تفعيل البريد الإلكتروني",
    exact: true,
  });
const resend = async (page: Page, email: string) => {
  await page.getByLabel("البريد الإلكتروني للحساب").fill(email);
  await page
    .getByRole("button", { name: "إعادة إرسال رابط التفعيل", exact: true })
    .click();
};

const recovery = async (page: Page, email: string) => {
  await page.goto("/auth/forgot-password");
  await page.getByLabel("البريد الإلكتروني للحساب").fill(email);
  await page.getByRole("button", { name: "إرسال رابط إعادة التعيين" }).click();
  await expect(page.getByRole("status")).toContainText(
    "قبول الطلب لا يؤكد وصولها",
  );
};
const enterReset = async (page: Page) => {
  await expect(
    page.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
  ).toBeEnabled();
  await page.getByLabel(/^كلمة المرور الجديدة/u).fill(password);
  await page.getByLabel("تأكيد كلمة المرور", { exact: true }).fill(password);
};

test("US5-01 account shows persisted current identity across reload logout and A to B with unavailable domains and narrow RTL layout", async ({
  page,
  scenario,
}) => {
  const accountRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(apiUrl))
      accountRequests.push(new URL(request.url()).pathname);
  });
  const signIn = async (email: string) => {
    await page.getByLabel("البريد الإلكتروني للعمل").fill(email);
    await page
      .getByLabel("كلمة المرور", { exact: true })
      .fill("P03 test password only!");
    await page
      .getByRole("button", { name: "تسجيل الدخول", exact: true })
      .click();
    await expect(page).toHaveURL("/employee/account");
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "موظف الاختبار", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("غير متاح حالياً", { exact: true }),
    ).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "طلب تغيير العنوان" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "نسخ عنوان السحب" }),
    ).toBeDisabled();
    await expect(page.getByRole("textbox")).toHaveCount(0);
  };
  await page.goto("/employee/account");
  await expect(page).toHaveURL(/\/employee\/auth\/login/u);
  await signIn("employee@p03.test");
  await page.reload();
  await expect(
    page.getByText("employee@p03.test", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/USDT|Free|المجاني/u)).toHaveCount(0);
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.locator(".employee-scope")).toHaveAttribute("dir", "rtl");
    expect(
      await page
        .locator(".employee-scope")
        .evaluate((element) =>
          getComputedStyle(element).fontFamily.includes("Cairo"),
        ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "تسجيل الخروج من الحساب" })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "تسجيل الخروج من الحساب" }),
    ).toBeInViewport();
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `../../output/playwright/p03/us5-account-${String(width)}.png`,
      fullPage: true,
      mask: [page.locator("bdi")],
    });
  }
  const opener = page.getByRole("button", { name: /تغيير كلمة المرور/u });
  await opener.click();
  await expect(
    page.getByRole("dialog", { name: "تغيير كلمة المرور" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await page.getByRole("button", { name: "تسجيل الخروج من الحساب" }).click();
  await expect(page).toHaveURL(/\/employee\/auth\/login/u);
  expect(
    await scenario.command({ command: "state", email: "employee@p03.test" }),
  ).toMatchObject({ user: { sessions: 0 } });
  await signIn("other@p03.test");
  await expect(
    page.getByText("employee@p03.test", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("other@p03.test", { exact: true })).toBeVisible();
  expect(
    await scenario.command({ command: "state", email: "other@p03.test" }),
  ).toMatchObject({ user: { sessions: 1 } });
  expect(accountRequests.length).toBeGreaterThan(0);
  expect(
    accountRequests.every((path) =>
      [
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
        "/api/v1/users/me",
      ].includes(path),
    ),
  ).toBe(true);
});

for (const role of ["employee", "admin"]) {
  test(`US4-01 ${role} recovery preview explicit reset revokes both devices and preserves unrelated sessions`, async ({
    page,
    browser,
    scenario,
  }) => {
    const email = `${role}@p03.test`;
    const otherDevice = await browser.newContext();
    try {
      for (const context of [page.context(), otherDevice]) {
        const signedIn = await context.request.post(`${apiUrl}/auth/login`, {
          data: {
            email,
            password: "P03 test password only!",
            rememberMe: false,
          },
        });
        expect(signedIn.status()).toBe(200);
      }
      await expect
        .poll(() => scenario.command({ command: "state", email }))
        .toMatchObject({ user: { sessions: 2 } });
      // The shared recovery route is also usable with an unrelated signed-in admin.
      const unrelated = await page
        .context()
        .request.post(`${apiUrl}/auth/admin/login`, {
          data: {
            email: "admin2@p03.test",
            password: "P03 test password only!",
            rememberMe: false,
          },
        });
      expect(unrelated.status()).toBe(200);
      await recovery(page, email);
      const mail = await scenario.command({ command: "mail", email });
      if (mail === null || !("url" in mail) || mail.url === null)
        throw new Error("P03_MAIL_MISSING");
      const sentinel = new URL(mail.url).searchParams.get("token");
      if (sentinel === null) throw new Error("P03_LINK_MISSING");
      let messageLeak = false;
      let retirementMessages = 0;
      const observer = await page.context().newPage();
      await observer.exposeFunction(
        "observeCredentialMessage",
        (data: unknown) => {
          const serialized = JSON.stringify(data);
          if (serialized.includes(sentinel) || serialized.includes(password))
            messageLeak = true;
          if (serialized === '{"version":1,"kind":"retire"}')
            retirementMessages++;
        },
      );
      await observer.goto("/auth/forgot-password");
      await observer.evaluate(() => {
        const observe = (event: MessageEvent<unknown>) => {
          void window.observeCredentialMessage(event.data);
        };
        window.addEventListener("message", observe);
        const channel = new BroadcastChannel("oscar.session-retirement");
        channel.addEventListener("message", observe);
      });
      let writes = 0;
      let incidentalLeak = false;
      page.on("request", (request) => {
        if (
          request.url().includes("/auth/reset-password") &&
          request.method() === "POST"
        )
          writes++;
        if (request.headers()["referer"]?.includes(sentinel))
          incidentalLeak = true;
      });
      const response = await page.goto(mail.url);
      expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
      await enterReset(page);
      expect(writes).toBe(0);
      expect(await scenario.command({ command: "state", email })).toMatchObject(
        { user: { sessions: 2 } },
      );
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name: "رابط إعادة التعيين غير صالح أو منتهي",
        }),
      ).toBeVisible();
      await openMail(page, mail.url);
      await enterReset(page);
      await page
        .getByRole("button", { name: "حفظ كلمة المرور الجديدة" })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "تم تعيين كلمة المرور الجديدة بنجاح",
        }),
      ).toBeVisible();
      expect(writes).toBe(1);
      expect(incidentalLeak).toBe(false);
      await expect.poll(() => retirementMessages).toBeGreaterThan(0);
      expect(messageLeak).toBe(false);
      await observer.close();
      expect(await scenario.command({ command: "state", email })).toMatchObject(
        { user: { sessions: 0 } },
      );
      expect(
        await scenario.command({ command: "state", email: "admin2@p03.test" }),
      ).toMatchObject({ user: { sessions: 1 } });
      expect(
        (
          await otherDevice.request.post(`${apiUrl}/auth/refresh`, {
            headers: {
              "x-csrf-token":
                (await otherDevice.cookies()).find(
                  (cookie) => cookie.name === "csrfToken",
                )?.value ?? "missing",
            },
            data: {},
          })
        ).status(),
      ).not.toBe(200);
      expect(
        await page.evaluate(
          (secret) =>
            JSON.stringify({
              local: Object.entries(localStorage),
              session: Object.entries(sessionStorage),
              url: location.href,
            }).includes(secret),
          sentinel,
        ),
      ).toBe(false);
      await page
        .getByRole("link", {
          name: role === "admin" ? "تسجيل دخول المسؤول" : "تسجيل دخول الموظف",
        })
        .click();
      await page.getByLabel("البريد الإلكتروني للعمل").fill(email);
      await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: "تسجيل الدخول", exact: true })
        .click();
      await expect(page).toHaveURL(role === "admin" ? "/admin" : "/employee");
      await openMail(page, mail.url);
      await expect(
        page.getByRole("heading", {
          name: "رابط إعادة التعيين غير صالح أو منتهي",
        }),
      ).toBeVisible();
    } finally {
      await otherDevice.close();
    }
  });
}

test("US4-02 expiry after preview and wrong-purpose links never commit", async ({
  page,
  scenario,
}) => {
  const email = "employee@p03.test";
  await recovery(page, email);
  const mail = await scenario.command({ command: "mail", email });
  const state = await scenario.command({ command: "state", email });
  if (
    mail === null ||
    !("url" in mail) ||
    mail.url === null ||
    state === null ||
    !("user" in state) ||
    state.user === null
  )
    throw new Error("P03_CONTROL_MISSING");
  const wrong = new URL(mail.url);
  wrong.pathname = "/auth/verify-email";
  await openMail(page, wrong.href);
  await expect(page.locator("p[role=alert]")).toBeVisible();
  await openMail(page, mail.url);
  await enterReset(page);
  await scenario.command({
    command: "expire",
    purpose: "reset",
    targetId: state.user.id,
  });
  await page.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }).click();
  await expect(
    page.getByRole("heading", { name: "رابط إعادة التعيين غير صالح أو منتهي" }),
  ).toBeVisible();
  expect(
    (
      await page.context().request.post(`${apiUrl}/auth/login`, {
        data: {
          email,
          password: "P03 test password only!",
          rememberMe: false,
        },
      })
    ).status(),
  ).toBe(200);
});

test("US4-03 lost reset response stays uncertain and quarantines replacement cookie writes", async ({
  page,
  scenario,
}) => {
  await recovery(page, "employee@p03.test");
  const mail = await scenario.command({
    command: "mail",
    email: "employee@p03.test",
  });
  if (mail === null || !("url" in mail) || mail.url === null)
    throw new Error("P03_MAIL_MISSING");
  await openMail(page, mail.url);
  await enterReset(page);
  let writes = 0;
  await page.route(`${apiUrl}/auth/reset-password*`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    writes++;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    const observation = browserErrors.get(page);
    if (observation !== undefined) observation.expectedResponseLoss = true;
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }).click();
  await expect.poll(() => writes).toBe(1);
  // App Router also mounts an alert announcer when the credential URL is cleaned.
  await expect(page.locator("p[role=alert]")).toContainText("لا تكرر الطلب", {
    timeout: 35_000,
  });
  expect(writes).toBe(1);
  await expect(
    page.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "تم تعيين كلمة المرور الجديدة بنجاح" }),
  ).toHaveCount(0);
  await page.reload();
  expect(
    await page.evaluate(() => localStorage.getItem("oscar.cookie-write.v1")),
  ).not.toBeNull();
});
test("US2-01 persisted pending registration fixed sponsor preview reload and explicit single use", async ({
  page,
  scenario,
}) => {
  const sponsor = await scenario.command({
    command: "state",
    email: "employee@p03.test",
  });
  if (sponsor === null || !("user" in sponsor) || sponsor.user === null)
    throw new Error("P03_SPONSOR_MISSING");
  const email = "new@p03.test";
  const registrationReply = page.waitForResponse(
    (response) =>
      response.url().endsWith("/auth/register") &&
      response.request().method() === "POST",
  );
  await register(
    page,
    email.toUpperCase(),
    ` ${sponsor.user.referralCode.toUpperCase()} `,
  );
  expect((await registrationReply).status()).toBe(201);
  await expect(page).toHaveURL("/employee/auth/verify-email");
  await expect(
    page.getByRole("heading", { name: "تحقق من صندوق بريدك الإلكتروني" }),
  ).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  expect(await scenario.command({ command: "state", email })).toMatchObject({
    user: {
      status: "PENDING_VERIFICATION",
      verified: false,
      sessions: 0,
      sponsorUserId: sponsor.user.id,
    },
  });
  const mail = await scenario.command({ command: "mail", email });
  if (mail === null || !("url" in mail) || mail.url === null)
    throw new Error("P03_MAIL_MISSING");
  let consumes = 0;
  let leakedReferrer = false;
  page.on("request", (request) => {
    if (
      request.url().startsWith(apiUrl) &&
      request.headers()["referer"]?.includes("token=")
    )
      leakedReferrer = true;
    if (
      request.url().startsWith(`${apiUrl}/auth/verify-email`) &&
      request.method() === "POST"
    )
      consumes++;
  });
  await openMail(page, mail.url);
  await expect(confirm(page)).toBeEnabled();
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(confirm(page)).toBeVisible();
    await page.screenshot({
      path: `../../output/playwright/p03/us2-shared-verification-${String(width)}.png`,
    });
  }
  expect(consumes).toBe(0);
  expect(await scenario.command({ command: "state", email })).toMatchObject({
    user: { verified: false, sessions: 0 },
  });
  await page.reload();
  await expect(page.getByLabel("البريد الإلكتروني للحساب")).toBeVisible();
  await expect(confirm(page)).toHaveCount(0);
  expect(consumes).toBe(0);
  await openMail(page, mail.url);
  await confirm(page).click();
  await expect(
    page.getByRole("heading", { name: "تم تفعيل بريدك الإلكتروني بنجاح!" }),
  ).toBeVisible();
  expect(consumes).toBe(1);
  expect(leakedReferrer).toBe(false);
  expect(await scenario.command({ command: "state", email })).toMatchObject({
    user: {
      status: "ACTIVE",
      verified: true,
      sessions: 0,
      sponsorUserId: sponsor.user.id,
    },
  });
  await openMail(page, mail.url);
  await expect(page.locator("p[role=alert]")).toBeVisible();
  expect(consumes).toBe(1);
});
test("US2-02 absent referral replacement wrong purpose and expiry after preview never activate", async ({
  page,
  scenario,
  request,
}) => {
  const email = "blank@p03.test";
  const registrationReply = page.waitForResponse(
    (response) =>
      response.url().endsWith("/auth/register") &&
      response.request().method() === "POST",
  );
  await register(page, email, "   ");
  expect((await registrationReply).status()).toBe(201);
  await expect(page).toHaveURL("/employee/auth/verify-email");
  await expect(
    page.getByRole("heading", { name: "تحقق من صندوق بريدك الإلكتروني" }),
  ).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  const saved = await scenario.command({ command: "state", email });
  if (saved === null || !("user" in saved) || saved.user === null)
    throw new Error("P03_IDENTITY_MISSING");
  expect(saved.user).toMatchObject({
    sponsorUserId: null,
    verified: false,
    sessions: 0,
  });
  const original = await scenario.command({ command: "mail", email });
  if (original === null || !("url" in original) || original.url === null)
    throw new Error("P03_MAIL_MISSING");
  await page.goto("/employee/auth/verify-email?state=success");
  await expect(
    page.getByRole("heading", { name: "تم تفعيل بريدك الإلكتروني بنجاح!" }),
  ).toHaveCount(0);
  await scenario.command({
    command: "expire",
    purpose: "verification",
    targetId: saved.user.id,
  });
  await resend(page, email);
  await expect(page.getByRole("status")).toContainText("إذا كان الحساب مؤهلاً");
  const replacement = await scenario.command({ command: "mail", email });
  if (
    replacement === null ||
    !("url" in replacement) ||
    replacement.url === null
  )
    throw new Error("P03_MAIL_MISSING");
  expect(replacement.url === original.url).toBe(false);
  await openMail(page, original.url);
  await expect(page.locator("p[role=alert]")).toBeVisible();
  await openMail(page, replacement.url);
  await expect(confirm(page)).toBeEnabled();
  await scenario.command({
    command: "expire",
    purpose: "verification",
    targetId: saved.user.id,
  });
  await confirm(page).click();
  await expect(page.locator("p[role=alert]")).toBeVisible();
  expect(await scenario.command({ command: "state", email })).toMatchObject({
    user: { verified: false, sessions: 0, sponsorUserId: null },
  });
  const recovery = await request.post(`${apiUrl}/auth/forgot-password`, {
    data: { email: "employee@p03.test" },
  });
  expect(recovery.status()).toBe(200);
  const resetMail = await scenario.command({
    command: "mail",
    email: "employee@p03.test",
  });
  if (resetMail === null || !("url" in resetMail) || resetMail.url === null)
    throw new Error("P03_MAIL_MISSING");
  const wrongPurpose = new URL(resetMail.url);
  wrongPurpose.pathname = "/employee/auth/verify-email";
  await openMail(page, wrongPurpose.href);
  await expect(page.locator("p[role=alert]")).toBeVisible();
  await expect(confirm(page)).toHaveCount(0);
});
test("US2-03 provider rejection preserves pending account and resend remains neutral", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "delivery", outcome: "rejected" });
  const email = "delivery@p03.test";
  let registrationRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/register") && request.method() === "POST")
      registrationRequests++;
  });
  await register(page, email);
  await expect(page.locator("p[role=alert]")).toContainText("قد يكون الحساب");
  await expect(
    page.getByRole("button", { name: "إنشاء الحساب" }),
  ).toBeDisabled();
  expect(registrationRequests).toBe(1);
  expect(await scenario.command({ command: "state", email })).toMatchObject({
    user: { status: "PENDING_VERIFICATION", verified: false, sessions: 0 },
  });
  await page.getByRole("link", { name: "طلب رابط تفعيل للبريد نفسه" }).click();
  await resend(page, email);
  await expect(page.getByRole("status")).toContainText("إذا كان الحساب مؤهلاً");
});
test("US2-05 lost registration response preserves identity without replay and email collision cannot create a duplicate", async ({
  page,
  scenario,
}) => {
  const email = "lost@p03.test";
  let writes = 0;
  await page.route(`${apiUrl}/auth/register`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    writes++;
    await route.fetch();
    const observation = browserErrors.get(page);
    if (observation !== undefined) observation.expectedResponseLoss = true;
    await route.abort("failed");
  });
  await register(page, email);
  await expect(page.locator("p[role=alert]")).toContainText("قد يكون الحساب");
  await expect(
    page.getByRole("button", { name: "إنشاء الحساب", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  const saved = await scenario.command({ command: "state", email });
  expect(saved).toMatchObject({
    user: { status: "PENDING_VERIFICATION", verified: false, sessions: 0 },
  });
  await page.unroute(`${apiUrl}/auth/register`);
  await register(page, email.toUpperCase());
  await expect(page.locator("p[role=alert]")).toBeVisible();
  expect(await scenario.command({ command: "state", email })).toEqual(saved);
  await expect(page.getByRole("status")).toHaveCount(0);
});
test("US2-04 responsive registration and employee verification keep RTL and explicit controls", async ({
  page,
}) => {
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const route of ["register", "verify-email"]) {
    await page.goto(`/employee/auth/${route}`);
    for (const width of [320, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator(".employee-scope")).toHaveAttribute(
        "dir",
        "rtl",
      );
      expect(
        await page
          .locator("button.emp-btn span.truncate")
          .evaluateAll((labels) =>
            labels.every((label) => label.scrollWidth <= label.clientWidth),
          ),
      ).toBe(true);
      await page.screenshot({
        path: `../../output/playwright/p03/us2-${route}-${String(width)}.png`,
        mask: [page.locator('input[type="password"]')],
      });
    }
  }
});
