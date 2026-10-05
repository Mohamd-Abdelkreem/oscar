import type {
  DailyTask,
  DepositRecord,
  EmployeeUser,
  FinancialBalance,
  LedgerTransaction,
  PackageId,
  PackageTier,
  TaskHistoryItem,
  TaskStatus,
  TeamCommissionRecord,
  TeamMember,
  WithdrawalRequest,
} from "../types/employee.types";
import type { Dispatch, SetStateAction } from "react";

// Function size/CQS exception: keep each preview financial transition and its
// UI result together. Revisit when persisted transactions replace these actions.
export interface EmployeeContextValue {
  readonly user: EmployeeUser;
  readonly currentPackage: PackageTier;
  readonly packageExpiryDays: number;
  readonly balance: FinancialBalance;
  readonly task: DailyTask;
  readonly taskHistory: readonly TaskHistoryItem[];
  readonly withdrawals: readonly WithdrawalRequest[];
  readonly deposits: readonly DepositRecord[];
  readonly transactions: readonly LedgerTransaction[];
  readonly teamMembers: readonly TeamMember[];
  readonly teamCommissions: readonly TeamCommissionRecord[];
  readonly submitTask: (screenshotUrl: string) => {
    success: boolean;
    message: string;
  };
  readonly replaceTaskScreenshot: (screenshotUrl: string) => {
    success: boolean;
    message: string;
  };
  readonly setTaskScenario: (scenario: TaskStatus) => void;
  readonly setupWithdrawalAddress: (address: string) => {
    success: boolean;
    message: string;
  };
  readonly requestWithdrawal: (amount: number) => {
    success: boolean;
    message: string;
  };
  readonly checkDepositStatus: (depositId: string) => void;
  readonly simulateRejectPendingWithdrawal: () => void;
  readonly simulateApprovePendingWithdrawal: () => void;
  readonly hasPendingWithdrawal: boolean;
  readonly pendingWithdrawal: WithdrawalRequest | undefined;
}
type EmployeeStateData = Pick<
  EmployeeContextValue,
  "user" | "balance" | "task" | "withdrawals" | "deposits" | "transactions"
> & { readonly currentPackageId: PackageId };
type EmployeeStateSetters = {
  [Key in keyof EmployeeStateData as `set${Capitalize<Key>}`]: Dispatch<
    SetStateAction<EmployeeStateData[Key]>
  >;
};
export type EmployeeActionDependencies = EmployeeStateData &
  EmployeeStateSetters &
  Pick<
    EmployeeContextValue,
    "currentPackage" | "pendingWithdrawal" | "hasPendingWithdrawal"
  >;
