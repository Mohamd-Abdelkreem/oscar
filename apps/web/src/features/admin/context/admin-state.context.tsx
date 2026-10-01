"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CURRENT_ADMIN,
  DEFAULT_ADMIN_SETTINGS,
} from "../constants/admin.constants";
import { SEED_PACKAGES } from "../fixtures/package.fixtures";
import { SEED_EMPLOYEES } from "../fixtures/employee.fixtures";
import { SEED_TASKS } from "../fixtures/task.fixtures";
import { SEED_CODES, SEED_CODE_USAGES } from "../fixtures/code.fixtures";
import { SEED_SUBMISSIONS } from "../fixtures/submission.fixtures";
import { SEED_DEPOSITS } from "../fixtures/deposit.fixtures";
import { SEED_WITHDRAWALS } from "../fixtures/withdrawal.fixtures";
import { SEED_FINANCE_TRANSACTIONS } from "../fixtures/finance.fixtures";
import {
  SEED_REFERRAL_MEMBERS,
  SEED_COMMISSIONS,
} from "../fixtures/referral.fixtures";
import { SEED_ADMINS } from "../fixtures/account.fixtures";
import { SEED_AUDIT_LOGS } from "../fixtures/audit.fixtures";
import type {
  AdminAccount,
  AdminAuditLog,
  AdminDeposit,
  AdminEmployee,
  AdminFinanceTransaction,
  AdminPackage,
  AdminReferralCommission,
  AdminReferralMember,
  AdminSubmission,
  AdminSystemSettings,
  AdminTask,
  AdminWithdrawal,
  CodeUsageRecord,
  TaskUnlockCode,
} from "../types/admin.types";

import { useTaskCodeActions } from "./actions/use-task-code-actions";
import { useTaskActions } from "./actions/use-task-actions";
import { useSubmissionReviewActions } from "./actions/use-submission-review-actions";
import { useEmployeeRestrictionActions } from "./actions/use-employee-restriction-actions";
import { useEmployeeAccountActions } from "./actions/use-employee-account-actions";
import { usePackageActions } from "./actions/use-package-actions";
import { useDepositActions } from "./actions/use-deposit-actions";
import { useWithdrawalActions } from "./actions/use-withdrawal-actions";
import { useSettingsActions } from "./actions/use-settings-actions";
import type { AdminStateContextValue } from "./admin-state.types";
import { generateId, getNowTimestamp } from "../utils/admin-records";

export const AdminStateContext = createContext<AdminStateContextValue | null>(
  null,
);

export function AdminStateProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [employees, setEmployees] =
    useState<readonly AdminEmployee[]>(SEED_EMPLOYEES);
  const [packages, setPackages] =
    useState<readonly AdminPackage[]>(SEED_PACKAGES);
  const [tasks, setTasks] = useState<readonly AdminTask[]>(SEED_TASKS);
  const [codes, setCodes] = useState<readonly TaskUnlockCode[]>(SEED_CODES);
  const [codeUsages, setCodeUsages] =
    useState<readonly CodeUsageRecord[]>(SEED_CODE_USAGES);
  const [submissions, setSubmissions] =
    useState<readonly AdminSubmission[]>(SEED_SUBMISSIONS);
  const [deposits, setDeposits] =
    useState<readonly AdminDeposit[]>(SEED_DEPOSITS);
  const [withdrawals, setWithdrawals] =
    useState<readonly AdminWithdrawal[]>(SEED_WITHDRAWALS);
  const [financeTransactions, setFinanceTransactions] = useState<
    readonly AdminFinanceTransaction[]
  >(SEED_FINANCE_TRANSACTIONS);
  const [referralMembers] = useState<readonly AdminReferralMember[]>(
    SEED_REFERRAL_MEMBERS,
  );
  const [referralCommissions] =
    useState<readonly AdminReferralCommission[]>(SEED_COMMISSIONS);
  const [auditLogs, setAuditLogs] =
    useState<readonly AdminAuditLog[]>(SEED_AUDIT_LOGS);
  const [settings, setSettings] = useState<AdminSystemSettings>(
    DEFAULT_ADMIN_SETTINGS,
  );
  const [admins, setAdmins] = useState<readonly AdminAccount[]>(SEED_ADMINS);

  const addAuditLog = useCallback(
    (
      entry: Omit<
        AdminAuditLog,
        "id" | "adminName" | "adminEmail" | "timestamp"
      >,
    ) => {
      const newEntry: AdminAuditLog = {
        id: generateId("aud"),
        adminName: CURRENT_ADMIN.name,
        adminEmail: CURRENT_ADMIN.email,
        timestamp: getNowTimestamp(),
        ...entry,
      };
      setAuditLogs((prev) => [newEntry, ...prev]);
    },
    [],
  );
  const {
    isTaskUnlockedForEmployee,
    unlockTaskWithCode,
    createCode,
    toggleCodeStatus,
    getDistinctCodeUsersCount,
    getDistinctTaskUnlocksCount,
  } = useTaskCodeActions({
    employees,
    tasks,
    codes,
    codeUsages,
    setCodes,
    setCodeUsages,
    addAuditLog,
  });
  const { createTask, updateTask, toggleTaskStatus } = useTaskActions({
    tasks,
    setTasks,
    addAuditLog,
  });
  const { approveSubmission, rejectSubmission } = useSubmissionReviewActions({
    submissions,
    setEmployees,
    setCodeUsages,
    setSubmissions,
    setFinanceTransactions,
    addAuditLog,
  });
  const {
    toggleEmployeeAccountStatus,
    toggleEmployeeTaskRestriction,
    toggleEmployeeWithdrawalRestriction,
  } = useEmployeeRestrictionActions({ employees, setEmployees, addAuditLog });
  const {
    adjustEmployeeBalance,
    updateEmployeeWithdrawalAddress,
    deleteEmployeeAccount,
  } = useEmployeeAccountActions({
    employees,
    setEmployees,
    setFinanceTransactions,
    addAuditLog,
  });
  const { updatePackage } = usePackageActions({
    packages,
    setPackages,
    addAuditLog,
  });
  const { manualCreditDeposit } = useDepositActions({
    employees,
    deposits,
    setEmployees,
    setDeposits,
    setFinanceTransactions,
    addAuditLog,
  });
  const {
    holdWithdrawal,
    releaseWithdrawal,
    rejectWithdrawal,
    completeWithdrawal,
    extendWithdrawalSchedule,
  } = useWithdrawalActions({
    withdrawals,
    setEmployees,
    setWithdrawals,
    setFinanceTransactions,
    addAuditLog,
  });
  const {
    updateSettings,
    createAdminAccount,
    toggleAdminStatus,
    updateAdminAccount,
  } = useSettingsActions({
    settings,
    admins,
    setSettings,
    setAdmins,
    addAuditLog,
  });

  const value = useMemo<AdminStateContextValue>(
    () => ({
      employees,
      packages,
      tasks,
      codes,
      codeUsages,
      submissions,
      deposits,
      withdrawals,
      financeTransactions,
      referralMembers,
      referralCommissions,
      auditLogs,
      settings,
      admins,
      currentAdmin: CURRENT_ADMIN,

      createCode,
      toggleCodeStatus,
      unlockTaskWithCode,
      isTaskUnlockedForEmployee,
      getDistinctCodeUsersCount,
      getDistinctTaskUnlocksCount,

      createTask,
      updateTask,
      toggleTaskStatus,

      approveSubmission,
      rejectSubmission,

      toggleEmployeeAccountStatus,
      toggleEmployeeTaskRestriction,
      toggleEmployeeWithdrawalRestriction,
      adjustEmployeeBalance,
      updateEmployeeWithdrawalAddress,
      deleteEmployeeAccount,

      updatePackage,
      manualCreditDeposit,

      holdWithdrawal,
      releaseWithdrawal,
      extendWithdrawalSchedule,
      rejectWithdrawal,
      completeWithdrawal,

      updateSettings,

      createAdminAccount,
      updateAdminAccount,
      toggleAdminStatus,
    }),
    [
      employees,
      packages,
      tasks,
      codes,
      codeUsages,
      submissions,
      deposits,
      withdrawals,
      financeTransactions,
      referralMembers,
      referralCommissions,
      auditLogs,
      settings,
      admins,
      createCode,
      toggleCodeStatus,
      unlockTaskWithCode,
      isTaskUnlockedForEmployee,
      getDistinctCodeUsersCount,
      getDistinctTaskUnlocksCount,
      createTask,
      updateTask,
      toggleTaskStatus,
      approveSubmission,
      rejectSubmission,
      toggleEmployeeAccountStatus,
      toggleEmployeeTaskRestriction,
      toggleEmployeeWithdrawalRestriction,
      adjustEmployeeBalance,
      updateEmployeeWithdrawalAddress,
      deleteEmployeeAccount,
      updatePackage,
      manualCreditDeposit,
      holdWithdrawal,
      releaseWithdrawal,
      extendWithdrawalSchedule,
      rejectWithdrawal,
      completeWithdrawal,
      updateSettings,
      createAdminAccount,
      updateAdminAccount,
      toggleAdminStatus,
    ],
  );

  return (
    <AdminStateContext.Provider value={value}>
      {children}
    </AdminStateContext.Provider>
  );
}

export function useAdminState(): AdminStateContextValue {
  const context = useContext(AdminStateContext);
  if (!context) {
    throw new Error("useAdminState must be used within an AdminStateProvider");
  }
  return context;
}
