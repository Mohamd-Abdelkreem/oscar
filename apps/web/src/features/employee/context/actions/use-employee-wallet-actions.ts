"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { DepositRecord } from "../../types/employee.types";

export function useEmployeeWalletActions({
  setDeposits,
}: {
  readonly setDeposits: Dispatch<SetStateAction<readonly DepositRecord[]>>;
}) {
  const checkDepositStatus = useCallback(
    (depositId: string) => {
      setDeposits((prev) =>
        prev.map((deposit) =>
          deposit.id === depositId
            ? { ...deposit, status: "confirmed" }
            : deposit,
        ),
      );
    },
    [setDeposits],
  );
  return { checkDepositStatus };
}
