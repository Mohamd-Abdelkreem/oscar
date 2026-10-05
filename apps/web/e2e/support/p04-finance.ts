import type { Page, APIRequestContext } from "@playwright/test";
import {
  adminCatalogSchema,
  referralSettingsDataSchema,
  successEnvelopeSchema,
  employeeRestrictionsDataSchema,
} from "@template/contracts";
import { p04StateSchema } from "../../../api/tests/e2e/control.js";
import { expect, type Scenario } from "./fixtures";
import {
  managementPassword,
  managementActor,
  managementApiUrl,
} from "./admin-management";

export const editFutureTerms = async (
  request: APIRequestContext,
  price: string,
  futureTerms: {
    dailyReward?: string;
    countedWorkDates?: number;
    withdrawalFeeBps?: number;
  } = {},
) => {
  const actor = await managementActor(request);
  const response = await request.get(`${managementApiUrl}/admin/packages`, {
    headers: actor.headers,
  });
  const catalog = adminCatalogSchema.parse(
    successEnvelopeSchema.parse(await response.json()).data,
  );
  const terms = catalog.items.find((entry) => entry.terms.code === "S1")?.terms;
  if (!terms) throw new Error("P04_MISSING_TERMS");
  const changed = await request.patch(`${managementApiUrl}/admin/packages/S1`, {
    headers: actor.headers,
    data: {
      commandId: crypto.randomUUID(),
      expectedVersion: terms.version,
      price,
      ...futureTerms,
      reason: "P04 independent reviewed edit",
      confirmed: true,
    },
  });
  expect(changed.status()).toBe(200);
};

export const financeState = async (
  scenario: Scenario,
  email = "buyer@p04.test",
) =>
  p04StateSchema.parse(await scenario.command({ command: "p04-state", email }));

export const blockWithdrawals = async (
  request: APIRequestContext,
  employeeId: string,
) => {
  const actor = await managementActor(request);
  const endpoint = `${managementApiUrl}/admin/employees/${employeeId}/restrictions`;
  const current = await request.get(endpoint, { headers: actor.headers });
  expect(current.status()).toBe(200);
  const saved = employeeRestrictionsDataSchema.parse(
    successEnvelopeSchema.parse(await current.json()).data,
  );
  const changed = await request.patch(endpoint, {
    headers: actor.headers,
    data: {
      withdrawalsBlocked: true,
      expectedVersion: saved.employee.accountVersion,
      confirmed: true,
      reason: "P04 source eligibility versus action restriction",
    },
  });
  expect(changed.status()).toBe(200);
};

export const editReferralRate = async (request: APIRequestContext) => {
  const actor = await managementActor(request);
  const current = await request.get(
    `${managementApiUrl}/admin/referral-settings`,
    { headers: actor.headers },
  );
  const settings = referralSettingsDataSchema.parse(
    successEnvelopeSchema.parse(await current.json()).data,
  );
  const changed = await request.patch(
    `${managementApiUrl}/admin/referral-settings`,
    {
      headers: actor.headers,
      data: {
        commandId: crypto.randomUUID(),
        expectedVersion: settings.version,
        ratesBps: [1000, ...settings.ratesBps.slice(1)],
        reason: "P04 saved-rate acceptance",
        confirmed: true,
      },
    },
  );
  expect(changed.status()).toBe(200);
};

export const employeeSignIn = async (page: Page, email = "buyer@p04.test") => {
  await page.goto("/employee/auth/login");
  await page.getByLabel("البريد الإلكتروني للعمل").fill(email);
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill(managementPassword);
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page).toHaveURL("/employee");
};

export const reviewPurchase = async (page: Page, code = "S1") => {
  if (new URL(page.url()).pathname !== "/employee/packages")
    await page.goto("/employee/packages");
  await expect(page.locator(`#upgrade-btn-${code}`)).toBeEnabled();
  await page.locator(`#upgrade-btn-${code}`).click();
  await expect(page.getByRole("dialog")).toContainText(
    "إجمالي المبلغ المخصوم:",
  );
};

export const confirmPurchase = async (page: Page) => {
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "تأكيد الشراء وخصم السعر كاملاً",
      exact: true,
    })
    .click();
};

export const reviewConfiguration = async (page: Page, price: string) => {
  await page.goto("/admin/packages");
  await page
    .getByRole("button", { name: "تعديل", exact: true })
    .first()
    .click();
  await page.getByLabel("سعر الاشتراك (USDT)").fill(price);
  await page.getByLabel("سبب التعديل").fill("P04 reviewed future terms");
  await page
    .getByRole("button", { name: "مراجعة التعديلات", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(price);
};
