import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminStateProvider, useAdminState } from "./admin-state.context";

function wrapper({ children }: { readonly children: ReactNode }) {
  return <AdminStateProvider>{children}</AdminStateProvider>;
}

describe("Admin State and Task Unlock Code Domain Actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 1, 14, 0, 0));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("maintains independent controls for account status, task restriction, and withdrawal restriction", () => {
    const { result } = renderHook(useAdminState, { wrapper });
    const empId = "usr_1002";

    // Initial state: active, tasks allowed, withdrawals allowed
    let emp = result.current.employees.find((e) => e.id === empId);
    if (!emp) throw new Error("emp not found");
    expect(emp.accountStatus).toBe("active");
    expect(emp.restrictions.tasksBlocked).toBe(false);
    expect(emp.restrictions.withdrawalsBlocked).toBe(false);

    // Block only withdrawals
    act(() => {
      result.current.toggleEmployeeWithdrawalRestriction(empId);
    });
    emp = result.current.employees.find((e) => e.id === empId);
    if (!emp) throw new Error("emp not found");
    expect(emp.restrictions.withdrawalsBlocked).toBe(true);
    expect(emp.restrictions.tasksBlocked).toBe(false);
    expect(emp.accountStatus).toBe("active");

    // Block tasks independently
    act(() => {
      result.current.toggleEmployeeTaskRestriction(empId);
    });
    emp = result.current.employees.find((e) => e.id === empId);
    if (!emp) throw new Error("emp not found");
    expect(emp.restrictions.withdrawalsBlocked).toBe(true);
    expect(emp.restrictions.tasksBlocked).toBe(true);
    expect(emp.accountStatus).toBe("active");

    // Unblock withdrawals independently
    act(() => {
      result.current.toggleEmployeeWithdrawalRestriction(empId);
    });
    emp = result.current.employees.find((e) => e.id === empId);
    if (!emp) throw new Error("emp not found");
    expect(emp.restrictions.withdrawalsBlocked).toBe(false);
    expect(emp.restrictions.tasksBlocked).toBe(true);
    expect(emp.accountStatus).toBe("active");
  });

  describe("extendWithdrawalSchedule action", () => {
    it("extends a scheduled withdrawal's dueAt and tracks cumulative added hours", () => {
      const { result } = renderHook(useAdminState, { wrapper });
      const wthId = "wth_8092";

      const initialWth = result.current.withdrawals.find((w) => w.id === wthId);
      if (!initialWth) throw new Error("initialWth not found");
      expect(initialWth.status).toBe("scheduled");
      const initialDueAtMs = new Date(initialWth.dueAt).getTime();
      const initialAmount = initialWth.amount;
      const initialFee = initialWth.fee;
      const initialNet = initialWth.netAmount;
      const initialLogsCount = result.current.auditLogs.length;

      // 1. First extension: +12 hours
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          wthId,
          12,
          "تمديد أول للتحقق الأمني",
        );
        expect(res.success).toBe(true);
      });

      let updatedWth = result.current.withdrawals.find((w) => w.id === wthId);
      if (!updatedWth) throw new Error("updatedWth not found");
      expect(new Date(updatedWth.dueAt).getTime()).toBe(
        initialDueAtMs + 12 * 3600 * 1000,
      );
      expect(updatedWth.originalDurationHours).toBe(72);
      expect(updatedWth.addedHours).toBe(12);

      // Financial values remain untouched
      expect(updatedWth.amount).toBe(initialAmount);
      expect(updatedWth.fee).toBe(initialFee);
      expect(updatedWth.netAmount).toBe(initialNet);

      // 2. Second extension: +6 hours -> cumulative +18 hours
      act(() => {
        const res2 = result.current.extendWithdrawalSchedule(
          wthId,
          6,
          "تمديد إضافي لطلب مستندات",
        );
        expect(res2.success).toBe(true);
      });

      updatedWth = result.current.withdrawals.find((w) => w.id === wthId);
      if (!updatedWth) throw new Error("updatedWth not found");
      expect(new Date(updatedWth.dueAt).getTime()).toBe(
        initialDueAtMs + (12 + 6) * 3600 * 1000,
      );
      expect(updatedWth.addedHours).toBe(18);

      // Audit logs were written
      expect(result.current.auditLogs.length).toBe(initialLogsCount + 2);
      const latestAudit = result.current.auditLogs[0];
      expect(latestAudit?.action).toBe("زيادة جدولة السحب");
      expect(latestAudit?.reason).toBe("تمديد إضافي لطلب مستندات");
      expect(latestAudit?.newState).toContain("+6 ساعة");
      expect(latestAudit?.newState).toContain("+18 ساعة");
    });

    it("rejects extending non-scheduled withdrawals", () => {
      const { result } = renderHook(useAdminState, { wrapper });

      // wth_8091 is completed
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          "wth_8091",
          10,
          "محاولة تمديد طلب مكتمل",
        );
        expect(res.success).toBe(false);
        expect(res.message).toBe("لا يمكن تمديد جدولة طلب غير مجدول.");
      });
    });

    it("validates positive safe-integer hours and non-empty reason", () => {
      const { result } = renderHook(useAdminState, { wrapper });
      const wthId = "wth_8092";

      // Zero hours
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          wthId,
          0,
          "سبب تجريبي",
        );
        expect(res.success).toBe(false);
      });

      // Negative hours
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          wthId,
          -5,
          "سبب تجريبي",
        );
        expect(res.success).toBe(false);
      });

      // Fractional hours
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          wthId,
          3.5,
          "سبب تجريبي",
        );
        expect(res.success).toBe(false);
      });

      // Empty reason
      act(() => {
        const res = result.current.extendWithdrawalSchedule(wthId, 10, "   ");
        expect(res.success).toBe(false);
        expect(res.message).toBe("يرجى إدخال سبب زيادة الجدولة الإلزامي.");
      });
    });
  });
});
