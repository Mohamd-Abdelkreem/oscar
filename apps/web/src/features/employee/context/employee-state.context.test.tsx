import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import {
  EmployeeStateProvider,
  useEmployeeState,
} from "./employee-state.context";

function wrapper({ children }: { readonly children: ReactNode }) {
  return <EmployeeStateProvider>{children}</EmployeeStateProvider>;
}

describe("employee mock state", () => {
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
