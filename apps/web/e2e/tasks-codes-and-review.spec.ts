import { mkdir } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { managementSignIn } from "./support/admin-management";
import {
  employeeSignIn,
  reviewPurchase,
  confirmPurchase,
  editFutureTerms,
} from "./support/p04-finance";
import {
  p05StateSchema,
  p05DecoderStateSchema,
  p05FixturesSchema,
} from "../../api/tests/e2e/control";
import {
  adminTaskDetailSchema,
  successEnvelopeSchema,
  taskEditSchema,
  commandObservationSchema,
  submissionDetailSchema,
  taskCodeSummarySchema,
  adminSubmissionDetailSchema,
  uploadObservationSchema,
  evidencePageSchema,
  submissionPageSchema,
  taskCodeUsagePageSchema,
  taskCodeAuditPageSchema,
  membershipSchema,
} from "@template/contracts";
import { managementActor, managementApiUrl } from "./support/admin-management";
import {
  taskActor,
  acceptedProof,
  publishedTask,
  syntheticProof,
} from "./support/p05-tasks";

const file = syntheticProof;
test.use({ actionTimeout: 15000, navigationTimeout: 20000 });
async function ui(page: Page, name: string) {
  await mkdir("../../output/playwright/p03", { recursive: true });
  await expect(page.locator(".session-loader")).toHaveCount(0);
  const surface = page
    .locator(page.url().includes("/employee/") ? ".employee-scope" : "main")
    .first();
  await expect(surface).toHaveCSS("direction", "rtl");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await surface.evaluate((element) => getComputedStyle(element).direction),
    ).toBe("rtl");
    expect(
      await surface.evaluate((element) => getComputedStyle(element).fontFamily),
    ).toContain("Cairo");
    expect(
      await page
        .locator('[dir="ltr"]')
        .evaluateAll((elements) =>
          elements.every(
            (element) => getComputedStyle(element).direction === "ltr",
          ),
        ),
    ).toBe(true);
    expect(
      await page
        .locator(".admin-button > span")
        .evaluateAll((elements) =>
          elements.every(
            (element) =>
              getComputedStyle(element).flexDirection === "row" &&
              getComputedStyle(element).flexWrap === "nowrap",
          ),
        ),
    ).toBe(true);
    if (page.url().includes("/employee/")) {
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      const content = await page
        .locator(".safe-bottom-pad > div")
        .first()
        .boundingBox();
      const navigation = await page
        .getByRole("navigation", { name: "التنقل الرئيسي للتطبيق" })
        .boundingBox();
      expect(
        content && navigation && content.y + content.height <= navigation.y + 2,
      ).toBe(true);
      await page.screenshot({
        path:
          "../../output/playwright/p03/p05-" +
          name +
          "-clearance-" +
          String(width) +
          ".png",
        mask: [page.locator("img"), page.locator("input"), page.locator("bdi")],
      });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
    }
    expect(
      await page
        .getByRole("dialog")
        .evaluateAll((elements) =>
          elements.every(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ),
    ).toBe(true);
    await page.screenshot({
      path:
        "../../output/playwright/p03/p05-" +
        name +
        "-" +
        String(width) +
        ".png",
      fullPage: true,
      mask: [
        page.locator("img"),
        page.locator("input"),
        page.locator("bdi"),
        page.locator("textarea"),
      ],
    });
  }
}
async function confirm(page: Page, label = "تأكيد الإجراء") {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function unlock(page: Page) {
  await page.goto("/employee/tasks");
  await page.locator("#task-unlock-code").fill(" oscar-p05 ");
  await page.getByRole("button", { name: "فتح المهمة", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "تأكيد وإرسال المهمة للاعتماد" }),
  ).toBeVisible();
}
async function submit(page: Page) {
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "تأكيد وإرسال المهمة للاعتماد" })
    .click();
  await expect(page.getByText(/المكافأة.*قيد المراجعة/)).toBeVisible();
}
async function review(
  page: Page,
  name: string,
  decision: "APPROVE" | "REJECT",
  evidenceVersions: number[] = [1],
) {
  await page.goto("/admin/submissions");
  const row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "معاينة", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("img")).toBeVisible();
  await expect(dialog.getByText(/إقرار التنفيذ محفوظ/)).toBeVisible();
  const terms = dialog.getByRole("region", { name: "شروط الاستحقاق المسجلة" });
  await expect(terms).toContainText("المنصب S1");
  await expect(terms).toContainText("60 USDT");
  await expect(terms).toContainText("المكافأة اليومية المسجلة: 2 USDT");
  await expect(terms).toContainText("21%");
  const history = dialog.getByRole("region", { name: "سجل تغييرات الدليل" });
  for (const version of evidenceVersions)
    await expect(
      history.getByText(
        `الدليل ${String(version)} — ${version === evidenceVersions[0] ? "الحالي" : "سابق"}`,
        { exact: true },
      ),
    ).toBeVisible();
  await expect(history.getByRole("img")).toHaveCount(0);
  await dialog
    .getByRole("button", {
      name: decision === "APPROVE" ? "اعتماد وصرف المكافأة" : "رفض نهائي",
      exact: true,
    })
    .click();
  const confirmation = page.getByRole("dialog");
  await confirmation.getByRole("textbox").fill("سبب قرار محفوظ للاختبار");
  await confirm(
    page,
    decision === "APPROVE"
      ? "تأكيد الاعتماد وصرف المكافأة"
      : "تأكيد الرفض النهائي",
  );
  await expect(confirmation).not.toBeVisible();
}
test("P05 actual publication code proof replacement approval rejection and nine frozen routes", async ({
  page,
  browser,
  scenario,
  request,
}) => {
  test.setTimeout(600_000);
  const fixture = p05FixturesSchema.parse(
    await scenario.command({ command: "p05-fixtures", futureWorkDate: true }),
  );
  const consoleErrors: string[] = [];
  const watch = (target: Page) => {
    target.on("pageerror", () => consoleErrors.push("pageerror"));
    target.on("console", (message) => {
      if (message.type() !== "error") return;
      // The frozen UI has no favicon; use the same exact exception as P03.
      const favicon =
        message.location().url === "http://127.0.0.1:3103/favicon.ico" &&
        /Failed to load resource:.*status of 404/u.test(message.text());
      if (!favicon) consoleErrors.push("consoleerror");
    });
  };
  watch(page);
  await managementSignIn(page);
  await page.goto("/admin/tasks");
  await ui(page, "tasks-list");
  await page.goto("/admin/tasks/new");
  await ui(page, "task-new");
  await page.getByLabel(/عنوان المهمة/).fill("مهمة قبول P05");
  await page
    .getByLabel(/وصف المهمة/)
    .fill("نفذ الخطوات المسجلة\nأرفق لقطة الشاشة وأقر بالتنفيذ");
  await page.getByLabel(/الرابط الخارجي/).fill("https://example.com/p05");
  await page
    .getByLabel("تاريخ النشر:", { exact: true })
    .fill(fixture.publicationDate);
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole("button", { name: "إنشاء المهمة", exact: true }).click();
  await confirm(page);
  await expect(page).toHaveURL(/\/admin\/tasks\/[0-9a-f-]+$/);
  const taskPath = new URL(page.url()).pathname;
  await ui(page, "task-detail");
  await page.goto(taskPath + "/edit");
  await ui(page, "task-edit");
  await page.getByLabel(/عنوان المهمة/).fill("مهمة قبول P05 محررة");
  await page.getByRole("button", { name: "حفظ التعديلات" }).click();
  await confirm(page);
  await expect(page).toHaveURL(taskPath);
  const taskId = taskPath.split("/").at(-1);
  if (!taskId) throw new Error("P05_TASK_ID_MISSING");
  await page.goto("/admin/codes/new?taskId=" + taskId);
  await ui(page, "code-new");
  await page.getByRole("textbox", { name: /Code/ }).fill(" oscar-p05 ");
  await page.getByRole("button", { name: "حفظ وإنشاء الرمز" }).click();
  await confirm(page);
  await expect(page).toHaveURL(/\/admin\/codes\/[0-9a-f-]+$/);
  const codePath = new URL(page.url()).pathname;
  await ui(page, "code-detail");
  await page.goto("/admin/codes");
  await ui(page, "codes-list");
  const employeeContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3103",
  });
  const employee = await employeeContext.newPage();
  const privileged: string[] = [];
  employee.on("request", (request) => {
    if (request.url().includes("/api/v1/admin/")) privileged.push("admin");
  });
  const otherContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3103",
  });
  const other = await otherContext.newPage();
  watch(employee);
  watch(other);
  try {
    await employeeSignIn(employee, "employee@p05.test");
    await unlock(employee);
    await ui(employee, "employee-tasks");
    await submit(employee);
    expect(
      p05StateSchema.parse(
        await scenario.command({
          command: "p05-state",
          email: "employee@p05.test",
        }),
      ),
    ).toMatchObject({
      submissions: 1,
      evidence: 1,
      rewardPostings: 0,
      available: "0",
    });
    await employee.reload();
    await expect(
      employee.getByRole("img", { name: "معاينة لقطة الشاشة المرفوعة" }),
    ).toBeVisible();
    await employee
      .locator('input[type="file"]')
      .setInputFiles({ ...file, name: "replacement.png" });
    await employee
      .getByRole("button", { name: "تحديث لقطة الشاشة المرفقة" })
      .click();
    await expect
      .poll(
        async () =>
          p05StateSchema.parse(
            await scenario.command({
              command: "p05-state",
              email: "employee@p05.test",
            }),
          ).evidence,
      )
      .toBe(2);
    await scenario.command({ command: "p05-fund-upgrade" });
    await reviewPurchase(employee, "S2");
    const upgradedMembership = employee.waitForResponse(async (response) => {
      if (
        !response.url().endsWith("/subscriptions/me") ||
        response.status() !== 200
      )
        return false;
      return (
        membershipSchema.parse(
          successEnvelopeSchema.parse(await response.json()).data,
        ).subscription?.terms.code === "S2"
      );
    });
    await confirmPurchase(employee);
    await expect(employee.getByRole("dialog")).toContainText(
      "تم تفعيل المنصب وتسجيل الشراء",
    );
    const membership = membershipSchema.parse(
      successEnvelopeSchema.parse(await (await upgradedMembership).json()).data,
    );
    expect(membership.subscription?.terms).toMatchObject({
      code: "S2",
      dailyReward: "4",
    });
    await editFutureTerms(request, "60", {
      dailyReward: "3",
      withdrawalFeeBps: 1000,
    });
    await employee.goto("/employee/tasks");
    await expect(employee.getByText(/المكافأة.*قيد المراجعة/)).toBeVisible();
    await other.goto("/employee/auth/login");
    await other
      .getByRole("button", { name: "إظهار كلمة المرور", exact: true })
      .click();
    await expect(
      other.getByLabel("كلمة المرور", { exact: true }),
    ).toHaveAttribute("type", "text");
    await other.getByLabel("البريد الإلكتروني للعمل").fill("other@p05.test");
    await other
      .getByLabel("كلمة المرور", { exact: true })
      .fill("P03 test password only!");
    await expect(other.getByLabel("كلمة المرور", { exact: true })).toHaveValue(
      "P03 test password only!",
    );
    const otherLogin = other.waitForResponse(
      (response) =>
        response.url().endsWith("/auth/login") &&
        response.request().method() === "POST",
    );
    await other
      .getByRole("button", { name: "تسجيل الدخول", exact: true })
      .click();
    const response = await otherLogin;
    expect(response.status()).toBe(200);
    await expect(other).toHaveURL("/employee");
    await unlock(other);
    await page.goto(codePath);
    await page
      .getByRole("button", { name: "إيقاف الرمز مؤقتاً", exact: true })
      .click();
    await confirm(page, "تأكيد إيقاف الرمز");
    await other.reload();
    await expect(
      other.getByRole("button", { name: "تأكيد وإرسال المهمة للاعتماد" }),
    ).toBeVisible();
    await submit(other);
    await page.goto(taskPath + "/edit");
    await expect(
      page.getByLabel("تاريخ النشر:", { exact: true }),
    ).toBeDisabled();
    await page.goto("/admin/submissions");
    await ui(page, "submissions");
    await review(page, "موظف المهام", "APPROVE", [2, 1]);
    await review(page, "موظف آخر", "REJECT");
    expect(
      p05StateSchema.parse(
        await scenario.command({
          command: "p05-state",
          email: "employee@p05.test",
        }),
      ),
    ).toMatchObject({ rewardPostings: 1, available: "2" });
    expect(
      p05StateSchema.parse(
        await scenario.command({
          command: "p05-state",
          email: "other@p05.test",
        }),
      ),
    ).toMatchObject({ rewardPostings: 0, available: "0" });
    await employee.reload();
    await expect(
      employee.getByText("تم اعتماد المهمة وصرف المكافأة نهائياً"),
    ).toBeVisible();
    await employee.goto("/employee/wallet");
    await expect(employee.getByText(/مكافأة مهمة/).first()).toBeVisible();
    await other.reload();
    await expect(other.getByText("سبب قرار محفوظ للاختبار")).toBeVisible();
    await expect(
      other.getByRole("button", { name: "تأكيد وإرسال المهمة للاعتماد" }),
    ).toHaveCount(0);
    const secondDevice = await browser.newContext({
      baseURL: "http://127.0.0.1:3103",
    });
    const secondAdmin = await browser.newContext({
      baseURL: "http://127.0.0.1:3103",
    });
    try {
      const devicePage = await secondDevice.newPage();
      const adminPage = await secondAdmin.newPage();
      watch(devicePage);
      watch(adminPage);
      await employeeSignIn(devicePage, "employee@p05.test");
      await devicePage.goto("/employee/tasks");
      await expect(
        devicePage.getByText("تم اعتماد المهمة وصرف المكافأة نهائياً"),
      ).toBeVisible();
      await devicePage.goto("/employee/wallet");
      await expect(devicePage.getByText(/مكافأة مهمة/).first()).toBeVisible();
      await managementSignIn(adminPage, "admin2@p03.test");
      await adminPage.goto("/admin/submissions");
      await expect(
        adminPage
          .getByRole("row")
          .filter({ hasText: "موظف المهام" })
          .getByText("معتمد ومصروف"),
      ).toBeVisible();
      await expect(
        adminPage
          .getByRole("row")
          .filter({ hasText: "موظف آخر" })
          .getByText("مرفوض دون صرف مكافأة"),
      ).toBeVisible();
    } finally {
      await secondDevice.close();
      await secondAdmin.close();
    }
    await page.reload();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: "موظف المهام" })
        .getByRole("button", { name: "اعتماد", exact: true }),
    ).toHaveCount(0);
    expect(privileged).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    await employeeContext.close();
    await otherContext.close();
  }
});

test("P05 narrow long review and server page controls remain reachable with restored focus", async ({
  page,
  request,
  playwright,
  scenario,
}) => {
  await scenario.command({ command: "p05-fixtures" });
  const admin = await managementActor(request);
  const ownerRequest = await playwright.request.newContext();
  try {
    const owner = await taskActor(ownerRequest, "employee@p05.test");
    const task = await publishedTask(
      request,
      admin.headers,
      "مهمة تعليمات طويلة للمراجعة",
    );
    const edited = await request.patch(
      managementApiUrl + "/admin/tasks/" + task.id,
      {
        headers: admin.headers,
        data: {
          commandId: crypto.randomUUID(),
          confirmed: true,
          expectedTaskRevision: task.revision,
          description:
            "تعليمات مطولة مسجلة ينبغي مراجعتها قبل القرار النهائي. ".repeat(
              60,
            ),
        },
      },
    );
    expect(edited.status()).toBe(200);
    const current = adminTaskDetailSchema.parse(
      successEnvelopeSchema.parse(await edited.json()).data,
    );
    const proof = await acceptedProof(ownerRequest, owner.headers);
    expect(
      (
        await ownerRequest.post(managementApiUrl + "/task-submissions", {
          headers: owner.headers,
          data: {
            commandId: crypto.randomUUID(),
            taskId: task.id,
            expectedTaskRevision: current.revision,
            proofAssetId: proof.id,
            declaredExecuted: true,
          },
        })
      ).status(),
    ).toBe(201);
    await managementSignIn(page);
    await page.goto("/admin/submissions");
    await page.setViewportSize({ width: 320, height: 850 });
    const trigger = page
      .getByRole("row")
      .filter({ hasText: "موظف المهام" })
      .getByRole("button", { name: "معاينة", exact: true });
    await trigger.click();
    await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
    const box = await page
      .getByRole("dialog")
      .locator('[tabindex="-1"]')
      .boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect(box?.height).toBeLessThanOrEqual(850);
    const approve = page
      .getByRole("dialog")
      .getByRole("button", { name: "اعتماد وصرف المكافأة", exact: true });
    await expect(approve).toBeEnabled();
    await approve.scrollIntoViewIfNeeded();
    await expect(approve).toBeInViewport();
    await approve.focus();
    await expect(approve).toBeFocused();
    await page.keyboard.press("Tab");
    const reviewDialog = page.getByRole("dialog", {
      name: "تدقيق تسليم المهمة",
      exact: true,
    });
    expect(
      await reviewDialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    await ui(page, "long-review");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await scenario.command({ command: "p05-pages" });
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto("/admin/codes");
    await expect(
      page.getByRole("button", { name: "التالي", exact: true }),
    ).toBeVisible();
    const nextPage = page.getByRole("button", { name: "التالي", exact: true });
    const horizontalBounds = await nextPage.boundingBox();
    expect(horizontalBounds?.x).toBeGreaterThanOrEqual(0);
    expect(
      (horizontalBounds?.x ?? 320) + (horizontalBounds?.width ?? 320),
    ).toBeLessThanOrEqual(320);
    await nextPage.scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "التالي", exact: true }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "التالي", exact: true }).click();
    await expect(page.getByText(/من 11 إلى 20/)).toBeVisible();
    await ui(page, "bounded-codes");
  } finally {
    await ownerRequest.dispose();
  }
});

test("P05 dropped upload lost cancellation and actual processing cancellation cannot attach late bytes", async ({
  page,
  request,
  playwright,
  scenario,
}) => {
  test.setTimeout(600_000);
  await scenario.command({ command: "p05-fixtures" });
  const admin = await managementActor(request);
  const ownerRequest = await playwright.request.newContext();
  try {
    const owner = await taskActor(ownerRequest, "employee@p05.test");
    await publishedTask(request, admin.headers, "مهمة سياج الرفع");
    await employeeSignIn(page, "employee@p05.test");
    await page.goto("/employee/tasks");
    const uploadEndpoint = managementApiUrl + "/proofs";
    const uploadId = (bytes: Buffer | null) => {
      const id = bytes
        ?.subarray(0, 1024)
        .toString("utf8")
        .match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u,
        )?.[0];
      if (!id) throw new Error("P05_UPLOAD_ID_MISSING");
      return id;
    };
    let dropped = "";
    await page.route(uploadEndpoint, async (route) => {
      dropped = uploadId(route.request().postDataBuffer());
      await route.abort("failed");
    });
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "تأكيد وإرسال المهمة للاعتماد" })
      .click();
    await expect(
      page.getByRole("button", { name: "التحقق من الطلب" }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "التحقق من الطلب" }).click();
    await expect(
      page.getByRole("button", { name: "إلغاء الطلب غير المؤكد" }),
    ).toBeVisible();
    const cancelEndpoint = uploadEndpoint + "/uploads/" + dropped + "/cancel";
    await page.route(cancelEndpoint, async (route) => {
      const saved = await route.fetch();
      expect(saved.status()).toBe(200);
      await route.abort("failed");
    });
    await page.getByRole("button", { name: "إلغاء الطلب غير المؤكد" }).click();
    await expect(
      page.getByRole("button", { name: "التحقق من الطلب" }),
    ).toBeEnabled();
    await page.unrouteAll({ behavior: "wait" });
    await page.reload();
    await page.getByRole("button", { name: "التحقق من الطلب" }).click();
    await expect(
      page.getByRole("button", { name: "التحقق من الطلب" }),
    ).toHaveCount(0);
    const late = await ownerRequest.post(uploadEndpoint, {
      headers: owner.headers,
      multipart: { commandId: dropped, file: syntheticProof },
    });
    expect(late.status()).toBe(409);
    let processing = "";
    await page.route(uploadEndpoint, async (route) => {
      processing = uploadId(route.request().postDataBuffer());
      await scenario.command({ command: "p05-hold-decoder" });
      const result = await route.fetch();
      expect(result.status()).not.toBe(201);
      await route.fulfill({ response: result });
    });
    await page.locator('input[type="file"]').setInputFiles(syntheticProof);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "تأكيد وإرسال المهمة للاعتماد" })
      .click();
    await expect.poll(() => processing).not.toBe("");
    await expect
      .poll(async () => {
        const facts = p05DecoderStateSchema.parse(
          await scenario.command({ command: "p05-decoder-state" }),
        );
        return facts.held;
      })
      .toBe(true);
    await expect
      .poll(
        async () => {
          const response = await ownerRequest.get(
            uploadEndpoint + "/uploads/" + processing,
            { headers: owner.headers },
          );
          expect(response.status()).toBe(200);
          return uploadObservationSchema.parse(
            successEnvelopeSchema.parse(await response.json()).data,
          ).state;
        },
        { intervals: [10, 10, 20, 20], timeout: 5000 },
      )
      .toBe("PENDING");
    const cancelled = await ownerRequest.post(
      uploadEndpoint + "/uploads/" + processing + "/cancel",
      { headers: owner.headers, data: { confirmed: true } },
    );
    expect(cancelled.status()).toBe(200);
    expect(
      uploadObservationSchema.parse(
        successEnvelopeSchema.parse(await cancelled.json()).data,
      ).state,
    ).toBe("FAILED");
    await expect
      .poll(
        async () =>
          p05DecoderStateSchema.parse(
            await scenario.command({ command: "p05-decoder-state" }),
          ).closedSignal,
      )
      .toBe("SIGKILL");
    await expect(
      page.getByRole("button", { name: "التحقق من الطلب" }),
    ).toBeEnabled();
    await page.unrouteAll({ behavior: "wait" });
    await page.getByRole("button", { name: "التحقق من الطلب" }).click();
    await expect(
      page.getByRole("button", { name: "التحقق من الطلب" }),
    ).toHaveCount(0);
    expect(
      p05StateSchema.parse(
        await scenario.command({
          command: "p05-state",
          email: "employee@p05.test",
        }),
      ),
    ).toMatchObject({
      submissions: 0,
      evidence: 0,
      rewardPostings: 0,
      available: "0",
    });
  } finally {
    await ownerRequest.dispose();
  }
});

test("P05 real stale versions foreign proof denial late preview and pending retention", async ({
  page,
  browser,
  request,
  playwright,
  scenario,
}) => {
  test.setTimeout(600_000);
  await scenario.command({ command: "p05-fixtures" });
  const admin = await managementActor(request);
  const ownerRequest = await playwright.request.newContext();
  const foreignRequest = await playwright.request.newContext();
  const employeeContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3103",
  });
  const employee = await employeeContext.newPage();
  try {
    const owner = await taskActor(ownerRequest, "employee@p05.test");
    const foreign = await taskActor(foreignRequest, "other@p05.test");
    const task = await publishedTask(
      request,
      admin.headers,
      "مهمة تعارض واحتفاظ",
      true,
    );
    const taskEndpoint = managementApiUrl + "/admin/tasks/" + task.id;
    const edited = await request.patch(taskEndpoint, {
      headers: admin.headers,
      data: {
        commandId: crypto.randomUUID(),
        confirmed: true,
        expectedTaskRevision: task.revision,
        title: "مهمة تعارض واحتفاظ محررة",
      },
    });
    expect(edited.status()).toBe(200);
    const live = adminTaskDetailSchema.parse(
      successEnvelopeSchema.parse(await edited.json()).data,
    );
    expect(
      (
        await request.patch(taskEndpoint, {
          headers: admin.headers,
          data: {
            commandId: crypto.randomUUID(),
            confirmed: true,
            expectedTaskRevision: task.revision,
            title: "تعديل قديم",
          },
        })
      ).status(),
    ).toBe(409);
    const createdCode = await request.post(
      managementApiUrl + "/admin/task-codes",
      {
        headers: admin.headers,
        data: {
          commandId: crypto.randomUUID(),
          confirmed: true,
          taskId: task.id,
          code: "oscar-p05",
          state: "ENABLED",
        },
      },
    );
    expect(createdCode.status()).toBe(201);
    const code = taskCodeSummarySchema.parse(
      successEnvelopeSchema.parse(await createdCode.json()).data,
    );
    expect(
      (
        await ownerRequest.post(
          managementApiUrl + "/tasks/" + task.id + "/unlock",
          {
            headers: owner.headers,
            data: {
              commandId: crypto.randomUUID(),
              expectedTaskRevision: task.revision,
              code: "oscar-p05",
            },
          },
        )
      ).status(),
    ).toBe(409);
    expect(
      (
        await ownerRequest.post(
          managementApiUrl + "/tasks/" + task.id + "/unlock",
          {
            headers: owner.headers,
            data: {
              commandId: crypto.randomUUID(),
              expectedTaskRevision: live.revision,
              code: "oscar-p05",
            },
          },
        )
      ).status(),
    ).toBe(200);
    const statusEndpoint =
      managementApiUrl + "/admin/task-codes/" + code.id + "/status";
    expect(
      (
        await request.patch(statusEndpoint, {
          headers: admin.headers,
          data: {
            commandId: crypto.randomUUID(),
            confirmed: true,
            expectedCodeVersion: code.version,
            state: "PAUSED",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.patch(statusEndpoint, {
          headers: admin.headers,
          data: {
            commandId: crypto.randomUUID(),
            confirmed: true,
            expectedCodeVersion: code.version,
            state: "ENABLED",
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.patch(taskEndpoint, {
          headers: admin.headers,
          data: {
            commandId: crypto.randomUUID(),
            confirmed: true,
            expectedTaskRevision: live.revision,
            publicationDate: "2026-10-06",
          },
        })
      ).status(),
    ).toBe(409);
    const first = await acceptedProof(ownerRequest, owner.headers);
    const submitted = await ownerRequest.post(
      managementApiUrl + "/task-submissions",
      {
        headers: owner.headers,
        data: {
          commandId: crypto.randomUUID(),
          taskId: task.id,
          expectedTaskRevision: live.revision,
          proofAssetId: first.id,
          declaredExecuted: true,
        },
      },
    );
    expect(submitted.status()).toBe(201);
    const submission = submissionDetailSchema.parse(
      successEnvelopeSchema.parse(await submitted.json()).data,
    );
    const second = await acceptedProof(ownerRequest, owner.headers);
    const evidenceEndpoint =
      managementApiUrl + "/task-submissions/" + submission.id + "/evidence";
    await managementSignIn(page);
    await page.goto("/admin/submissions?submission=" + submission.id);
    const preview = page.getByRole("dialog", {
      name: "تدقيق تسليم المهمة",
      exact: true,
    });
    await expect(preview.getByRole("img")).toBeVisible();
    await preview
      .getByRole("button", { name: "اعتماد وصرف المكافأة", exact: true })
      .click();
    const approval = page.getByRole("button", {
      name: "تأكيد الاعتماد وصرف المكافأة",
      exact: true,
    });
    await page
      .getByRole("dialog")
      .getByRole("textbox")
      .fill("سبب النسخة المراجعة");
    await expect(approval).toBeEnabled();
    const replaced = await ownerRequest.patch(evidenceEndpoint, {
      headers: owner.headers,
      data: {
        commandId: crypto.randomUUID(),
        expectedSubmissionVersion: submission.version,
        proofAssetId: second.id,
      },
    });
    expect(replaced.status()).toBe(200);
    const latest = submissionDetailSchema.parse(
      successEnvelopeSchema.parse(await replaced.json()).data,
    );
    await expect(approval).toBeDisabled({ timeout: 20_000 });
    await expect(
      page.getByText(
        "تغير التسليم أو الدليل؛ أغلق التأكيد وراجع النسخة الحالية.",
      ),
    ).toBeVisible({ timeout: 20_000 });
    expect(
      p05StateSchema.parse(
        await scenario.command({
          command: "p05-state",
          email: "employee@p05.test",
        }),
      ),
    ).toMatchObject({ evidence: 2, rewardPostings: 0, available: "0" });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "إلغاء", exact: true })
      .click();
    await expect(preview.getByRole("img")).toBeVisible();
    await expect(
      preview.getByText(/إقرار التنفيذ محفوظ.*الدليل 2/),
    ).toBeVisible();
    const evidenceHistory = preview.getByRole("region", {
      name: "سجل تغييرات الدليل",
    });
    await expect(
      evidenceHistory.getByText("الدليل 2 — الحالي", { exact: true }),
    ).toBeVisible();
    await expect(
      evidenceHistory.getByText("الدليل 1 — سابق", { exact: true }),
    ).toBeVisible();
    await expect(
      preview.getByRole("button", {
        name: "اعتماد وصرف المكافأة",
        exact: true,
      }),
    ).toBeEnabled();
    await page.keyboard.press("Escape");
    expect(
      (
        await ownerRequest.patch(evidenceEndpoint, {
          headers: owner.headers,
          data: {
            commandId: crypto.randomUUID(),
            expectedSubmissionVersion: submission.version,
            proofAssetId: first.id,
          },
        })
      ).status(),
    ).toBe(409);
    const reviewEndpoint =
      managementApiUrl + "/admin/task-submissions/" + submission.id + "/review";
    expect(
      (
        await request.post(reviewEndpoint, {
          headers: admin.headers,
          data: {
            commandId: crypto.randomUUID(),
            confirmed: true,
            decision: "APPROVE",
            reason: "نسخة قديمة",
            expectedSubmissionVersion: submission.version,
            expectedEvidenceVersion: submission.currentEvidenceVersion,
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await foreignRequest.get(managementApiUrl + "/proofs/" + second.id, {
          headers: foreign.headers,
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await foreignRequest.get(
          managementApiUrl + "/proofs/" + second.id + "/content",
          { headers: foreign.headers },
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await foreignRequest.get(
          managementApiUrl + "/task-submissions/" + submission.id,
          { headers: foreign.headers },
        )
      ).status(),
    ).toBe(404);
    const evidence = evidencePageSchema.parse(
      successEnvelopeSchema.parse(
        await (
          await ownerRequest.get(evidenceEndpoint, {
            headers: owner.headers,
            params: { page: 1, limit: 25 },
          })
        ).json(),
      ).data,
    );
    expect(evidence.pagination).toMatchObject({ limit: 25, total: 2 });
    const history = submissionPageSchema.parse(
      successEnvelopeSchema.parse(
        await (
          await ownerRequest.get(managementApiUrl + "/task-submissions", {
            headers: owner.headers,
            params: { page: 1, limit: 25 },
          })
        ).json(),
      ).data,
    );
    expect(history.items).toHaveLength(1);
    for (const [section, schema] of [
      ["usages", taskCodeUsagePageSchema],
      ["changes", taskCodeAuditPageSchema],
    ] as const) {
      const response = await request.get(
        managementApiUrl + "/admin/task-codes/" + code.id + "/" + section,
        { headers: admin.headers, params: { page: 1, limit: 25 } },
      );
      expect(response.status()).toBe(200);
      expect(
        schema.parse(successEnvelopeSchema.parse(await response.json()).data)
          .pagination.limit,
      ).toBe(25);
    }
    const original = p05StateSchema.parse(
      await scenario.command({
        command: "p05-state",
        email: "employee@p05.test",
      }),
    );
    // Retention time travel must not expire an actively polling browser session.
    await page.goto("about:blank");
    await scenario.command({
      command: "p04-clock",
      instant: "2026-11-05T09:00:00.000Z",
    });
    await scenario.command({ command: "p05-scan" });
    expect(
      p05StateSchema.parse(
        await scenario.command({
          command: "p05-state",
          email: "employee@p05.test",
        }),
      ).assets,
    ).toEqual(original.assets);
    await scenario.command({
      command: "p04-clock",
      instant: "2026-10-05T09:00:00.000Z",
    });
    await page.goto("/admin/submissions");
    const trigger = page
      .getByRole("row")
      .filter({ hasText: "موظف المهام" })
      .getByRole("button", { name: "معاينة", exact: true });
    await expect(trigger).toBeVisible();
    let releasePreview!: () => void;
    const previewGate = new Promise<void>((resolve) => {
      releasePreview = resolve;
    });
    let previewStarted = false;
    const contentEndpoint =
      managementApiUrl + "/proofs/" + second.id + "/content";
    await page.route(contentEndpoint, async (route) => {
      const response = await route.fetch();
      previewStarted = true;
      await previewGate;
      await route.fulfill({ response }).catch(() => {});
    });
    try {
      await trigger.click();
      await expect.poll(() => previewStarted).toBe(true);
      // The image request can start before the dialog's keyboard effect runs.
      await expect(
        page.getByRole("dialog").locator('[tabindex="-1"]'),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } finally {
      releasePreview();
      await page.unrouteAll({ behavior: "wait" });
    }
    await expect(trigger).toBeFocused();
    await employeeSignIn(employee, "employee@p05.test");
    await employee.goto("/employee/tasks");
    await expect(
      employee.getByRole("button", { name: "تحديث لقطة الشاشة المرفقة" }),
    ).toBeVisible();
    let releaseUpload!: () => void;
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    let uploadStarted = false;
    await employee.route(managementApiUrl + "/proofs", async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      uploadStarted = true;
      await uploadGate;
      await route.fulfill({ response }).catch(() => {});
    });
    await employee.locator('input[type="file"]').setInputFiles(file);
    await employee
      .getByRole("button", { name: "تحديث لقطة الشاشة المرفقة" })
      .click();
    await expect.poll(() => uploadStarted).toBe(true);
    await employee.goto("/employee/account");
    await employee
      .getByRole("button", { name: "تسجيل الخروج من الحساب" })
      .click();
    await expect(employee).toHaveURL(/\/employee\/auth\/login/);
    releaseUpload();
    await employee.unrouteAll({ behavior: "wait" });
    await employeeSignIn(employee, "other@p05.test");
    await employee.goto("/employee/tasks");
    await expect(
      employee.getByRole("img", { name: "معاينة لقطة الشاشة المرفوعة" }),
    ).toHaveCount(0);
    expect(
      p05StateSchema.parse(
        await scenario.command({
          command: "p05-state",
          email: "employee@p05.test",
        }),
      ),
    ).toMatchObject({ evidence: 2, rewardPostings: 0, available: "0" });
    await page.goto("/admin/submissions?submission=" + submission.id);
    await expect(preview.getByRole("img")).toBeVisible();
    await preview
      .getByRole("button", { name: "اعتماد وصرف المكافأة", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("textbox").fill("قرار نهائي");
    let releaseReview!: () => void;
    const reviewGate = new Promise<void>((resolve) => {
      releaseReview = resolve;
    });
    let reviewSaved = false;
    await page.route(reviewEndpoint, async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      expect(
        adminSubmissionDetailSchema.parse(
          successEnvelopeSchema.parse(await response.json()).data,
        ).submission.status,
      ).toBe("APPROVED");
      reviewSaved = true;
      await reviewGate;
      await route.fulfill({ response }).catch(() => {});
    });
    await confirm(page, "تأكيد الاعتماد وصرف المكافأة");
    await expect.poll(() => reviewSaved).toBe(true);
    await page.goto("/admin");
    await page
      .getByRole("button", { name: "تسجيل الخروج", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/auth\/login/);
    releaseReview();
    await page.unrouteAll({ behavior: "wait" });
    await managementSignIn(page, "admin2@p03.test");
    await page.goto("/admin/submissions");
    await expect(
      page.getByRole("dialog", { name: "تدقيق تسليم المهمة", exact: true }),
    ).toHaveCount(0);
    expect(
      p05StateSchema.parse(
        await scenario.command({
          command: "p05-state",
          email: "employee@p05.test",
        }),
      ),
    ).toMatchObject({ rewardPostings: 1, available: "2" });
    expect(
      (
        await ownerRequest.patch(evidenceEndpoint, {
          headers: owner.headers,
          data: {
            commandId: crypto.randomUUID(),
            expectedSubmissionVersion: latest.version + 1,
            proofAssetId: first.id,
          },
        })
      ).status(),
    ).toBe(409);
    await page.goto("about:blank");
    await employee.goto("about:blank");
    await scenario.command({
      command: "p04-clock",
      instant: "2026-11-05T09:00:00.000Z",
    });
    await scenario.command({ command: "p05-scan" });
    const retained = p05StateSchema.parse(
      await scenario.command({
        command: "p05-state",
        email: "employee@p05.test",
      }),
    );
    expect(retained.assets.map((asset) => asset.uploadedAt)).toEqual(
      original.assets.map((asset) => asset.uploadedAt),
    );
    expect(retained.assets.every((asset) => asset.state === "DELETED")).toBe(
      true,
    );
    await scenario.command({
      command: "p04-clock",
      instant: "2026-10-05T09:00:00.000Z",
    });
    await page.goto("/admin/submissions?submission=" + submission.id);
    await expect(
      page
        .getByRole("dialog")
        .getByText("حُذفت الصورة بعد مدة الاحتفاظ", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "اعتماد وصرف المكافأة" }),
    ).toHaveCount(0);
  } finally {
    await employeeContext.close();
    await ownerRequest.dispose();
    await foreignRequest.dispose();
  }
});

test("P05 two admins refresh pristine fields and reconcile a dirty draft before confirmation", async ({
  page,
  browser,
  request,
}) => {
  const actor = await managementActor(request);
  const task = await publishedTask(request, actor.headers, "مهمة مسؤولين");
  const endpoint = managementApiUrl + "/admin/tasks/" + task.id;
  const editPath = "/admin/tasks/" + task.id + "/edit";
  await managementSignIn(page);
  await page.goto(editPath);
  await expect(page.getByLabel(/عنوان المهمة/)).toHaveValue(task.title);
  const peerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3103",
  });
  const away = await page.context().newPage();
  try {
    const peer = await peerContext.newPage();
    await managementSignIn(peer, "admin2@p03.test");
    const peerEdit = async (description: string, targetUrl: string) => {
      await away.bringToFront();
      await peer.bringToFront();
      await peer.goto(editPath);
      await expect(peer.getByLabel(/عنوان المهمة/)).toBeEnabled();
      await peer.getByLabel(/وصف المهمة/).fill(description);
      await peer.getByLabel(/الرابط الخارجي/).fill(targetUrl);
      await peer.getByRole("button", { name: "حفظ التعديلات" }).click();
      await confirm(peer);
      await expect(peer).toHaveURL("/admin/tasks/" + task.id);
      const refreshed = page.waitForResponse(
        (response) =>
          response.url() === endpoint &&
          response.request().method() === "GET" &&
          response.status() === 200,
      );
      await page.bringToFront();
      await page.evaluate(() =>
        window.dispatchEvent(new Event("visibilitychange")),
      );
      await refreshed;
    };
    await peerEdit("تعليمات المسؤول الثاني", "https://example.com/peer-1");
    await expect(page.getByLabel(/وصف المهمة/)).toHaveValue(
      "تعليمات المسؤول الثاني",
    );
    await expect(page.getByLabel(/الرابط الخارجي/)).toHaveValue(
      "https://example.com/peer-1",
    );
    await page.getByLabel(/عنوان المهمة/).fill("مسودة المسؤول الأول");
    await peerEdit("تعليمات أحدث للمسؤول الثاني", "https://example.com/peer-2");
    const loadCurrent = page.getByRole("button", {
      name: "تحميل النسخة الحالية",
    });
    await expect(loadCurrent).toBeVisible();
    await expect(page.getByLabel(/عنوان المهمة/)).toHaveValue(
      "مسودة المسؤول الأول",
    );
    await expect(page.getByLabel(/وصف المهمة/)).toHaveValue(
      "تعليمات المسؤول الثاني",
    );
    await page.getByRole("button", { name: "حفظ التعديلات" }).click();
    await expect(
      page.getByRole("dialog", { name: "تأكيد تعديل المهمة" }),
    ).toHaveCount(0);
    const remote = adminTaskDetailSchema.parse(
      successEnvelopeSchema.parse(
        await (await request.get(endpoint, { headers: actor.headers })).json(),
      ).data,
    );
    expect(remote).toMatchObject({
      revision: 3,
      description: "تعليمات أحدث للمسؤول الثاني",
      targetUrl: "https://example.com/peer-2",
      title: task.title,
    });
    await ui(page, "dirty-task-conflict");
    await loadCurrent.click();
    await expect(page.getByLabel(/وصف المهمة/)).toHaveValue(remote.description);
    await expect(page.getByLabel(/الرابط الخارجي/)).toHaveValue(
      remote.targetUrl,
    );
    await page.getByLabel(/عنوان المهمة/).fill("تعديل صريح بعد المراجعة");
    const edited = page.waitForRequest(
      (sent) => sent.url() === endpoint && sent.method() === "PATCH",
    );
    await page.getByRole("button", { name: "حفظ التعديلات" }).click();
    await confirm(page);
    expect(taskEditSchema.parse((await edited).postDataJSON())).toMatchObject({
      expectedTaskRevision: 3,
      description: remote.description,
      targetUrl: remote.targetUrl,
      title: "تعديل صريح بعد المراجعة",
    });
    await expect(page).toHaveURL("/admin/tasks/" + task.id);
    const persisted = adminTaskDetailSchema.parse(
      successEnvelopeSchema.parse(
        await (await request.get(endpoint, { headers: actor.headers })).json(),
      ).data,
    );
    expect(persisted).toMatchObject({
      revision: 4,
      description: remote.description,
      targetUrl: remote.targetUrl,
      title: "تعديل صريح بعد المراجعة",
    });
    await peer.goto(editPath);
    await expect(peer.getByLabel(/عنوان المهمة/)).toHaveValue(persisted.title);
    await expect(peer.getByLabel(/وصف المهمة/)).toHaveValue(
      persisted.description,
    );
  } finally {
    await away.close();
    await peerContext.close();
  }
});

test("P05 dropped edit cancellation and committed lost response retain original identities across reload", async ({
  page,
  request,
}) => {
  const actor = await managementActor(request);
  const created = await request.post(managementApiUrl + "/admin/tasks", {
    headers: actor.headers,
    data: {
      commandId: crypto.randomUUID(),
      confirmed: true,
      title: "مهمة اختبار الاسترداد",
      description: "تعليمات محفوظة",
      platform: "منصة",
      targetUrl: "https://example.com/recovery",
      publicationDate: "2026-10-05",
      publicationState: "PUBLISHED",
      isCodeRequired: false,
      illustrationAssetId: null,
    },
  });
  expect(created.status()).toBe(201);
  const saved = adminTaskDetailSchema.parse(
    successEnvelopeSchema.parse(await created.json()).data,
  );
  const endpoint = managementApiUrl + "/admin/tasks/" + saved.id;
  await managementSignIn(page);
  await page.goto("/admin/tasks/" + saved.id + "/edit");
  let dropped: ReturnType<typeof taskEditSchema.parse> | undefined;
  let sends = 0;
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    sends++;
    dropped = taskEditSchema.parse(route.request().postDataJSON());
    await route.abort("failed");
  });
  await page.getByLabel(/عنوان المهمة/).fill("مسودة غير مرسلة");
  await page.getByRole("button", { name: "حفظ التعديلات" }).click();
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "التحقق من الطلب" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/عنوان المهمة/)).toBeDisabled();
  await page.getByRole("button", { name: "التحقق من الطلب" }).click();
  await expect(
    page.getByRole("button", { name: "إلغاء الطلب غير المؤكد" }),
  ).toBeVisible();
  expect(sends).toBe(1);
  if (!dropped) throw new Error("P05_DROPPED_ID_MISSING");
  const cancellation =
    managementApiUrl + "/task-commands/" + dropped.commandId + "/cancel";
  await page.route(cancellation, async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "إلغاء الطلب غير المؤكد" }).click();
  await expect(
    page.getByRole("button", { name: "التحقق من الطلب" }),
  ).toBeEnabled();
  await page.unroute(cancellation);
  await page.reload();
  await page.getByRole("button", { name: "التحقق من الطلب" }).click();
  await expect(page.getByLabel(/عنوان المهمة/)).toBeEnabled();
  const cancelled = await request.get(
    managementApiUrl + "/task-commands/" + dropped.commandId,
    { headers: actor.headers, params: { kind: "TASK_EDIT" } },
  );
  expect(
    commandObservationSchema.parse(
      successEnvelopeSchema.parse(await cancelled.json()).data,
    ).state,
  ).toBe("CANCELLED");
  const late = await request.patch(endpoint, {
    headers: actor.headers,
    data: dropped,
  });
  expect(late.status()).toBe(409);
  await page.unroute(endpoint);
  let committed: ReturnType<typeof taskEditSchema.parse> | undefined;
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    sends++;
    committed = taskEditSchema.parse(route.request().postDataJSON());
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort("failed");
  });
  await page.getByLabel(/عنوان المهمة/).fill("تعديل محفوظ رغم فقد الرد");
  await page.getByRole("button", { name: "حفظ التعديلات" }).click();
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "إلغاء الطلب غير المؤكد" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "إلغاء الطلب غير المؤكد" }).click();
  await expect(page.getByLabel(/عنوان المهمة/)).toBeEnabled();
  expect(sends).toBe(2);
  if (!committed) throw new Error("P05_COMMITTED_ID_MISSING");
  expect(committed.commandId).not.toBe(dropped.commandId);
  const observed = await request.get(
    managementApiUrl + "/task-commands/" + committed.commandId,
    { headers: actor.headers, params: { kind: "TASK_EDIT" } },
  );
  expect(
    commandObservationSchema.parse(
      successEnvelopeSchema.parse(await observed.json()).data,
    ).state,
  ).toBe("OBSERVED");
  const current = await request.get(endpoint, { headers: actor.headers });
  expect(
    adminTaskDetailSchema.parse(
      successEnvelopeSchema.parse(await current.json()).data,
    ),
  ).toMatchObject({
    title: "تعديل محفوظ رغم فقد الرد",
    revision: saved.revision + 1,
  });
});
