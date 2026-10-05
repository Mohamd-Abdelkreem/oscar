"use client";

import {
  createContext,
  useContext,
  useEffect,
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
  INITIAL_WITHDRAWALS,
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
  WithdrawalRequest,
} from "../types/employee.types";

import { useEmployeeTaskActions } from "./actions/use-employee-task-actions";
import { useEmployeeWalletActions } from "./actions/use-employee-wallet-actions";
import type { EmployeeContextValue } from "./employee-state.types";

const EmployeeStateContext = createContext<EmployeeContextValue | null>(null);

export function EmployeeStateProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [user, setUser] = useState<EmployeeUser>(INITIAL_USER);
  const [currentPackageId] = useState<PackageId>("S1");
  const [packageExpiryDays] = useState(22);
  const [balance, setBalance] = useState<FinancialBalance>(INITIAL_BALANCE);
  const [task, setTask] = useState<DailyTask>(INITIAL_TASK);
  const [taskHistory] =
    useState<readonly TaskHistoryItem[]>(INITIAL_TASK_HISTORY);
  const [withdrawals, setWithdrawals] =
    useState<readonly WithdrawalRequest[]>(INITIAL_WITHDRAWALS);
  const [deposits, setDeposits] =
    useState<readonly DepositRecord[]>(INITIAL_DEPOSITS);
  const [transactions, setTransactions] =
    useState<readonly LedgerTransaction[]>(INITIAL_TRANSACTIONS);
  const [teamMembers] = useState<readonly TeamMember[]>(INITIAL_TEAM_MEMBERS);
  const [teamCommissions] = useState<readonly TeamCommissionRecord[]>(
    INITIAL_TEAM_COMMISSIONS,
  );

  useEffect(() => {
    const committedScreenshot = task.submittedScreenshot;
    return () => {
      if (committedScreenshot?.startsWith("blob:")) {
        URL.revokeObjectURL(committedScreenshot);
      }
    };
  }, [task.submittedScreenshot]);

  const currentPackage =
    PACKAGES.find((pkg) => pkg.id === currentPackageId) ?? PACKAGES[1];
  const pendingWithdrawal = withdrawals.find(
    (withdrawal) => withdrawal.status === "pending",
  );

  const hasPendingWithdrawal = pendingWithdrawal !== undefined;
  const { submitTask, replaceTaskScreenshot, setTaskScenario } =
    useEmployeeTaskActions({ task, setBalance, setTask, setTransactions });
  const {
    setupWithdrawalAddress,
    requestWithdrawal,
    checkDepositStatus,
    simulateRejectPendingWithdrawal,
    simulateApprovePendingWithdrawal,
  } = useEmployeeWalletActions({
    user,
    balance,
    setUser,
    setBalance,
    setWithdrawals,
    setDeposits,
    setTransactions,
    pendingWithdrawal,
    hasPendingWithdrawal,
  });

  const value = useMemo(
    () => ({
      user,
      currentPackage,
      packageExpiryDays,
      balance,
      task,
      taskHistory,
      withdrawals,
      deposits,
      transactions,
      teamMembers,
      teamCommissions,
      submitTask,
      replaceTaskScreenshot,
      setTaskScenario,
      setupWithdrawalAddress,
      requestWithdrawal,
      checkDepositStatus,
      simulateRejectPendingWithdrawal,
      simulateApprovePendingWithdrawal,
      hasPendingWithdrawal,
      pendingWithdrawal,
    }),
    [
      user,
      currentPackage,
      packageExpiryDays,
      balance,
      task,
      taskHistory,
      withdrawals,
      deposits,
      transactions,
      teamMembers,
      teamCommissions,
      submitTask,
      replaceTaskScreenshot,
      setTaskScenario,
      setupWithdrawalAddress,
      requestWithdrawal,
      checkDepositStatus,
      simulateRejectPendingWithdrawal,
      simulateApprovePendingWithdrawal,
      hasPendingWithdrawal,
      pendingWithdrawal,
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
