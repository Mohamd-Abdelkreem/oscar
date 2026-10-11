import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupQueries, queryHarness } from "@/test/p04-query";
import { actorId, reply, pagination, reject } from "@/test/p04-network";
import { withdrawal } from "@/test/p09-withdrawals";
import { WithdrawalsScreen } from "./withdrawals-screen";

cleanupQueries();
afterEach(() => {
  vi.useRealTimers();
});
const row = {
  ...withdrawal,
  employee: {
    id: actorId,
    fullName: "Current Employee",
    email: "current@example.test",
  },
  canExtend: true,
  canReject: true,
};
describe("US4 scheduled administration", () => {
  it("retains known rows with read-error feedback and blocks commands until explicit refresh succeeds", async () => {
    let failed = false;
    const h = queryHarness("ADMIN", (config) => {
      if (failed) reject(config, "SERVICE_UNAVAILABLE", 503);
      return reply(config, {
        items: [row],
        pagination: { ...pagination, limit: 10, total: 1, totalPages: 1 },
      });
    });
    render(<WithdrawalsScreen />, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "رفض" })).toBeEnabled();
    });
    failed = true;
    fireEvent.click(screen.getByRole("button", { name: "تحديث طلبات السحب" }));
    await screen.findByText(
      "الخدمة غير متاحة مؤقتاً. تحقق من الاتصال وحاول لاحقاً.",
    );
    expect(screen.getByText("Current Employee")).toBeVisible();
    expect(screen.getByRole("button", { name: "رفض" })).toBeDisabled();
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "تحديث طلبات السحب" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "رفض" })).toBeEnabled();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("shows exhausted last-known rows after revalidation and requires refresh before commands", async () => {
    let reads = 0,
      sends = 0;
    const h = queryHarness("ADMIN", (config) => {
      if (config.method === "post") sends++;
      reads++;
      return reply(config, {
        items: [row],
        pagination: { ...pagination, limit: 10, total: 1, totalPages: 1 },
      });
    });
    const view = render(<WithdrawalsScreen />, { wrapper: h.wrapper });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "رفض" })).toBeEnabled(),
    );
    vi.useFakeTimers();
    const tick = async () => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_001);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
    };
    for (let cycle = 1; cycle < 20; cycle++) {
      view.rerender(<WithdrawalsScreen />);
      await tick();
    }
    expect(reads).toBe(20);
    act(() => {
      h.runtime.beginCheck();
    });
    await tick();
    expect(screen.getByText("Current Employee")).toBeVisible();
    expect(screen.getByText(/آخر بيانات معروفة/u)).toBeVisible();
    const reject = screen.getByRole("button", { name: "رفض" });
    expect(reject).toBeDisabled();
    fireEvent.click(reject);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/جارٍ/u)).not.toBeInTheDocument();
    expect(reads).toBe(20);
    expect(sends).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "تحديث طلبات السحب" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole("button", { name: "رفض" })).toBeEnabled();
    expect(reads).toBe(21);
  });
  it.each(["EXTEND", "REJECT"])(
    "retires the %s draft when fresh detail makes the target readonly",
    async (kind) => {
      let readonly = false,
        sends = 0;
      const h = queryHarness("ADMIN", (config) => {
        if (config.method === "post") sends++;
        if (config.url === "/admin/withdrawals")
          return reply(config, {
            items: [row],
            pagination: { ...pagination, limit: 10, total: 1, totalPages: 1 },
          });
        return reply(
          config,
          readonly
            ? {
                ...row,
                version: 2,
                state: "SIGNING",
                canExtend: false,
                canReject: false,
              }
            : row,
        );
      });
      render(<WithdrawalsScreen />, { wrapper: h.wrapper });
      fireEvent.click(
        await screen.findByRole("button", {
          name: kind === "EXTEND" ? "زيادة الجدولة" : "رفض",
        }),
      );
      const dialog = await screen.findByRole("dialog");
      const confirm = within(dialog).getByRole("button", {
        name:
          kind === "EXTEND"
            ? "تأكيد زيادة الجدولة"
            : "تأكيد الرفض وتحرير الرصيد",
      });
      fireEvent.change(
        within(dialog).getByLabelText(
          kind === "EXTEND" ? /سبب زيادة الجدولة/u : /سبب رفض السحب/u,
        ),
        { target: { value: "Private reason" } },
      );
      await waitFor(() => {
        expect(confirm).toBeEnabled();
      });
      readonly = true;
      fireEvent.click(confirm);
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(sends).toBe(0);
      expect(
        screen.queryByDisplayValue("Private reason"),
      ).not.toBeInTheDocument();
    },
  );
  it.each(["contract", "unavailable", "denied"])(
    "distinguishes %s detail failures in the inline disclosure",
    async (failure) => {
      const h = queryHarness("ADMIN", (config) => {
        if (config.url === "/admin/withdrawals")
          return reply(config, {
            items: [row],
            pagination: { ...pagination, limit: 10, total: 1, totalPages: 1 },
          });
        if (failure === "contract") return reply(config, {});
        reject(
          config,
          failure === "denied" ? "FORBIDDEN" : "SERVICE_UNAVAILABLE",
          failure === "denied" ? 403 : 503,
        );
      });
      render(<WithdrawalsScreen />, { wrapper: h.wrapper });
      fireEvent.click(await screen.findByText("تفاصيل الطلب"));
      if (failure === "denied") {
        await waitFor(() => {
          expect(
            screen.queryByText("Current Employee"),
          ).not.toBeInTheDocument();
          expect(
            screen.queryByRole("button", { name: "رفض" }),
          ).not.toBeInTheDocument();
        });
      } else {
        await screen.findByText(
          failure === "contract"
            ? "تعذر التحقق من استجابة الخدمة. حاول لاحقاً."
            : "الخدمة غير متاحة مؤقتاً. تحقق من الاتصال وحاول لاحقاً.",
        );
      }
      expect(screen.queryByText(row.id)).not.toBeInTheDocument();
    },
  );
  it.each(["EXTEND", "REJECT"] as const)(
    "preserves %s drafts through supersession and requires explicit new-version review",
    async (kind) => {
      let current = row,
        sends = 0;
      const h = queryHarness("ADMIN", (config) => {
        if (config.method === "post") {
          sends++;
          current = { ...row, version: 2, scheduleVersion: 2 };
          reject(config, "WITHDRAWAL_VERSION_CONFLICT", 409);
        }
        const requestKey: unknown = config.params
          ? Reflect.get(config.params as object, "requestKey")
          : undefined;
        if (config.url?.endsWith("/actions/outcome"))
          return reply(config, {
            status: "SUPERSEDED",
            kind,
            requestKey,
            withdrawalId: row.id,
            expectedVersion: 1,
            serverNow: row.serverNow,
            withdrawal: current,
          });
        return reply(
          config,
          config.url === "/admin/withdrawals"
            ? {
                items: [current],
                pagination: {
                  ...pagination,
                  limit: 10,
                  total: 1,
                  totalPages: 1,
                },
              }
            : current,
        );
      });
      render(<WithdrawalsScreen />, { wrapper: h.wrapper });
      fireEvent.click(
        await screen.findByRole("button", {
          name: kind === "EXTEND" ? "زيادة الجدولة" : "رفض",
        }),
      );
      const dialog = await screen.findByRole("dialog");
      const reason = within(dialog).getByLabelText(
        kind === "EXTEND" ? /سبب زيادة الجدولة/u : /سبب رفض السحب/u,
      );
      fireEvent.change(reason, { target: { value: "Preserve my reason" } });
      if (kind === "EXTEND")
        fireEvent.change(
          within(dialog).getByLabelText(/الساعات الإضافية المراد/u),
          { target: { value: "1.5" } },
        );
      const confirm = within(dialog).getByRole("button", {
        name:
          kind === "EXTEND"
            ? "تأكيد زيادة الجدولة"
            : "تأكيد الرفض وتحرير الرصيد",
      });
      await waitFor(() => {
        expect(confirm).toBeEnabled();
      });
      fireEvent.click(confirm);
      await screen.findByText(/تغير الطلب دون إثبات/u);
      expect(reason).toHaveValue("Preserve my reason");
      const review = await within(dialog).findByRole("button", {
        name: "مراجعة الإصدار الجديد",
      });
      fireEvent.click(review);
      await waitFor(() => {
        expect(
          within(dialog).getByRole("button", {
            name:
              kind === "EXTEND"
                ? "تأكيد زيادة الجدولة"
                : "تأكيد الرفض وتحرير الرصيد",
          }),
        ).toBeEnabled();
      });
      expect(reason).toHaveValue("Preserve my reason");
      if (kind === "EXTEND")
        expect(
          within(dialog).getByLabelText(/الساعات الإضافية المراد/u),
        ).toHaveValue("1.5");
      expect(sends).toBe(1);
    },
  );
  it.each(["contract", "unavailable", "denied"])(
    "distinguishes %s list failures without exposing protected rows",
    async (failure) => {
      const h = queryHarness("ADMIN", (config) => {
        if (failure === "contract") return reply(config, {});
        reject(
          config,
          failure === "denied" ? "FORBIDDEN" : "SERVICE_UNAVAILABLE",
          failure === "denied" ? 403 : 503,
        );
      });
      render(<WithdrawalsScreen />, { wrapper: h.wrapper });
      await screen.findByText(
        failure === "contract"
          ? "تعذر التحقق من استجابة الخدمة. حاول لاحقاً."
          : failure === "unavailable"
            ? "الخدمة غير متاحة مؤقتاً. تحقق من الاتصال وحاول لاحقاً."
            : "تعذر السماح بهذا الطلب. تحقق من تسجيل الدخول والصلاحيات.",
      );
      expect(screen.queryByText("Current Employee")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "رفض" }),
      ).not.toBeInTheDocument();
    },
  );
  it("loads server identity/detail/filter scope and retires unsafe demo controls", async () => {
    const h = queryHarness("ADMIN", (config) =>
      reply(
        config,
        config.url === "/admin/withdrawals"
          ? {
              items: [row],
              pagination: { ...pagination, limit: 10, total: 1, totalPages: 1 },
            }
          : row,
      ),
    );
    render(<WithdrawalsScreen />, { wrapper: h.wrapper });
    await screen.findByText("Current Employee");
    expect(screen.queryByRole("button", { name: "إتمام" })).toBeNull();
    expect(screen.queryByRole("button", { name: "فك التعليق" })).toBeNull();
    fireEvent.click(screen.getByText("تفاصيل الطلب"));
    await screen.findByText(row.id);
    fireEvent.click(screen.getByRole("button", { name: "زيادة الجدولة" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Current Employee")).toBeVisible();
    fireEvent.change(within(dialog).getByLabelText(/سبب زيادة الجدولة/u), {
      target: { value: "Keep draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تحديث طلبات السحب" }));
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/سبب زيادة الجدولة/u)).toHaveValue(
        "Keep draft",
      );
    });
  });
  it.each(["SIGNING", "SIGNED", "SUBMITTED", "UNKNOWN", "SCHEDULED"])(
    "shows %s readonly when safe flags deny actions even with no transaction ID",
    async (state) => {
      const h = queryHarness("ADMIN", (config) =>
        reply(config, {
          items: [{ ...row, state, canExtend: false, canReject: false }],
          pagination: { ...pagination, limit: 10, total: 1, totalPages: 1 },
        }),
      );
      render(<WithdrawalsScreen />, { wrapper: h.wrapper });
      await screen.findByText("Current Employee");
      expect(screen.queryByRole("button", { name: "رفض" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "زيادة الجدولة" }),
      ).toBeNull();
    },
  );
});
