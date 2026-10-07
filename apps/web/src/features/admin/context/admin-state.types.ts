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
import type { Dispatch, SetStateAction } from "react";
import type { CURRENT_ADMIN } from "../constants/admin.constants";

// Function size/CQS exception: financial actions retain the existing result and
// coordinated balance/ledger/audit transaction. Revisit when persistence replaces
// these preview actions, rather than splitting a transaction between state owners.
export interface AdminStateContextValue {
  readonly employees: readonly AdminEmployee[];
  readonly packages: readonly AdminPackage[];
  readonly tasks: readonly AdminTask[];
  readonly codes: readonly TaskUnlockCode[];
  readonly codeUsages: readonly CodeUsageRecord[];
  readonly submissions: readonly AdminSubmission[];
  readonly deposits: readonly AdminDeposit[];
  readonly withdrawals: readonly AdminWithdrawal[];
  readonly financeTransactions: readonly AdminFinanceTransaction[];
  readonly referralMembers: readonly AdminReferralMember[];
  readonly referralCommissions: readonly AdminReferralCommission[];
  readonly auditLogs: readonly AdminAuditLog[];
  readonly settings: AdminSystemSettings;
  readonly admins: readonly AdminAccount[];
  readonly currentAdmin: typeof CURRENT_ADMIN;

  // Employee actions
  readonly toggleEmployeeAccountStatus: (employeeId: string) => void;
  readonly toggleEmployeeTaskRestriction: (employeeId: string) => void;
  readonly toggleEmployeeWithdrawalRestriction: (employeeId: string) => void;
  readonly adjustEmployeeBalance: (
    employeeId: string,
    amount: number,
    direction: "credit" | "debit",
    reason: string,
  ) => { success: boolean; message: string };
  readonly updateEmployeeWithdrawalAddress: (
    employeeId: string,
    newAddress: string,
    reason: string,
  ) => { success: boolean; message: string };
  readonly deleteEmployeeAccount: (
    employeeId: string,
    reason: string,
  ) => { success: boolean; message: string };

  // Deposit actions
  readonly manualCreditDeposit: (
    employeeId: string,
    amount: number,
    reference: string,
    reason: string,
  ) => { success: boolean; message: string };

  // Withdrawal actions
  readonly holdWithdrawal: (withdrawalId: string, reason: string) => void;
  readonly releaseWithdrawal: (withdrawalId: string) => void;
  readonly extendWithdrawalSchedule: (
    withdrawalId: string,
    additionalHours: number,
    reason: string,
  ) => {
    success: boolean;
    message: string;
    withdrawal?: AdminWithdrawal | undefined;
  };
  readonly rejectWithdrawal: (
    withdrawalId: string,
    reason: string,
  ) => { success: boolean; message: string };
  readonly completeWithdrawal: (withdrawalId: string) => void;

  // Settings actions
  readonly updateSettings: (newSettings: Partial<AdminSystemSettings>) => void;

  readonly createAdminAccount: (data: { name: string; email: string }) => {
    success: boolean;
    message: string;
  };
  readonly updateAdminAccount: (
    adminId: string,
    data: { name: string; email: string },
  ) => { success: boolean; message: string };
  readonly toggleAdminStatus: (adminId: string) => void;
}

export type AdminStateData = Pick<
  AdminStateContextValue,
  | "employees"
  | "packages"
  | "tasks"
  | "codes"
  | "codeUsages"
  | "submissions"
  | "deposits"
  | "withdrawals"
  | "financeTransactions"
  | "referralMembers"
  | "referralCommissions"
  | "auditLogs"
  | "settings"
  | "admins"
>;
type MutableAdminState = Omit<
  AdminStateData,
  "referralMembers" | "referralCommissions"
>;
type AdminStateSetters = {
  [Key in keyof MutableAdminState as `set${Capitalize<Key>}`]: Dispatch<
    SetStateAction<MutableAdminState[Key]>
  >;
};
export type AdminActionDependencies = AdminStateData &
  AdminStateSetters & {
    addAuditLog: (
      entry: Omit<
        AdminAuditLog,
        "id" | "adminName" | "adminEmail" | "timestamp"
      >,
    ) => void;
  };
