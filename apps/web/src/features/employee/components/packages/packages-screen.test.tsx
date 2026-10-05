import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { it, expect, vi } from "vitest";
import {
  actorId,
  reply,
  reject,
  catalog,
  membership,
  quote,
  purchase,
  otherId,
  now,
} from "@/test/p04-network";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import { EmployeePackagesScreen } from "./packages-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn() }) }));
cleanupQueries();

const retainOriginal = () => {
  localStorage.setItem(
    `oscar.purchase.v1.${actorId}`,
    JSON.stringify({ version: 1, quoteId: quote.quoteId }),
  );
};
it.each([
  { dailyReward: "3.000001", conditionalGross: "1095.000365" },
  { withdrawalFeeBps: 1000 },
])(
  "review shows updated quote terms despite an older catalog: %j",
  async (edit) => {
    const freshQuote = {
      ...quote,
      terms: { ...quote.terms, version: 2, ...edit },
      canPurchase: true,
      blockReason: null,
      usableFunds: "60",
      fundedAllocation: { referral: "10", nonReferral: "50", total: "60" },
      requiredTopUp: "0",
    };
    let purchases = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/packages") return reply(config, catalog);
      if (config.url === "/subscriptions/me") return reply(config, membership);
      if (config.url === "/subscriptions/purchases") {
        purchases++;
        return reply(
          config,
          {
            purchase: {
              ...purchase,
              subscriptionAtPurchase: {
                ...purchase.subscriptionAtPurchase,
                terms: freshQuote.terms,
              },
            },
            replayed: false,
          },
          201,
        );
      }
      return reply(config, freshQuote, 201);
    });
    render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
    await screen.findByText("منصب S1");
    const select = document.getElementById("upgrade-btn-S1");
    if (!select) throw new Error("Missing purchase control");
    await waitFor(() => {
      expect(select).toBeEnabled();
    });
    fireEvent.click(select);
    const confirm = await screen.findByRole("button", {
      name: "تأكيد الشراء وخصم السعر كاملاً",
    });
    const review = screen.getByRole("dialog");
    expect(review).toHaveTextContent(edit.dailyReward ?? "2.00");
    expect(review).toHaveTextContent(edit.withdrawalFeeBps ? "10%" : "21%");
    expect(review).toHaveTextContent("Asia/Baghdad");
    expect(review).toHaveTextContent("1, 2, 3, 4, 5");
    expect(review).toHaveTextContent("18:00");
    expect(review).toHaveTextContent("365");
    expect(review).toHaveTextContent(freshQuote.preview.firstWorkDate);
    expect(review).toHaveTextContent(freshQuote.preview.finalWorkDate);
    expect(review).toHaveTextContent(freshQuote.preview.expiresAt);
    expect(review).toHaveTextContent(
      edit.conditionalGross ? "1,095.000365" : "730.00",
    );
    expect(purchases).toBe(0);
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(purchases).toBe(1);
    });
  },
);
it.each(["EXPIRED", "REPLACED"] as const)(
  "reconciliation shows the original committed purchase independently of %s membership",
  async (state) => {
    let writes = 0;
    const { stateAtPurchase: _, ...saved } = purchase.subscriptionAtPurchase;
    const h = queryHarness("USER", (config) => {
      if (config.method !== "get") writes++;
      if (config.url === "/packages") return reply(config, catalog);
      if (config.url === "/subscriptions/me")
        return reply(
          config,
          state === "EXPIRED"
            ? {
                ...membership,
                serverNow: saved.expiresAt,
                subscription: { ...saved, state: "EXPIRED" },
              }
            : {
                ...membership,
                effective: "PAID",
                subscription: {
                  ...saved,
                  id: actorId,
                  purchaseId: actorId,
                  state: "CURRENT",
                  terms: {
                    ...saved.terms,
                    code: "S2",
                    tierOrder: 2,
                    price: "120",
                    dailyReward: "4",
                    conditionalGross: "1460",
                  },
                },
              },
        );
      return reply(config, {
        status: "COMMITTED",
        quoteId: quote.quoteId,
        purchase,
        serverNow: state === "EXPIRED" ? saved.expiresAt : now,
      });
    });
    retainOriginal();
    render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "التحقق من نتيجة العملية",
      }),
    );
    const outcome = await screen.findByRole("status", {
      name: "نتيجة العملية الأصلية",
    });
    expect(outcome).toHaveTextContent("تم تسجيل عملية الشراء الأصلية");
    expect(outcome).toHaveTextContent(purchase.purchaseId);
    expect(outcome).toHaveTextContent(purchase.quoteId);
    expect(outcome).toHaveTextContent(purchase.purchasedAt);
    expect(outcome).toHaveTextContent("60.00");
    expect(outcome).toHaveTextContent("S1");
    expect(outcome).toHaveTextContent("365");
    expect(outcome).toHaveTextContent("21%");
    expect(outcome).toHaveTextContent("Asia/Baghdad");
    expect(outcome).toHaveTextContent(saved.firstWorkDate);
    expect(outcome).toHaveTextContent(saved.finalWorkDate);
    expect(outcome).toHaveTextContent(saved.expiresAt);
    expect(outcome).toHaveTextContent(
      "هذه نتيجة العملية الأصلية وليست حالة العضوية الحالية",
    );
    expect(localStorage.getItem(`oscar.purchase.v1.${actorId}`)).toBeNull();
    expect(screen.queryByText("توجد عملية شراء لم تتأكد نتيجتها.")).toBeNull();
    expect(writes).toBe(0);
    if (state === "REPLACED") {
      const current = screen
        .getAllByLabelText("شروط الاشتراك المحفوظة")
        .find((element) => !outcome.contains(element));
      expect(current).toHaveTextContent("S2");
      expect(current).toHaveTextContent("120.00");
    } else expect(screen.queryByText("المنصب الحالي")).toBeNull();
  },
);

it("explains expired uncommitted recovery without dispatching a replacement purchase", async () => {
  let writes = 0;
  const h = queryHarness("USER", (config) => {
    if (config.method !== "get") writes++;
    return reply(
      config,
      config.url === "/packages"
        ? catalog
        : config.url === "/subscriptions/me"
          ? membership
          : {
              status: "EXPIRED_UNCOMMITTED",
              quoteId: quote.quoteId,
              quote,
              serverNow: quote.quoteExpiresAt,
            },
    );
  });
  retainOriginal();
  render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
  fireEvent.click(
    await screen.findByRole("button", {
      name: "التحقق من نتيجة العملية",
    }),
  );
  const outcome = await screen.findByRole("status", {
    name: "نتيجة العملية الأصلية",
  });
  expect(outcome).toHaveTextContent(
    "انتهت صلاحية عرض الشراء الأصلي دون تسجيل شراء أو خصم",
  );
  expect(outcome).toHaveTextContent(quote.quoteId);
  expect(localStorage.getItem(`oscar.purchase.v1.${actorId}`)).toBeNull();
  expect(writes).toBe(0);
});

it.each(["live", "failed"])(
  "%s observation keeps uncertainty and the original handle",
  async (mode) => {
    const h = queryHarness("USER", (config) => {
      if (config.url === "/packages") return reply(config, catalog);
      if (config.url === "/subscriptions/me") return reply(config, membership);
      if (mode === "failed") return reject(config, "SERVICE_UNAVAILABLE", 503);
      return reply(config, {
        status: "NOT_OBSERVED",
        quoteId: quote.quoteId,
        quote,
        serverNow: now,
      });
    });
    retainOriginal();
    render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "التحقق من نتيجة العملية",
      }),
    );
    if (mode === "failed")
      await screen.findByText("تعذر التحقق. تظل العملية الأصلية غير محسومة.");
    else
      await screen.findByRole("button", {
        name: "مراجعة العملية الأصلية",
      });
    expect(screen.getByText("توجد عملية شراء لم تتأكد نتيجتها.")).toBeVisible();
    expect(
      screen.queryByRole("status", { name: "نتيجة العملية الأصلية" }),
    ).toBeNull();
    expect(localStorage.getItem(`oscar.purchase.v1.${actorId}`)).not.toBeNull();
  },
);

it.each(["account", "check"])(
  "an obsolete %s completion cannot show the original result",
  async (change) => {
    const pending = deferred<undefined>();
    let reads = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/packages") return reply(config, catalog);
      if (config.url === "/subscriptions/me") return reply(config, membership);
      reads++;
      return pending.promise.then(() =>
        reply(config, {
          status: "COMMITTED",
          quoteId: quote.quoteId,
          purchase,
          serverNow: now,
        }),
      );
    });
    retainOriginal();
    render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "التحقق من نتيجة العملية",
      }),
    );
    await waitFor(() => {
      expect(reads).toBe(1);
    });
    await act(async () => {
      if (change === "account") {
        h.runtime.retire();
        h.runtime.admitIdentity(h.runtime.scope(), {
          id: otherId,
          role: "USER",
        });
      } else h.runtime.beginCheck();
      pending.resolve(undefined);
      await pending.promise;
    });
    await screen.findByText("تعذر التحقق. تظل العملية الأصلية غير محسومة.");
    expect(
      screen.queryByRole("status", { name: "نتيجة العملية الأصلية" }),
    ).toBeNull();
    expect(screen.queryByText(purchase.purchaseId)).toBeNull();
    expect(localStorage.getItem(`oscar.purchase.v1.${actorId}`)).not.toBeNull();
  },
);
it("catalog edits leave the active subscription's accepted terms and dates visible", async () => {
  const { stateAtPurchase: _, ...saved } = purchase.subscriptionAtPurchase;
  const h = queryHarness("USER", (config) =>
    reply(
      config,
      config.url === "/packages"
        ? {
            ...catalog,
            items: catalog.items.map((terms) =>
              terms.code === "S1"
                ? {
                    ...terms,
                    version: 2,
                    price: "61.000001",
                    dailyReward: "3",
                    countedWorkDates: 2,
                    conditionalGross: "6",
                    withdrawalFeeBps: 1000,
                  }
                : terms,
            ),
          }
        : {
            ...membership,
            effective: "PAID",
            subscription: { ...saved, state: "CURRENT" },
          },
    ),
  );
  render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
  const accepted = await screen.findByLabelText("شروط الاشتراك المحفوظة");
  expect(accepted).toHaveTextContent("60.00");
  expect(accepted).toHaveTextContent("2.00");
  expect(accepted).toHaveTextContent("365");
  expect(accepted).toHaveTextContent("21%");
  expect(accepted).toHaveTextContent("Asia/Baghdad");
  expect(accepted).toHaveTextContent("18:00");
  expect(accepted).toHaveTextContent(saved.firstWorkDate);
  expect(accepted).toHaveTextContent(saved.finalWorkDate);
  expect(accepted).toHaveTextContent(saved.expiresAt);
  expect(accepted).toHaveTextContent("قبل تكلفة الباقة ورسوم السحب");
  expect(within(accepted).queryByText("61.000001")).toBeNull();
  expect(screen.getByText("61.000001")).toBeVisible();
  expect(screen.getAllByText(/شروط الكتالوج الحالية/u)).toHaveLength(5);
});
it("an unreadable recovery handle blocks a new quote as well as a purchase", async () => {
  let writes = 0;
  const h = queryHarness("USER", (config) => {
    if (config.url === "/packages") return reply(config, catalog);
    if (config.url === "/subscriptions/me") return reply(config, membership);
    writes++;
    return reply(config, quote, 201);
  });
  localStorage.setItem(`oscar.purchase.v1.${actorId}`, "unreadable");
  render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
  await screen.findByRole("alert");
  await screen.findByText("منصب S1");
  const button = document.getElementById("upgrade-btn-S1");
  if (!button) throw new Error("Missing purchase control");
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(writes).toBe(0);
});
it("quotes only an explicit selection and shows the full shortfall without a fixture purchase", async () => {
  let quotes = 0;
  const h = queryHarness("USER", (config) => {
    if (config.url === "/packages") return reply(config, catalog);
    if (config.url === "/subscriptions/me") return reply(config, membership);
    quotes++;
    return reply(config, quote, 201);
  });
  render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
  await screen.findByText("منصب S1");
  expect(quotes).toBe(0);
  await waitFor(() => {
    expect(document.getElementById("upgrade-btn-S1")).not.toBeDisabled();
  });
  const upgrade = document.getElementById("upgrade-btn-S1");
  if (!upgrade) throw new Error("Missing purchase control");
  fireEvent.click(upgrade);
  await screen.findByText("إجمالي المبلغ المخصوم:");
  expect(screen.getByRole("dialog")).toHaveTextContent("60.00");
  expect(screen.getByRole("dialog")).toHaveTextContent("20.00");
  expect(
    screen.queryByRole("button", { name: "تأكيد الشراء وخصم السعر كاملاً" }),
  ).toBeNull();
  expect(quotes).toBe(1);
});
it("a malformed catalog never creates selectable fixture positions", async () => {
  const h = queryHarness("USER", (config) =>
    reply(config, config.url === "/packages" ? { items: [] } : membership),
  );
  render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
  await screen.findByRole("alert");
  expect(screen.queryByText("منصب S1")).toBeNull();
});

it.each(["PURCHASE_TRANSITION_DENIED", "PURCHASE_QUOTE_STALE", "FORBIDDEN"])(
  "a rejected %s quote cannot become fixture purchase authority",
  async (code) => {
    let purchases = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/packages") return reply(config, catalog);
      if (config.url === "/subscriptions/me") return reply(config, membership);
      if (config.url === "/subscriptions/purchases") purchases++;
      return reject(config, code, code === "FORBIDDEN" ? 403 : 409);
    });
    render(<EmployeePackagesScreen />, { wrapper: h.wrapper });
    await screen.findByText("منصب S1");
    const button = document.getElementById("upgrade-btn-S1");
    if (!button) throw new Error("Missing purchase control");
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
    fireEvent.click(button);
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "تأكيد الشراء وخصم السعر كاملاً" }),
    ).toBeNull();
    expect(purchases).toBe(0);
  },
);
