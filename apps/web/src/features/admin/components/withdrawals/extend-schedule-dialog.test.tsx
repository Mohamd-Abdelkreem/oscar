import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { actorId } from "@/test/p04-network";
import { withdrawal } from "@/test/p09-withdrawals";
import { deferred } from "@/test/p04-query";
import { ExtendScheduleDialog } from "./extend-schedule-dialog";

const row = {
  ...withdrawal,
  employee: {
    id: actorId,
    fullName: "Employee",
    email: "employee@example.test",
  },
  canExtend: true,
  canReject: true,
};
describe("reviewed extension dialog", () => {
  it("retains hours and reason when explicit fresh-version review does not dispatch", async () => {
    const confirm = vi.fn(() => false);
    const close = vi.fn();
    const view = render(
      <ExtendScheduleDialog
        isOpen
        withdrawal={row}
        reviewNewVersion
        onConfirm={confirm}
        onClose={close}
      />,
    );
    fireEvent.change(screen.getByLabelText(/الساعات الإضافية المراد/u), {
      target: { value: "2.5" },
    });
    fireEvent.change(screen.getByLabelText(/سبب زيادة الجدولة/u), {
      target: { value: "Keep my reason" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "مراجعة الإصدار الجديد" }),
    );
    await waitFor(() => {
      expect(confirm).toHaveBeenCalledTimes(1);
    });
    view.rerender(
      <ExtendScheduleDialog
        isOpen
        withdrawal={{ ...row, version: 2 }}
        onConfirm={confirm}
        onClose={close}
      />,
    );
    expect(screen.getByLabelText(/الساعات الإضافية المراد/u)).toHaveValue(
      "2.5",
    );
    expect(screen.getByLabelText(/سبب زيادة الجدولة/u)).toHaveValue(
      "Keep my reason",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("v2");
    expect(close).not.toHaveBeenCalled();
  });
  it.each(["", " ", "a".repeat(501)])(
    "blocks invalid required reasons without losing hours",
    (reason) => {
      const confirm = vi.fn();
      render(
        <ExtendScheduleDialog
          isOpen
          withdrawal={row}
          onConfirm={confirm}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText(/الساعات الإضافية المراد/u), {
        target: { value: "0.5" },
      });
      fireEvent.change(screen.getByLabelText(/سبب زيادة الجدولة/u), {
        target: { value: reason },
      });
      expect(
        screen.getByRole("button", { name: "تأكيد زيادة الجدولة" }),
      ).toBeDisabled();
      expect(screen.getByLabelText(/الساعات الإضافية المراد/u)).toHaveValue(
        "0.5",
      );
      expect(confirm).not.toHaveBeenCalled();
    },
  );
  it("reviews exact fractional added hours, submits current version, and protects pending dismissal", async () => {
    const pending = deferred<undefined>();
    const confirm = vi.fn(() => pending.promise),
      close = vi.fn();
    render(
      <ExtendScheduleDialog
        isOpen
        withdrawal={row}
        onConfirm={confirm}
        onClose={close}
      />,
    );
    fireEvent.change(screen.getByLabelText(/الساعات الإضافية المراد/u), {
      target: { value: "1.5" },
    });
    fireEvent.change(screen.getByLabelText(/سبب زيادة الجدولة/u), {
      target: { value: " Reviewed " },
    });
    expect(screen.getByText("1.5 ساعة")).toBeVisible();
    expect(screen.queryByText("إجمالي الجدولة الكلية:")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "تأكيد زيادة الجدولة" }),
    );
    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith("1.5", "Reviewed", 1);
    });
    fireEvent.keyDown(screen.getByLabelText(/سبب زيادة الجدولة/u), {
      key: "Escape",
    });
    expect(close).not.toHaveBeenCalled();
    pending.resolve(undefined);
    await waitFor(() => {
      expect(close).toHaveBeenCalledTimes(1);
    });
  });
  it.each(["0", "-1", "1e2", "0.00000001"])(
    "rejects unsupported hours %s without dispatch",
    (hours) => {
      const confirm = vi.fn();
      render(
        <ExtendScheduleDialog
          isOpen
          withdrawal={row}
          onConfirm={confirm}
          onClose={() => {}}
        />,
      );
      fireEvent.change(screen.getByLabelText(/الساعات الإضافية المراد/u), {
        target: { value: hours },
      });
      fireEvent.change(screen.getByLabelText(/سبب زيادة الجدولة/u), {
        target: { value: "Reviewed" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "تأكيد زيادة الجدولة" }),
      );
      expect(confirm).not.toHaveBeenCalled();
    },
  );
  it("preserves dirty reason on transient refresh and disables stale or unavailable review", () => {
    const props = {
      isOpen: true,
      withdrawal: row,
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    };
    const view = render(<ExtendScheduleDialog {...props} />);
    fireEvent.change(screen.getByLabelText(/سبب زيادة الجدولة/u), {
      target: { value: "Dirty" },
    });
    view.rerender(<ExtendScheduleDialog {...props} disabled />);
    expect(screen.getByLabelText(/سبب زيادة الجدولة/u)).toHaveValue("Dirty");
    expect(
      screen.getByRole("button", { name: "تأكيد زيادة الجدولة" }),
    ).toBeDisabled();
  });
  it("contains keyboard focus and protects an externally pending command", () => {
    const close = vi.fn();
    const props = {
      isOpen: true,
      withdrawal: row,
      onConfirm: vi.fn(),
      onClose: close,
    };
    const view = render(<ExtendScheduleDialog {...props} />);
    const dialog = screen
      .getByRole("dialog")
      .querySelector<HTMLElement>('[tabindex="-1"]');
    if (!dialog) throw new Error("Missing dialog focus container");
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(screen.getByRole("button", { name: "إغلاق" })).toHaveFocus();
    view.rerender(<ExtendScheduleDialog {...props} isLoading />);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/الساعات الإضافية المراد/u)).toBeDisabled();
  });
});
