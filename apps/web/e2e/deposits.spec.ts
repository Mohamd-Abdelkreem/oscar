import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import jsQR from "jsqr";
import type { Locator, Page } from "@playwright/test";
import {
  depositAddressEnvelopeSchema,
  depositHistoryEnvelopeSchema,
  manualCreditEnvelopeSchema,
  identityUserDataSchema,
  successEnvelopeSchema,
} from "@template/contracts";
import {
  test,
  expect,
  p07Fixtures,
  p07State,
  type Scenario,
} from "./support/fixtures";
import { employeeSignIn } from "./support/p04-finance";
import {
  managementActor,
  managementApiUrl,
  managementSignIn,
} from "./support/admin-management";

test.use({ actionTimeout: 15000, navigationTimeout: 20000 });

async function captureDepositSurface(
  page: Page,
  surface: string,
  scope: string,
  confirmation?: Locator,
) {
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.locator(scope).first()).toHaveAttribute("dir", "rtl");
    expect(
      await page.locator(scope).evaluateAll((elements) =>
        elements.every((element) => {
          const style = getComputedStyle(element);
          return (
            style.fontFamily.includes("Cairo") && style.direction === "rtl"
          );
        }),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator('[role="dialog"]')
        .evaluateAll((dialogs) =>
          dialogs.every((dialog) => dialog.scrollWidth <= dialog.clientWidth),
        ),
    ).toBe(true);
    expect(
      await page
        .locator('bdi[dir="ltr"]')
        .evaluateAll((values) =>
          values.every((value) => getComputedStyle(value).direction === "ltr"),
        ),
    ).toBe(true);
    if (surface === "employee") {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      expect(
        await page.locator(scope).evaluate((main) => {
          const nav = document.querySelector("nav.fixed");
          const last = main.querySelector("h3")?.parentElement;
          return (
            nav !== null &&
            last != null &&
            last.getBoundingClientRect().bottom <=
              nav.getBoundingClientRect().top
          );
        }),
      ).toBe(true);
    }
    if (confirmation !== undefined) {
      await confirmation
        .getByRole("button", { name: "إلغاء", exact: true })
        .focus();
      for (let index = 0; index < 6; index++) {
        await page.keyboard.press("Tab");
        expect(
          await confirmation.evaluate((dialog) =>
            dialog.contains(document.activeElement),
          ),
        ).toBe(true);
      }
    }
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `../../output/playwright/p03/p07-${surface}-${String(width)}.png`,
      animations: "disabled",
      fullPage: true,
      mask: [
        page.locator("input"),
        page.locator("bdi"),
        page.locator("[title]"),
      ],
    });
  }
}

test("P07 deposit instructions history and exact confirmation preserve narrow RTL layouts and keyboard focus", async ({
  page,
  scenario,
}) => {
  await p07Fixtures(scenario);
  let unexpectedDiagnostic = false;
  let privilegedEmployeeRequest = false;
  let employeeActive = true;
  page.on("pageerror", () => {
    unexpectedDiagnostic = true;
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = new URL(message.location().url, page.url()).pathname;
    const expected =
      (source === "/api/v1/auth/refresh" &&
        /Failed to load resource:.*status of (?:400|401)/u.test(
          message.text(),
        )) ||
      (source === "/api/v1/users/me" &&
        /Failed to load resource:.*status of 401/u.test(message.text()));
    const favicon =
      message.location().url.endsWith("/favicon.ico") &&
      /status of 404/u.test(message.text());
    if (!expected && !favicon) unexpectedDiagnostic = true;
  });
  page.on("request", (request) => {
    if (
      employeeActive &&
      new URL(request.url()).pathname.startsWith("/api/v1/admin/")
    )
      privilegedEmployeeRequest = true;
  });
  await employeeSignIn(page, "employee@p03.test");
  const ready = await readyInstructions(page, scenario);
  await scenario.command({
    command: "p07-credit",
    email: "employee@p03.test",
    event: "two-logs",
  });
  await page.getByRole("button", { name: "تحديث الحالة" }).click();
  await expect(page.getByText("+2.000001", { exact: true })).toBeVisible();
  await expect(
    page.getByText(ready.address, { exact: true }).first(),
  ).toHaveAttribute("dir", "ltr");
  await captureDepositSurface(page, "employee", ".employee-scope");
  await page.setViewportSize({ width: 320, height: 850 });
  const copy = page.getByRole("button", { name: "نسخ العنوان" });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("تم النسخ بنجاح")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    ready.address,
  );
  await page.goto("/employee/account");
  await page
    .getByRole("button", { name: "تسجيل الخروج من الحساب", exact: true })
    .click();
  await expect(page).toHaveURL(/\/employee\/auth\/login/u);
  employeeActive = false;
  await managementSignIn(page);
  await page.goto("/admin/deposits");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await captureDepositSurface(page, "admin-history", ".admin-scope");
  const opener = page.getByRole("button", {
    name: "إيداع يدوي معتمد",
    exact: true,
  });
  await opener.focus();
  await page.keyboard.press("Enter");
  const initialForm = page.getByRole("dialog", {
    name: "إضافة إيداع يدوي استثنائي معتمد",
  });
  await expect(initialForm).toBeFocused();
  const target = initialForm.getByRole("combobox", { name: "الموظف المستفيد" });
  await expect(target).toBeEnabled();
  expect(
    await page
      .locator('input[aria-label="بحث في الإيداعات"]')
      .evaluate((input) => input.closest("[inert]") !== null),
  ).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(
    initialForm.getByRole("button", { name: "إلغاء", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(initialForm).toBeVisible();
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(target).not.toContainText("اختر الموظف");
  await captureDepositSurface(page, "admin-form", ".admin-scope", initialForm);
  await page.keyboard.press("Escape");
  await expect(initialForm).toHaveCount(0);
  await expect(opener).toBeFocused();
  const confirmation = await reviewGrant(page, "first-credit@p07.test");
  await captureDepositSurface(
    page,
    "admin-confirmation",
    ".admin-scope",
    confirmation,
  );
  await page.setViewportSize({ width: 320, height: 850 });
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "مراجعة وتأكيد الإيداع", exact: true }),
  ).toBeFocused();
  expect(
    (await p07State(scenario, "first-credit@p07.test")).manualCredits,
  ).toBe(0);
  expect(privilegedEmployeeRequest).toBe(false);
  expect(unexpectedDiagnostic).toBe(false);
});

async function reviewGrant(page: Page, email: string, paged = false) {
  await page
    .getByRole("button", { name: "إيداع يدوي معتمد", exact: true })
    .click();
  const form = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("combobox", { name: "الموظف المستفيد" }) });
  if (paged) await form.getByRole("button", { name: "2", exact: true }).click();
  await form.getByRole("combobox", { name: "الموظف المستفيد" }).click();
  await page.getByRole("option").filter({ hasText: email }).click();
  await form
    .getByRole("textbox", { name: "المبلغ (USDT)", exact: true })
    .fill("1.000001");
  await form
    .getByRole("textbox", { name: "المرجع الإداري", exact: true })
    .fill("P07 same deliberate reference");
  await form
    .getByRole("textbox", { name: "سبب الإيداع اليدوي الإلزامي", exact: true })
    .fill("P07 reviewed exact adjustment");
  await form
    .getByRole("button", { name: "مراجعة وتأكيد الإيداع", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "تأكيد إضافة الإيداع اليدوي الاستثنائي",
  });
  await expect(confirmation).toContainText(email);
  await expect(confirmation).toContainText("1.000001 USDT");
  await expect(confirmation).toContainText("P07 reviewed exact adjustment");
  await expect(confirmation).toContainText("P07 same deliberate reference");
  return confirmation;
}

test("P07 paged first-credit target receives separate deliberate exact same-reference grants with genuine source/audit", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p07-fixtures", pagedTargets: true });
  const before = await p07State(scenario, "first-credit@p07.test");
  expect(before.manualCredits).toBe(0);
  await managementSignIn(page);
  await page.goto("/admin/deposits");
  const replies: string[] = [];
  for (let index = 0; index < 2; index++) {
    const dialog = await reviewGrant(
      page,
      "first-credit@p07.test",
      index === 0,
    );
    const response = page.waitForResponse(
      (reply) =>
        reply.request().method() === "POST" &&
        new URL(reply.url()).pathname.endsWith(
          "/admin/deposits/manual-credits",
        ),
    );
    await dialog
      .getByRole("button", { name: "تأكيد إضافة الرصيد", exact: true })
      .dblclick();
    const recorded = await response;
    expect(recorded.status()).toBe(201);
    const grant = manualCreditEnvelopeSchema.parse(await recorded.json()).data;
    replies.push(grant.actionId);
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("تم تسجيل الإيداع اليدوي المعتمد.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(index + 1);
  }
  expect(new Set(replies).size).toBe(2);
  const after = await p07State(scenario, "first-credit@p07.test");
  expect(after).toMatchObject({
    manualCredits: 2,
    operations: 2,
    postings: 2,
    auditCount: 2,
    wallet: {
      availableNonReferral: "2.000002",
      availableReferral: before.wallet.availableReferral,
      reservedReferral: before.wallet.reservedReferral,
      reservedNonReferral: before.wallet.reservedNonReferral,
    },
  });
  expect(after.receipts).toEqual([]);
  expect(after.reservations).toEqual(before.reservations);
  const sourceBefore = await p07State(scenario, "other@p03.test");
  expect(sourceBefore.wallet).toMatchObject({
    availableReferral: "5",
    availableNonReferral: "0",
    reservedReferral: "2",
    reservedNonReferral: "11",
  });
  const protectedGrant = await reviewGrant(page, "other@p03.test");
  await protectedGrant
    .getByRole("button", { name: "تأكيد إضافة الرصيد", exact: true })
    .click();
  await expect(protectedGrant).toHaveCount(0);
  const sourceAfter = await p07State(scenario, "other@p03.test");
  expect(sourceAfter.wallet).toEqual({
    ...sourceBefore.wallet,
    availableNonReferral: "1.000001",
    total: "19.000001",
  });
  expect(sourceAfter.reservations).toEqual(sourceBefore.reservations);
  expect(sourceAfter.operations).toBe(sourceBefore.operations + 1);
  expect(sourceAfter.postings).toBe(sourceBefore.postings + 1);
  expect(sourceAfter.auditCount).toBe(sourceBefore.auditCount + 1);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(page.locator("tbody")).not.toContainText("TRON_NILE");
});

test("P07 committed lost reply blocks competing tabs and reload reconciles original action without another POST", async ({
  page,
  scenario,
}) => {
  await p07Fixtures(scenario);
  await managementSignIn(page);
  await page.goto("/admin/deposits");
  let writes = 0;
  let actionId = "";
  await page
    .context()
    .route("**/admin/deposits/manual-credits/*", (route) =>
      route.abort("failed"),
    );
  await page.route("**/admin/deposits/manual-credits", async (route) => {
    writes++;
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    actionId = manualCreditEnvelopeSchema.parse(await response.json()).data
      .actionId;
    await route.abort("failed");
  });
  const dialog = await reviewGrant(page, "first-credit@p07.test");
  await dialog
    .getByRole("button", { name: "تأكيد إضافة الرصيد", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("غير محسومة");
  expect(writes).toBe(1);
  await expect
    .poll(
      async () =>
        (await p07State(scenario, "first-credit@p07.test")).manualCredits,
    )
    .toBe(1);
  const tab = await page.context().newPage();
  await tab.goto("/admin/deposits");
  await tab
    .getByRole("button", { name: "إيداع يدوي معتمد", exact: true })
    .click();
  await expect(
    tab.getByRole("button", { name: "مراجعة وتأكيد الإيداع", exact: true }),
  ).toBeDisabled();
  await tab.close();
  await page.bringToFront();
  await page.reload();
  const uncertain = page
    .getByRole("alert")
    .filter({ hasText: "نتيجة الإيداع اليدوي غير محسومة" });
  await expect(uncertain).toBeVisible();
  const retained = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("oscar.manual-credit.v1."))
      .map((key) => JSON.parse(localStorage.getItem(key) ?? "null") as unknown),
  );
  expect(retained).toEqual([
    {
      version: 1,
      actionId,
      employeeId: (await p07State(scenario, "first-credit@p07.test"))
        .employeeId,
    },
  ]);
  await page.context().unroute("**/admin/deposits/manual-credits/*");
  await uncertain.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(uncertain).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  expect(writes).toBe(1);
  expect(await p07State(scenario, "first-credit@p07.test")).toMatchObject({
    manualCredits: 1,
    operations: 1,
    postings: 1,
    auditCount: 1,
    wallet: { total: "1.000001" },
  });
});

test("P07 absent original crash handle stays uncertain and revoked authority cannot grant", async ({
  page,
  scenario,
  request,
}) => {
  const fixtures = await p07Fixtures(scenario);
  await managementSignIn(page, "admin2@p03.test");
  await page.goto("/admin/deposits");
  await expect(
    page.getByRole("button", { name: "إيداع يدوي معتمد", exact: true }),
  ).toBeEnabled();
  const actorState = await scenario.command({
    command: "state",
    email: "admin2@p03.test",
  });
  if (
    actorState === null ||
    !("user" in actorState) ||
    actorState.user === null
  )
    throw new Error("P03_IDENTITY_MISSING");
  const actionId = randomUUID();
  await page.evaluate(
    ({ actorId, actionId, employeeId }) => {
      localStorage.setItem(
        `oscar.manual-credit.v1.${actorId}`,
        JSON.stringify({ version: 1, actionId, employeeId }),
      );
    },
    {
      actorId: actorState.user.id,
      actionId,
      employeeId: fixtures.firstCreditId,
    },
  );
  let writes = 0;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().endsWith("/admin/deposits/manual-credits")
    )
      writes++;
  });
  const identityReply = page.waitForResponse(
    (response) =>
      response.status() === 200 &&
      new URL(response.url()).pathname.endsWith("/users/me"),
  );
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/deposits/u);
  expect(
    identityUserDataSchema.parse(
      successEnvelopeSchema.parse(await (await identityReply).json()).data,
    ).user.id,
  ).toBe(actorState.user.id);
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`oscar.manual-credit.v1.${id}`) !== null,
      actorState.user.id,
    ),
  ).toBe(true);
  const uncertain = page
    .getByRole("alert")
    .filter({ hasText: "نتيجة الإيداع اليدوي غير محسومة" });
  await expect(uncertain).toBeVisible();
  await uncertain.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(uncertain).toBeVisible();
  await page
    .getByRole("button", { name: "إيداع يدوي معتمد", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "مراجعة وتأكيد الإيداع", exact: true }),
  ).toBeDisabled();
  const actor = await managementActor(request);
  const revoked = await request.patch(
    `${managementApiUrl}/admin/admins/${actorState.user.id}/status`,
    {
      headers: actor.headers,
      data: {
        status: "DEACTIVATED",
        expectedVersion: 0,
        confirmed: true,
        reason: "P07 revoke current actor",
      },
    },
  );
  expect(revoked.status()).toBe(200);
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/auth\/login/u);
  expect(writes).toBe(0);
  expect(
    (await p07State(scenario, "first-credit@p07.test")).manualCredits,
  ).toBe(0);
});

async function readyInstructions(
  page: Page,
  scenario: Scenario,
  email: "employee@p03.test" | "other@p03.test" = "employee@p03.test",
) {
  const writes = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/deposits/me/address"),
  );
  await page.goto("/employee/deposit");
  expect((await writes).status()).toBe(202);
  await expect(page.getByRole("button", { name: "نسخ العنوان" })).toHaveCount(
    0,
  );
  await scenario.command({ command: "p07-ready", email });
  const ready = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname.endsWith("/deposits/me/address"),
  );
  await page.getByRole("button", { name: "تحديث الحالة" }).click();
  const instructions = depositAddressEnvelopeSchema.parse(
    await (await ready).json(),
  ).data;
  if (instructions.state !== "READY") throw new Error("P07_READY_REQUIRED");
  await expect(page.getByRole("button", { name: "نسخ العنوان" })).toBeVisible();
  await expect(
    page.getByText(instructions.address, { exact: true }),
  ).toBeVisible();
  return instructions;
}

async function decodeRenderedInstructions(
  page: Page,
  address: string,
  stage: string,
) {
  const evidence = [];
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.getByText(address, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "نسخ العنوان" }).click();
    await expect(page.getByText("تم النسخ بنجاح")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      address,
    );
    const screenshot = await page
      .getByText("امسح الرمز بواسطة تطبيق المحفظة", { exact: true })
      .locator("..")
      .screenshot({
        path: `../../output/playwright/p03/p07-qr-${stage}-${String(width)}.png`,
        animations: "disabled",
      });
    const pixels = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("P07_QR_PIXELS_UNAVAILABLE");
      context.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        data: Array.from(
          context.getImageData(0, 0, canvas.width, canvas.height).data,
        ),
      };
    }, screenshot.toString("base64"));
    // Decode rendered pixels independently of qrcode.react and its SVG input.
    const decoded = jsQR(
      Uint8ClampedArray.from(pixels.data),
      pixels.width,
      pixels.height,
    );
    expect(
      decoded,
      `${stage} QR must decode at ${String(width)}px`,
    ).not.toBeNull();
    expect(decoded?.data).toBe(address);
    evidence.push({ stage, width, apiVisibleClipboardDecodedEqual: true });
  }
  await page.setViewportSize({ width: 390, height: 850 });
  return evidence;
}

async function reloadReadyAddress(page: Page, expectedAddress: string) {
  const reply = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname.endsWith("/deposits/me/address"),
  );
  await page.reload();
  const reloaded = depositAddressEnvelopeSchema.parse(
    await (await reply).json(),
  ).data;
  expect(reloaded.state).toBe("READY");
  if (reloaded.state !== "READY") throw new Error("P07_READY_REQUIRED");
  expect(reloaded.address).toBe(expectedAddress);
  return reloaded.address;
}

test("P07 two accounts independently decode ready QR pixels equal to API visible and copied addresses across reload and clipboard refusal", async ({
  page,
  scenario,
}) => {
  await p07Fixtures(scenario);
  const calls: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", () => errors.push("page-error"));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/deposits/me/address")) calls.push(request.method());
    expect(path).not.toContain("/admin/deposits");
  });
  await employeeSignIn(page, "employee@p03.test");
  const first = await readyInstructions(page, scenario);
  expect(calls[0]).toBe("GET");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "نسخ العنوان" }).click();
  await expect(page.getByText("تم النسخ بنجاح")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    first.address,
  );
  await mkdir("../../output/playwright/p03", { recursive: true });
  const qrEvidence = await decodeRenderedInstructions(
    page,
    first.address,
    "first-before",
  );
  await page.screenshot({
    path: "../../output/playwright/p03/p07-phone-first-before.png",
    fullPage: true,
  });
  const firstReloadedAddress = await reloadReadyAddress(page, first.address);
  qrEvidence.push(
    ...(await decodeRenderedInstructions(
      page,
      firstReloadedAddress,
      "first-reload",
    )),
  );
  await expect(page.getByText(first.address, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "نسخ العنوان" }).click();
  await expect(page.getByText("تم النسخ بنجاح")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    first.address,
  );
  await page.screenshot({
    path: "../../output/playwright/p03/p07-phone-first-reload.png",
    fullPage: true,
  });
  expect(calls.filter((method) => method === "POST")).toHaveLength(1);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("test clipboard refusal")),
      },
    });
  });
  await page.getByRole("button", { name: "نسخ العنوان" }).click();
  await expect(page.getByText(/تعذر نسخ العنوان/u)).toBeVisible();
  await expect(page.getByText("تم النسخ بنجاح")).toHaveCount(0);
  await expect(page.getByText(first.address, { exact: true })).toBeVisible();
  await page.goto("/employee/account");
  await page
    .getByRole("button", { name: "تسجيل الخروج من الحساب", exact: true })
    .click();
  await expect(page).toHaveURL(/\/employee\/auth\/login/u);
  await employeeSignIn(page, "other@p03.test");
  const other = await readyInstructions(page, scenario, "other@p03.test");
  expect(other.address).not.toBe(first.address);
  await expect(page.getByText(first.address, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "نسخ العنوان" }).click();
  await expect(page.getByText("تم النسخ بنجاح")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    other.address,
  );
  qrEvidence.push(
    ...(await decodeRenderedInstructions(page, other.address, "other-before")),
  );
  await page.screenshot({
    path: "../../output/playwright/p03/p07-phone-other-before.png",
    fullPage: true,
  });
  const otherReloadedAddress = await reloadReadyAddress(page, other.address);
  qrEvidence.push(
    ...(await decodeRenderedInstructions(
      page,
      otherReloadedAddress,
      "other-reload",
    )),
  );
  await expect(page.getByText(other.address, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "نسخ العنوان" }).click();
  await expect(page.getByText("تم النسخ بنجاح")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    other.address,
  );
  await page.screenshot({
    path: "../../output/playwright/p03/p07-phone-other-reload.png",
    fullPage: true,
  });
  await writeFile(
    "../../output/playwright/p03/p07-qr-decoding.json",
    JSON.stringify({ decoder: "jsqr@1.4.0", checks: qrEvidence }, null, 2),
  );
  expect(errors).toEqual([]);
});

test("P07 canonical replay, distinct logs and both weekend days show only exact persisted credits and private manual rows", async ({
  page,
  request,
  scenario,
}) => {
  const fixtures = await p07Fixtures(scenario);
  await employeeSignIn(page, "employee@p03.test");
  await readyInstructions(page, scenario);
  const before = await p07State(scenario, "employee@p03.test");
  for (const event of ["unfinalized", "wrong-token"] as const)
    await scenario.command({
      command: "p07-credit",
      email: "employee@p03.test",
      event,
    });
  await page.getByRole("button", { name: "تحديث الحالة" }).click();
  await expect(
    page.getByText("لا توجد إيداعات مسجلة.", { exact: true }),
  ).toBeVisible();
  expect((await p07State(scenario, "employee@p03.test")).wallet).toEqual(
    before.wallet,
  );
  for (let replay = 0; replay < 2; replay++)
    await scenario.command({
      command: "p07-credit",
      email: "employee@p03.test",
      event: "two-logs",
    });
  await scenario.command({
    command: "p07-credit",
    email: "employee@p03.test",
    event: "confirmed",
    day: "SUNDAY",
  });
  const historyReply = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/deposits/me/history"),
  );
  await page.getByRole("button", { name: "تحديث الحالة" }).click();
  const chainPage = depositHistoryEnvelopeSchema.parse(
    await (await historyReply).json(),
  ).data;
  expect(chainPage.items).toHaveLength(3);
  await expect(page.getByText("+2.000001", { exact: true })).toBeVisible();
  await expect(page.getByText("2026-10-10 23:00", { exact: true })).toHaveCount(
    2,
  );
  await expect(
    page.getByText("2026-10-11 23:00", { exact: true }),
  ).toBeVisible();
  const chain = await p07State(scenario, "employee@p03.test");
  expect(chain.receipts).toHaveLength(3);
  const counts = new Map<string, number>();
  for (const receipt of chain.receipts)
    counts.set(
      receipt.transactionId,
      (counts.get(receipt.transactionId) ?? 0) + 1,
    );
  expect([...counts.values()].sort()).toEqual([1, 2]);
  expect(chain).toMatchObject({
    operations: 3,
    auditCount: 3,
    wallet: {
      availableNonReferral: "4.000003",
      availableReferral: before.wallet.availableReferral,
      reservedNonReferral: before.wallet.reservedNonReferral,
      reservedReferral: before.wallet.reservedReferral,
    },
  });
  expect(chain.reservations).toEqual(before.reservations);
  const admin = await managementActor(request);
  const actionId = randomUUID();
  const response = await request.post(
    `${managementApiUrl}/admin/deposits/manual-credits`,
    {
      headers: { ...admin.headers, "Idempotency-Key": actionId },
      data: {
        actionId,
        employeeId: fixtures.employeeId,
        amount: "1.000001",
        reason: "Private admin reason",
        reference: { kind: "EXTERNAL", value: "Private external reference" },
        confirmed: true,
      },
    },
  );
  expect(response.status()).toBe(201);
  const grant = manualCreditEnvelopeSchema.parse(await response.json()).data;
  await page.getByRole("button", { name: "تحديث الحالة" }).click();
  await expect(
    page.getByText("إضافة يدوية مسجلة", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Private admin reason|Private external reference/u),
  ).toHaveCount(0);
  const manual = await p07State(scenario, "employee@p03.test");
  expect(manual.wallet.total).toBe("5.000004");
  expect(manual.reservations).toEqual(before.reservations);
  await page.goto("/employee/account");
  await page
    .getByRole("button", { name: "تسجيل الخروج من الحساب", exact: true })
    .click();
  await expect(page).toHaveURL(/\/employee\/auth\/login/u);
  await managementSignIn(page);
  await page.goto("/admin/deposits");
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(page.getByText(/Private admin reason/u)).toBeVisible();
  await expect(
    page.getByText(grant.actor.email, { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "بحث في الإيداعات" })
    .fill("employee@p03.test");
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("combobox", { name: "تصفية حسب نوع الإيداع" }).click();
  await page.getByRole("option", { name: "يدوي (إدارة)", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).not.toContainText("TRON_NILE");
  await expect(page.locator("tbody tr")).not.toContainText(
    chain.receipts[0]?.transactionId ?? "missing",
  );
});

test("P07 unavailable and malformed observations retain no fabricated empty or credit and recover safely", async ({
  page,
  scenario,
}) => {
  await p07Fixtures(scenario);
  await employeeSignIn(page, "employee@p03.test");
  await readyInstructions(page, scenario);
  await scenario.command({
    command: "p07-credit",
    email: "employee@p03.test",
    event: "confirmed",
  });
  await page.getByRole("button", { name: "تحديث الحالة" }).click();
  await expect(page.getByText("+1.000001", { exact: true })).toBeVisible();
  let malformed = false;
  await page.route("**/deposits/me/history?*", async (route) => {
    if (malformed)
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { items: [] } }),
      });
    else await route.abort("failed");
  });
  await page.getByRole("button", { name: "تحديث الحالة" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "تعذر تحميل البيانات المالية" }),
  ).toBeVisible();
  await expect(page.getByText("+1.000001", { exact: true })).toBeVisible();
  malformed = true;
  await page.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(page.getByText("+1.000001", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("لا توجد إيداعات مسجلة.", { exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/deposits/me/history?*");
  await page.getByRole("button", { name: "إعادة المحاولة" }).click();
  await expect(page.getByText("+1.000001", { exact: true })).toBeVisible();
  expect((await p07State(scenario, "employee@p03.test")).operations).toBe(1);
});
