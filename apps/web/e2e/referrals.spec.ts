import { test, expect } from "./support/fixtures";
import {
  employeeSignIn,
  financeState,
  editReferralRate,
} from "./support/p04-finance";
import { managementSignIn } from "./support/admin-management";
import {
  employeeTeamSummarySchema,
  employeeMemberPageSchema,
  successEnvelopeSchema,
} from "@template/contracts";

test.use({ actionTimeout: 15000, navigationTimeout: 20000 });

test("P04 a late beneficiary read cannot restore an earlier root or member selection", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "referrals" });
  const buyerId = (await financeState(scenario)).employeeId;
  await managementSignIn(page);
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let complete: (() => void) | undefined;
  const completed = new Promise<void>((resolve) => {
    complete = resolve;
  });
  await page.route(
    `**/admin/referrals/${buyerId}/commissions?*`,
    async (route) => {
      try {
        const response = await route.fetch();
        await held;
        await route.fulfill({ response });
      } finally {
        complete?.();
      }
    },
  );
  await page.goto("/admin/referrals");
  await page.getByLabel("بحث عن الحساب الجذر").fill("P04 buyer");
  await page.getByRole("combobox", { name: "اختر عضو لحساب فريقه" }).click();
  const original = page.waitForRequest((outgoing) =>
    new URL(outgoing.url()).pathname.endsWith(
      `/admin/referrals/${buyerId}/commissions`,
    ),
  );
  await page.getByRole("option", { name: /P04 buyer/u }).click();
  await original;
  try {
    await page
      .getByLabel("تصفية أعضاء فريق الحساب المختار")
      .fill("P04 descendant 0");
    await expect(
      page.getByText("P04 descendant 0", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("بحث عن الحساب الجذر").fill("P04 other root");
    await page.getByRole("combobox", { name: "اختر عضو لحساب فريقه" }).click();
    await page.getByRole("option", { name: /P04 other root/u }).click();
    await expect(
      page.getByText("الحساب المختار: فريق P04 other root", { exact: true }),
    ).toBeVisible();
  } finally {
    release?.();
  }
  await completed;
  await expect(page.getByText("P04 descendant 0", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("عمولة محفوظة", { exact: true })).toHaveCount(0);
});

test("P04 saved commission rates survive a policy change and an expired beneficiary is skipped", async ({
  page,
  request,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "referrals" });
  await editReferralRate(request);
  const originalTerm = await financeState(scenario);
  if (originalTerm.expiresAt === null) throw new Error("P04_MISSING_EXPIRY");
  // Separate this event from the fixture batch's tied timestamps while still paid.
  await scenario.command({
    command: "p04-clock",
    instant: new Date(
      new Date(originalTerm.expiresAt).getTime() - 60000,
    ).toISOString(),
  });
  await scenario.command({
    command: "p04-referral-purchase",
    event: "after-rate",
  });
  expect((await financeState(scenario)).awards).toBe(29);
  await employeeSignIn(page);
  await page.goto("/employee/team");
  await page.getByRole("button", { name: "سجل العمولات", exact: true }).click();
  await expect(
    page.getByText("P04 after-rate", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("المستوى 1 (10%)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("المستوى 1 (12%)", { exact: true }).first(),
  ).toBeVisible();
  const paid = await financeState(scenario);
  if (paid.expiresAt === null) throw new Error("P04_MISSING_EXPIRY");
  await scenario.command({ command: "p04-clock", instant: paid.expiresAt });
  await scenario.command({
    command: "p04-referral-purchase",
    event: "after-expiry",
  });
  const expired = await financeState(scenario);
  expect(expired.awards).toBe(29);
  expect(expired.skipped).toBe(1);
  expect(expired.wallet).toEqual(paid.wallet);
  await managementSignIn(page);
  await page.goto("/admin/referrals");
  await page.getByLabel("بحث عن الحساب الجذر").fill("P04 buyer");
  await page.getByRole("combobox", { name: "اختر عضو لحساب فريقه" }).click();
  await page.getByRole("option", { name: /P04 buyer/u }).click();
  await expect(
    page.getByText("P04 after-expiry", { exact: false }).last(),
  ).toBeVisible();
  await expect(
    page.getByText("متخطاة: EXPIRED", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("النسبة المحفوظة: 10%", { exact: false }).first(),
  ).toBeVisible();
  const decisions = page
    .getByText("سجل القرارات المحفوظة للمستفيد", { exact: true })
    .locator("..");
  await expect(
    decisions.getByText("عمولة محفوظة", { exact: true }),
  ).toHaveCount(24);
  await decisions.getByRole("button", { name: "التالي", exact: true }).click();
  await expect(
    decisions.getByText("عمولة محفوظة", { exact: true }),
  ).toHaveCount(5);
});

test("P04 a descendant cannot be inspected through a privileged commission route", async ({
  page,
  request,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "referrals" });
  await employeeSignIn(page);
  const summaryRequest = page.waitForRequest((outgoing) =>
    new URL(outgoing.url()).pathname.endsWith("/referrals/me"),
  );
  await page.goto("/employee/team");
  const authorized = await summaryRequest;
  const headers = {
    authorization: authorized.headers()["authorization"] ?? "",
  };
  const members = await request.get(
    "http://127.0.0.1:4103/api/v1/referrals/me/members?level=1&page=1&limit=25",
    { headers },
  );
  expect(members.status()).toBe(200);
  const descendants = employeeMemberPageSchema.parse(
    successEnvelopeSchema.parse(await members.json()).data,
  );
  const descendant = descendants.items[0];
  if (!descendant) throw new Error("P04_MISSING_DESCENDANT");
  const forbidden = await request.get(
    `http://127.0.0.1:4103/api/v1/admin/referrals/${descendant.id}/commissions?page=1&limit=25`,
    { headers },
  );
  expect(forbidden.status()).toBe(403);
  await expect(
    page.getByText("الربح الخاص بالعضو", { exact: true }),
  ).toHaveCount(0);
});

test("P04 own invitation and earned commissions span bounded relative-member pages", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "referrals" });
  expect((await financeState(scenario)).awards).toBe(28);
  await employeeSignIn(page);
  const summaryResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/referrals/me") && response.status() === 200,
  );
  await page.goto("/employee/team");
  const summary = employeeTeamSummarySchema.parse(
    successEnvelopeSchema.parse(await (await summaryResponse).json()).data,
  );
  await expect(
    page.getByText(summary.root.referralCode, { exact: true }),
  ).toBeVisible();
  expect(summary.levelCounts.map((count) => count.members)).toEqual([
    29, 1, 1, 1, 1,
  ]);
  await expect(page.getByText("نسخ الكود", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "أعضاء الفريق (L1 - L5)", exact: true })
    .click();
  await expect(
    page.getByText("P04 descendant", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("الربح الخاص بالعضو", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "المستوى 1", exact: true }).click();
  await expect(page.getByText("P04 deep 1", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "التالي", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("P04 descendant 0", { exact: true }),
  ).toBeVisible();
  for (const level of [2, 3, 4, 5]) {
    await page
      .getByRole("button", { name: `المستوى ${String(level)}`, exact: true })
      .click();
    await expect(
      page.getByText(`P04 deep ${String(level)}`, { exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByText("P04 deep 6", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "سجل العمولات", exact: true }).click();
  await expect(page.getByText("عمولة محفوظة", { exact: false })).toHaveCount(
    25,
  );
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await expect(page.getByText("عمولة محفوظة", { exact: false })).toHaveCount(3);
});

test("P04 administrator separates root search from relative member selection", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "referrals" });
  await managementSignIn(page);
  await page.goto("/admin/referrals");
  await page.getByLabel("بحث عن الحساب الجذر").fill("P04 buyer");
  await page.getByRole("combobox", { name: "اختر عضو لحساب فريقه" }).click();
  await page.getByRole("option", { name: /P04 buyer/u }).click();
  await expect(
    page.getByText("الحساب المختار: فريق P04 buyer", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("تصفية أعضاء فريق الحساب المختار")
    .fill("P04 descendant 0");
  await expect(
    page.getByText("P04 descendant 0", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("P04 descendant 1", { exact: true })).toHaveCount(
    0,
  );
  await page.getByText("P04 descendant 0", { exact: true }).click();
  await expect(page.getByText(/P04 descendant 0/u).last()).toBeVisible();
  await page.getByLabel("بحث عن الحساب الجذر").fill("P04 other root");
  await page.getByRole("combobox", { name: "اختر عضو لحساب فريقه" }).click();
  await page.getByRole("option", { name: /P04 other root/u }).click();
  await expect(
    page.getByText("الحساب المختار: فريق P04 other root", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("P04 descendant 0", { exact: true })).toHaveCount(
    0,
  );
});
