"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { INITIAL_USER } from "../fixtures/account.fixtures";
import { PACKAGES } from "../fixtures/package.fixtures";
import { INITIAL_TASK, INITIAL_TASK_HISTORY } from "../fixtures/task.fixtures";
import {
  INITIAL_TEAM_COMMISSIONS,
  INITIAL_TEAM_MEMBERS,
} from "../fixtures/team.fixtures";
import {
  INITIAL_BALANCE,
  INITIAL_DEPOSITS,
  INITIAL_TRANSACTIONS,
} from "../fixtures/wallet.fixtures";
import type {
  DailyTask,
  DepositRecord,
  EmployeeUser,
  FinancialBalance,
  LedgerTransaction,
  PackageId,
  TaskHistoryItem,
  TeamCommissionRecord,
  TeamMember,
} from "../types/employee.types";

import { useEmployeeWalletActions } from "./actions/use-employee-wallet-actions";
import type { EmployeeContextValue } from "./employee-state.types";

const EmployeeStateContext = createContext<EmployeeContextValue | null>(null);

export function EmployeeStateProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [user] = useState<EmployeeUser>(INITIAL_USER);
  const [currentPackageId] = useState<PackageId>("S1");
  const [packageExpiryDays] = useState(22);
  const [balance] = useState<FinancialBalance>(INITIAL_BALANCE);
  const [task] = useState<DailyTask>(INITIAL_TASK);
  const [taskHistory] =
    useState<readonly TaskHistoryItem[]>(INITIAL_TASK_HISTORY);
  const [deposits, setDeposits] =
    useState<readonly DepositRecord[]>(INITIAL_DEPOSITS);
  const [transactions] =
    useState<readonly LedgerTransaction[]>(INITIAL_TRANSACTIONS);
  const [teamMembers] = useState<readonly TeamMember[]>(INITIAL_TEAM_MEMBERS);
  const [teamCommissions] = useState<readonly TeamCommissionRecord[]>(
    INITIAL_TEAM_COMMISSIONS,
  );

  const currentPackage =
    PACKAGES.find((pkg) => pkg.id === currentPackageId) ?? PACKAGES[1];
  const { checkDepositStatus } = useEmployeeWalletActions({ setDeposits });

  const value = useMemo(
    () => ({
      user,
      currentPackage,
      packageExpiryDays,
      balance,
      task,
      taskHistory,
      deposits,
      transactions,
      teamMembers,
      teamCommissions,
      checkDepositStatus,
    }),
    [
      user,
      currentPackage,
      packageExpiryDays,
      balance,
      task,
      taskHistory,
      deposits,
      transactions,
      teamMembers,
      teamCommissions,
      checkDepositStatus,
    ],
  );

  return (
    <EmployeeStateContext.Provider value={value}>
      {children}
    </EmployeeStateContext.Provider>
  );
}

export function useEmployeeState(): EmployeeContextValue {
  const context = useContext(EmployeeStateContext);
  if (!context) {
    throw new Error(
      "useEmployeeState must be used within EmployeeStateProvider",
    );
  }
  return context;
}
