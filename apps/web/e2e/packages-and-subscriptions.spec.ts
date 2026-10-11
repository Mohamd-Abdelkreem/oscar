import { mkdir } from "node:fs/promises";
import { test, expect } from "./support/fixtures";
import {
  employeeSignIn,
  reviewPurchase,
  confirmPurchase,
  financeState,
  reviewConfiguration,
  editFutureTerms,
} from "./support/p04-finance";
import { managementSignIn } from "./support/admin-management";
import {
  purchaseCommandResultSchema,
  purchaseQuoteSchema,
  membershipSchema,
  successEnvelopeSchema,
  type PurchaseResult,
} from "@template/contracts";

test.use({ actionTimeout: 15000, navigationTimeout: 20000 });
test("P04 review accepts fresh remote reward and fee terms while the catalog remains older", async ({
  page,
  request,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await employeeSignIn(page);
  await page.goto("/employee/packages");
  const card = page.locator("#upgrade-btn-S1").locator("../..");
  await expect(card).toContainText("21%");
  await expect(card).toContainText("2.00 USDT");
  await editFutureTerms(request, "60", {
    dailyReward: "3.000001",
    withdrawalFeeBps: 1000,
  });
  await expect(card).toContainText("21%");
  await expect(card).toContainText("2.00 USDT");
  const before = await financeState(scenario);
  const recipients = Array.from(
    { length: 5 },
    (_, level) => `ancestor-${String(level)}@p04.test`,
  );
  const recipientStates = await Promise.all(
    recipients.map((email) => financeState(scenario, email)),
  );
  expect(
    recipientStates.map((state) => state.wallet.availableReferral),
  ).toEqual(["14.4", "13.2", "10.8", "7.2", "0"]);
  let sends = 0;
  page.on("request", (sent) => {
    if (
      sent.url().endsWith("/subscriptions/purchases") &&
      sent.method() === "POST"
    )
      sends++;
  });
  const quoteResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/purchase-quotes") &&
      response.request().method() === "POST",
  );
  await reviewPurchase(page);
  const acceptedQuote = purchaseQuoteSchema.parse(
    successEnvelopeSchema.parse(await (await quoteResponse).json()).data,
  );
  expect(acceptedQuote.terms.dailyReward).toBe("3.000001");
  expect(acceptedQuote.terms.withdrawalFeeBps).toBe(1000);
  const review = page.getByRole("dialog");
  await expect(review).toContainText("مكافأة المهمة المعتمدة: 3.000001");
  await expect(review).toContainText("رسوم السحب: 10%");
  await expect(review).not.toContainText("21%");
  await expect(review).toContainText("Asia/Baghdad");
  await expect(review).toContainText("1, 2, 3, 4, 5");
  await expect(review).toContainText("18:00");
  await expect(review).toContainText(acceptedQuote.preview.firstWorkDate);
  await expect(review).toContainText(acceptedQuote.preview.finalWorkDate);
  expect(sends).toBe(0);
  await page.setViewportSize({ width: 320, height: 850 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await review.evaluate((element) => getComputedStyle(element).direction),
  ).toBe("rtl");
  expect(
    await review.evaluate((element) => getComputedStyle(element).fontFamily),
  ).toContain("Cairo");
  await page.keyboard.press("Tab");
  expect(
    await review.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await mkdir("../../output/playwright/p03", { recursive: true });
  await review.screenshot({
    path: "../../output/playwright/p03/p04-quote-terms-320.png",
  });
  const purchaseResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/subscriptions/purchases") &&
      response.request().method() === "POST",
  );
  await confirmPurchase(page);
  const committed = purchaseCommandResultSchema.parse(
    successEnvelopeSchema.parse(await (await purchaseResponse).json()).data,
  );
  expect(committed.replayed).toBe(false);
  expect(committed.purchase.subscriptionAtPurchase.terms).toEqual(
    acceptedQuote.terms,
  );
  expect(committed.purchase.fullDebit).toBe("60");
  await expect(review).toContainText("تم تفعيل المنصب وتسجيل الشراء");
  const membershipResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/subscriptions/me") && response.status() === 200,
  );
  await page.reload();
  const saved = page.getByLabel("شروط الاشتراك المحفوظة");
  await expect(saved).toContainText("3.000001");
  await expect(saved).toContainText("10%");
  const current = membershipSchema.parse(
    successEnvelopeSchema.parse(await (await membershipResponse).json()).data,
  );
  expect(current.subscription?.terms).toEqual(acceptedQuote.terms);
  expect(current.subscription?.purchaseId).toBe(committed.purchase.purchaseId);
  const after = await financeState(scenario);
  expect(after.purchases).toBe(before.purchases + 1);
  expect(after.subscriptions).toBe(before.subscriptions + 1);
  expect(after.operations).toBe(before.operations + 1);
  expect(after.postings).toBe(before.postings + 1);
  expect(after.wallet).toEqual({
    ...before.wallet,
    availableReferral: "140",
    total: "1140",
  });
  const referralBalances = ["15.6", "14.4", "13.2", "10.8", "7.2"];
  for (const [index, email] of recipients.entries()) {
    const previous = recipientStates[index];
    if (!previous) throw new Error("P04_MISSING_RECIPIENT_STATE");
    const recipient = await financeState(scenario, email);
    expect(recipient.awards).toBe(previous.awards + 1);
    expect(recipient.operations).toBe(previous.operations + 1);
    expect(recipient.postings).toBe(previous.postings + 1);
    expect(recipient.purchases).toBe(previous.purchases);
    expect(recipient.wallet.availableReferral).toBe(referralBalances[index]);
    expect(recipient.wallet.availableNonReferral).toBe(
      previous.wallet.availableNonReferral,
    );
    expect(recipient.wallet.reservedReferral).toBe(
      previous.wallet.reservedReferral,
    );
    expect(recipient.wallet.reservedNonReferral).toBe(
      previous.wallet.reservedNonReferral,
    );
  }
  expect(sends).toBe(1);
});
test("P04 catalog edits and reload preserve accepted terms on the current card and account", async ({
  page,
  request,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await employeeSignIn(page);
  await reviewPurchase(page);
  const review = page.getByRole("dialog");
  await expect(review).toContainText("قبل تكلفة الباقة ورسوم السحب");
  await confirmPurchase(page);
  await expect(review).toContainText("تم تفعيل المنصب وتسجيل الشراء");
  await editFutureTerms(request, "61.000001", {
    dailyReward: "3.000001",
    countedWorkDates: 3,
    withdrawalFeeBps: 1000,
  });
  await page.reload();
  const accepted = page.getByLabel("شروط الاشتراك المحفوظة");
  await expect(accepted).toContainText("60.00");
  await expect(accepted).toContainText("2.00");
  await expect(accepted).toContainText("أيام العمل المحتسبة: 2");
  await expect(accepted).toContainText("21%");
  await expect(accepted).toContainText("Asia/Baghdad");
  await expect(accepted).toContainText("18:00");
  await expect(accepted).toContainText("أول يوم عمل:");
  await expect(accepted).toContainText("آخر يوم عمل:");
  await expect(accepted).toContainText(
    (await financeState(scenario)).expiresAt ?? "MISSING",
  );
  await expect(accepted).not.toContainText("61.000001");
  await expect(page.getByText("61.000001", { exact: true })).toBeVisible();
  const savedText = await accepted.innerText();
  await page.goto("/employee/account");
  await expect(page.getByLabel("شروط الاشتراك المحفوظة")).toHaveText(
    savedText,
    { useInnerText: true },
  );
  await managementSignIn(page);
  await page.goto("/admin/packages");
  await expect(
    page.getByRole("columnheader", {
      name: "الإجمالي المشروط بالمهام المعتمدة قبل تكلفة الباقة ورسوم السحب",
    }),
  ).toBeVisible();
  await expect(page.locator("tbody tr").first()).toContainText("61.000001");
  await expect(page.locator("tbody tr").first()).toContainText("9.000003");
});
test("P04 pending purchase survives dismissal and blocks a peer until the original settles", async ({
  page,
  context,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await employeeSignIn(page);
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let sends = 0;
  await page.route("**/subscriptions/purchases", async (route) => {
    sends++;
    await route.fetch();
    await held;
    await route.abort("failed");
  });
  await reviewPurchase(page);
  const dispatched = page.waitForRequest(
    (request) =>
      request.url().endsWith("/subscriptions/purchases") &&
      request.method() === "POST",
  );
  await confirmPurchase(page);
  await dispatched;
  const peer = await context.newPage();
  try {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "إغلاق", exact: true })
      .click();
    await expect(page.locator("#upgrade-btn-S1")).toBeDisabled();
    await peer.goto("/employee/packages");
    await expect(peer.locator("#upgrade-btn-S2")).toBeDisabled();
    await expect
      .poll(async () => (await financeState(scenario)).purchases)
      .toBe(1);
    expect(sends).toBe(1);
  } finally {
    release?.();
  }
  await expect
    .poll(async () => (await financeState(scenario)).purchases)
    .toBe(1);
  await peer.bringToFront();
  await peer
    .getByRole("button", { name: "التحقق من نتيجة العملية", exact: true })
    .click();
  await expect(peer.locator("#upgrade-btn-S2")).toBeEnabled();
  expect(sends).toBe(1);
  await peer.close();
});

test("P04 uncertain purchase does not migrate to a different signed-in account", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await employeeSignIn(page);
  let sends = 0;
  await page.route("**/subscriptions/purchases", async (route) => {
    sends++;
    await route.abort("failed");
  });
  await reviewPurchase(page);
  await confirmPurchase(page);
  await expect(page.getByRole("dialog")).toContainText(
    "لم تتأكد نتيجة العملية",
  );
  await page.goto("/employee/account");
  await page
    .getByRole("button", { name: "تسجيل الخروج من الحساب", exact: true })
    .click();
  await expect(page).toHaveURL(/\/employee\/auth\/login/u);
  await employeeSignIn(page, "other@p04.test");
  await page.goto("/employee/packages");
  await expect(page.locator("#upgrade-btn-S1")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "التحقق من نتيجة العملية", exact: true }),
  ).toHaveCount(0);
  expect(sends).toBe(1);
  expect((await financeState(scenario)).purchases).toBe(0);
  expect((await financeState(scenario, "other@p04.test")).purchases).toBe(0);
});
test("P04 superseded original edit releases uncertainty before a fresh current-version review", async ({
  page,
  request,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await managementSignIn(page);
  let attempts = 0;
  await page.route("**/admin/packages/S1", async (route) => {
    attempts++;
    if (attempts === 1) await route.abort("failed");
    else await route.continue();
  });
  await reviewConfiguration(page, "61");
  await page
    .getByRole("button", { name: "تأكيد حفظ الشروط المراجعة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("لم تتأكد نتيجة الحفظ");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "إلغاء", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await editFutureTerms(request, "62");
  await page
    .getByRole("button", { name: "التحقق من الحفظ", exact: true })
    .click();
  await expect(
    page.getByText("لم تُرصد العملية بعد. تظل غير محسومة."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "مراجعة إعادة المحاولة الأصلية", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تأكيد حفظ الشروط المراجعة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "تجاوزت نسخة أحدث العملية الأصلية",
  );
  expect((await financeState(scenario)).configurationChanges).toBe(6);
  await page.keyboard.press("Escape");
  await reviewConfiguration(page, "63");
  await expect(page.getByRole("dialog")).toContainText("النسخة المراجعة: 3");
  await page
    .getByRole("button", { name: "تأكيد حفظ الشروط المراجعة", exact: true })
    .click();
  await expect
    .poll(async () => (await financeState(scenario)).configurationChanges)
    .toBe(7);
});

test("P04 lost configuration acknowledgement followed by newer terms reconciles saved command after reload", async ({
  page,
  request,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await managementSignIn(page);
  await page.route("**/admin/packages/S1", async (route) => {
    await route.fetch();
    await route.abort("failed");
  });
  await reviewConfiguration(page, "61");
  await page
    .getByRole("button", { name: "تأكيد حفظ الشروط المراجعة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("لم تتأكد نتيجة الحفظ");
  await editFutureTerms(request, "62");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "التحقق من الحفظ", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", {
      name: "مراجعة إعادة المحاولة الأصلية",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "التحقق من الحفظ", exact: true })
    .click();
  await expect(
    page.getByText("تم التحقق من الحفظ. أُعيد تحميل الشروط الحالية."),
  ).toBeVisible();
  expect((await financeState(scenario)).configurationChanges).toBe(7);
  await expect(page.locator("tbody tr").first()).toContainText("62.00");
});

for (const fault of ["storage", "readback", "locks"] as const) {
  test(`P04 ${fault} failure prevents purchase dispatch`, async ({
    page,
    scenario,
  }) => {
    await scenario.command({ command: "p04-fixtures", profile: "purchase" });
    if (fault !== "locks")
      await page.addInitScript((failure) => {
        {
          const localSet = localStorage.setItem.bind(localStorage);
          const sessionSet = sessionStorage.setItem.bind(sessionStorage);
          Storage.prototype.setItem = function (key, value) {
            if (key.startsWith("oscar.purchase.v1.")) {
              if (failure === "storage")
                throw new Error("TEST_STORAGE_FAILURE");
              return;
            }
            if (this === localStorage) localSet(key, value);
            else sessionSet(key, value);
          };
        }
      }, fault);
    await employeeSignIn(page);
    let sends = 0;
    page.on("request", (request) => {
      if (
        request.url().endsWith("/subscriptions/purchases") &&
        request.method() === "POST"
      )
        sends++;
    });
    await reviewPurchase(page);
    if (fault === "locks") {
      const actor = (await financeState(scenario)).employeeId;
      await page.evaluate(
        (id) =>
          new Promise<void>((acquired) => {
            void navigator.locks.request(
              `oscar.purchase.v1.${id}`,
              async () => {
                acquired();
                await new Promise<void>(() => {});
              },
            );
          }),
        actor,
      );
    }
    await confirmPurchase(page);
    await expect(page.getByRole("dialog")).toContainText(
      "تعذر تنسيق الشراء بأمان",
    );
    expect((await financeState(scenario)).purchases).toBe(0);
    expect(sends).toBe(0);
  });
}

test("P04 offline confirmation cannot queue a purchase for reconnect", async ({
  page,
  context,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await employeeSignIn(page);
  await reviewPurchase(page);
  let sends = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/subscriptions/purchases") &&
      request.method() === "POST"
    )
      sends++;
  });
  await context.setOffline(true);
  await confirmPurchase(page);
  await expect(page.getByRole("dialog")).toContainText(
    "لم يُرسل طلب شراء جديد",
  );
  await context.setOffline(false);
  await page.goto("/employee/packages");
  await expect(page.locator("#upgrade-btn-S1")).toBeEnabled();
  expect((await financeState(scenario)).purchases).toBe(0);
  expect(sends).toBe(0);
});

test("P04 live NOT_OBSERVED and failed observation/retry keep the original purchase until committed", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await employeeSignIn(page);
  let sends = 0;
  const bodies: (string | null)[] = [];
  await page.route("**/subscriptions/purchases", async (route) => {
    sends++;
    bodies.push(route.request().postData());
    if (sends < 3) await route.abort("failed");
    else await route.continue();
  });
  await reviewPurchase(page);
  await confirmPurchase(page);
  await expect(page.getByRole("dialog")).toContainText(
    "لم تتأكد نتيجة العملية",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "إغلاق", exact: true })
    .click();
  await page.route("**/purchase-quotes/*/outcome", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page
    .getByRole("button", { name: "التحقق من نتيجة العملية", exact: true })
    .click();
  await expect(
    page.getByText("تعذر التحقق. تظل العملية الأصلية غير محسومة."),
  ).toBeVisible();
  await page.unroute("**/purchase-quotes/*/outcome");
  await page
    .getByRole("button", { name: "التحقق من نتيجة العملية", exact: true })
    .click();
  await page
    .getByRole("button", { name: "مراجعة العملية الأصلية", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "إعادة إرسال الشراء الأصلي نفسه",
      exact: true,
    })
    .click();
  await expect.poll(() => sends).toBe(2);
  await expect(page.getByRole("dialog")).toContainText(
    "لم تتأكد نتيجة العملية",
  );
  expect((await financeState(scenario)).purchases).toBe(0);
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "إعادة إرسال الشراء الأصلي نفسه",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await financeState(scenario)).purchases)
    .toBe(1);
  expect(bodies[1]).toBe(bodies[0]);
  expect(bodies[2]).toBe(bodies[0]);
});

test("P04 full purchase and upgrade preserve saved terms after reload and expiry", async ({
  page,
  browser,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await employeeSignIn(page);
  await reviewPurchase(page);
  await confirmPurchase(page);
  await expect
    .poll(async () => (await financeState(scenario)).purchases)
    .toBe(1);
  const initial = await financeState(scenario);
  expect(initial.wallet.availableReferral).toBe("140");
  expect(initial.wallet.availableNonReferral).toBe("1000");
  expect(initial.savedPrices).toEqual(["60"]);
  expect(initial.savedCountedDates).toEqual([2]);
  await expect(page.getByRole("dialog")).toContainText(
    "تم تفعيل المنصب وتسجيل الشراء",
  );
  await page.reload();
  await reviewPurchase(page, "S2");
  await confirmPurchase(page);
  await expect
    .poll(async () => (await financeState(scenario)).purchases)
    .toBe(2);
  const upgraded = await financeState(scenario);
  expect(upgraded.savedPrices).toEqual(["60", "120"]);
  expect(upgraded.wallet.availableReferral).toBe("20");
  expect(upgraded.wallet.availableNonReferral).toBe("1000");
  expect(upgraded.subscriptions).toBe(2);
  expect(upgraded.expiresAt).not.toBeNull();
  if (upgraded.expiresAt === null) throw new Error("P04_MISSING_EXPIRY");
  const adminContext = await browser.newContext();
  try {
    const admin = await adminContext.newPage();
    await managementSignIn(admin);
    await admin.goto("/admin/packages");
    const rows = admin.locator("tbody tr");
    await expect(rows.nth(0).locator("td").nth(7)).toHaveText("5 موظف");
    await expect(rows.nth(1).locator("td").nth(7)).toHaveText("1 موظف");
    await scenario.command({
      command: "p04-clock",
      instant: upgraded.expiresAt,
    });
    await page.goto("/employee/account");
    await expect(
      page.getByText("حساب مجاني / منتهٍ", { exact: true }),
    ).toBeVisible();
    await admin.reload();
    await expect(rows.nth(0).locator("td").nth(7)).toHaveText("0 موظف");
    await expect(rows.nth(1).locator("td").nth(7)).toHaveText("0 موظف");
  } finally {
    await adminContext.close();
  }
  expect((await financeState(scenario)).wallet).toEqual(upgraded.wallet);
});

for (const laterState of ["expiry", "replacement"] as const) {
  test(`P04 committed lost acknowledgement reconciles the original after ${laterState} exactly once`, async ({
    page,
    context,
    browser,
    request,
    scenario,
  }) => {
    await scenario.command({ command: "p04-fixtures", profile: "purchase" });
    await editFutureTerms(request, "60.000001");
    await employeeSignIn(page);
    let sends = 0;
    let original: PurchaseResult | undefined;
    await page.route("**/subscriptions/purchases", async (route) => {
      sends++;
      const response = await route.fetch();
      original = purchaseCommandResultSchema.parse(
        successEnvelopeSchema.parse(await response.json()).data,
      ).purchase;
      await route.abort("failed");
    });
    await reviewPurchase(page);
    await confirmPurchase(page);
    await expect
      .poll(async () => (await financeState(scenario)).purchases)
      .toBe(1);
    await expect(page.getByRole("dialog")).toContainText(
      "لم تتأكد نتيجة العملية",
    );
    if (!original) throw new Error("P04_MISSING_ORIGINAL_PURCHASE");
    const originalPurchase = original;
    if (laterState === "expiry") {
      await scenario.command({
        command: "p04-clock",
        instant: originalPurchase.subscriptionAtPurchase.expiresAt,
      });
    } else {
      const independent = await browser.newContext();
      try {
        const replacement = await independent.newPage();
        await employeeSignIn(replacement);
        await reviewPurchase(replacement, "S2");
        await confirmPurchase(replacement);
        await expect(replacement.getByRole("dialog")).toContainText(
          "تم تفعيل المنصب وتسجيل الشراء",
        );
      } finally {
        await independent.close();
      }
    }
    const beforeObservation = await financeState(scenario);
    const recipientEmails = Array.from(
      { length: 5 },
      (_, level) => `ancestor-${String(level)}@p04.test`,
    );
    const recipientStates = await Promise.all(
      recipientEmails.map((email) => financeState(scenario, email)),
    );
    expect(beforeObservation.purchases).toBe(laterState === "expiry" ? 1 : 2);
    await page.reload();
    await expect(
      page.getByText("توجد عملية شراء لم تتأكد نتيجتها."),
    ).toBeVisible();
    const peer = await context.newPage();
    await peer.goto("/employee/packages");
    await expect(
      peer.getByText("توجد عملية شراء لم تتأكد نتيجتها."),
    ).toBeVisible();
    await expect(peer.locator("#upgrade-btn-O1")).toBeDisabled();
    await peer.bringToFront();
    await expect(
      peer.getByRole("button", {
        name: "التحقق من نتيجة العملية",
        exact: true,
      }),
    ).toBeEnabled();
    await peer
      .getByRole("button", { name: "التحقق من نتيجة العملية", exact: true })
      .click();
    await expect(
      peer.getByText("توجد عملية شراء لم تتأكد نتيجتها."),
    ).toHaveCount(0);
    const recovered = peer.getByRole("status", {
      name: "نتيجة العملية الأصلية",
    });
    await expect(recovered).toContainText(originalPurchase.purchaseId);
    await expect(recovered).toContainText(originalPurchase.quoteId);
    await expect(recovered).toContainText(originalPurchase.purchasedAt);
    await expect(recovered).toContainText("60.000001");
    await expect(recovered).toContainText("S1");
    await expect(recovered).toContainText("21%");
    await expect(recovered).toContainText("أيام العمل المحتسبة: 2");
    await expect(recovered).toContainText("Asia/Baghdad");
    await expect(recovered).toContainText(
      originalPurchase.subscriptionAtPurchase.firstWorkDate,
    );
    await expect(recovered).toContainText(
      originalPurchase.subscriptionAtPurchase.finalWorkDate,
    );
    await expect(recovered).toContainText(
      originalPurchase.subscriptionAtPurchase.expiresAt,
    );
    await expect(recovered).toContainText(
      "هذه نتيجة العملية الأصلية وليست حالة العضوية الحالية",
    );
    if (laterState === "expiry")
      await expect(
        peer.getByText("المنصب الحالي", { exact: true }),
      ).toHaveCount(0);
    else {
      const current = peer
        .getByLabel("شروط الاشتراك المحفوظة")
        .filter({ hasText: "S2" });
      await expect(current).toContainText("120.00");
    }
    expect(sends).toBe(1);
    expect(await financeState(scenario)).toEqual(beforeObservation);
    expect(
      await Promise.all(
        recipientEmails.map((email) => financeState(scenario, email)),
      ),
    ).toEqual(recipientStates);
    await peer.setViewportSize({ width: 320, height: 850 });
    expect(
      await peer.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(recovered).toBeVisible();
    await expect(peer.getByRole("dialog")).toHaveCount(0);
    await mkdir("../../output/playwright/p03", { recursive: true });
    await recovered.screenshot({
      path: `../../output/playwright/p03/p04-original-${laterState}-320.png`,
      mask: [recovered.locator("p").filter({ hasText: /مرجع/u })],
    });
    await peer.close();
  });
}

test("P04 expired uncommitted recovery explicitly confirms no purchase or debit", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await employeeSignIn(page);
  let sends = 0;
  await page.route("**/subscriptions/purchases", async (route) => {
    sends++;
    await route.abort("failed");
  });
  const quoteResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/purchase-quotes") &&
      response.request().method() === "POST",
  );
  await reviewPurchase(page);
  const savedQuote = purchaseQuoteSchema.parse(
    successEnvelopeSchema.parse(await (await quoteResponse).json()).data,
  );
  await confirmPurchase(page);
  await expect(page.getByRole("dialog")).toContainText(
    "لم تتأكد نتيجة العملية",
  );
  const before = await financeState(scenario);
  expect(before.purchases).toBe(0);
  await scenario.command({
    command: "p04-clock",
    instant: savedQuote.quoteExpiresAt,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "التحقق من نتيجة العملية", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "نتيجة العملية الأصلية" }),
  ).toContainText("انتهت صلاحية عرض الشراء الأصلي دون تسجيل شراء أو خصم");
  await expect(page.getByText("توجد عملية شراء لم تتأكد نتيجتها.")).toHaveCount(
    0,
  );
  expect(sends).toBe(1);
  expect(await financeState(scenario)).toEqual(before);
});

test("P04 a delayed original configuration and an explicit identical retry commit one audit", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await managementSignIn(page);
  const bodies: (string | null)[] = [];
  let original: Promise<unknown> | undefined;
  await page.route("**/admin/packages/S1", async (route) => {
    bodies.push(route.request().postData());
    if (bodies.length === 1) {
      original = route.fetch();
      await route.abort("failed");
      await original;
    } else await route.continue();
  });
  await reviewConfiguration(page, "61");
  await page
    .getByRole("button", { name: "تأكيد حفظ الشروط المراجعة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("لم تتأكد نتيجة الحفظ");
  await page
    .getByRole("button", { name: "تأكيد حفظ الشروط المراجعة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await original;
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
  expect((await financeState(scenario)).configurationChanges).toBe(6);
});

test("P04 never-arrived configuration retains exact reviewed intent for explicit retry", async ({
  page,
  scenario,
}) => {
  await scenario.command({ command: "p04-fixtures", profile: "purchase" });
  await managementSignIn(page);
  let original: string | null = null;
  let retried: string | null = null;
  let attempts = 0;
  await page.route("**/admin/packages/S1", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    attempts++;
    if (attempts === 1) {
      original = route.request().postData();
      await route.abort("failed");
    } else {
      retried = route.request().postData();
      await route.continue();
    }
  });
  await reviewConfiguration(page, "61.000001");
  expect((await financeState(scenario)).configurationChanges).toBe(5);
  await page
    .getByRole("button", { name: "تأكيد حفظ الشروط المراجعة", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("لم تتأكد نتيجة الحفظ");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "إلغاء", exact: true })
    .click();
  await page
    .getByRole("button", { name: "التحقق من الحفظ", exact: true })
    .click();
  await expect(
    page.getByText("لم تُرصد العملية بعد. تظل غير محسومة."),
  ).toBeVisible();
  expect((await financeState(scenario)).configurationChanges).toBe(5);
  await page
    .getByRole("button", { name: "مراجعة إعادة المحاولة الأصلية", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تأكيد حفظ الشروط المراجعة", exact: true })
    .click();
  await expect
    .poll(async () => (await financeState(scenario)).configurationChanges)
    .toBe(6);
  expect(retried).toBe(original);
  expect(attempts).toBe(2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "الاشتراكات النشطة" }),
  ).toBeVisible();
});
