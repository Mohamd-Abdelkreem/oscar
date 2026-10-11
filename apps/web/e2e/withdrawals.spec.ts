import { mkdir } from "node:fs/promises";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  identitySessionDataSchema,
  successEnvelopeSchema,
  withdrawalDestinationSchema,
  withdrawalStatusSchema,
  withdrawalRequestSchema,
  withdrawalCommandResultSchema,
  withdrawalQuoteSchema,
  withdrawalStateSchema,
  adminWithdrawalRequestSchema,
  adminWithdrawalHistorySchema,
  adminWithdrawalActionOutcomeSchema,
  employeeRestrictionsDataSchema,
  walletViewSchema,
} from "@template/contracts";
import { test, expect, type Scenario } from "./support/fixtures";
import { p09Fixtures, p09State, p09Clock } from "./support/p09-withdrawals";
import { employeeSignIn } from "./support/p04-finance";
import {
  managementApiUrl,
  managementPassword,
  managementActor,
  managementSignIn,
} from "./support/admin-management";

test.use({ actionTimeout: 15000, navigationTimeout: 20000 });
const initialAddress = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";

for (const kind of ["employee", "EXTEND", "REJECT"] as const)
  test(`P09 route revalidation preserves ${kind} drafts (session response boundary failure)`, async ({
    page,
    request,
    scenario,
  }) => {
    const saved =
      kind === "employee" ? null : await reserveForAdmin(request, scenario);
    if (kind === "employee") {
      await p09Fixtures(scenario);
      await confirmedEmployee(request, scenario);
      await employeeSignIn(page, "employee@p09.test");
    } else await managementSignIn(page);
    const path =
      kind === "employee" ? "/employee/withdraw" : "/admin/withdrawals";
    const label =
      kind === "employee"
        ? "المبلغ المطلوب سحبه (USDT)"
        : kind === "EXTEND"
          ? /سبب زيادة الجدولة/u
          : /سبب رفض السحب/u;
    const draft = kind === "employee" ? "90.123456" : "P09 private route draft";
    const expected = new Map([["/api/v1/users/me", 503]]);
    const failures = browserFailures(page, expected);
    let sends = 0,
      quotes = 0;
    page.on("request", (event) => {
      if (event.method() !== "POST") return;
      const target = new URL(event.url()).pathname;
      if (target === "/api/v1/withdrawals/quotes") quotes++;
      if (
        target === "/api/v1/withdrawals" ||
        /\/api\/v1\/admin\/withdrawals\/[^/]+\/(extensions|rejections)$/u.test(
          target,
        )
      )
        sends++;
    });
    await page.goto(path);
    if (kind === "employee") await review(page, draft);
    else {
      await page
        .getByRole("button", {
          name: kind === "EXTEND" ? "زيادة الجدولة" : "رفض",
          exact: true,
        })
        .click();
      await page.getByLabel(label).fill(draft);
      if (kind === "EXTEND")
        await page.getByLabel(/الساعات الإضافية المراد/u).fill("2.5");
    }
    let mode: "held" | "real" | "unavailable" = "held";
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/users/me", async (route) => {
      if (mode === "held") await gate;
      if (mode === "unavailable")
        return route.fulfill({
          status: 503,
          json: {
            success: false,
            statusCode: 503,
            code: "SERVICE_UNAVAILABLE",
          },
        });
      return route.continue();
    });
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await expect(page.getByLabel(label)).toBeHidden();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(sends).toBe(0);
    mode = "real";
    release();
    await expect(page.getByLabel(label)).toBeVisible({ timeout: 20000 });
    await expect(page.getByLabel(label)).toHaveValue(draft);
    if (kind === "employee") {
      await expect(page.getByRole("dialog")).toBeHidden();
      expect(quotes).toBe(1);
    }
    mode = "unavailable";
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });
    await expect(
      page.getByRole("button", { name: "إعادة المحاولة", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(label)).toBeHidden();
    await expect(page.getByRole("dialog")).toBeHidden();
    if (saved) {
      const admin = await managementActor(request);
      const changed = await request.post(
        `${managementApiUrl}/admin/withdrawals/${saved.id}/extensions`,
        {
          headers: {
            ...admin.headers,
            "Idempotency-Key": `p09-route-${kind.toLowerCase()}-external`,
          },
          data: {
            expectedVersion: saved.version,
            countedHours: "1.5",
            reason: "External route-check winner",
            confirmed: true,
          },
        },
      );
      expect(changed.status()).toBe(200);
    }
    const before = await p09State(scenario);
    mode = "real";
    await page
      .getByRole("button", { name: "إعادة المحاولة", exact: true })
      .click();
    await expect(page.getByLabel(label)).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel(label)).toHaveValue(draft);
    if (kind === "employee") {
      await expect(page.getByRole("dialog")).toBeHidden();
      expect(quotes).toBe(1);
      await review(page, draft);
      expect(quotes).toBe(2);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "تراجع", exact: true })
        .click();
    } else {
      if (kind === "EXTEND")
        await expect(page.getByLabel(/الساعات الإضافية المراد/u)).toHaveValue(
          "2.5",
        );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "مراجعة الإصدار الجديد", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText("v2");
    }
    expect(sends).toBe(0);
    expect(await p09State(scenario)).toEqual({
      ...before,
      quotes: before.quotes + (kind === "employee" ? 1 : 0),
    });
    expect(
      await page.evaluate((value) => {
        for (const storage of [localStorage, sessionStorage])
          for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index);
            if (key !== null && storage.getItem(key)?.includes(value))
              return true;
          }
        return false;
      }, draft),
    ).toBe(false);
    // A new document is a definite departure; private drafts do not survive it.
    await page.goto(kind === "employee" ? "/employee/account" : "/admin");
    if (kind === "employee")
      await expect(
        page.locator('nav a[href="/employee/account"]'),
      ).toBeVisible();
    else await expect(page.getByRole("banner")).toBeVisible();
    await page.goto(path);
    if (kind === "employee")
      await expect(page.getByLabel(label)).toHaveValue("100");
    else {
      await expect(page.getByRole("dialog")).toBeHidden();
      const reopenedAction = page.getByRole("button", {
        name: kind === "EXTEND" ? "زيادة الجدولة" : "رفض",
        exact: true,
      });
      await expect(reopenedAction).toBeEnabled({ timeout: 30000 });
      await reopenedAction.click();
      await expect(page.getByLabel(label)).toHaveValue("");
      if (kind === "EXTEND")
        await expect(page.getByLabel(/الساعات الإضافية المراد/u)).toHaveValue(
          "12",
        );
    }
    expect(sends).toBe(0);
    expect(failures).toEqual([]);
  });

test("P09 convergence two expanded resources retain bounded observation (response boundary fixtures)", async ({
  page,
  request,
  scenario,
}) => {
  await reserveForAdmin(request, scenario);
  await managementSignIn(page);
  let rows: ReturnType<typeof adminWithdrawalRequestSchema.parse>[] = [];
  const reads = new Map<string, number>();
  await page.route("**/api/v1/admin/withdrawals?*", async (route) => {
    const response = await route.fetch();
    const envelope = successEnvelopeSchema.parse(await response.json());
    const data = adminWithdrawalHistorySchema.parse(envelope.data);
    const original = adminWithdrawalRequestSchema.parse(data.items[0]);
    rows = [
      original,
      adminWithdrawalRequestSchema.parse({
        ...original,
        id: "10000000-0000-4000-8000-000000000057",
      }),
    ];
    const pagination = {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
    await route.fulfill({
      json: {
        ...envelope,
        data: { items: rows, pagination },
        paginationMeta: pagination,
      },
    });
  });
  await page.route(
    /\/api\/v1\/admin\/withdrawals\/[a-f0-9-]+$/u,
    async (route) => {
      const id =
        new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
      const row = rows.find((item) => item.id === id);
      expect(row).toBeDefined();
      reads.set(id, (reads.get(id) ?? 0) + 1);
      const response = await route.fetch({
        url: route
          .request()
          .url()
          .replace(id, rows[0]?.id ?? ""),
      });
      const envelope = successEnvelopeSchema.parse(await response.json());
      await route.fulfill({ json: { ...envelope, data: row } });
    },
  );
  await page.goto("/admin/withdrawals");
  const disclosures = page.getByText("تفاصيل الطلب", { exact: true });
  await expect(disclosures).toHaveCount(2);
  await disclosures.nth(0).click();
  await disclosures.nth(1).click();
  for (const row of rows)
    await expect(page.getByRole("table")).toContainText(row.id);
  await expect
    .poll(() => [...reads.values()].every((count) => count >= 2))
    .toBe(true);
  for (const count of reads.values()) expect(count).toBeLessThanOrEqual(4);
  expect((await p09State(scenario)).requests).toHaveLength(1);
});

test("P09 convergence page two active rows refresh without disclosure (response boundary fixtures)", async ({
  page,
  request,
  scenario,
}) => {
  await reserveForAdmin(request, scenario);
  await managementSignIn(page);
  let changed = false,
    secondPageReads = 0;
  await page.route("**/api/v1/admin/withdrawals?*", async (route) => {
    const response = await route.fetch({
      url: route.request().url().replace("page=2", "page=1"),
    });
    const envelope = successEnvelopeSchema.parse(await response.json());
    const original = adminWithdrawalRequestSchema.parse(
      adminWithdrawalHistorySchema.parse(envelope.data).items[0],
    );
    const selected = Number(
      new URL(route.request().url()).searchParams.get("page"),
    );
    if (selected === 2) secondPageReads++;
    const row = adminWithdrawalRequestSchema.parse({
      ...original,
      version: changed ? 2 : 1,
      remainingCountedHours: changed ? "99.5" : original.remainingCountedHours,
      remainingCountedMilliseconds: changed
        ? "358200000"
        : original.remainingCountedMilliseconds,
    });
    const items =
      selected === 2
        ? [row]
        : Array.from({ length: 10 }, (_, index) => ({
            ...original,
            id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          }));
    const pagination = {
      page: selected,
      limit: 10,
      total: 11,
      totalPages: 2,
      hasNextPage: selected === 1,
      hasPreviousPage: selected === 2,
    };
    await route.fulfill({
      json: {
        ...envelope,
        data: { items, pagination },
        paginationMeta: pagination,
      },
    });
  });
  await page.goto("/admin/withdrawals");
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await expect.poll(() => secondPageReads).toBe(1);
  changed = true;
  await expect(page.getByRole("table")).toContainText("99.5", {
    timeout: 15_000,
  });
  expect(secondPageReads).toBeGreaterThan(1);
  await expect(
    page.getByRole("button", { name: "تحديث التفاصيل" }),
  ).toHaveCount(0);
  expect((await p09State(scenario)).requests[0]?.version).toBe(1);
});

test("P09 convergence lost consume reply precedes commit and pending observation resolves without replay", async ({
  page,
  scenario,
}) => {
  await p09Fixtures(scenario);
  await employeeSignIn(page, "employee@p09.test");
  await issueDestination(page);
  await page.goto(await destinationMail(scenario));
  let consumeCount = 0,
    commit: (() => Promise<void>) | undefined;
  // Delay the real harness consume until after the browser observes reply loss and PENDING.
  await page.route("**/destination/consume", async (route) => {
    consumeCount++;
    const request = route.request();
    const headers = await request.allHeaders();
    const body = request.postData();
    commit = async () => {
      const response = await page.request.post(request.url(), {
        headers,
        data: body,
      });
      expect(response.status()).toBe(200);
    };
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "تأكيد عنوان السحب" }).click();
  await expect(page.getByText(/نتيجة التأكيد غير مؤكدة/u)).toBeVisible();
  expect((await p09State(scenario)).destination?.confirmed).toBe(false);
  expect(commit).toBeDefined();
  await commit?.();
  commit = undefined;
  await expect(page.getByText("تم تأكيد عنوان السحب.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/افتح أحدث رابط بريد/u)).toHaveCount(0);
  expect(consumeCount).toBe(1);
  await assertPrivateLinkRemoved(page);
});

for (const invalidation of ["expired", "superseded"] as const) {
  test(`P09 later ${invalidation} proof retires lost-consume uncertainty (response boundary fixtures)`, async ({
    page,
    scenario,
  }) => {
    const failures = browserFailures(
      page,
      new Map(),
      new Set(["/api/v1/withdrawals/me/destination/consume"]),
    );
    await p09Fixtures(scenario);
    await employeeSignIn(page, "employee@p09.test");
    await issueDestination(page);
    await page.goto(await destinationMail(scenario));
    let invalidated = false;
    let consumeCount = 0;
    // Keep the real persisted destination pending; control only later read evidence.
    await page.route("**/api/v1/withdrawals/me/destination", async (route) => {
      const response = await route.fetch();
      const envelope = successEnvelopeSchema.parse(await response.json());
      const saved = withdrawalDestinationSchema.parse(envelope.data);
      expect(saved.state).toBe("PENDING");
      const data =
        invalidated && saved.state === "PENDING"
          ? withdrawalDestinationSchema.parse({
              ...saved,
              ...(invalidation === "expired"
                ? { proofStatus: "EXPIRED", serverNow: saved.expiresAt }
                : { version: saved.version + 1 }),
            })
          : saved;
      await route.fulfill({ json: { ...envelope, data } });
    });
    await page.route("**/destination/consume", async (route) => {
      consumeCount++;
      await route.abort("failed");
    });
    await page.getByRole("button", { name: "تأكيد عنوان السحب" }).click();
    await expect(page.getByText(/نتيجة التأكيد غير مؤكدة/u)).toBeVisible();
    expect((await p09State(scenario)).destination?.confirmed).toBe(false);
    invalidated = true;
    await expect(page.getByText(/افتح أحدث رابط بريد/u)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/نتيجة التأكيد غير مؤكدة/u)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "إعادة التحقق من التأكيد" }),
    ).toHaveCount(0);
    expect(consumeCount).toBe(1);
    expect((await p09State(scenario)).destination?.confirmed).toBe(false);
    await assertPrivateLinkRemoved(page);
    expect(failures).toEqual([]);
  });
}

async function reserveForAdmin(
  request: APIRequestContext,
  scenario: Scenario,
  gross = "100",
) {
  await p09Fixtures(scenario);
  await p09Clock(scenario, "2026-10-05T09:00:00.000Z");
  const headers = await confirmedEmployee(request, scenario);
  const quoted = await request.post(`${managementApiUrl}/withdrawals/quotes`, {
    headers,
    data: { gross },
  });
  expect(quoted.status()).toBe(201);
  const quote = withdrawalQuoteSchema.parse(
    successEnvelopeSchema.parse(await quoted.json()).data,
  );
  const accepted = await request.post(`${managementApiUrl}/withdrawals`, {
    headers: { ...headers, "Idempotency-Key": "p09-us4-reservation-0001" },
    data: { quoteId: quote.quoteId, confirmed: true },
  });
  expect(accepted.status()).toBe(201);
  return withdrawalCommandResultSchema.parse(
    successEnvelopeSchema.parse(await accepted.json()).data,
  ).withdrawal;
}

test("US4 real admin fractional extension, exact keyed lost-reply recovery and source-identical rejection", async ({
  page,
  request,
  playwright,
  scenario,
}) => {
  const saved = await reserveForAdmin(request, scenario);
  const adminRequest = await playwright.request.newContext();
  const failures: string[] = [];
  page.on("pageerror", () => {
    failures.push("pageerror");
  });
  const path = `/api/v1/admin/withdrawals/${saved.id}/extensions`;
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const resourceFailure = message
      .text()
      .startsWith("Failed to load resource:");
    if (
      resourceFailure &&
      message.location().url.includes(path) &&
      message.text().includes("ERR_FAILED")
    )
      return;
    // Match the established P03 exception for the frozen UI's absent favicon.
    if (
      resourceFailure &&
      message.location().url === "http://127.0.0.1:3103/favicon.ico" &&
      message.text().includes("404")
    )
      return;
    failures.push(
      `console-${resourceFailure ? "resource" : "other"}-${message.location().url ? new URL(message.location().url).pathname : "unknown"}`,
    );
  });
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname.startsWith("/api/v1/") &&
      response.status() >= 400
    )
      failures.push("api-http-error");
  });
  try {
    const admin = await managementActor(adminRequest);
    await managementSignIn(page);
    await page.goto("/admin/withdrawals");
    await expect(page.getByRole("table")).toContainText("employee@p09.test");
    await expect(
      page.getByRole("button", { name: "إتمام", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "فك التعليق" })).toHaveCount(
      0,
    );
    await page.getByText("تفاصيل الطلب", { exact: true }).click();
    await expect(page.getByRole("table")).toContainText(saved.id);
    await page.getByText("تفاصيل الطلب", { exact: true }).click();
    await page
      .getByRole("button", { name: "زيادة الجدولة", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/الساعات الإضافية المراد/u).fill("1.5");
    await dialog
      .getByLabel(/سبب زيادة الجدولة/u)
      .fill("US4 original lost reply reason");
    await expect(dialog).toContainText("1.5 ساعة");
    await mkdir("../../output/playwright/p03", { recursive: true });
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `../../output/playwright/p03/p09-us4-extension-${String(width)}.png`,
        fullPage: false,
        animations: "disabled",
        mask: [
          page.locator("input:visible"),
          page.locator("textarea:visible"),
          page.locator("tbody td:nth-child(1)"),
          page.locator("tbody td:nth-child(5)"),
          page.locator("bdi:visible"),
          dialog.getByText("P09 employee", { exact: true }),
          dialog.locator('p[dir="ltr"]'),
        ],
      });
    }
    await page.setViewportSize({ width: 1280, height: 850 });
    let key = "",
      sends = 0,
      executed = false;
    await page.route(`**${path}`, async (route) => {
      sends++;
      key = route.request().headers()["idempotency-key"] ?? "";
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      executed = true;
      await route.abort("failed");
    });
    await dialog
      .getByRole("button", { name: "تأكيد زيادة الجدولة", exact: true })
      .click();
    await expect(
      page.getByText(/تم العثور على الإجراء الأصلي:/u),
    ).toContainText("US4 original lost reply reason");
    expect(executed).toBe(true);
    expect(sends).toBe(1);
    const outcomeResponse = await adminRequest.get(
      `${managementApiUrl}/admin/withdrawals/${saved.id}/actions/outcome`,
      {
        headers: admin.headers,
        params: { kind: "EXTEND", requestKey: key, expectedVersion: "1" },
      },
    );
    expect(outcomeResponse.status()).toBe(200);
    const outcome = adminWithdrawalActionOutcomeSchema.parse(
      successEnvelopeSchema.parse(await outcomeResponse.json()).data,
    );
    expect(outcome.status).toBe("COMMITTED");
    expect(outcome.withdrawal.originalDueAt).toBe(saved.originalDueAt);
    expect(outcome.withdrawal.dueAt).toBe("2026-10-08T10:30:00.000Z");
    expect(outcome.withdrawal.version).toBe(2);
    const extendedState = await p09State(scenario);
    expect(extendedState.actions).toBe(2);
    expect(extendedState.wallet.reservedNonReferral).toBe("100");
    expect(
      await page.evaluate(() =>
        Object.entries(localStorage).some(
          ([name, value]) =>
            name.startsWith("oscar.admin-withdrawal") &&
            typeof value === "string" &&
            value.includes("US4 original lost reply reason"),
        ),
      ),
    ).toBe(false);
    await page.reload();
    await page.getByRole("button", { name: "رفض", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel("سبب رفض السحب الإلزامي", { exact: false })
      .fill("US4 source-identical release");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "تأكيد الرفض وتحرير الرصيد" })
      .click();
    await expect(page.getByRole("table")).toContainText("مرفوض — أُعيد المبلغ");
    const released = await p09State(scenario);
    expect(released.operations - extendedState.operations).toBe(1);
    expect(released.actions).toBe(3);
    expect(released.wallet).toMatchObject({
      availableNonReferral: "100",
      availableReferral: "30",
      reservedNonReferral: "0",
      reservedReferral: "0",
    });
    expect(released.reservations[0]).toMatchObject({
      state: "RELEASED",
      nonReferral: "100",
      referral: "0",
    });
    expect(released.withdrawalAttempts).toBe(0);
    await page.getByText("تفاصيل الطلب", { exact: true }).click();
    await expect(page.getByRole("table")).toContainText(
      "US4 source-identical release",
    );
    await expect(page.getByRole("table")).toContainText(admin.actorId);
    await mkdir("../../output/playwright/p03", { recursive: true });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `../../output/playwright/p03/p09-us4-admin-${String(width)}.png`,
        fullPage: true,
        animations: "disabled",
        mask: [
          page.locator("bdi:visible"),
          page.locator("input:visible"),
          page.locator("tbody td:nth-child(1)"),
          page.locator("tbody td:nth-child(5)"),
        ],
      });
    }
    expect(failures).toEqual([]);
  } finally {
    await adminRequest.dispose();
  }
});

for (const kind of ["EXTEND", "REJECT"] as const)
  test(`US4 real stale ${kind} supersession preserves draft without automatic resend`, async ({
    page,
    request,
    playwright,
    scenario,
  }) => {
    const saved = await reserveForAdmin(request, scenario);
    const adminRequest = await playwright.request.newContext();
    const failures: string[] = [];
    const extensionPath = `/api/v1/admin/withdrawals/${saved.id}/${kind === "EXTEND" ? "extensions" : "rejections"}`;
    page.on("pageerror", () => {
      failures.push("pageerror");
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (message.text().startsWith("Failed to load resource:")) {
        if (
          message.location().url.includes(extensionPath) &&
          message.text().includes("409")
        )
          return;
        if (
          message.location().url === "http://127.0.0.1:3103/favicon.ico" &&
          message.text().includes("404")
        )
          return;
      }
      failures.push("console-error");
    });
    page.on("response", (response) => {
      const path = new URL(response.url()).pathname;
      if (
        path.startsWith("/api/v1/") &&
        response.status() >= 400 &&
        !(path === extensionPath && response.status() === 409)
      )
        failures.push("api-http-error");
    });
    try {
      const admin = await managementActor(adminRequest);
      await managementSignIn(page);
      await page.goto("/admin/withdrawals");
      await page
        .getByRole("button", {
          name: kind === "EXTEND" ? "زيادة الجدولة" : "رفض",
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog");
      const reason = dialog.getByLabel(
        kind === "EXTEND" ? /سبب زيادة الجدولة/u : /سبب رفض السحب/u,
      );
      await reason.fill("US4 stale loser");
      if (kind === "EXTEND")
        await dialog.getByLabel(/الساعات الإضافية المراد/u).fill("2.5");
      let conflicted = false;
      let sends = 0;
      await page.route(`**${extensionPath}`, async (route) => {
        sends++;
        const winner = await adminRequest.post(
          `${managementApiUrl}/admin/withdrawals/${saved.id}/extensions`,
          {
            headers: {
              ...admin.headers,
              "Idempotency-Key": "p09-us4-winner-0001",
            },
            data: {
              expectedVersion: 1,
              countedHours: "1.5",
              reason: "US4 external winner",
              confirmed: true,
            },
          },
        );
        expect(winner.status()).toBe(200);
        const loser = await route.fetch();
        expect(loser.status()).toBe(409);
        conflicted = true;
        await route.fulfill({ response: loser });
      });
      await dialog
        .getByRole("button", {
          name:
            kind === "EXTEND"
              ? "تأكيد زيادة الجدولة"
              : "تأكيد الرفض وتحرير الرصيد",
          exact: true,
        })
        .click();
      await expect(page.getByText(/تغير الطلب دون إثبات/u)).toBeVisible();
      expect(conflicted).toBe(true);
      expect((await p09State(scenario)).actions).toBe(2);
      await expect(reason).toHaveValue("US4 stale loser");
      await dialog
        .getByRole("button", { name: "مراجعة الإصدار الجديد" })
        .click();
      await expect(
        dialog.getByRole("button", {
          name:
            kind === "EXTEND"
              ? "تأكيد زيادة الجدولة"
              : "تأكيد الرفض وتحرير الرصيد",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(reason).toHaveValue("US4 stale loser");
      if (kind === "EXTEND")
        await expect(dialog.getByLabel(/الساعات الإضافية المراد/u)).toHaveValue(
          "2.5",
        );
      await expect(dialog).toContainText("v2");
      expect(sends).toBe(1);
      expect((await p09State(scenario)).actions).toBe(2);
      expect(failures).toEqual([]);
    } finally {
      await adminRequest.dispose();
    }
  });
test("US4 non-signing SQL claim denies administration under real due and weekday guards", async ({
  page,
  request,
  playwright,
  scenario,
}) => {
  const saved = await reserveForAdmin(request, scenario);
  const adminRequest = await playwright.request.newContext();
  const failures = browserFailures(page);
  try {
    const admin = await managementActor(adminRequest);
    const winner = await adminRequest.post(
      `${managementApiUrl}/admin/withdrawals/${saved.id}/extensions`,
      {
        headers: {
          ...admin.headers,
          "Idempotency-Key": "p09-us4-before-claim",
        },
        data: {
          expectedVersion: 1,
          countedHours: "1.5",
          reason: "US4 pre-claim extension",
          confirmed: true,
        },
      },
    );
    expect(winner.status()).toBe(200);
    await managementSignIn(page);
    await page.goto("/admin/withdrawals");
    // Controlled disposable SQL time proves early/weekend rejection before the
    // eligible non-signing claim, retaining the actual due/admission guards.
    // It proves persisted readonly HTTP behavior, not a production worker or live payout.
    await scenario.command({
      command: "p09-claim-fixture",
      withdrawalId: saved.id,
    });
    const before = await p09State(scenario);
    expect(before.requests[0]?.state).toBe("SIGNING");
    expect(before.withdrawalAttempts).toBe(1);
    await page.reload();
    await expect(page.getByRole("table")).toContainText("جارٍ تجهيز التوقيع");
    await expect(
      page.getByRole("button", { name: "زيادة الجدولة", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "رفض", exact: true }),
    ).toHaveCount(0);
    const currentResponse = await adminRequest.get(
      `${managementApiUrl}/admin/withdrawals/${saved.id}`,
      { headers: admin.headers },
    );
    const current = adminWithdrawalRequestSchema.parse(
      successEnvelopeSchema.parse(await currentResponse.json()).data,
    );
    expect(current.transactionId).toBeNull();
    expect(current.canExtend).toBe(false);
    expect(current.canReject).toBe(false);
    for (const kind of ["extensions", "rejections"]) {
      const denied = await adminRequest.post(
        `${managementApiUrl}/admin/withdrawals/${saved.id}/${kind}`,
        {
          headers: {
            ...admin.headers,
            "Idempotency-Key": `p09-us4-claimed-${kind}`,
          },
          data: {
            expectedVersion: current.version,
            confirmed: true,
            reason: "Must remain reserved",
            ...(kind === "extensions" ? { countedHours: "0.5" } : {}),
          },
        },
      );
      expect(denied.status()).toBe(409);
    }
    expect(await p09State(scenario)).toEqual(before);

    expect(failures).toEqual([]);
  } finally {
    await adminRequest.dispose();
  }
});

test("P09 remediation expanded 320px admin details and safe read feedback preserve scheduled actions", async ({
  page,
  request,
  scenario,
}) => {
  const saved = await reserveForAdmin(request, scenario, "99.123456");
  const expected = new Map<string, number>();
  const failures = browserFailures(page, expected);
  await managementSignIn(page);
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/admin/withdrawals");
  const table = page.getByRole("table");
  await expect(table).toContainText("99.123456 USDT");
  const summary = page.getByText("تفاصيل الطلب", { exact: true });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(table).toContainText(saved.recipient);
  await expect(table).toContainText(saved.id);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const scrolling = page.locator(".admin-table-container");
  expect(
    await scrolling.evaluate(
      (element) =>
        element.scrollWidth > element.clientWidth &&
        ["auto", "scroll"].includes(getComputedStyle(element).overflowX),
    ),
  ).toBe(true);
  await table.getByRole("button", { name: "تحديث التفاصيل" }).focus();
  await page.keyboard.press("Enter");
  await expect(table).toContainText(saved.id);
  await mkdir("../../output/playwright/p03", { recursive: true });
  await page.screenshot({
    path: "../../output/playwright/p03/p09-remediation-expanded-320.png",
    animations: "disabled",
    mask: [
      page.locator("bdi"),
      page.locator("input"),
      page.locator("tbody td:first-child"),
      page.locator("tbody td:nth-child(5)"),
    ],
  });
  const extend = page.getByRole("button", {
    name: "زيادة الجدولة",
    exact: true,
  });
  await expect(extend).toBeEnabled();
  await extend.press("Enter");
  const extensionDialog = page.getByRole("dialog", {
    name: "زيادة جدولة معالجة طلب السحب",
  });
  await expect(extensionDialog).toBeVisible();
  await expect(extensionDialog).toContainText("99.123456 USDT");
  await page.keyboard.press("Escape");
  const reject = page.getByRole("button", { name: "رفض", exact: true });
  await expect(reject).toBeEnabled();
  await reject.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "رفض طلب السحب وإلغاء الحجز المالي" }),
  ).toContainText(saved.id);
  await page.keyboard.press("Escape");
  for (const failure of ["malformed", "unavailable"] as const) {
    if (failure === "unavailable")
      expected.set("/api/v1/admin/withdrawals", 503);
    await page.route("**/api/v1/admin/withdrawals?*", (route) =>
      route.fulfill({
        status: failure === "malformed" ? 200 : 503,
        json:
          failure === "malformed"
            ? {}
            : { success: false, statusCode: 503, code: "SERVICE_UNAVAILABLE" },
      }),
    );
    await page.getByRole("button", { name: "تحديث طلبات السحب" }).click();
    await expect(
      page.getByText(
        failure === "malformed"
          ? "تعذر التحقق من استجابة الخدمة. حاول لاحقاً."
          : "الخدمة غير متاحة مؤقتاً. تحقق من الاتصال وحاول لاحقاً.",
      ),
    ).toBeVisible();
    await expect(table).toContainText("99.123456 USDT");
    await expect(
      page.getByRole("button", { name: "رفض", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "زيادة الجدولة", exact: true }),
    ).toBeDisabled();
    await page.unroute("**/api/v1/admin/withdrawals?*");
    await page.getByRole("button", { name: "تحديث طلبات السحب" }).click();
    await expect(table).toContainText("99.123456 USDT");
    await expect(
      page.getByRole("button", { name: "رفض", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "زيادة الجدولة", exact: true }),
    ).toBeEnabled();
  }
  expect((await p09State(scenario)).requests[0]?.version).toBe(1);
  expect(failures).toEqual([]);
});

test("P09 remediation external rejection refreshes the mounted account wallet without history", async ({
  page,
  request,
  playwright,
  scenario,
}) => {
  const saved = await reserveForAdmin(request, scenario);
  const adminRequest = await playwright.request.newContext();
  const failures = browserFailures(page);
  try {
    const admin = await managementActor(adminRequest);
    await employeeSignIn(page, "employee@p09.test");
    await page.goto("/employee/account");
    const balance = page
      .getByText("الرصيد المتاح", { exact: true })
      .locator("..");
    await expect(balance).toContainText("30.00");
    const rejected = await adminRequest.post(
      `${managementApiUrl}/admin/withdrawals/${saved.id}/rejections`,
      {
        headers: {
          ...admin.headers,
          "Idempotency-Key": "p09-account-external-release",
        },
        data: {
          expectedVersion: 1,
          reason: "External account release",
          confirmed: true,
        },
      },
    );
    expect(rejected.status()).toBe(200);
    await expect(balance).toContainText("130.00", { timeout: 30_000 });
    expect((await p09State(scenario)).wallet.reservedNonReferral).toBe("0");
    expect(failures).toEqual([]);
  } finally {
    await adminRequest.dispose();
  }
});

test("P09 remediation completion response boundary refreshes the mounted account wallet without history", async ({
  page,
  request,
  scenario,
}) => {
  const saved = await reserveForAdmin(request, scenario);
  const before = await p09State(scenario);
  const failures = browserFailures(page);
  let completed = false,
    activeStatusReads = 0,
    detailReads = 0,
    settledWalletReads = 0;
  // Read-boundary coverage only: persisted reservation is unchanged; no signer,
  // broadcast or fabricated database settlement is used as payout evidence.
  const terminal = withdrawalRequestSchema.parse({
    ...saved,
    version: 2,
    state: "COMPLETED",
    finalizedAt: saved.serverNow,
    transactionId: "a".repeat(64),
    settlement: {
      withdrawalId: saved.id,
      attemptId: saved.quoteId,
      network: saved.network,
      tokenContract: initialAddress,
      source: initialAddress,
      recipient: saved.recipient,
      addressVersion: saved.addressVersion,
      gross: saved.gross,
      feeBps: saved.feeBps,
      fee: saved.fee,
      net: saved.net,
      sourceAllocation: saved.sourceAllocation,
      transactionId: "a".repeat(64),
      blockId: "b".repeat(64),
      blockNumber: "123",
    },
  });
  await page.route("**/api/v1/withdrawals/me", async (route) => {
    const response = await route.fetch();
    const envelope = successEnvelopeSchema.parse(await response.json());
    const status = withdrawalStatusSchema.parse(envelope.data);
    if (!completed && status.activeWithdrawal !== null) activeStatusReads++;
    await route.fulfill({
      response,
      json: {
        ...envelope,
        data: {
          ...status,
          activeWithdrawal: completed ? null : status.activeWithdrawal,
        },
      },
    });
  });
  await page.route(`**/api/v1/withdrawals/${saved.id}`, async (route) => {
    detailReads++;
    const response = await route.fetch();
    const envelope = successEnvelopeSchema.parse(await response.json());
    await route.fulfill({ response, json: { ...envelope, data: terminal } });
  });
  await page.route("**/api/v1/wallet/me", async (route) => {
    const terminalObserved = completed && detailReads > 0;
    const response = await route.fetch();
    const envelope = successEnvelopeSchema.parse(await response.json());
    const wallet = walletViewSchema.parse(envelope.data);
    if (terminalObserved) settledWalletReads++;
    const data = terminalObserved
      ? walletViewSchema.parse({
          ...wallet,
          walletComponents: {
            ...wallet.walletComponents,
            reservedNonReferral: "0",
            total: "30",
          },
        })
      : wallet;
    await route.fulfill({ response, json: { ...envelope, data } });
  });
  await employeeSignIn(page, "employee@p09.test");
  await page.goto("/employee/account");
  const total = page.getByText("الرصيد المتاح", { exact: true }).locator("..");
  await expect(total).toContainText("30.00");
  await expect
    .poll(() => activeStatusReads, { timeout: 30_000 })
    .toBeGreaterThan(1);
  completed = true;
  await expect
    .poll(() => ({ details: detailReads, refreshed: settledWalletReads > 0 }), {
      timeout: 30_000,
    })
    .toEqual({ details: 1, refreshed: true });
  await expect(total).toContainText("30.00");
  expect(detailReads).toBe(1);
  expect(settledWalletReads).toBeGreaterThan(0);
  expect(await p09State(scenario)).toEqual(before);
  expect(failures).toEqual([]);
});

function browserFailures(
  page: Page,
  expectedResponses: ReadonlyMap<string, number> = new Map(),
  expectedAbortedRequests: ReadonlySet<string> = new Set(),
) {
  const failures: string[] = [];
  page.on("pageerror", () => {
    failures.push("pageerror");
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    if (
      location === "http://127.0.0.1:3103/favicon.ico" &&
      message.text().startsWith("Failed to load resource:") &&
      message.text().includes("404")
    )
      return;
    const expectedStatus = location
      ? expectedResponses.get(new URL(location).pathname)
      : undefined;
    if (
      location &&
      expectedAbortedRequests.has(new URL(location).pathname) &&
      message.text().startsWith("Failed to load resource:") &&
      message.text().includes("net::ERR_FAILED")
    )
      return;
    if (
      expectedStatus !== undefined &&
      message.text().startsWith("Failed to load resource:") &&
      message.text().includes(`status of ${String(expectedStatus)}`)
    )
      return;
    failures.push("console-error");
  });
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname.startsWith("/api/v1/") &&
      response.status() >= 400 &&
      expectedResponses.get(new URL(response.url()).pathname) !==
        response.status()
    )
      failures.push("api-http-error");
  });
  return failures;
}
async function destinationMail(
  scenario: Scenario,
  email: "employee@p09.test" | "other@p09.test" = "employee@p09.test",
) {
  const mail = await scenario.command({ command: "mail", email });
  if (!mail || !("url" in mail) || mail.url === null)
    throw new Error("P09_MAIL_REQUIRED");
  const target = new URL(mail.url);
  return target.pathname + target.hash;
}
async function issueDestination(page: Page) {
  await page.goto("/employee/withdraw");
  await page.getByLabel("أدخل عنوان محفظة TRON (TRC20):").fill(initialAddress);
  await page.getByRole("button", { name: "حفظ وتأمين عنوان السحب" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText(initialAddress);
  await expect(sheet).toContainText("TRON_NILE");
  await sheet
    .getByRole("button", { name: "تأكيد العنوان وإرسال رابط البريد" })
    .click();
  await expect(page.getByText(/قبل مزود البريد/u)).toBeVisible();
}
async function assertPrivateLinkRemoved(page: Page) {
  expect(new URL(page.url()).hash).toBe("");
  expect(
    await page.evaluate(() => {
      const retained = [
        location.href,
        JSON.stringify(history.state),
        JSON.stringify(localStorage),
        JSON.stringify(sessionStorage),
      ];
      return retained.some((text) => text.includes("withdrawal-confirmation="));
    }),
  ).toBe(false);
}
async function confirmedEmployee(
  request: APIRequestContext,
  scenario: Scenario,
) {
  const login = await request.post(`${managementApiUrl}/auth/login`, {
    data: {
      email: "employee@p09.test",
      password: managementPassword,
      rememberMe: false,
    },
  });
  expect(login.status()).toBe(200);
  const actor = identitySessionDataSchema.parse(
    successEnvelopeSchema.parse(await login.json()).data,
  );
  const csrf = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "csrfToken",
  );
  if (!csrf) throw new Error("P09_CSRF_REQUIRED");
  const headers = {
    Authorization: `Bearer ${actor.tokens.accessToken}`,
    "x-csrf-token": csrf.value,
  };
  const issue = await request.post(
    `${managementApiUrl}/withdrawals/me/destination/confirmations`,
    { headers, data: { address: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb" } },
  );
  expect(issue.status()).toBe(201);
  const mail = await scenario.command({
    command: "mail",
    email: "employee@p09.test",
  });
  if (!mail || !("url" in mail) || mail.url === null)
    throw new Error("P09_MAIL_REQUIRED");
  const token = new URL(mail.url).hash.slice(
    "#withdrawal-confirmation=".length,
  );
  const consume = await request.post(
    `${managementApiUrl}/withdrawals/me/destination/consume`,
    { headers, data: { token } },
  );
  expect(consume.status()).toBe(200);
  expect(
    withdrawalDestinationSchema.parse(
      successEnvelopeSchema.parse(await consume.json()).data,
    ).state,
  ).toBe("CONFIRMED");
  return headers;
}
async function review(page: Page, gross = "100") {
  await page.getByLabel("المبلغ المطلوب سحبه (USDT)").fill(gross);
  await page.getByRole("button", { name: "متابعة تأكيد طلب السحب" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}
async function assertOneReservation(scenario: Scenario) {
  const state = await p09State(scenario);
  expect(state.requests).toHaveLength(1);
  expect(state.requests[0]).toMatchObject({
    state: "SCHEDULED",
    gross: "100",
    fee: "21",
    net: "79",
    nonReferral: "100",
    referral: "0",
  });
  expect(state.reservations).toHaveLength(1);
  expect(state.reservations[0]).toMatchObject({
    state: "ACTIVE",
    gross: "100",
    nonReferral: "100",
    referral: "0",
  });
  expect(state.wallet).toMatchObject({
    availableNonReferral: "0",
    availableReferral: "30",
    reservedNonReferral: "100",
    reservedReferral: "0",
  });
  expect(state.withdrawalAttempts).toBe(0);
  expect(state.transferAttempts).toBe(0);
  return state;
}
test("P09 acceptance read failures retain dirty drafts and empty/range feedback never fabricates history", async ({
  page,
  request,
  scenario,
}) => {
  await p09Fixtures(scenario);
  await confirmedEmployee(request, scenario);
  const before = await p09State(scenario);
  const expected = new Map<string, number>();
  const failures = browserFailures(page, expected);
  let mode: "real" | "malformed" | "unavailable" | "empty" = "real";
  await page.route(/\/api\/v1\/withdrawals\?/u, async (route) => {
    if (mode === "real") return route.continue();
    if (mode === "unavailable")
      return route.fulfill({
        status: 503,
        json: { success: false, statusCode: 503, code: "SERVICE_UNAVAILABLE" },
      });
    if (mode === "malformed")
      return route.fulfill({
        status: 200,
        json: { success: true, statusCode: 200, data: { items: "invalid" } },
      });
    const response = await route.fetch();
    const envelope = successEnvelopeSchema.parse(await response.json());
    const pagination = {
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
    return route.fulfill({
      status: 200,
      json: {
        ...envelope,
        data: { items: [], pagination },
        paginationMeta: pagination,
      },
    });
  });
  await employeeSignIn(page, "employee@p09.test");
  await page.goto("/employee/withdraw");
  const amount = page.getByLabel("المبلغ المطلوب سحبه (USDT)");
  await amount.fill("123.456789");
  const history = page.getByRole("region", { name: "سجل طلبات السحب" });
  for (const next of ["malformed", "unavailable", "empty"] as const) {
    mode = next;
    if (next === "unavailable") expected.set("/api/v1/withdrawals", 503);
    await history.getByRole("button", { name: "تحديث سجل السحب" }).click();
    if (next === "malformed")
      await expect(history.getByRole("alert")).toContainText("تعذر التحقق");
    if (next === "unavailable")
      await expect(history.getByRole("alert")).toContainText("تعذر تحميل سجل");
    if (next === "empty") await expect(history).toContainText("0 طلب — 0 صفحة");
    await expect(amount).toHaveValue("123.456789");
    await expect(history.getByRole("article")).toHaveCount(0);
  }
  expect(await p09State(scenario)).toEqual(before);
  expect(failures).toEqual([]);
});

test("P09 acceptance bounded observation exhausts without payment or replay and explicit refresh restarts", async ({
  page,
  request,
  scenario,
}) => {
  const saved = await reserveForAdmin(request, scenario);
  const before = await p09State(scenario);
  const failures = browserFailures(page);
  await employeeSignIn(page, "employee@p09.test");
  await page.clock.install();
  let reads = 0;
  await page.route("**/api/v1/withdrawals/me", async (route) => {
    reads++;
    return route.continue();
  });
  await page.goto("/employee/withdraw");
  await expect(
    page.getByRole("region", { name: "طلب السحب النشط" }),
  ).toBeVisible();
  await page.clock.resume();
  // The first persisted request can reset mounted observers. Start a known
  // budget through the existing explicit refresh after that initial render.
  const refresh = page.getByRole("button", { name: "تحديث حالة السحب" });
  await expect(refresh).toBeEnabled();
  const initialReads = reads;
  await refresh.click();
  await expect.poll(() => reads).toBe(initialReads + 1);
  await expect(refresh).toBeEnabled();
  const budgetStart = reads;
  // Advance only browser scheduling, never the API clock or protected payout claims.
  for (let cycle = 1; cycle < 20; cycle++) {
    const previous = reads;
    await page.clock.fastForward(61_000);
    await expect.poll(() => reads).toBeGreaterThan(previous);
    await expect(
      page.getByRole("button", { name: "تحديث حالة السحب" }),
    ).toBeEnabled();
  }
  await expect(
    page.getByText(/توقفت المتابعة التلقائية/u).first(),
  ).toBeVisible();
  expect(reads).toBe(budgetStart + 19);
  const exhaustedReads = reads;
  await page.clock.fastForward(300_000);
  expect(reads).toBe(exhaustedReads);
  // Real protected-route focus revalidation changes the session check, not the actor.
  const revalidated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/users/me") && response.status() === 200,
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await revalidated;
  await expect(
    page.getByRole("region", { name: "طلب السحب النشط" }),
  ).toBeVisible();
  await expect(
    page.getByText(/توقفت المتابعة التلقائية/u).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "طلب السحب النشط" }),
  ).toContainText(saved.id);
  await expect(
    page.getByRole("button", { name: "متابعة تأكيد طلب السحب" }),
  ).toHaveCount(0);
  await page.clock.fastForward(300_000);
  expect(reads).toBe(exhaustedReads);
  await expect(
    page.getByRole("region", { name: "طلب السحب النشط" }),
  ).toContainText("يبقى المبلغ محجوزاً");
  await page.getByRole("button", { name: "تحديث حالة السحب" }).click();
  await expect.poll(() => reads).toBe(exhaustedReads + 1);
  await expect(
    page.getByRole("button", { name: "تحديث حالة السحب" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("region", { name: "طلب السحب النشط" }),
  ).toContainText("مجدول");
  expect((await p09State(scenario)).requests[0]?.id).toBe(saved.id);
  expect(await p09State(scenario)).toEqual(before);
  expect(failures).toEqual([]);
});

test("P09 acceptance current authority revocation retires withdrawal data and account switch cannot inherit drafts", async ({
  page,
  request,
  playwright,
  scenario,
}) => {
  const fixtures = await p09Fixtures(scenario);
  await confirmedEmployee(request, scenario);
  const adminRequest = await playwright.request.newContext();
  const expected = new Map([
    ["/api/v1/withdrawals/me", 401],
    ["/api/v1/users/me", 401],
    ["/api/v1/auth/refresh", 401],
  ]);
  const failures = browserFailures(page, expected);
  try {
    await employeeSignIn(page, "employee@p09.test");
    await page.goto("/employee/withdraw");
    await page.getByLabel("المبلغ المطلوب سحبه (USDT)").fill("123.456789");
    const actor = await managementActor(adminRequest);
    const endpoint = `${managementApiUrl}/admin/employees/${fixtures.employeeId}/restrictions`;
    const current = await adminRequest.get(endpoint, {
      headers: actor.headers,
    });
    expect(current.status()).toBe(200);
    const controls = employeeRestrictionsDataSchema.parse(
      successEnvelopeSchema.parse(await current.json()).data,
    );
    // Revocation must follow real login timestamps, independently of fixture startup time.
    await p09Clock(scenario, new Date(Date.now() + 1_000).toISOString());
    const changed = await adminRequest.patch(endpoint, {
      headers: actor.headers,
      data: {
        status: "BANNED",
        expectedVersion: controls.employee.accountVersion,
        confirmed: true,
        reason: "P09 revoked browser authority",
      },
    });
    expect(changed.status()).toBe(200);
    await page.getByRole("button", { name: "تحديث حالة السحب" }).click();
    await expect(page).toHaveURL(/\/employee\/auth\/login/u);
    await expect(
      page.getByRole("region", { name: "سجل طلبات السحب" }),
    ).toHaveCount(0);
    await employeeSignIn(page, "other@p09.test");
    await page.goto("/employee/withdraw");
    await expect(
      page.getByLabel("أدخل عنوان محفظة TRON (TRC20):"),
    ).toBeVisible();
    await expect(page.getByText(initialAddress, { exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator('input[value="123.456789"]')).toHaveCount(0);
    expect((await p09State(scenario)).requests).toHaveLength(0);
    expect((await p09State(scenario, "other@p09.test")).requests).toHaveLength(
      0,
    );
    expect(failures).toEqual([]);
  } finally {
    await adminRequest.dispose();
  }
});

test("P09 acceptance long exact quote remains readable with keyboard focus at phone and desktop widths", async ({
  page,
  request,
  scenario,
}) => {
  await p09Fixtures(scenario, { nonReferral: "500" });
  await confirmedEmployee(request, scenario);
  const failures = browserFailures(page);
  await employeeSignIn(page, "employee@p09.test");
  await page.goto("/employee/withdraw");
  const dialog = await review(page, "499.999999");
  await expect(dialog).toContainText("499.999999");
  await expect(dialog).toContainText("104.999999");
  await expect(dialog).toContainText(initialAddress);
  const before = await p09State(scenario);
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await dialog.evaluate((element) => getComputedStyle(element).direction),
    ).toBe("rtl");
    expect(
      await dialog.evaluate((element) => getComputedStyle(element).fontFamily),
    ).toContain("Cairo");
    await dialog.getByRole("button", { name: "إغلاق النافذة" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "تراجع", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "إغلاق النافذة" }),
    ).toBeFocused();
    await page.screenshot({
      path: `../../output/playwright/p03/p09-acceptance-quote-${String(width)}.png`,
      animations: "disabled",
      mask: [page.locator("input:visible"), page.locator("bdi:visible")],
    });
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "متابعة تأكيد طلب السحب" }),
  ).toBeFocused();
  await expect(page.getByLabel("المبلغ المطلوب سحبه (USDT)")).toHaveValue(
    "499.999999",
  );
  expect(await p09State(scenario)).toEqual(before);
  expect(failures).toEqual([]);
});

test("US1 exact review, source eligibility, reservation and reload on approved phone/desktop surfaces", async ({
  page,
  request,
  scenario,
}) => {
  await p09Fixtures(scenario);
  await confirmedEmployee(request, scenario);
  await employeeSignIn(page, "employee@p09.test");
  await page.goto("/employee/withdraw");
  const errors: string[] = [];
  page.on("pageerror", () => {
    errors.push("pageerror");
  });
  const amount = page.getByLabel("المبلغ المطلوب سحبه (USDT)");
  await amount.fill("100.0000001");
  await expect(
    page.getByRole("button", { name: "متابعة تأكيد طلب السحب" }),
  ).toBeDisabled();
  // Free membership retains the 30 referral funds, which cannot cover the extra micro-unit.
  let dialog = await review(page, "100.000001");
  await expect(
    dialog.getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "تراجع", exact: true }).click();
  dialog = await review(page, "00100.000000");
  await dialog.getByRole("button", { name: "تراجع", exact: true }).click();
  await amount.fill("50");
  await expect(page.getByText("79.00", { exact: true })).toHaveCount(0);
  dialog = await review(page, "50");
  await expect(dialog).toContainText("39.50");
  await dialog.getByRole("button", { name: "تراجع", exact: true }).click();
  await page.getByRole("button", { name: "100", exact: true }).click();
  await expect(page.getByText("39.50", { exact: true })).toHaveCount(0);
  dialog = await review(page);
  await expect(dialog).toContainText("21%");
  await expect(dialog).toContainText("79.00");
  await expect(dialog).toContainText("TRON_NILE");
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await dialog.evaluate((element) =>
        getComputedStyle(element).fontFamily.includes("Cairo"),
      ),
    ).toBe(true);
    await dialog.getByRole("button", { name: "تراجع", exact: true }).focus();
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../../output/playwright/p03/p09-us1-review-${String(width)}.png`,
      animations: "disabled",
      mask: [page.locator("input"), page.locator("bdi")],
    });
  }
  const before = await p09State(scenario);
  await dialog
    .getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" })
    .click();
  await expect(
    page.getByText("تم حجز المبلغ وجدولة السحب تلقائياً."),
  ).toBeVisible();
  const after = await assertOneReservation(scenario);
  expect(after.operations - before.operations).toBe(1);
  expect(after.actions - before.actions).toBe(1);
  await page.reload();
  await expect(
    page.getByText("لديك طلب سحب قيد المعالجة", { exact: true }),
  ).toBeVisible();
  expect((await assertOneReservation(scenario)).requests[0]?.id).toBe(
    after.requests[0]?.id,
  );
  expect(errors).toEqual([]);
});
test("US1 definite stale rejection has zero effect and requires a fresh reviewed quote", async ({
  page,
  request,
  scenario,
}) => {
  await p09Fixtures(scenario);
  await confirmedEmployee(request, scenario);
  await employeeSignIn(page, "employee@p09.test");
  await page.goto("/employee/withdraw");
  let dialog = await review(page);
  const before = await p09State(scenario);
  await p09Clock(
    scenario,
    new Date(new Date(before.serverNow).getTime() + 3600000).toISOString(),
  );
  await dialog
    .getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" })
    .click();
  await expect(
    page.getByText("تغيرت شروط الطلب. راجع عرضاً جديداً قبل التأكيد."),
  ).toBeVisible();
  const stale = await p09State(scenario);
  expect(stale.requests).toEqual([]);
  expect(stale.reservations).toEqual([]);
  expect(stale.operations).toBe(before.operations);
  await expect(page.getByLabel("المبلغ المطلوب سحبه (USDT)")).toHaveValue(
    "100",
  );
  dialog = await review(page);
  await dialog
    .getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" })
    .click();
  await expect(
    page.getByText("تم حجز المبلغ وجدولة السحب تلقائياً."),
  ).toBeVisible();
  await assertOneReservation(scenario);
});
test("P09 remediation strict blocked acceptance retires recovery and keeps the amount draft", async ({
  page,
  request,
  playwright,
  scenario,
}) => {
  const fixture = await p09Fixtures(scenario);
  await confirmedEmployee(request, scenario);
  const adminRequest = await playwright.request.newContext();
  const failures = browserFailures(
    page,
    new Map([["/api/v1/withdrawals", 403]]),
  );
  try {
    const admin = await managementActor(adminRequest);
    await employeeSignIn(page, "employee@p09.test");
    await page.goto("/employee/withdraw");
    const dialog = await review(page);
    let sends = 0;
    await page.route("**/api/v1/withdrawals", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      sends++;
      const endpoint = `${managementApiUrl}/admin/employees/${fixture.employeeId}/restrictions`;
      const response = await adminRequest.get(endpoint, {
        headers: admin.headers,
      });
      const controls = employeeRestrictionsDataSchema.parse(
        successEnvelopeSchema.parse(await response.json()).data,
      );
      const blocked = await adminRequest.patch(endpoint, {
        headers: admin.headers,
        data: {
          withdrawalsBlocked: true,
          expectedVersion: controls.employee.accountVersion,
          confirmed: true,
          reason: "P09 blocked first dispatch",
        },
      });
      expect(blocked.status()).toBe(200);
      const rejected = await route.fetch();
      expect(rejected.status()).toBe(403);
      await route.fulfill({ response: rejected });
    });
    await dialog
      .getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" })
      .click();
    await expect(page.getByText("السحب مقيد لهذا الحساب.")).toBeVisible();
    await expect(page.getByLabel("المبلغ المطلوب سحبه (USDT)")).toHaveValue(
      "100",
    );
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).some((key) =>
          key.startsWith("oscar.withdrawal.v1."),
        ),
      ),
    ).toBe(false);
    expect((await p09State(scenario)).requests).toHaveLength(0);
    expect(sends).toBe(1);
    expect(failures).toEqual([]);
  } finally {
    await adminRequest.dispose();
  }
});
test("US1 competing contexts and a real executed acceptance with its reply lost reserve only once", async ({
  page,
  request,
  scenario,
  browser,
}) => {
  await p09Fixtures(scenario);
  await confirmedEmployee(request, scenario);
  await employeeSignIn(page, "employee@p09.test");
  await page.goto("/employee/withdraw");
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3103" });
  try {
    const competing = await other.newPage();
    await employeeSignIn(competing, "employee@p09.test");
    await competing.goto("/employee/withdraw");
    const first = await review(page),
      second = await review(competing);
    const before = await p09State(scenario);
    let suppressed = false;
    await page.route("**/api/v1/withdrawals", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      expect([200, 201]).toContain(response.status());
      suppressed = true;
      await route.abort("failed");
    });
    await first
      .getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" })
      .click();
    await expect.poll(() => suppressed).toBe(true);
    await second
      .getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" })
      .click();
    await page.reload();
    await expect(
      page.getByText("لديك طلب سحب قيد المعالجة", { exact: true }),
    ).toBeVisible();
    await expect(
      competing.getByText("لديك طلب سحب قيد المعالجة", { exact: true }),
    ).toBeVisible();
    const after = await assertOneReservation(scenario);
    expect(after.operations - before.operations).toBe(1);
    expect(after.actions - before.actions).toBe(1);
  } finally {
    await other.close();
  }
});

test("US1 simultaneous independently reviewed contexts choose one persisted winner", async ({
  page,
  request,
  scenario,
  browser,
}) => {
  await p09Fixtures(scenario);
  await confirmedEmployee(request, scenario);
  await employeeSignIn(page, "employee@p09.test");
  await page.goto("/employee/withdraw");
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3103" });
  try {
    const competing = await other.newPage();
    await employeeSignIn(competing, "employee@p09.test");
    await competing.goto("/employee/withdraw");
    const first = await review(page),
      second = await review(competing);
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    for (const current of [page, competing])
      await current.route("**/api/v1/withdrawals", async (route) => {
        if (route.request().method() === "POST") {
          arrived++;
          if (arrived === 2) release();
          await barrier;
        }
        await route.continue();
      });
    const before = await p09State(scenario);
    await Promise.all([
      first
        .getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" })
        .click(),
      second
        .getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" })
        .click(),
    ]);
    await expect(
      page.getByText("لديك طلب سحب قيد المعالجة", { exact: true }),
    ).toBeVisible();
    await expect(
      competing.getByText("لديك طلب سحب قيد المعالجة", { exact: true }),
    ).toBeVisible();
    expect(arrived).toBe(2);
    const after = await assertOneReservation(scenario);
    expect(after.operations - before.operations).toBe(1);
    expect(after.actions - before.actions).toBe(1);
  } finally {
    await other.close();
  }
});

test("US2 first destination review, private no-write link opening, explicit confirmation and reload", async ({
  page,
  scenario,
}) => {
  await p09Fixtures(scenario);
  await employeeSignIn(page, "employee@p09.test");
  await issueDestination(page);
  expect((await p09State(scenario)).destination).toMatchObject({
    confirmed: false,
    proofIssued: true,
  });
  await page.reload();
  await expect(page.getByText(/عنوان بانتظار تأكيد البريد/u)).toBeVisible();
  const link = await destinationMail(scenario);
  let consumes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/destination/consume")
    )
      consumes++;
  });
  await page.goto(link);
  const confirm = page.getByRole("button", {
    name: "تأكيد عنوان السحب",
  });
  await expect(confirm).toBeEnabled();
  await assertPrivateLinkRemoved(page);
  expect(consumes).toBe(0);
  expect((await p09State(scenario)).destination?.confirmed).toBe(false);
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await mkdir("../../output/playwright/p03", { recursive: true });
    await page.screenshot({
      path: `../../output/playwright/p03/p09-us2-account-${width.toString()}.png`,
      fullPage: true,
      mask: [
        page.locator("bdi"),
        page.getByRole("heading", { name: /employee/u }),
        page.getByText("employee@p09.test", { exact: true }),
      ],
    });
  }
  await confirm.click();
  await expect(page.getByText("تم تأكيد عنوان السحب.")).toBeVisible();
  expect(consumes).toBe(1);
  expect((await p09State(scenario)).destination?.confirmed).toBe(true);
  await page.reload();
  await expect(page.getByText(initialAddress, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "طلب تغيير العنوان" }),
  ).toBeDisabled();
  await page.goto("/employee/withdraw");
  await expect(page.getByText("مثبت ومؤمن")).toBeVisible();
  await expect(page.getByLabel("أدخل عنوان محفظة TRON (TRC20):")).toHaveCount(
    0,
  );
  const saved = await p09State(scenario);
  expect(saved.requests).toHaveLength(0);
  expect(saved.withdrawalAttempts).toBe(0);
});

test("US2 expired and superseded links never confirm; a genuinely lost consume reply observes the saved destination", async ({
  page,
  scenario,
}) => {
  await p09Fixtures(scenario);
  await employeeSignIn(page, "employee@p09.test");
  await issueDestination(page);
  const oldLink = await destinationMail(scenario);
  const issued = await p09State(scenario);
  await p09Clock(
    scenario,
    new Date(
      new Date(issued.serverNow).getTime() + 25 * 60 * 60 * 1000,
    ).toISOString(),
  );
  await page.reload();
  await expect(page.getByText(/انتهت صلاحية الرابط/u)).toBeVisible();
  await page.getByRole("button", { name: "إعادة إرسال رابط التأكيد" }).click();
  await expect
    .poll(async () => (await p09State(scenario)).destination?.version)
    .toBe(2);
  const latestLink = await destinationMail(scenario);
  await page.goto(oldLink);
  await page.getByRole("button", { name: "تأكيد عنوان السحب" }).click();
  await expect(page.getByText(/افتح أحدث رابط بريد/u)).toBeVisible();
  expect((await p09State(scenario)).destination?.confirmed).toBe(false);
  await page.goto(latestLink);
  let executed = false;
  await page.route("**/destination/consume", async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    executed = true;
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "تأكيد عنوان السحب" }).click();
  await expect(page.getByText("تم تأكيد عنوان السحب.")).toBeVisible();
  expect(executed).toBe(true);
  expect((await p09State(scenario)).destination).toMatchObject({
    confirmed: true,
    version: 3,
  });
  await assertPrivateLinkRemoved(page);
  await page.reload();
  await expect(page.getByText(initialAddress, { exact: true })).toBeVisible();
  await page.goto(latestLink);
  await expect(
    page.getByRole("button", { name: "تأكيد عنوان السحب" }),
  ).toHaveCount(0);
  expect((await p09State(scenario)).destination).toMatchObject({
    confirmed: true,
    version: 3,
  });
});

test("US2 wrong-account and signed-out links are ineffective and require reopening after matching login", async ({
  page,
  scenario,
  browser,
}) => {
  await p09Fixtures(scenario);
  await employeeSignIn(page, "employee@p09.test");
  await issueDestination(page);
  const employeeLink = await destinationMail(scenario);
  const otherContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3103",
  });
  try {
    const other = await otherContext.newPage();
    await other.goto(employeeLink);
    await expect(other).toHaveURL(/\/employee\/auth\/login/u);
    await assertPrivateLinkRemoved(other);
    await employeeSignIn(other, "other@p09.test");
    await issueDestination(other);
    await other.goto(employeeLink);
    await other.getByRole("button", { name: "تأكيد عنوان السحب" }).click();
    await expect(other.getByText(/افتح أحدث رابط بريد/u)).toBeVisible();
    expect(
      (await p09State(scenario, "other@p09.test")).destination?.confirmed,
    ).toBe(false);
    expect((await p09State(scenario)).destination?.confirmed).toBe(false);
    await assertPrivateLinkRemoved(other);
    await page.goto(employeeLink);
    await page.getByRole("button", { name: "تأكيد عنوان السحب" }).click();
    await expect(page.getByText("تم تأكيد عنوان السحب.")).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test("US3 real HTTP schedule, weekend snapshots, external extension/release and wallet/history refresh", async ({
  page,
  request,
  playwright,
  scenario,
}) => {
  const failures = browserFailures(page);
  await p09Fixtures(scenario);
  await p09Clock(scenario, "2026-10-09T09:00:00.000Z");
  const headers = await confirmedEmployee(request, scenario);
  const adminRequest = await playwright.request.newContext();
  try {
    const admin = await managementActor(adminRequest);
    await employeeSignIn(page, "employee@p09.test");
    await page.goto("/employee/withdraw");
    const dialog = await review(page);
    await dialog
      .getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" })
      .click();
    const active = page.getByRole("region", { name: "طلب السحب النشط" });
    await expect(active).toBeVisible();
    const readStatus = async () => {
      const response = await request.get(`${managementApiUrl}/withdrawals/me`, {
        headers,
      });
      expect(response.status()).toBe(200);
      return withdrawalStatusSchema.parse(
        successEnvelopeSchema.parse(await response.json()).data,
      );
    };
    let saved = (await readStatus()).activeWithdrawal;
    if (saved === null) throw new Error("P09_SAVED_REQUEST_REQUIRED");
    expect(saved.originalDueAt).toBe("2026-10-14T09:00:00.000Z");
    expect(saved.remainingCountedHours).toBe("72");
    await active.getByText("تفاصيل الطلب").click();
    await expect(active).toContainText(saved.recipient);
    const disclosure = active.locator("summary");
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect(active.locator("details")).not.toHaveAttribute("open", "");
    await page.keyboard.press("Enter");
    await expect(active.locator("details")).toHaveAttribute("open", "");
    const originalId = saved.id;
    for (const instant of [
      "2026-10-09T21:00:00.000Z",
      "2026-10-10T12:00:00.000Z",
      "2026-10-11T20:59:59.000Z",
      "2026-10-11T21:00:00.000Z",
    ]) {
      await p09Clock(scenario, instant);
      saved = (await readStatus()).activeWithdrawal;
      expect(saved?.remainingCountedHours).toBe("60");
      expect(saved?.id).toBe(originalId);
    }
    const extension = await adminRequest.post(
      `${managementApiUrl}/admin/withdrawals/${originalId}/extensions`,
      {
        headers: {
          ...admin.headers,
          "Idempotency-Key": "p09-us3-extension-0001",
        },
        data: {
          expectedVersion: 1,
          countedHours: "1.5",
          confirmed: true,
          reason: "US3 real counted extension",
        },
      },
    );
    expect(extension.status()).toBe(200);
    const extended = withdrawalCommandResultSchema.parse(
      successEnvelopeSchema.parse(await extension.json()).data,
    ).withdrawal;
    expect(extended.originalDueAt).toBe("2026-10-14T09:00:00.000Z");
    expect(extended.dueAt).toBe("2026-10-14T10:30:00.000Z");
    expect(extended.remainingCountedHours).toBe("61.5");
    await page.getByRole("button", { name: "تحديث حالة السحب" }).click();
    await expect(active).toContainText("61.5");
    await expect(active).toContainText("US3 real counted extension");
    await expect(active).toContainText(admin.actorId);
    await mkdir("../../output/playwright/p03", { recursive: true });
    for (const width of [320, 390, 430, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await active.evaluate((element) =>
          getComputedStyle(element).fontFamily.includes("Cairo"),
        ),
      ).toBe(true);
      await page.screenshot({
        path: `../../output/playwright/p03/p09-us3-schedule-${String(width)}.png`,
        fullPage: true,
        animations: "disabled",
        mask: [page.locator("bdi:visible"), page.locator("input:visible")],
      });
    }
    await p09Clock(scenario, extended.dueAt);
    await page.getByRole("button", { name: "تحديث حالة السحب" }).click();
    await expect(active).toContainText("صفر لا يعني اكتمال الدفع");
    saved = (await readStatus()).activeWithdrawal;
    expect(saved?.remainingCountedHours).toBe("0");
    expect(saved?.state).toBe("SCHEDULED");
    await assertOneReservation(scenario);
    const beforeRelease = await p09State(scenario);
    const rejected = await adminRequest.post(
      `${managementApiUrl}/admin/withdrawals/${originalId}/rejections`,
      {
        headers: {
          ...admin.headers,
          "Idempotency-Key": "p09-us3-rejection-0001",
        },
        data: {
          expectedVersion: extended.version,
          confirmed: true,
          reason: "US3 safe release",
        },
      },
    );
    expect(rejected.status()).toBe(200);
    await page.getByRole("button", { name: "تحديث سجل السحب" }).click();
    const history = page.getByRole("region", { name: "سجل طلبات السحب" });
    await expect(history).toContainText(
      "أُعيد المبلغ إلى مصادره الأصلية؛ رسوم محصلة: 0 USDT.",
    );
    await expect(active).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "متابعة تأكيد طلب السحب" }),
    ).toBeEnabled();
    const after = await p09State(scenario);
    expect(after.operations - beforeRelease.operations).toBe(1);
    expect(after.wallet).toMatchObject({
      availableNonReferral: "100",
      availableReferral: "30",
      reservedNonReferral: "0",
      reservedReferral: "0",
    });
    expect(after.reservations[0]?.state).toBe("RELEASED");
    expect(after.withdrawalAttempts).toBe(0);
    expect(after.transferAttempts).toBe(0);
    await page.reload();
    await expect(history).toContainText("مرفوض — أُعيد المبلغ");
    await expect(history).toContainText("الصفحة 1 من 1 — 1 طلب");
    await expect(
      page.getByRole("button", { name: "متابعة تأكيد طلب السحب" }),
    ).toBeEnabled();
    await page.goto("/employee/wallet");
    await expect(
      page.getByText("100.00", { exact: true }).first(),
    ).toBeVisible();
    // These are real reservations/schedule reads, without a worker or signer.
    for (const boundary of [
      {
        acceptedAt: "2026-10-17T09:00:00.000Z",
        dueAt: "2026-10-21T21:00:00.000Z",
        dispatchAt: "2026-10-21T21:00:00.000Z",
      },
      {
        acceptedAt: "2026-10-20T21:00:00.000Z",
        dueAt: "2026-10-23T21:00:00.000Z",
        dispatchAt: "2026-10-25T21:00:00.000Z",
      },
    ]) {
      await p09Clock(scenario, boundary.acceptedAt);
      const quoteResponse = await request.post(
        `${managementApiUrl}/withdrawals/quotes`,
        { headers, data: { gross: "100" } },
      );
      expect(quoteResponse.status()).toBe(201);
      const quote = withdrawalQuoteSchema.parse(
        successEnvelopeSchema.parse(await quoteResponse.json()).data,
      );
      const acceptance = await request.post(`${managementApiUrl}/withdrawals`, {
        headers: {
          ...headers,
          "Idempotency-Key": `p09-us3-boundary-${boundary.acceptedAt}`,
        },
        data: { quoteId: quote.quoteId, confirmed: true },
      });
      expect(acceptance.status()).toBe(201);
      const current = withdrawalCommandResultSchema.parse(
        successEnvelopeSchema.parse(await acceptance.json()).data,
      ).withdrawal;
      expect(current.dueAt).toBe(boundary.dueAt);
      expect(current.dispatchAt).toBe(boundary.dispatchAt);
      expect(current.remainingCountedHours).toBe("72");
      await page.goto("/employee/withdraw");
      await expect(active).toBeVisible();
      await expect(active).toContainText("72");
      if (boundary.acceptedAt === "2026-10-17T09:00:00.000Z") {
        await p09Clock(scenario, "2026-10-18T20:59:59.000Z");
        expect(
          (await readStatus()).activeWithdrawal?.remainingCountedHours,
        ).toBe("72");
      }
      const release = await adminRequest.post(
        `${managementApiUrl}/admin/withdrawals/${current.id}/rejections`,
        {
          headers: {
            ...admin.headers,
            "Idempotency-Key": `p09-us3-release-${current.id}`,
          },
          data: {
            expectedVersion: current.version,
            confirmed: true,
            reason: "US3 boundary cleanup through actual safe rejection",
          },
        },
      );
      expect(release.status()).toBe(200);
    }
    expect((await p09State(scenario)).wallet.reservedNonReferral).toBe("0");
    expect(failures).toEqual([]);
  } finally {
    await adminRequest.dispose();
  }
});

test("US3 seeded lifecycle/expiry/disposition and employee25 paging presentation only", async ({
  page,
  request,
  scenario,
}) => {
  const failures = browserFailures(page);
  await p09Fixtures(scenario);
  const headers = await confirmedEmployee(request, scenario);
  const quoteReply = await request.post(
    `${managementApiUrl}/withdrawals/quotes`,
    { headers, data: { gross: "100" } },
  );
  expect(quoteReply.status()).toBe(201);
  const quote = withdrawalQuoteSchema.parse(
    successEnvelopeSchema.parse(await quoteReply.json()).data,
  );
  const accepted = await request.post(`${managementApiUrl}/withdrawals`, {
    headers: { ...headers, "Idempotency-Key": "p09-us3-seed-base-0001" },
    data: { quoteId: quote.quoteId, confirmed: true },
  });
  expect(accepted.status()).toBe(201);
  const original = withdrawalCommandResultSchema.parse(
    successEnvelopeSchema.parse(await accepted.json()).data,
  ).withdrawal;
  const before = await p09State(scenario);
  const statusResponse = await request.get(
    `${managementApiUrl}/withdrawals/me`,
    { headers },
  );
  const statusEnvelope = successEnvelopeSchema.parse(
    await statusResponse.json(),
  );
  const baseStatus = withdrawalStatusSchema.parse(statusEnvelope.data);
  let seeded = original;
  let rangeShrank = false;
  await page.route("**/api/v1/withdrawals/me", (route) =>
    route.fulfill({
      status: 200,
      json: {
        ...statusEnvelope,
        data: {
          ...baseStatus,
          activeWithdrawal:
            seeded.release !== null || seeded.settlement !== null
              ? null
              : seeded,
        },
      },
    }),
  );
  await page.route(/\/api\/v1\/withdrawals\?/u, (route) => {
    const selected = Number(
      new URL(route.request().url()).searchParams.get("page"),
    );
    const pagination = {
      page: selected,
      limit: 25,
      total: rangeShrank ? 1 : 26,
      totalPages: rangeShrank ? 1 : 2,
      hasNextPage: selected === 1 && !rangeShrank,
      hasPreviousPage: selected > 1,
    };
    const items = Array.from(
      {
        length: rangeShrank
          ? selected === 1
            ? 1
            : 0
          : selected === 1
            ? 25
            : 1,
      },
      (_, index) =>
        withdrawalRequestSchema.parse({
          ...seeded,
          id:
            selected === 1 && index === 0
              ? seeded.id
              : `10000000-0000-4000-8000-${String(selected * 25 + index).padStart(12, "0")}`,
          settlement:
            seeded.settlement === null
              ? null
              : {
                  ...seeded.settlement,
                  withdrawalId:
                    selected === 1 && index === 0
                      ? seeded.id
                      : `10000000-0000-4000-8000-${String(selected * 25 + index).padStart(12, "0")}`,
                },
        }),
    );
    return route.fulfill({
      status: 200,
      json: {
        ...statusEnvelope,
        data: { items, pagination },
        paginationMeta: pagination,
      },
    });
  });
  await employeeSignIn(page, "employee@p09.test");
  let version = original.version;
  const stateLabels = {
    SCHEDULED: "مجدول للدفع التلقائي",
    SIGNING: "جارٍ تجهيز التوقيع",
    SIGNED: "تم التوقيع",
    SUBMITTED: "أُرسل وبانتظار التأكيد",
    UNKNOWN: "نتيجة الدفع غير مؤكدة",
    COMPLETED: "مكتمل — دفع مؤكد",
    REJECTED: "مرفوض — أُعيد المبلغ",
    CANCELLED: "ملغى — أُعيد المبلغ",
    FAILED: "تعذر الدفع بأمان — أُعيد المبلغ",
  };
  for (const state of withdrawalStateSchema.options) {
    const released = ["REJECTED", "CANCELLED", "FAILED"].includes(state);
    const final = released || state === "COMPLETED";
    const transactionId = "a".repeat(64);
    seeded = withdrawalRequestSchema.parse({
      ...original,
      state,
      version: ++version,
      serverNow: "2026-10-17T09:00:00.000Z",
      effectiveMembership: "PAID",
      feeBasis: "SUBSCRIPTION",
      subscriptionId: original.quoteId,
      subscriptionVersion: 1,
      subscriptionExpiresAt: new Date(
        new Date(original.acceptedAt).getTime() + 3600000,
      ).toISOString(),
      sourceAllocation: { nonReferral: "70", referral: "30", gross: "100" },
      remainingCountedHours: "0",
      remainingCountedMilliseconds: "0",
      finalizedAt: final ? "2026-10-17T09:00:00.000Z" : null,
      transactionId: state === "COMPLETED" ? transactionId : null,
      release: released
        ? {
            gross: "100",
            chargedFee: "0",
            releasedAt: "2026-10-17T09:00:00.000Z",
            sourceAllocation: {
              nonReferral: "70",
              referral: "30",
              gross: "100",
            },
          }
        : null,
      settlement:
        state === "COMPLETED"
          ? {
              withdrawalId: original.id,
              attemptId: original.quoteId,
              network: original.network,
              tokenContract: original.recipient,
              source: original.recipient,
              recipient: original.recipient,
              addressVersion: original.addressVersion,
              gross: "100",
              feeBps: 2100,
              fee: "21",
              net: "79",
              sourceAllocation: {
                nonReferral: "70",
                referral: "30",
                gross: "100",
              },
              transactionId,
              blockId: "b".repeat(64),
              blockNumber: "123",
            }
          : null,
    });
    if (state === "SCHEDULED") await page.goto("/employee/withdraw");
    else {
      await page.getByRole("button", { name: "تحديث حالة السحب" }).click();
      await page.getByRole("button", { name: "تحديث سجل السحب" }).click();
    }
    const history = page.getByRole("region", { name: "سجل طلبات السحب" });
    await expect(history.getByRole("article")).toHaveCount(25);
    await expect(history.getByRole("article").first()).toContainText(
      stateLabels[state],
    );
    const detail = history.getByRole("article").first().locator("details");
    if (!(await detail.evaluate((element) => element.hasAttribute("open"))))
      await history.getByText("تفاصيل الطلب", { exact: true }).first().click();
    await expect(history.getByRole("article").first()).toContainText(
      original.recipient,
    );
    await expect(history.getByRole("article").first()).toContainText("30.00");
    if (!final) {
      await expect(
        page.getByRole("region", { name: "طلب السحب النشط" }),
      ).toContainText("يبقى المبلغ محجوزاً");
      await expect(
        page.getByRole("button", { name: "متابعة تأكيد طلب السحب" }),
      ).toHaveCount(0);
    } else {
      await expect(
        page.getByRole("region", { name: "طلب السحب النشط" }),
      ).toHaveCount(0);
      await expect(history.getByRole("article").first()).toContainText(
        released ? "رسوم محصلة: 0 USDT" : "تم تأكيد دفع الصافي وتسوية الرسوم",
      );
    }
    await history.getByRole("button", { name: "التالي" }).click();
    await expect(history).toContainText("الصفحة 2 من 2 — 26 طلب");
    await expect(history.getByRole("article")).toHaveCount(1);
    await history.getByRole("button", { name: "السابق" }).click();
    await expect(history.getByRole("article")).toHaveCount(25);
  }
  rangeShrank = true;
  const history = page.getByRole("region", { name: "سجل طلبات السحب" });
  await history.getByRole("button", { name: "التالي" }).click();
  // A settled shrink clamps the same list scope back to its last valid page.
  await expect(history.getByRole("article")).toHaveCount(1);
  await expect(history).toContainText("الصفحة 1 من 1 — 1 طلب");
  // The routed states above never change persisted money, attempts, or payout evidence.
  expect(await p09State(scenario)).toEqual(before);
  expect(failures).toEqual([]);
});
