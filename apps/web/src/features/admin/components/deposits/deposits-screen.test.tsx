import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { adminDepositHistoryQuerySchema } from "@template/contracts";
import { safeApiError } from "@/services/api/safe-error";
import { reply } from "@/test/p04-network";
import { cleanupQueries, queryHarness } from "@/test/p04-query";
import {
  emptyAdminDepositHistory,
  recordedAdminDepositHistory,
} from "@/test/p07-deposits";
import { DepositsScreen } from "./deposits-screen";
import { manualCreditTargets, manualCreditOutcome } from "@/test/p07-deposits";
import { deferred } from "@/test/p04-query";

const locks = Object.getOwnPropertyDescriptor(navigator, "locks");
const scrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);
afterEach(() => {
  if (scrollIntoView)
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      scrollIntoView,
    );
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
afterEach(() => {
  localStorage.clear();
  if (locks) Object.defineProperty(navigator, "locks", locks);
  else Reflect.deleteProperty(navigator, "locks");
});
it("reviews real identity and all exact intent, rejects invalid units and guards pending close/double confirm", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _key: string,
        _options: unknown,
        work: (lock: object) => Promise<unknown>,
      ) => work({}),
    },
  });
  const pending = deferred<undefined>();
  let writes = 0;
  const h = queryHarness("ADMIN", (config) => {
    if (config.url === "/admin/employees/manual-credit-targets")
      return reply(config, manualCreditTargets);
    if (config.method === "post") {
      writes++;
      const body: unknown = JSON.parse(String(config.data));
      if (!body || typeof body !== "object" || !("actionId" in body))
        throw new Error("BODY_REQUIRED");
      return pending.promise.then(() => {
        const response = reply(config, {
          ...manualCreditOutcome,
          actionId: body.actionId,
        });
        response.status = 201;
        response.data.statusCode = 201;
        return response;
      });
    }
    return reply(config, emptyAdminDepositHistory);
  });
  render(<DepositsScreen />, { wrapper: h.wrapper });
  const open = await screen.findByRole("button", { name: "إيداع يدوي معتمد" });
  await waitFor(() => {
    expect(open).toBeEnabled();
  });
  fireEvent.click(open);
  const selector = screen.getByRole("combobox", { name: "الموظف المستفيد" });
  await waitFor(() => {
    expect(selector).toBeEnabled();
  });
  fireEvent.keyDown(selector, { key: "Enter" });
  fireEvent.click(
    await screen.findByRole("option", {
      name: "First Credit Employee (first@example.test)",
    }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "المبلغ (USDT)" }), {
    target: { value: "1.0000001" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "المرجع الإداري" }), {
    target: { value: "same-reference" },
  });
  fireEvent.change(
    screen.getByRole("textbox", { name: "سبب الإيداع اليدوي الإلزامي" }),
    { target: { value: "Reviewed adjustment" } },
  );
  const review = screen.getByRole("button", { name: "مراجعة وتأكيد الإيداع" });
  expect(review).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "المبلغ (USDT)" }), {
    target: { value: "1.000001" },
  });
  fireEvent.click(review);
  const dialog = screen.getByRole("dialog", {
    name: "تأكيد إضافة الإيداع اليدوي الاستثنائي",
  });
  expect(within(dialog).getByText("1.000001 USDT")).toBeVisible();
  expect(dialog.textContent).toContain("first@example.test");
  expect(dialog.textContent).toContain("Reviewed adjustment");
  expect(dialog.textContent).toContain("same-reference");
  const confirm = within(dialog).getByRole("button", {
    name: "تأكيد إضافة الرصيد",
  });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() => {
    expect(writes).toBe(1);
  });
  expect(
    within(dialog).getByRole("button", { name: "إغلاق النافذة" }),
  ).toBeDisabled();
  expect(review).toBeDisabled();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(dialog).toBeInTheDocument();
  await act(async () => {
    pending.resolve(undefined);
    await pending.promise;
  });
  expect(
    await screen.findByText("تم تسجيل الإيداع اليدوي المعتمد."),
  ).toBeVisible();
  expect(writes).toBe(1);
});

cleanupQueries();
it("names the initial grant form, contains keyboard focus and restores its opener on dismissal", async () => {
  const h = queryHarness("ADMIN", (config) =>
    reply(
      config,
      config.url === "/admin/employees/manual-credit-targets"
        ? manualCreditTargets
        : emptyAdminDepositHistory,
    ),
  );
  render(<DepositsScreen />, { wrapper: h.wrapper });
  const opener = await screen.findByRole("button", {
    name: "إيداع يدوي معتمد",
  });
  await waitFor(() => expect(opener).toBeEnabled());
  opener.focus();
  fireEvent.click(opener);
  const form = screen.getByRole("dialog", {
    name: "إضافة إيداع يدوي استثنائي معتمد",
  });
  await waitFor(() => expect(form).toHaveFocus());
  const target = within(form).getByRole("combobox", {
    name: "الموظف المستفيد",
  });
  await waitFor(() => expect(target).toBeEnabled());
  const cancel = within(form).getByRole("button", {
    name: "إلغاء",
  });
  fireEvent.keyDown(form, { key: "Tab" });
  expect(target).toHaveFocus();
  fireEvent.keyDown(target, { key: "Tab", shiftKey: true });
  expect(cancel).toHaveFocus();
  fireEvent.keyDown(cancel, { key: "Tab" });
  expect(target).toHaveFocus();
  const search = screen.getByRole("textbox", { name: "بحث في الإيداعات" });
  expect(search.closest("[inert]")).not.toBeNull();
  search.focus();
  expect(form).toHaveFocus();
  fireEvent.keyDown(form, { key: "Escape" });
  expect(form).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(search.closest("[inert]")).toBeNull();
});
const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});
it("renders genuine exact chain/manual history without fixture grant authority and reports copy refusal", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.reject(new Error("SENTINEL")) },
  });
  const h = queryHarness("ADMIN", (config) =>
    reply(config, recordedAdminDepositHistory),
  );
  const view = render(<DepositsScreen />, { wrapper: h.wrapper });
  expect(await screen.findByText("+1.000001 USDT")).toBeVisible();
  expect(screen.getByText("+2.000002 USDT")).toBeVisible();
  expect(screen.getByText(/Verified external adjustment/)).toBeVisible();
  expect(screen.getByText(/Real Admin/)).toBeVisible();
  expect(view.container.querySelectorAll("tbody tr")).toHaveLength(2);
  expect(
    view.container.querySelectorAll("tbody tr")[1]?.textContent,
  ).not.toContain("TRON_NILE");
  fireEvent.click(screen.getByRole("button", { name: /نسخ المعرف/ }));
  expect(await screen.findByText(/تعذر نسخ المعرف/)).toBeVisible();
  expect(screen.queryByText("SENTINEL")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "إيداع يدوي معتمد" }));
  expect(
    screen.getByRole("button", { name: "مراجعة وتأكيد الإيداع" }),
  ).toBeDisabled();
});
it("distinguishes unavailable history from empty and sends server search with page reset", async () => {
  const searches: string[] = [];
  let failed = true;
  const h = queryHarness("ADMIN", (config) => {
    const query = adminDepositHistoryQuerySchema.parse(config.params);
    searches.push(query.q ?? "");
    if (failed) throw safeApiError("transient", "NETWORK_ERROR");
    expect(query.page).toBe(1);
    expect(query.limit).toBe(10);
    return reply(config, emptyAdminDepositHistory);
  });
  render(<DepositsScreen />, { wrapper: h.wrapper });
  await screen.findByRole("alert");
  expect(screen.queryByText("لا توجد إيداعات مطابقة")).not.toBeInTheDocument();
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
  expect(await screen.findByText("لا توجد إيداعات مطابقة")).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "بحث في الإيداعات" }), {
    target: { value: " selected " },
  });
  await waitFor(() => {
    expect(searches).toContain("selected");
  });
});

it("navigates ten-row history pages and removes accepted rows and grant access on current denial", async () => {
  const chain = recordedAdminDepositHistory.items.find(
    (row) => row.kind === "CHAIN_DEPOSIT",
  );
  if (chain === undefined) throw new Error("P07_CHAIN_REQUIRED");
  const rows = Array.from({ length: 12 }, (_, index) => ({
    ...chain,
    operationId: `00000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`,
    logIndex: index,
  }));
  let denied = false;
  const h = queryHarness("ADMIN", (config) => {
    const query = adminDepositHistoryQuerySchema.parse(config.params);
    if (denied) throw safeApiError("denied", "FORBIDDEN", 403);
    return reply(config, {
      ...emptyAdminDepositHistory,
      items: rows.slice((query.page - 1) * 10, query.page * 10),
      pagination: {
        page: query.page,
        limit: 10,
        total: 12,
        totalPages: 2,
        hasNextPage: query.page < 2,
        hasPreviousPage: query.page > 1,
      },
    });
  });
  const view = render(<DepositsScreen />, { wrapper: h.wrapper });
  await waitFor(() => {
    expect(view.container.querySelectorAll("tbody tr")).toHaveLength(10);
  });
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  await waitFor(() => {
    expect(view.container.querySelectorAll("tbody tr")).toHaveLength(2);
  });
  denied = true;
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "revoked" },
  });
  await screen.findByRole("alert");
  expect(view.container.querySelectorAll("tbody tr")).toHaveLength(0);
  expect(
    screen.getByRole("button", { name: "إيداع يدوي معتمد" }),
  ).toBeDisabled();
});
