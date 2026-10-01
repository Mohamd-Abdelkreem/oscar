import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminStateProvider, useAdminState } from "./admin-state.context";

function wrapper({ children }: { readonly children: ReactNode }) {
  return <AdminStateProvider>{children}</AdminStateProvider>;
}

describe("admin financial actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("credits a manual deposit once across employee, deposit, ledger and audit", () => {
    const { result } = renderHook(useAdminState, { wrapper });
    const employee = result.current.employees.find((e) => e.id === "usr_9981");
    if (!employee) throw new Error("Missing seeded employee");
    const initialDeposits = result.current.deposits.length;
    const initialLedger = result.current.financeTransactions.length;
    const initialAudit = result.current.auditLogs.length;

    act(() => {
      expect(
        result.current.manualCreditDeposit(
          employee.id,
          25,
          " REF-TEST ",
          " verified ",
        ).success,
      ).toBe(true);
    });

    expect(
      result.current.employees.find((e) => e.id === employee.id)?.balance,
    ).toEqual({
      total: employee.balance.total + 25,
      available: employee.balance.available + 25,
      reserved: employee.balance.reserved,
    });
    expect(result.current.deposits).toHaveLength(initialDeposits + 1);
    expect(result.current.deposits[0]).toMatchObject({
      employeeId: employee.id,
      amount: 25,
      reference: "REF-TEST",
      manualReason: "verified",
      status: "confirmed",
    });
    expect(result.current.financeTransactions).toHaveLength(initialLedger + 1);
    expect(result.current.financeTransactions[0]).toMatchObject({
      employeeId: employee.id,
      amount: 25,
      direction: "credit",
      reference: "REF-TEST",
    });
    expect(result.current.auditLogs).toHaveLength(initialAudit + 1);
    expect(result.current.auditLogs[0]).toMatchObject({
      targetId: result.current.deposits[0]?.id,
      targetType: "deposit",
    });

    act(() => {
      expect(
        result.current.manualCreditDeposit(
          employee.id,
          25,
          "REF-TEST",
          "duplicate",
        ).success,
      ).toBe(false);
    });
    expect(result.current.deposits).toHaveLength(initialDeposits + 1);
    expect(result.current.financeTransactions).toHaveLength(initialLedger + 1);
    expect(result.current.auditLogs).toHaveLength(initialAudit + 1);
    expect(
      result.current.employees.find((e) => e.id === employee.id)?.balance
        .available,
    ).toBe(employee.balance.available + 25);
  });

  it.each([
    [0, "REF-INVALID", "reason"],
    [25, "", "reason"],
    [25, "REF-INVALID", ""],
  ])(
    "rejects invalid deposit input without financial side effects (%s, %s, %s)",
    (amount, reference, reason) => {
      const { result } = renderHook(useAdminState, { wrapper });
      const before = result.current;
      act(() => {
        expect(
          result.current.manualCreditDeposit(
            "usr_9981",
            amount,
            reference,
            reason,
          ).success,
        ).toBe(false);
      });
      expect(result.current.employees).toEqual(before.employees);
      expect(result.current.deposits).toEqual(before.deposits);
      expect(result.current.financeTransactions).toEqual(
        before.financeTransactions,
      );
      expect(result.current.auditLogs).toEqual(before.auditLogs);
    },
  );

  it("holds and releases a withdrawal without resetting its deadline or moving money", () => {
    const { result } = renderHook(useAdminState, { wrapper });
    const withdrawal = result.current.withdrawals.find(
      (w) => w.id === "wth_8092",
    );
    if (!withdrawal) throw new Error("Missing seeded withdrawal");
    const before = result.current;
    act(() => {
      result.current.holdWithdrawal(withdrawal.id, "review");
    });
    expect(
      result.current.withdrawals.find((w) => w.id === withdrawal.id),
    ).toMatchObject({
      status: "held",
      dueAt: withdrawal.dueAt,
      amount: withdrawal.amount,
    });
    act(() => {
      result.current.releaseWithdrawal(withdrawal.id);
    });
    expect(
      result.current.withdrawals.find((w) => w.id === withdrawal.id),
    ).toMatchObject({
      status: "scheduled",
      dueAt: withdrawal.dueAt,
      holdReason: undefined,
    });
    expect(result.current.employees).toEqual(before.employees);
    expect(result.current.financeTransactions).toEqual(
      before.financeTransactions,
    );
    expect(result.current.auditLogs).toHaveLength(before.auditLogs.length + 2);
  });

  it.each(["reject", "complete"] as const)(
    "%s settles the reservation once and records the matching ledger entry",
    (action) => {
      const { result } = renderHook(useAdminState, { wrapper });
      const withdrawal = result.current.withdrawals.find(
        (w) => w.id === "wth_8092",
      );
      if (!withdrawal) throw new Error("Missing seeded withdrawal");
      const employee = result.current.employees.find(
        (e) => e.id === withdrawal.employeeId,
      );
      if (!employee) throw new Error("Missing withdrawal owner");
      const before = result.current;
      const settle = () => {
        if (action === "reject")
          result.current.rejectWithdrawal(withdrawal.id, "verification failed");
        else result.current.completeWithdrawal(withdrawal.id);
      };
      act(settle);
      const expectedBalance = {
        total:
          action === "complete"
            ? employee.balance.total - withdrawal.amount
            : employee.balance.total,
        available:
          action === "reject"
            ? employee.balance.available + withdrawal.amount
            : employee.balance.available,
        reserved: employee.balance.reserved - withdrawal.amount,
      };
      expect(
        result.current.employees.find((e) => e.id === employee.id)?.balance,
      ).toEqual(expectedBalance);
      expect(
        result.current.withdrawals.find((w) => w.id === withdrawal.id)?.status,
      ).toBe(action === "reject" ? "rejected" : "completed");
      expect(result.current.financeTransactions[0]).toMatchObject({
        employeeId: employee.id,
        type:
          action === "reject" ? "withdrawal_reversal" : "withdrawal_completion",
        amount: action === "reject" ? 0 : -withdrawal.amount,
        direction: action === "reject" ? "neutral" : "debit",
      });
      expect(result.current.financeTransactions).toHaveLength(
        before.financeTransactions.length + 1,
      );
      expect(result.current.auditLogs).toHaveLength(
        before.auditLogs.length + 1,
      );
      act(settle);
      expect(
        result.current.employees.find((e) => e.id === employee.id)?.balance,
      ).toEqual(expectedBalance);
      expect(result.current.financeTransactions).toHaveLength(
        before.financeTransactions.length + 1,
      );
      expect(result.current.auditLogs).toHaveLength(
        before.auditLogs.length + 1,
      );
    },
  );
});
