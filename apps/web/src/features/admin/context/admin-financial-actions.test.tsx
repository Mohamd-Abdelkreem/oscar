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
});
