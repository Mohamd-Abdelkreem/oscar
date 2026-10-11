import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { safeApiError } from "@/services/api/safe-error";
import { reply, wallet, reject } from "@/test/p04-network";
import { cleanupQueries, queryHarness, deferred } from "@/test/p04-query";
import {
  withdrawal,
  withdrawalQuote,
  withdrawalStatus,
} from "@/test/p09-withdrawals";
import { EmployeeStateProvider } from "../../context/employee-state.context";
import { normalizeWithdrawalAmount } from "../../utils/withdrawal-presentation";
import { WithdrawalForm } from "./withdrawal-form";

cleanupQueries();
describe("withdrawal review", () => {
  it("keeps the amount and refreshes the restriction after a strict blocked first dispatch", async () => {
    let blocked = false,
      sends = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/wallet/me") return reply(config, wallet);
      if (config.url === "/withdrawals/me")
        return reply(config, {
          ...withdrawalStatus,
          withdrawalsBlocked: blocked,
        });
      if (config.url === "/withdrawals/me/destination")
        return reply(config, withdrawalStatus.destination);
      if (config.url === "/withdrawals/quotes")
        return reply(config, withdrawalQuote, 201);
      sends++;
      blocked = true;
      reject(config, "WITHDRAWAL_BLOCKED", 403);
    });
    render(<WithdrawalForm />, { wrapper: h.wrapper });
    fireEvent.click(
      await screen.findByRole("button", { name: "متابعة تأكيد طلب السحب" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "تأكيد طلب السحب وحجز الرصيد",
      }),
    );
    await screen.findByText("السحب مقيد لهذا الحساب.");
    expect(screen.getByLabelText("المبلغ المطلوب سحبه (USDT)")).toHaveValue(
      "100",
    );
    expect(
      screen.getByRole("button", { name: "متابعة تأكيد طلب السحب" }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/نتيجة الطلب غير مؤكدة/u),
    ).not.toBeInTheDocument();
    expect(sends).toBe(1);
  });
  it.each(["typed", "preset"])(
    "hides obsolete terms after a dismissed quote and %s edit",
    async (edit) => {
      let quotes = 0,
        sends = 0;
      const h = queryHarness("USER", (config) => {
        if (config.url === "/wallet/me") return reply(config, wallet);
        if (config.url === "/withdrawals/me")
          return reply(config, withdrawalStatus);
        if (config.url === "/withdrawals/quotes") {
          quotes++;
          return reply(
            config,
            quotes === 1
              ? withdrawalQuote
              : {
                  ...withdrawalQuote,
                  gross: "200",
                  fee: "42",
                  net: "158",
                  eligibleNonReferral: "200",
                  fundedAllocation: {
                    nonReferral: "200",
                    referral: "0",
                    total: "200",
                  },
                },
            201,
          );
        }
        if (config.method === "post" && config.url === "/withdrawals") sends++;
        return reply(config, { withdrawal, replayed: false }, 201);
      });
      render(<WithdrawalForm />, { wrapper: h.wrapper });
      const review = await screen.findByRole("button", {
        name: "متابعة تأكيد طلب السحب",
      });
      fireEvent.click(review);
      await screen.findByRole("dialog");
      fireEvent.keyDown(window, { key: "Escape" });
      if (edit === "typed")
        fireEvent.change(screen.getByLabelText("المبلغ المطلوب سحبه (USDT)"), {
          target: { value: "200" },
        });
      else fireEvent.click(screen.getByRole("button", { name: "200" }));
      expect(screen.queryByText("79.00")).not.toBeInTheDocument();
      expect(screen.queryByText("21.00")).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(quotes).toBe(1);
      expect(sends).toBe(0);
      fireEvent.click(review);
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("158.00");
      expect(
        within(dialog).getByRole("button", {
          name: "تأكيد طلب السحب وحجز الرصيد",
        }),
      ).toBeEnabled();
      expect(quotes).toBe(2);
      expect(sends).toBe(0);
    },
  );
  it("returns focus to review after an asynchronous quote disables the trigger and the sheet closes", async () => {
    const quoteReady = deferred<undefined>();
    const h = queryHarness("USER", async (config) => {
      if (config.url === "/wallet/me") return reply(config, wallet);
      if (config.url === "/withdrawals/me")
        return reply(config, withdrawalStatus);
      await quoteReady.promise;
      return reply(config, withdrawalQuote, 201);
    });
    render(<WithdrawalForm />, { wrapper: h.wrapper });
    const review = await screen.findByRole("button", {
      name: "متابعة تأكيد طلب السحب",
    });
    await waitFor(() => {
      expect(review).toBeEnabled();
    });
    review.focus();
    fireEvent.click(review);
    await waitFor(() => {
      expect(review).toBeDisabled();
    });
    act(() => {
      quoteReady.resolve(undefined);
    });
    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(review).toHaveFocus();
    });
    expect(screen.getByLabelText("المبلغ المطلوب سحبه (USDT)")).toHaveValue(
      "100",
    );
  });
  it.each([
    ["16", "3.36", "12.64", 2100, "21%"],
    ["500", "105", "395", 2100, "21%"],
    ["100", "12.55", "87.45", 1255, "12.55%"],
  ])(
    "reviews inclusive server amount %s and its saved rate",
    async (gross, fee, net, feeBps, rate) => {
      const h = queryHarness("USER", (config) => {
        if (config.url === "/wallet/me") return reply(config, wallet);
        if (config.url === "/withdrawals/me")
          return reply(config, withdrawalStatus);
        return reply(
          config,
          {
            ...withdrawalQuote,
            gross,
            fee,
            net,
            feeBps,
            eligibleNonReferral: gross,
            fundedAllocation: {
              nonReferral: gross,
              referral: "0",
              total: gross,
            },
          },
          201,
        );
      });
      render(
        <EmployeeStateProvider>
          <WithdrawalForm />
        </EmployeeStateProvider>,
        { wrapper: h.wrapper },
      );
      const review = await screen.findByRole("button", {
        name: "متابعة تأكيد طلب السحب",
      });
      fireEvent.change(screen.getByLabelText("المبلغ المطلوب سحبه (USDT)"), {
        target: { value: gross },
      });
      fireEvent.click(review);
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent(rate);
      expect(dialog).toHaveTextContent(net);
      expect(
        screen.getByRole("button", { name: "تأكيد طلب السحب وحجز الرصيد" }),
      ).toBeEnabled();
    },
  );
  it.each([
    ["0016.000000", "16"],
    ["500.000001", "500.000001"],
    ["16.000001", "16.000001"],
    ["1e2", null],
    ["16.0000001", null],
    ["-16", null],
    ["1,000", null],
    ["0", null],
  ])("normalizes exact decimal text %s", (input, expected) => {
    expect(normalizeWithdrawalAmount(input)).toBe(expected);
  });
  it("reviews exact server terms, guards pending confirmation and never edits money optimistically", async () => {
    const pending = deferred<undefined>();
    let sends = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/wallet/me") return reply(config, wallet);
      if (config.url === "/withdrawals/me")
        return reply(config, withdrawalStatus);
      if (config.url === "/withdrawals/quotes")
        return reply(config, withdrawalQuote, 201);
      sends++;
      return pending.promise.then(() =>
        reply(config, { withdrawal, replayed: false }, 201),
      );
    });
    render(
      <EmployeeStateProvider>
        <WithdrawalForm />
      </EmployeeStateProvider>,
      { wrapper: h.wrapper },
    );
    const review = await screen.findByRole("button", {
      name: "متابعة تأكيد طلب السحب",
    });
    fireEvent.change(screen.getByLabelText("المبلغ المطلوب سحبه (USDT)"), {
      target: { value: "00100.000000" },
    });
    fireEvent.click(review);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("21%");
    expect(dialog).toHaveTextContent("79.00");
    expect(dialog).toHaveTextContent(withdrawal.recipient);
    const confirm = screen.getByRole("button", {
      name: "تأكيد طلب السحب وحجز الرصيد",
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(sends).toBe(1);
    });
    expect(h.client.getQueryData(["p04", "wallet"])).toBeUndefined();
    act(() => {
      pending.resolve(undefined);
    });
    await screen.findByText("تم حجز المبلغ وجدولة السحب تلقائياً.");
  });
  it("preserves dirty amount after definite stale rejection and requires fresh explicit review", async () => {
    let quotes = 0,
      sends = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/wallet/me") return reply(config, wallet);
      if (config.url === "/withdrawals/me")
        return reply(config, withdrawalStatus);
      if (config.url === "/withdrawals/me/destination")
        return reply(config, withdrawalStatus.destination);
      if (config.url === "/withdrawals/quotes") {
        quotes++;
        return reply(config, withdrawalQuote, 201);
      }
      if (config.method !== "post" || config.url !== "/withdrawals")
        throw new Error("UNEXPECTED_REQUEST");
      sends++;
      throw safeApiError("request", "WITHDRAWAL_QUOTE_STALE", 409);
    });
    render(
      <EmployeeStateProvider>
        <WithdrawalForm />
      </EmployeeStateProvider>,
      { wrapper: h.wrapper },
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "متابعة تأكيد طلب السحب" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "تأكيد طلب السحب وحجز الرصيد",
      }),
    );
    await screen.findByText("تغيرت شروط الطلب. راجع عرضاً جديداً قبل التأكيد.");
    expect(screen.getByLabelText("المبلغ المطلوب سحبه (USDT)")).toHaveValue(
      "100",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "متابعة تأكيد طلب السحب" }),
    );
    await screen.findByRole("dialog");
    expect(quotes).toBe(2);
    expect(sends).toBe(1);
  });
  it.each(["SCHEDULED", "SIGNING", "SIGNED", "SUBMITTED", "UNKNOWN"] as const)(
    "blocks new review for active %s",
    async (state) => {
      const h = queryHarness("USER", (config) =>
        reply(config, {
          ...withdrawalStatus,
          activeWithdrawal: { ...withdrawal, state },
        }),
      );
      render(
        <EmployeeStateProvider>
          <WithdrawalForm />
        </EmployeeStateProvider>,
        { wrapper: h.wrapper },
      );
      await screen.findByText("لديك طلب سحب قيد المعالجة");
      expect(
        screen.queryByRole("button", { name: "متابعة تأكيد طلب السحب" }),
      ).not.toBeInTheDocument();
    },
  );
  it("rejects unsupported precision and disables first writes when readiness is unavailable", async () => {
    let ready = true,
      sends = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") sends++;
      return reply(config, {
        ...withdrawalStatus,
        withdrawalExecutionReady: ready,
      });
    });
    render(
      <EmployeeStateProvider>
        <WithdrawalForm />
      </EmployeeStateProvider>,
      { wrapper: h.wrapper },
    );
    const review = await screen.findByRole("button", {
      name: "متابعة تأكيد طلب السحب",
    });
    fireEvent.change(screen.getByLabelText("المبلغ المطلوب سحبه (USDT)"), {
      target: { value: "100.0000001" },
    });
    expect(review).toBeDisabled();
    expect(sends).toBe(0);
    ready = false;
    fireEvent.click(screen.getByRole("button", { name: "تحديث" }));
    await screen.findByText("استقبال طلبات السحب غير متاح حالياً.");
    expect(review).toBeDisabled();
  });
});
