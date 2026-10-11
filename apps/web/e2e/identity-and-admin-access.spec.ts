import { mkdir } from "node:fs/promises";
import type { Page, APIRequestContext, Request } from "@playwright/test";
import {
  employeeRestrictionsDataSchema,
  adminDataSchema,
  identitySessionDataSchema,
  successEnvelopeSchema,
} from "@template/contracts";
import { test, expect } from "./support/fixtures";
import {
  confirmManagement,
  managementActor,
  managementSignIn,
  reviewInvitation,
} from "./support/admin-management";

const password = "P03 test password only!";
const apiUrl = "http://127.0.0.1:4103/api/v1";
const browserErrors = new WeakMap<Page, { unexpected: boolean }>();
const observeBrowserErrors = (page: Page) => {
  const observation = { unexpected: false };
  browserErrors.set(page, observation);
  page.on("pageerror", () => {
    observation.unexpected = true;
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const expectedBoundaryFailure =
      /Failed to load resource:.*status of (?:400|401|403|409|429|503)/u.test(
        message.text(),
      );
    // The frozen UI has no favicon; Chromium requests it on direct entry.
    const missingFavicon =
      message.location().url === "http://127.0.0.1:3103/favicon.ico" &&
      /Failed to load resource:.*status of 404/u.test(message.text());
    const absentBoundedRoute =
      ["/admin/auth/unknown", "/admin/auth/accept-invitation"].some(
        (path) => message.location().url === `http://127.0.0.1:3103${path}`,
      ) && /Failed to load resource:.*status of 404/u.test(message.text());
    if (!expectedBoundaryFailure && !missingFavicon && !absentBoundedRoute)
      observation.unexpected = true;
  });
};
test.beforeEach(({ page }) => {
  observeBrowserErrors(page);
});
test.afterEach(({ page }) => {
  expect(browserErrors.get(page)?.unexpected).toBe(false);
});
const signIn = async (
  page: Page,
  email = "employee@p03.test",
  enteredPassword = password,
) => {
  await page.getByLabel("البريد الإلكتروني للعمل").fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(enteredPassword);
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
};
const privateNavigation = (page: Page) =>
  page.getByRole("navigation", { name: "التنقل الرئيسي للتطبيق" });

test("US6-04 concurrent target change preserves draft self pending targets deny and issuer loss retires actor and link", async ({
  page,
  request,
  browser,
  scenario,
}) => {
  const actor = await managementActor(request);
  await managementSignIn(page, "admin2@p03.test");
  await page.goto("/admin/settings/admins");
  const self = page.getByRole("row").filter({ hasText: "admin2@p03.test" });
  await expect(
    self.getByRole("button", { name: "تعطيل", exact: true }),
  ).toBeDisabled();
  const pending = page
    .getByRole("row")
    .filter({ hasText: "pending-admin@p03.test" });
  await expect(
    pending.getByRole("button", { name: "تفعيل", exact: true }),
  ).toBeDisabled();
  for (const email of ["admin@p03.test", "pending-admin@p03.test"]) {
    const state = await scenario.command({ command: "state", email });
    if (state === null || !("user" in state) || state.user === null)
      throw new Error("P03_IDENTITY_MISSING");
    const denial = await request.patch(
      `${apiUrl}/admin/admins/${state.user.id}/status`,
      {
        headers: actor.headers,
        data: {
          status: email === "admin@p03.test" ? "DEACTIVATED" : "ACTIVE",
          expectedVersion: 0,
          confirmed: true,
          reason: "P03 denied target",
        },
      },
    );
    expect(denial.status()).toBe(409);
  }
  const targetState = await scenario.command({
    command: "state",
    email: "inactive-admin@p03.test",
  });
  if (
    targetState === null ||
    !("user" in targetState) ||
    targetState.user === null
  )
    throw new Error("P03_IDENTITY_MISSING");
  const row = page
    .getByRole("row")
    .filter({ hasText: "inactive-admin@p03.test" });
  await row.getByRole("button", { name: "تفعيل", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "تأكيد التفعيل" }),
  ).toBeEnabled();
  const changed = await request.patch(
    `${apiUrl}/admin/admins/${targetState.user.id}/status`,
    {
      headers: actor.headers,
      data: {
        status: "ACTIVE",
        expectedVersion: 0,
        confirmed: true,
        reason: "P03 concurrent winner",
      },
    },
  );
  expect(changed.status()).toBe(200);
  await confirmManagement(page, "تأكيد التفعيل", "P03 retained draft");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "تغير السجل أو تعذر تنفيذ الإجراء",
  );
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue(
    "P03 retained draft",
  );
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();
  const email = "issuer-denied@p03.test";
  await reviewInvitation(page, email);
  await confirmManagement(page, "تأكيد إرسال الدعوة");
  await expect(
    page.getByText("تم تسجيل الدعوة. لا يصبح المستلم مسؤولاً حتى يقبلها."),
  ).toBeVisible();
  const link = await scenario.command({ command: "mail", email });
  if (link === null || !("url" in link) || link.url === null)
    throw new Error("P03_MAIL_MISSING");
  await row.getByRole("button", { name: "تعطيل", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "تأكيد التعطيل" }),
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
  const revoked = await request.patch(
    `${apiUrl}/admin/admins/${actorState.user.id}/status`,
    {
      headers: actor.headers,
      data: {
        status: "DEACTIVATED",
        expectedVersion: 0,
        confirmed: true,
        reason: "P03 revoke current actor",
      },
    },
  );
  expect(revoked.status()).toBe(200);
  await confirmManagement(page, "تأكيد التعطيل");
  await expect(page).toHaveURL(/\/admin\/auth\/login/u);
  await expect(page.getByRole("banner")).toHaveCount(0);
  expect(
    await scenario.command({
      command: "state",
      email: "inactive-admin@p03.test",
    }),
  ).toMatchObject({ user: { status: "ACTIVE" } });
  const context = await browser.newContext();
  try {
    const recipient = await context.newPage();
    await recipient.goto(link.url);
    await expect(
      recipient.getByText("رابط الدعوة غير صالح أو منتهي"),
    ).toBeVisible();
  } finally {
    await context.close();
  }
  expect(await scenario.command({ command: "state", email })).toMatchObject({
    user: null,
  });
});

test("US4-10 late actual A identity cannot overwrite B after a coordinated account switch", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrive!: () => void;
  const arrival = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  await page.route(`${apiUrl}/users/me`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    arrive();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.goto("/admin/auth/login");
    await signIn(page, "admin@p03.test");
    await arrival;
    const second = await page.context().newPage();
    observeBrowserErrors(second);
    await second.goto("/admin/auth/login");
    await signIn(second, "admin2@p03.test");
    await expect(second.getByRole("banner")).toBeVisible();
    const identity = await second
      .getByRole("banner")
      .locator("span[title]")
      .textContent();
    release();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(second.getByRole("banner").locator("span[title]")).toHaveText(
      identity ?? "",
    );
    await page.unroute(`${apiUrl}/users/me`);
    await page.goto("/admin");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("banner").locator("span[title]")).toHaveText(
      identity ?? "",
    );
  } finally {
    release();
    await page.unroute(`${apiUrl}/users/me`);
  }
});

test("US4-11 a UI deadline cannot release a live cookie owner; terminal settlement alone releases ordering", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${apiUrl}/auth/admin/login`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.goto("/admin/auth/login");
    await signIn(page, "admin@p03.test");
    await expect(page.locator("p[role=alert]")).toContainText("لا تكرره", {
      timeout: 35_000,
    });
    expect(
      await page.evaluate(() => localStorage.getItem("oscar.cookie-write.v1")),
    ).not.toBeNull();
    await expect(
      page.getByRole("button", { name: "تسجيل الدخول", exact: true }),
    ).toBeDisabled();
    release();
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("oscar.cookie-write.v1")),
      )
      .toBeNull();
  } finally {
    release();
    await page.unroute(`${apiUrl}/auth/admin/login`);
  }
});

test("US4-08 committed employee change retains wrong-current correction then invalidates every prior device", async ({
  page,
  browser,
  scenario,
}) => {
  const device = await browser.newContext();
  try {
    expect(
      (
        await device.request.post(`${apiUrl}/auth/login`, {
          data: { email: "employee@p03.test", password, rememberMe: false },
        })
      ).status(),
    ).toBe(200);
    await page.goto("/employee/auth/login");
    await signIn(page);
    await expect(page).toHaveURL("/employee");
    await page.goto("/employee/account");
    await page.getByRole("button", { name: /تغيير كلمة المرور/u }).click();
    await page.getByLabel("كلمة المرور الحالية").fill("wrong-current");
    await page
      .getByLabel("كلمة المرور الجديدة (15 - 128 حرفاً)")
      .fill("US4 changed password!");
    await page
      .getByLabel("تأكيد كلمة المرور الجديدة")
      .fill("US4 changed password!");
    await page.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("كلمة المرور الحالية")).toHaveValue(
      "wrong-current",
    );
    await page.getByLabel("كلمة المرور الحالية").fill(password);
    await page.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }).click();
    await expect(page).toHaveURL(/\/employee\/auth\/login/u);
    expect(
      await scenario.command({ command: "state", email: "employee@p03.test" }),
    ).toMatchObject({ user: { sessions: 0 } });
    const remote = await device.newPage();
    await remote.goto("http://127.0.0.1:3103/employee");
    await expect(privateNavigation(remote)).toHaveCount(0);
    await signIn(page, "employee@p03.test", "US4 changed password!");
    await expect(page).toHaveURL("/employee/account");
    await expect(privateNavigation(page)).toBeVisible();
    await page.goBack();
    await page.reload();
    await expect(page.getByLabel("كلمة المرور الحالية")).toHaveCount(0);
  } finally {
    await device.close();
  }
});

test("US4-09 account-wide server revocation denies restoration on all independent devices", async ({
  page,
  browser,
  scenario,
}) => {
  const device = await browser.newContext();
  try {
    await page.goto("/admin/auth/login");
    await signIn(page, "admin@p03.test");
    await expect(page.getByRole("banner")).toBeVisible();
    const remote = await device.newPage();
    await remote.goto("http://127.0.0.1:3103/admin/auth/login");
    await signIn(remote, "admin@p03.test");
    await expect(remote.getByRole("banner")).toBeVisible();
    const result = await device.request.post(`${apiUrl}/auth/admin/login`, {
      data: { email: "admin@p03.test", password, rememberMe: false },
    });
    const session = identitySessionDataSchema.parse(
      successEnvelopeSchema.parse(await result.json()).data,
    );
    const csrf = (await device.cookies()).find(
      (cookie) => cookie.name === "csrfToken",
    );
    if (csrf === undefined) throw new Error("P03_CSRF_MISSING");
    expect(
      (
        await device.request.post(`${apiUrl}/auth/logout-all`, {
          headers: {
            Authorization: `Bearer ${session.tokens.accessToken}`,
            "x-csrf-token": csrf.value,
          },
          data: {},
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await remote.reload();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(remote.getByRole("banner")).toHaveCount(0);
    expect(
      await scenario.command({ command: "state", email: "admin@p03.test" }),
    ).toMatchObject({ user: { sessions: 0 } });
  } finally {
    await device.close();
  }
});

test("US4-04 ordinary logout isolates devices and same-origin tabs retire immediately", async ({
  page,
  browser,
  scenario,
}) => {
  const device = await browser.newContext();
  try {
    const remote = await device.newPage();
    observeBrowserErrors(remote);
    await page.goto("/admin/auth/login");
    await signIn(page, "admin@p03.test");
    await expect(page.getByRole("banner")).toBeVisible();
    await remote.goto("http://127.0.0.1:3103/admin/auth/login");
    await signIn(remote, "admin@p03.test");
    await expect(remote.getByRole("banner")).toBeVisible();
    const tab = await page.context().newPage();
    observeBrowserErrors(tab);
    await tab.goto("/admin");
    await expect(tab.getByRole("banner")).toBeVisible();
    await tab
      .getByRole("button", { name: "تسجيل الخروج", exact: true })
      .click();
    await expect(tab).toHaveURL(/\/admin\/auth\/login/u);
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(tab.getByRole("banner")).toHaveCount(0);
    await tab.reload();
    await expect(tab.getByRole("banner")).toHaveCount(0);
    await remote.reload();
    await expect(remote.getByRole("banner")).toBeVisible();
    expect(
      await scenario.command({ command: "state", email: "admin@p03.test" }),
    ).toMatchObject({ user: { sessions: 1 } });
    expect(browserErrors.get(remote)?.unexpected).toBe(false);
    expect(browserErrors.get(tab)?.unexpected).toBe(false);
  } finally {
    await device.close();
  }
});

for (const operation of [
  "login",
  "refresh",
  "logout",
  "change-password",
  "reset-password",
]) {
  test(`US4-05 ${operation} lost holder keeps persistent barrier despite close reload and lock reacquisition`, async ({
    page,
    browser,
    scenario,
  }) => {
    const cookiePath = operation === "login" ? "admin/login" : operation;
    const cookieRoute = `${apiUrl}/auth/${cookiePath}${operation === "reset-password" ? "*" : ""}`;
    if (
      operation !== "login" &&
      operation !== "refresh" &&
      operation !== "reset-password"
    ) {
      await page.goto(
        operation === "change-password"
          ? "/employee/auth/login"
          : "/admin/auth/login",
      );
      await signIn(
        page,
        operation === "change-password"
          ? "employee@p03.test"
          : "admin@p03.test",
      );
      await expect(page).toHaveURL(
        operation === "change-password" ? "/employee" : "/admin",
      );
    }
    if (operation === "refresh") {
      expect(
        (
          await page.context().request.post(`${apiUrl}/auth/login`, {
            data: { email: "admin@p03.test", password, rememberMe: false },
          })
        ).status(),
      ).toBe(200);
    }
    if (operation === "reset-password") {
      expect(
        (
          await page.context().request.post(`${apiUrl}/auth/forgot-password`, {
            data: { email: "employee@p03.test" },
          })
        ).status(),
      ).toBe(200);
      const mail = await scenario.command({
        command: "mail",
        email: "employee@p03.test",
      });
      if (mail === null || !("url" in mail) || mail.url === null)
        throw new Error("P03_MAIL_MISSING");
      await page.goto(mail.url);
      await expect(
        page.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
      ).toBeEnabled();
      await page
        .getByLabel(/^كلمة المرور الجديدة/u)
        .fill("US4 changed password!");
      await page
        .getByLabel("تأكيد كلمة المرور", { exact: true })
        .fill("US4 changed password!");
    }
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let arrived!: () => void;
    const arrival = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    let writes = 0;
    await page.context().route(cookieRoute, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.continue();
        return;
      }
      writes++;
      const response = await route.fetch();
      arrived();
      await gate;
      try {
        await route.fulfill({ response });
      } catch {
        /* The original page was deliberately destroyed. */
      }
    });
    try {
      if (operation === "login") {
        await page.goto("/admin/auth/login");
        await signIn(page, "admin@p03.test");
      } else if (operation === "refresh") {
        await page.goto("/admin", { waitUntil: "domcontentloaded" });
      } else if (operation === "logout") {
        await page
          .getByRole("button", { name: "تسجيل الخروج", exact: true })
          .click();
      } else if (operation === "reset-password") {
        await page
          .getByRole("button", { name: "حفظ كلمة المرور الجديدة" })
          .click();
      } else {
        await page.goto("/employee/account");
        await page.getByRole("button", { name: /تغيير كلمة المرور/u }).click();
        await page.getByLabel("كلمة المرور الحالية").fill(password);
        await page
          .getByLabel("كلمة المرور الجديدة (15 - 128 حرفاً)")
          .fill("US4 changed password!");
        await page
          .getByLabel("تأكيد كلمة المرور الجديدة")
          .fill("US4 changed password!");
        await page
          .getByRole("button", { name: "حفظ كلمة المرور الجديدة" })
          .click();
      }
      await arrival;
      const barrier = await page.evaluate(() =>
        localStorage.getItem("oscar.cookie-write.v1"),
      );
      expect(barrier).not.toBeNull();
      expect(JSON.parse(barrier ?? "null") as unknown).toMatchObject({
        version: 1,
        state: "pending",
      });
      expect(barrier).not.toContain(password);
      if (operation === "login" || operation === "logout") await page.close();
      else await page.reload();
      const survivor = await page.context().newPage();
      observeBrowserErrors(survivor);
      let privateReads = 0;
      survivor.on("request", (request) => {
        if (
          request.url().includes("/users/me") ||
          request.url().includes("/auth/refresh")
        )
          privateReads++;
      });
      await survivor.goto("/admin");
      await expect(survivor.getByRole("banner")).toHaveCount(0);
      await survivor.reload();
      await expect(survivor.getByText(/ملف متصفح منفصلاً/u)).toBeVisible();
      expect(privateReads).toBe(0);
      expect(
        await survivor.evaluate(() =>
          localStorage.getItem("oscar.cookie-write.v1"),
        ),
      ).toBe(barrier);
      await survivor.evaluate(() =>
        navigator.locks.request("oscar.cookie-write", () => undefined),
      );
      await survivor.goto("/admin/auth/login");
      await signIn(survivor, "admin2@p03.test");
      await expect(survivor.locator("p[role=alert]")).toContainText(
        "ملف متصفح منفصلاً",
      );
      expect(writes).toBe(1);
      expect(
        await survivor.evaluate(() =>
          localStorage.getItem("oscar.cookie-write.v1"),
        ),
      ).toBe(barrier);
      const isolated = await browser.newContext();
      try {
        const fresh = await isolated.newPage();
        await fresh.goto("http://127.0.0.1:3103/admin/auth/login");
        await signIn(fresh, "admin2@p03.test");
        await expect(fresh.getByRole("banner")).toBeVisible();
      } finally {
        await isolated.close();
      }
    } finally {
      release();
      await page.context().unroute(cookieRoute);
    }
  });
}

for (const kind of ["malformed", "unsupported"]) {
  test(`US4-06 ${kind} coordination blocks protected reads and cookie dispatch`, async ({
    page,
  }) => {
    await page.context().addInitScript((state) => {
      if (state === "malformed")
        localStorage.setItem("oscar.cookie-write.v1", "invalid");
      else Object.defineProperty(navigator, "locks", { value: undefined });
    }, kind);
    let requests = 0;
    const observe = (request: Request) => {
      if (
        request.url().includes("/users/me") ||
        request.url().includes("/auth/refresh") ||
        request.url().includes("/auth/admin/login")
      )
        requests++;
    };
    page.on("request", observe);
    await page.goto("/admin");
    await expect(page.getByRole("banner")).toHaveCount(0);
    await page.goto("/admin/auth/login");
    await signIn(page, "admin@p03.test");
    await expect(page.locator("p[role=alert]")).toContainText(
      "ملف متصفح منفصلاً",
    );
    expect(requests).toBe(0);
    page.off("request", observe);
  });
}
const adminControls = async (request: APIRequestContext, userId: string) => {
  const login = await request.post(`${apiUrl}/auth/admin/login`, {
    data: { email: "admin@p03.test", password, rememberMe: false },
  });
  expect(login.status()).toBe(200);
  const session = identitySessionDataSchema.parse(
    successEnvelopeSchema.parse(await login.json()).data,
  );
  const csrf = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "csrfToken",
  );
  if (csrf === undefined) throw new Error("P03_CSRF_MISSING");
  const headers = {
    Authorization: `Bearer ${session.tokens.accessToken}`,
    "x-csrf-token": csrf.value,
  };
  return async (controls: {
    status?: "ACTIVE" | "SUSPENDED" | "BANNED";
    tasksBlocked?: boolean;
    withdrawalsBlocked?: boolean;
  }) => {
    const endpoint = `${apiUrl}/admin/employees/${userId}/restrictions`;
    const current = await request.get(endpoint, { headers });
    expect(current.status()).toBe(200);
    const saved = employeeRestrictionsDataSchema.parse(
      successEnvelopeSchema.parse(await current.json()).data,
    );
    const changed = await request.patch(endpoint, {
      headers,
      data: {
        ...controls,
        expectedVersion: saved.employee.accountVersion,
        confirmed: true,
        reason: "P03 isolated access acceptance",
      },
    });
    expect(changed.status()).toBe(200);
  };
};

test("US1-01 persisted employee login direct entry reload and approved phone desktop rendering", async ({
  page,
  scenario,
}) => {
  await page.goto("/employee/account");
  await expect(page).toHaveURL(/\/employee\/auth\/login\?returnTo=/u);
  await expect(privateNavigation(page)).toHaveCount(0);
  await expect(page.getByLabel("البريد الإلكتروني للعمل")).toHaveValue("");
  await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveValue("");
  const output = "../../output/playwright/p03";
  await mkdir(output, { recursive: true });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(await page.locator(".employee-scope").getAttribute("dir")).toBe(
      "rtl",
    );
    await page.screenshot({
      path: `${output}/us1-login-${String(width)}.png`,
      mask: [page.getByLabel("كلمة المرور", { exact: true })],
    });
  }
  await signIn(page);
  await expect(page).toHaveURL("/employee/account");
  await expect(privateNavigation(page)).toBeVisible();
  await page.reload();
  await expect(privateNavigation(page)).toBeVisible();
  const saved = await scenario.command({
    command: "state",
    email: "employee@p03.test",
  });
  expect(saved).toMatchObject({
    user: { role: "USER", status: "ACTIVE", verified: true, sessions: 1 },
  });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(privateNavigation(page)).toBeVisible();
    await page.screenshot({
      path: `${output}/us1-protected-${String(width)}.png`,
    });
  }
});

test("US1-02 invalid pending suspended and banned accounts never receive employee access", async ({
  page,
  scenario,
}) => {
  await page.goto("/employee/auth/login");
  for (const email of [
    "pending@p03.test",
    "suspended@p03.test",
    "banned@p03.test",
    "missing@p03.test",
  ]) {
    await signIn(page, email);
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(privateNavigation(page)).toHaveCount(0);
    await expect(page).toHaveURL("/employee/auth/login");
    expect(await scenario.command({ command: "state", email })).toMatchObject(
      email === "missing@p03.test" ? { user: null } : { user: { sessions: 0 } },
    );
  }
});

test("US1-03 partial restrictions allow sign-in but a later real ban retires access and restoration revives no session", async ({
  page,
  scenario,
  request,
}) => {
  const saved = await scenario.command({
    command: "state",
    email: "employee@p03.test",
  });
  if (saved === null || !("user" in saved) || saved.user === null)
    throw new Error("P03_IDENTITY_MISSING");
  const change = await adminControls(request, saved.user.id);
  await change({ tasksBlocked: true, withdrawalsBlocked: true });
  await page.goto("/employee/auth/login");
  await signIn(page);
  await expect(page).toHaveURL("/employee");
  await expect(privateNavigation(page)).toBeVisible();
  // Revocation must follow the real login, rather than the frozen fixture startup time.
  await scenario.command({
    command: "p04-clock",
    instant: new Date(Date.now() + 1_000).toISOString(),
  });
  await change({ status: "BANNED" });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/employee\/auth\/login/u);
  await expect(privateNavigation(page)).toHaveCount(0);
  await change({ status: "ACTIVE" });
  await page.goto("/employee/account");
  await expect(page).toHaveURL(/\/employee\/auth\/login/u);
  await expect(privateNavigation(page)).toHaveCount(0);
  expect(
    await scenario.command({ command: "state", email: "employee@p03.test" }),
  ).toMatchObject({ user: { sessions: 0 } });
});

test("US1-04 unavailable and malformed current checks block private content and reads until explicit retry", async ({
  page,
}) => {
  await page.goto("/employee/auth/login");
  await signIn(page);
  await expect(privateNavigation(page)).toBeVisible();
  let unauthorizedRead = false;
  let checkingDenied = false;
  page.on("request", (request) => {
    if (
      checkingDenied &&
      request.url().startsWith(apiUrl) &&
      !/\/(?:auth\/refresh|users\/me)$/u.test(request.url())
    )
      unauthorizedRead = true;
  });
  for (const status of [503, 200]) {
    checkingDenied = true;
    unauthorizedRead = false;
    await page.route(`${apiUrl}/users/me`, (route) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body:
          status === 200
            ? '{"success":true,"statusCode":200,"data":{"user":{"role":"USER"}}}'
            : '{"success":false,"statusCode":503,"code":"SERVICE_UNAVAILABLE"}',
      }),
    );
    await page.goto("/employee/account");
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(privateNavigation(page)).toHaveCount(0);
    expect(unauthorizedRead).toBe(false);
    checkingDenied = false;
    await page.unroute(`${apiUrl}/users/me`);
    await page.getByRole("button", { name: "إعادة المحاولة" }).click();
    await expect(privateNavigation(page)).toBeVisible();
    await page.goto("/employee");
    await expect(privateNavigation(page)).toBeVisible();
  }
});

test("US1-05 generic ADMIN sign-in uses checked role and employee preview grants no employee persona", async ({
  page,
}) => {
  await page.goto("/employee/auth/login?returnTo=%2Femployee%2Faccount");
  await signIn(page, "admin@p03.test");
  await expect(page).toHaveURL("/admin");
  await page.goto("/employee/account");
  await expect(page).toHaveURL("/admin");
  await expect(privateNavigation(page)).toHaveCount(0);
});

test("US1-06 encoded credential return target is discarded after real sign-in", async ({
  page,
}) => {
  await page.goto(
    "/employee/auth/login?returnTo=%2Femployee%3F%252574oken%3Dsentinel",
  );
  await signIn(page);
  await expect(page).toHaveURL("/employee");
  await expect(privateNavigation(page)).toBeVisible();
});

test("US1-07 unchanged account limiter produces safe 429 feedback without automatic login retry", async ({
  page,
}) => {
  await page.goto("/employee/auth/login");
  for (let attempt = 0; attempt < 6; attempt++) {
    await signIn(page, "employee@p03.test", "incorrect");
    await expect(page.locator("p[role=alert]")).toBeVisible();
  }
  await expect(page.locator("p[role=alert]")).toContainText("محاولات كثيرة");
  await expect(privateNavigation(page)).toHaveCount(0);
});

test("US1-08 existing generic login retains its pending form and navigates using checked ADMIN authority", async ({
  page,
}) => {
  await page.goto("/auth/login");
  await page.getByLabel("Work email").fill("admin@p03.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL("/admin");
  await expect(privateNavigation(page)).toHaveCount(0);
});

test("US3-01 dedicated entry two identities reload logout and responsive Cairo RTL", async ({
  page,
  browser,
  scenario,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/auth\/login\?returnTo=/u);
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "نسيت كلمة المرور؟" }),
  ).toHaveAttribute("href", "/auth/forgot-password");
  await mkdir("../../output/playwright/p03", { recursive: true });
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".admin-scope")).toHaveAttribute("dir", "rtl");
    expect(
      await page
        .locator("h1")
        .evaluate((element) => getComputedStyle(element).fontFamily),
    ).toContain("Cairo");
    await page.screenshot({
      path: `../../output/playwright/p03/us3-login-${String(width)}.png`,
      mask: [page.getByLabel("كلمة المرور", { exact: true })],
    });
  }
  await page.getByLabel("البريد الإلكتروني للعمل").focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "نسيت كلمة المرور؟" }),
  ).toBeFocused();
  await signIn(page, "admin@p03.test");
  await expect(page).toHaveURL("/admin");
  await expect(
    page.getByRole("banner").getByText("مدير الاختبار", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "تسجيل الخروج" }),
  ).toBeVisible();
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "تسجيل الخروج" }),
    ).toBeVisible();
    await page.screenshot({
      path: `../../output/playwright/p03/us3-dashboard-${String(width)}.png`,
    });
  }
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:3103" });
  const secondAdminName =
    "مديرة الاختبار الثانية ذات اسم عربي طويل للتأكد من ثبات مساحة الهوية";
  try {
    const other = await second.newPage();
    observeBrowserErrors(other);
    await other.goto("/admin/auth/login");
    await signIn(other, "admin2@p03.test");
    await expect(other).toHaveURL("/admin");
    await expect(
      other.getByRole("banner").getByText(secondAdminName, { exact: true }),
    ).toBeVisible();
    await other.reload();
    await expect(
      other.getByRole("banner").getByText(secondAdminName, { exact: true }),
    ).toBeVisible();
    await other.setViewportSize({ width: 640, height: 850 });
    // The sidebar margin transitions across the desktop breakpoint.
    await expect
      .poll(() =>
        other
          .getByRole("banner")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      )
      .toBe(true);
    await expect(
      other.getByRole("banner").getByText(secondAdminName, { exact: true }),
    ).toHaveAttribute("title", secondAdminName);
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL(/\/admin\/auth\/login/u);
    await expect(page.getByRole("banner")).toHaveCount(0);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/auth\/login/u);
    expect(
      await scenario.command({ command: "state", email: "admin@p03.test" }),
    ).toMatchObject({ user: { sessions: 0 } });
    await other.reload();
    await expect(
      other.getByRole("banner").getByText(secondAdminName, { exact: true }),
    ).toBeVisible();
    await other.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(other).toHaveURL(/\/admin\/auth\/login/u);
    expect(
      await scenario.command({ command: "state", email: "admin2@p03.test" }),
    ).toMatchObject({ user: { sessions: 0 } });
    expect(browserErrors.get(other)?.unexpected).toBe(false);
  } finally {
    await second.close();
  }
});

test("US3-02 employee inactive and unverified admin credentials grant no dashboard sessions", async ({
  page,
  scenario,
}) => {
  let privateRead = false;
  page.on("request", (request) => {
    if (
      request.url().startsWith(apiUrl) &&
      !/\/(?:auth\/(?:admin\/login|refresh)|users\/me)$/u.test(request.url())
    )
      privateRead = true;
  });
  await page.goto("/admin/auth/login");
  for (const email of [
    "employee@p03.test",
    "inactive-admin@p03.test",
    "pending-admin@p03.test",
  ]) {
    await signIn(page, email);
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page).toHaveURL("/admin/auth/login");
    expect(await scenario.command({ command: "state", email })).toMatchObject({
      user: { sessions: 0 },
    });
  }
  expect(privateRead).toBe(false);
});

test("US3-03 later deactivation retires admin access and activation revives no old session", async ({
  page,
  request,
  scenario,
}) => {
  const actorLogin = await request.post(`${apiUrl}/auth/admin/login`, {
    data: { email: "admin@p03.test", password, rememberMe: false },
  });
  expect(actorLogin.status()).toBe(200);
  const actor = identitySessionDataSchema.parse(
    successEnvelopeSchema.parse(await actorLogin.json()).data,
  );
  const csrf = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "csrfToken",
  );
  if (csrf === undefined) throw new Error("P03_CSRF_MISSING");
  const headers = {
    Authorization: `Bearer ${actor.tokens.accessToken}`,
    "x-csrf-token": csrf.value,
  };
  const saved = await scenario.command({
    command: "state",
    email: "admin2@p03.test",
  });
  if (saved === null || !("user" in saved) || saved.user === null)
    throw new Error("P03_IDENTITY_MISSING");
  const endpoint = `${apiUrl}/admin/admins/${saved.user.id}`;
  const changeStatus = async (status: "ACTIVE" | "DEACTIVATED") => {
    const current = await request.get(endpoint, { headers });
    expect(current.status()).toBe(200);
    const admin = adminDataSchema.parse(
      successEnvelopeSchema.parse(await current.json()).data,
    ).admin;
    const changed = await request.patch(`${endpoint}/status`, {
      headers,
      data: {
        status,
        expectedVersion: admin.accountVersion,
        confirmed: true,
        reason: "P03 isolated access acceptance",
      },
    });
    expect(changed.status()).toBe(200);
  };
  await page.goto("/admin/auth/login");
  await signIn(page, "admin2@p03.test");
  await expect(page.getByRole("banner")).toBeVisible();
  await changeStatus("DEACTIVATED");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/admin\/auth\/login/u);
  await expect(page.getByRole("banner")).toHaveCount(0);
  await changeStatus("ACTIVE");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/auth\/login/u);
  expect(
    await scenario.command({ command: "state", email: "admin2@p03.test" }),
  ).toMatchObject({ user: { status: "ACTIVE", sessions: 0 } });
});

test("US3-04 exact public entries recovery reachability unknown paths and nonimpersonating preview", async ({
  page,
}) => {
  await page.goto("/admin/auth/login");
  await signIn(page, "admin@p03.test");
  await expect(page.getByRole("banner")).toBeVisible();
  await page
    .getByRole("banner")
    .getByRole("link", { name: /واجهة الموظف/u })
    .click();
  await expect(page).toHaveURL("/admin");
  await expect(privateNavigation(page)).toHaveCount(0);
  await page.goto("/auth/forgot-password");
  await expect(
    page.getByRole("button", { name: "إرسال رابط إعادة التعيين" }),
  ).toBeVisible();
  await expect(page).toHaveURL("/auth/forgot-password");
  await page.goto("/admin/auth/login");
  await expect(
    page.getByRole("heading", { name: "تسجيل الدخول للإدارة" }),
  ).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0);
  await page.getByLabel("البريد الإلكتروني للعمل").fill("admin@p03.test");
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
  await page.goto("/auth/verify-email");
  await expect(page).toHaveURL("/auth/verify-email");
  await expect(page.getByLabel("البريد الإلكتروني للحساب")).toBeVisible();
  await page.goto("/auth/reset-password");
  await expect(page).toHaveURL("/auth/reset-password");
  await expect(page.getByRole("banner")).toHaveCount(0);
  const acceptance = await page.goto("/admin/auth/accept-invitation");
  expect(acceptance?.status()).toBe(200);
  await expect(page.getByText("رابط الدعوة غير صالح أو منتهي")).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByRole("banner")).toBeVisible();
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL(/\/admin\/auth\/login/u);
  const unknown = await page.goto("/admin/auth/unknown");
  expect(unknown?.status()).toBe(404);
  await expect(page.getByRole("banner")).toHaveCount(0);
});
