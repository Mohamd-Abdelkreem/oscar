import type { APIRequestContext, Page } from "@playwright/test";
import {
  identitySessionDataSchema,
  successEnvelopeSchema,
} from "@template/contracts";
import { expect } from "./fixtures";

export const managementApiUrl = "http://127.0.0.1:4103/api/v1";
export const managementPassword = "P03 test password only!";
export const managementSignIn = async (
  page: Page,
  email = "admin@p03.test",
  password = managementPassword,
) => {
  await page.goto("/admin/auth/login");
  await page.getByLabel("البريد الإلكتروني للعمل").fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page.getByRole("banner")).toBeVisible();
};
export const reviewInvitation = async (page: Page, email: string) => {
  await page.getByRole("button", { name: "إضافة مسؤول جديد" }).click();
  await page.getByLabel(/^الاسم الكامل/u).fill("مسؤول مدعو للاختبار");
  await page.getByLabel(/^البريد الإلكتروني/u).fill(email);
  await page.getByRole("button", { name: "مراجعة الدعوة" }).click();
};
export const confirmManagement = async (
  page: Page,
  label: string,
  reason = "P03 reviewed management request",
) => {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: /سبب الإجراء/u }).fill(reason);
  await expect(
    dialog.getByRole("button", { name: label, exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: label, exact: true }).click();
};
export const managementActor = async (request: APIRequestContext) => {
  const response = await request.post(`${managementApiUrl}/auth/admin/login`, {
    data: {
      email: "admin@p03.test",
      password: managementPassword,
      rememberMe: false,
    },
  });
  expect(response.status()).toBe(200);
  const actor = identitySessionDataSchema.parse(
    successEnvelopeSchema.parse(await response.json()).data,
  );
  const csrf = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "csrfToken",
  );
  if (csrf === undefined) throw new Error("P03_CSRF_MISSING");
  return {
    actorId: actor.user.id,
    headers: {
      Authorization: `Bearer ${actor.tokens.accessToken}`,
      "x-csrf-token": csrf.value,
    },
  };
};
