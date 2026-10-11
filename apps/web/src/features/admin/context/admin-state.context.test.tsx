import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminStateProvider, useAdminState } from "./admin-state.context";

function wrapper({ children }: { readonly children: ReactNode }) {
  return <AdminStateProvider>{children}</AdminStateProvider>;
}

describe("admin preview restrictions", () => {
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
});
