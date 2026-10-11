import type {
  DailyTask,
  DepositRecord,
  EmployeeUser,
  FinancialBalance,
  LedgerTransaction,
  PackageTier,
  TaskHistoryItem,
  TeamCommissionRecord,
  TeamMember,
} from "../types/employee.types";

export interface EmployeeContextValue {
  readonly user: EmployeeUser;
  readonly currentPackage: PackageTier;
  readonly packageExpiryDays: number;
  readonly balance: FinancialBalance;
  readonly task: DailyTask;
  readonly taskHistory: readonly TaskHistoryItem[];
  readonly deposits: readonly DepositRecord[];
  readonly transactions: readonly LedgerTransaction[];
  readonly teamMembers: readonly TeamMember[];
  readonly teamCommissions: readonly TeamCommissionRecord[];
  readonly checkDepositStatus: (depositId: string) => void;
}
