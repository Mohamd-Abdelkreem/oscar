import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EmployeeStateProvider,
  useEmployeeState,
} from "./employee-state.context";

function wrapper({ children }: { readonly children: ReactNode }) {
  return <EmployeeStateProvider>{children}</EmployeeStateProvider>;
}

describe("employee mock state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 13, 45));
    vi.stubGlobal(
      "URL",
      Object.assign(class extends URL {}, { revokeObjectURL: vi.fn() }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("credits a submitted task once and replaces its screenshot without another reward", () => {
    const { result } = renderHook(useEmployeeState, { wrapper });
    const history = result.current.taskHistory;
    const ledgerCount = result.current.transactions.length;

    act(() => {
      expect(result.current.submitTask("blob:first").success).toBe(true);
    });
    expect(result.current.task).toMatchObject({
      status: "submitted",
      submittedScreenshot: "blob:first",
      submittedAt: "13:45",
      rewardAmount: 2,
    });
    expect(result.current.balance).toMatchObject({
      total: 42,
      available: 42,
      reserved: 0,
    });
    expect(result.current.balance.breakdown.taskRewards).toBe(86);
    expect(result.current.transactions[0]).toMatchObject({
      type: "task_reward",
      amount: 2,
      status: "pending",
    });
    expect(result.current.transactions).toHaveLength(ledgerCount + 1);

    act(() => {
      expect(
        result.current.replaceTaskScreenshot("blob:replacement").success,
      ).toBe(true);
      expect(result.current.submitTask("blob:duplicate").success).toBe(false);
    });
    expect(result.current.task.submittedScreenshot).toBe("blob:replacement");
    expect(result.current.balance.available).toBe(42);
    expect(result.current.transactions).toHaveLength(ledgerCount + 1);
    expect(result.current.taskHistory).toEqual(history);
  });

  it("reserves withdrawal funds and releases them with a reversal when rejected", () => {
    const { result } = renderHook(useEmployeeState, { wrapper });
    act(() => {
      expect(result.current.requestWithdrawal(30).success).toBe(true);
    });
    expect(result.current.balance).toMatchObject({
      total: 40,
      available: 10,
      reserved: 30,
    });
    expect(result.current.pendingWithdrawal).toMatchObject({
      amount: 30,
      fee: 6.3,
      netAmount: 23.7,
      requestedAt: "2026-09-30 13:45",
      dueAt: "2026-10-03 13:45",
    });
    expect(result.current.transactions[0]).toMatchObject({
      type: "withdrawal_reservation",
      amount: -30,
      status: "pending",
    });
    act(() => {
      expect(result.current.requestWithdrawal(16).success).toBe(false);
      result.current.simulateRejectPendingWithdrawal();
    });
    expect(result.current.balance).toMatchObject({
      total: 40,
      available: 40,
      reserved: 0,
    });
    expect(result.current.withdrawals[0]?.status).toBe("rejected");
    expect(result.current.hasPendingWithdrawal).toBe(false);
    expect(result.current.transactions[0]).toMatchObject({
      type: "withdrawal_reversal",
      amount: 30,
      status: "reversed",
    });
  });

  it("completes a withdrawal by spending reserved funds and preserves the existing ledger snapshot", () => {
    const { result } = renderHook(useEmployeeState, { wrapper });
    act(() => {
      result.current.requestWithdrawal(30);
    });
    const ledger = result.current.transactions;
    act(() => {
      result.current.simulateApprovePendingWithdrawal();
    });

    expect(result.current.balance).toMatchObject({
      total: 10,
      available: 10,
      reserved: 0,
    });
    expect(result.current.withdrawals[0]?.status).toBe("completed");
    expect(result.current.hasPendingWithdrawal).toBe(false);
    // Baseline completion does not add a completion entry or update the reservation entry.
    expect(result.current.transactions).toEqual(ledger);
  });

  it("confirms a deposit status without crediting the balance or duplicating ledger entries", () => {
    const { result } = renderHook(useEmployeeState, { wrapper });
    const balance = result.current.balance;
    const ledger = result.current.transactions;
    act(() => {
      result.current.checkDepositStatus("dep_502");
    });

    expect(
      result.current.deposits.find((deposit) => deposit.id === "dep_502")
        ?.status,
    ).toBe("confirmed");
    expect(result.current.balance).toEqual(balance);
    expect(result.current.transactions).toEqual(ledger);
  });
});
