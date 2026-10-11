import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { focusManager } from "@tanstack/react-query";
import {
  withdrawalRequestSchema,
  type WithdrawalRequest,
} from "@template/contracts";
import { safeApiError } from "@/services/api/safe-error";
import { reply, wallet } from "@/test/p04-network";
import { cleanupQueries, deferred, queryHarness } from "@/test/p04-query";
import { withdrawal, withdrawalStatus } from "@/test/p09-withdrawals";
import { withdrawalInstant } from "../../utils/withdrawal-presentation";
import { WithdrawalStatusCard } from "./withdrawal-status-card";
import { WithdrawalForm } from "./withdrawal-form";

cleanupQueries();
afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});
function pageOf(
  requests: WithdrawalRequest[],
  page = 1,
  total = requests.length,
) {
  return {
    items: requests,
    pagination: {
      page,
      limit: 25,
      total,
      totalPages: Math.ceil(total / 25),
      hasNextPage: page < Math.ceil(total / 25),
      hasPreviousPage: page > 1,
    },
  };
}
function released(state: "REJECTED" | "CANCELLED" | "FAILED") {
  return withdrawalRequestSchema.parse({
    ...withdrawal,
    state,
    finalizedAt: withdrawal.serverNow,
    release: {
      gross: withdrawal.gross,
      sourceAllocation: withdrawal.sourceAllocation,
      chargedFee: "0",
      releasedAt: withdrawal.serverNow,
    },
  });
}
describe("persisted withdrawal status and history", () => {
  it("keeps uncertain funds visible on exhaustion and restarts only on explicit refresh", async () => {
    const saved = withdrawalRequestSchema.parse({
      ...withdrawal,
      state: "UNKNOWN",
    });
    let reads = 0;
    const h = queryHarness("USER", (config) => {
      reads++;
      return reply(
        config,
        config.url === "/withdrawals/me"
          ? { ...withdrawalStatus, activeWithdrawal: saved }
          : pageOf([saved]),
      );
    });
    render(<WithdrawalStatusCard />, { wrapper: h.wrapper });
    await screen.findByRole("region", { name: "طلب السحب النشط" });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "تحديث حالة السحب" }));
    fireEvent.click(screen.getByRole("button", { name: "تحديث سجل السحب" }));
    for (let cycle = 0; cycle < 24; cycle++)
      await act(async () => {
        vi.advanceTimersByTime(60_001);
        await Promise.resolve();
      });
    expect(
      screen.getAllByText(/توقفت المتابعة التلقائية/u).length,
    ).toBeGreaterThan(0);
    const exhausted = reads;
    await act(async () => {
      vi.advanceTimersByTime(600_000);
      await Promise.resolve();
    });
    expect(reads).toBe(exhausted);
    const active = screen.getByRole("region", { name: "طلب السحب النشط" });
    expect(active).toHaveTextContent("نتيجة الدفع غير مؤكدة");
    expect(active).toHaveTextContent("يبقى المبلغ محجوزاً");
    fireEvent.click(screen.getByRole("button", { name: "تحديث حالة السحب" }));
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(reads).toBe(exhausted + 1);
  });
  it("separates malformed history from empty and restores bounded navigation after refresh", async () => {
    let malformed = true;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/withdrawals/me")
        return reply(config, withdrawalStatus);
      const page = Number(Reflect.get(config.params as object, "page"));
      if (malformed) return reply(config, { items: [], pagination: {} });
      return reply(
        config,
        pageOf(
          page === 1
            ? Array.from({ length: 25 }, (_, index) => ({
                ...released("FAILED"),
                id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
              }))
            : [],
          page,
          25,
        ),
      );
    });
    render(<WithdrawalStatusCard />, { wrapper: h.wrapper });
    await screen.findByText(
      "تعذر التحقق من بيانات السحب. حدّث البيانات للمحاولة مجدداً.",
    );
    expect(
      screen.queryByText("لا توجد طلبات سحب مسجلة."),
    ).not.toBeInTheDocument();
    malformed = false;
    fireEvent.click(screen.getByRole("button", { name: "تحديث سجل السحب" }));
    await screen.findByText(/الصفحة 1 من 1/u);
    expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
  });
  it.each([
    ["SCHEDULED", "مجدول للدفع التلقائي"],
    ["SIGNING", "جارٍ تجهيز التوقيع"],
    ["SIGNED", "تم التوقيع"],
    ["SUBMITTED", "أُرسل وبانتظار التأكيد"],
    ["UNKNOWN", "نتيجة الدفع غير مؤكدة"],
  ] as const)(
    "keeps %s reserved and blocks creation even at zero counted time",
    async (state, label) => {
      const saved = withdrawalRequestSchema.parse({
        ...withdrawal,
        state,
        remainingCountedHours: "0",
        remainingCountedMilliseconds: "0",
      });
      const h = queryHarness("USER", (config) =>
        reply(
          config,
          config.url === "/wallet/me"
            ? wallet
            : config.url === "/withdrawals/me"
              ? { ...withdrawalStatus, activeWithdrawal: saved }
              : config.url === "/withdrawals/me/destination"
                ? withdrawalStatus.destination
                : pageOf([saved]),
        ),
      );
      render(
        <>
          <WithdrawalForm />
          <WithdrawalStatusCard />
        </>,
        { wrapper: h.wrapper },
      );
      const active = await screen.findByRole("region", {
        name: "طلب السحب النشط",
      });
      expect(active).toHaveTextContent(label);
      expect(active).toHaveTextContent("يبقى المبلغ محجوزاً");
      expect(active).toHaveTextContent("صفر لا يعني اكتمال الدفع");
      expect(
        screen.queryByRole("button", { name: "متابعة تأكيد طلب السحب" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText("لديك طلب سحب قيد المعالجة", { exact: true }),
      ).toBeInTheDocument();
    },
  );
  it.each(["REJECTED", "CANCELLED", "FAILED"] as const)(
    "shows %s original-source release and zero charged fee without a cooldown",
    async (state) => {
      const saved = released(state);
      const h = queryHarness("USER", (config) =>
        reply(
          config,
          config.url === "/withdrawals/me" ? withdrawalStatus : pageOf([saved]),
        ),
      );
      render(<WithdrawalStatusCard />, { wrapper: h.wrapper });
      const history = await screen.findByRole("region", {
        name: "سجل طلبات السحب",
      });
      await within(history).findByText(
        "أُعيد المبلغ إلى مصادره الأصلية؛ رسوم محصلة: 0 USDT.",
      );
      fireEvent.click(within(history).getByText("تفاصيل الطلب"));
      expect(history).toHaveTextContent("100.00");
      expect(history).toHaveTextContent(
        "لا توجد مهلة 24 ساعة؛ الطلب الجديد يخضع للأهلية الحالية.",
      );
      expect(
        screen.queryByRole("region", { name: "طلب السحب النشط" }),
      ).not.toBeInTheDocument();
    },
  );
  it("discloses confirmed settlement, saved recipient/sources and server action audit", async () => {
    const transactionId = "a".repeat(64);
    const saved = withdrawalRequestSchema.parse({
      ...withdrawal,
      state: "COMPLETED",
      finalizedAt: withdrawal.serverNow,
      transactionId,
      settlement: {
        withdrawalId: withdrawal.id,
        attemptId: withdrawal.quoteId,
        network: withdrawal.network,
        tokenContract: withdrawal.recipient,
        source: withdrawal.recipient,
        recipient: withdrawal.recipient,
        addressVersion: 1,
        gross: "100",
        feeBps: 2100,
        fee: "21",
        net: "79",
        sourceAllocation: withdrawal.sourceAllocation,
        transactionId,
        blockId: "b".repeat(64),
        blockNumber: "123",
      },
      actions: [
        {
          id: withdrawal.quoteId,
          kind: "COMPLETE",
          occurredAt: withdrawal.serverNow,
          actorUserId: null,
          reason: "Verified final receipt",
          committedVersion: 2,
          dueAt: withdrawal.dueAt,
          scheduleVersion: 1,
        },
      ],
    });
    const h = queryHarness("USER", (config) =>
      reply(
        config,
        config.url === "/withdrawals/me" ? withdrawalStatus : pageOf([saved]),
      ),
    );
    render(<WithdrawalStatusCard />, { wrapper: h.wrapper });
    await screen.findByText("تم تأكيد دفع الصافي وتسوية الرسوم.");
    fireEvent.click(screen.getByText("تفاصيل الطلب"));
    const history = screen.getByRole("region", { name: "سجل طلبات السحب" });
    for (const fact of [
      "79.00",
      "21.00",
      transactionId,
      saved.recipient,
      "TRON_NILE",
      "Verified final receipt",
      "النظام",
      withdrawalInstant(saved.originalDueAt),
    ])
      expect(history).toHaveTextContent(fact);
  });
  it("shows revised counted schedule, blockers and immutable detail without local clock arithmetic", async () => {
    const saved = withdrawalRequestSchema.parse({
      ...withdrawal,
      version: 2,
      scheduleVersion: 2,
      dueAt: "2026-10-09T09:30:00.000Z",
      dispatchAt: "2026-10-09T09:30:00.000Z",
      remainingCountedHours: "96.5",
      remainingCountedMilliseconds: "347400000",
      blocker: "DISPATCH_PAUSED",
      actions: [
        {
          id: withdrawal.quoteId,
          kind: "EXTEND",
          occurredAt: withdrawal.serverNow,
          actorUserId: withdrawal.quoteId,
          reason: "Reviewed extension",
          committedVersion: 2,
          dueAt: "2026-10-09T09:30:00.000Z",
          scheduleVersion: 2,
        },
      ],
    });
    const h = queryHarness("USER", (config) =>
      reply(
        config,
        config.url === "/withdrawals/me"
          ? { ...withdrawalStatus, activeWithdrawal: saved }
          : pageOf([]),
      ),
    );
    render(<WithdrawalStatusCard />, { wrapper: h.wrapper });
    const active = await screen.findByRole("region", {
      name: "طلب السحب النشط",
    });
    expect(active).toHaveTextContent("96.5");
    expect(active).toHaveTextContent("الإرسال متوقف مؤقتاً");
    fireEvent.click(within(active).getByText("تفاصيل الطلب"));
    for (const fact of [
      withdrawalInstant(saved.originalDueAt),
      withdrawalInstant(saved.dueAt),
      saved.recipient,
      "21%",
      "Reviewed extension",
      withdrawal.quoteId,
      "347400000",
    ])
      expect(active).toHaveTextContent(fact);
  });
  it("navigates employee25 history, hides previous-page rows and distinguishes failure from empty with a way back", async () => {
    const gate = deferred<undefined>();
    let fail = false;
    const h = queryHarness("USER", async (config) => {
      if (config.url === "/withdrawals/me")
        return reply(config, withdrawalStatus);
      const page = Number(Reflect.get(config.params as object, "page"));
      expect(Reflect.get(config.params as object, "limit")).toBe(25);
      if (page === 2) {
        await gate.promise;
        if (fail) throw safeApiError("transient", "NETWORK_ERROR");
      }
      return reply(
        config,
        pageOf(
          page === 1
            ? Array.from({ length: 25 }, (_, index) => ({
                ...released("REJECTED"),
                id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
              }))
            : [released("REJECTED")],
          page,
          26,
        ),
      );
    });
    render(<WithdrawalStatusCard />, { wrapper: h.wrapper });
    await screen.findByText(/الصفحة 1 من 2/u);
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.queryByText("تفاصيل الطلب")).not.toBeInTheDocument();
    fail = true;
    act(() => {
      gate.resolve(undefined);
    });
    await screen.findByText("تعذر تحميل سجل السحب. أعد المحاولة.");
    expect(
      screen.queryByText("لا توجد طلبات سحب مسجلة."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "العودة لأول صفحة" }));
    await screen.findByText(/الصفحة 1 من 2/u);
  });
  it("renders empty only from a successful history read and never exposes data after denial", async () => {
    let deny = false;
    const h = queryHarness("USER", (config) => {
      if (deny) throw safeApiError("denied", "FORBIDDEN", 403);
      return reply(
        config,
        config.url === "/withdrawals/me" ? withdrawalStatus : pageOf([]),
      );
    });
    render(<WithdrawalStatusCard />, { wrapper: h.wrapper });
    await screen.findByText("لا توجد طلبات سحب مسجلة.");
    deny = true;
    fireEvent.click(screen.getByRole("button", { name: "تحديث سجل السحب" }));
    await waitFor(() =>
      expect(
        screen.queryByText("لا توجد طلبات سحب مسجلة."),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(withdrawal.recipient)).not.toBeInTheDocument();
  });
});
