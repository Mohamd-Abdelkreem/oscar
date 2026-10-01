export type PackageId = "FREE" | "S1" | "S2" | "O1" | "O2" | "A1";

export interface EmployeeActionResult {
  readonly success: boolean;
  readonly message: string;
}

export interface PackageTier {
  readonly id: PackageId;
  readonly name: string;
  readonly price: number;
  readonly dailyReward: number;
  readonly durationDays: number;
  readonly cycle?: string;
  readonly description: string;
  readonly features: readonly string[];
}

export interface EmployeeUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly invitationCode: string;
  readonly registeredAt: string;
  readonly isEmailVerified: boolean;
  readonly savedWithdrawalAddress?: string | undefined;
}

export type TaskStatus =
  | "before_window"
  | "open"
  | "submitted"
  | "approved"
  | "rejected"
  | "closed"
  | "free";

export interface DailyTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly instructions: readonly string[];
  readonly targetUrl: string;
  readonly platform: string;
  readonly rewardAmount: number;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly timezone: string;
  readonly previewImageUrl: string;
  readonly status: TaskStatus;
  readonly rejectionReason?: string | undefined;
  readonly submittedScreenshot?: string | undefined;
  readonly submittedAt?: string | undefined;
  readonly isCodeRequired?: boolean | undefined;
}

export interface TaskHistoryItem {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly rewardAmount: number;
  readonly status: "approved" | "pending" | "rejected";
  readonly rejectionReason?: string | undefined;
}

export type WithdrawalStatus = "pending" | "completed" | "rejected";

export interface WithdrawalRequest {
  readonly id: string;
  readonly amount: number;
  readonly fee: number;
  readonly feeRate: number;
  readonly netAmount: number;
  readonly targetAddress: string;
  readonly status: WithdrawalStatus;
  readonly requestedAt: string;
  readonly dueAt: string;
  readonly rejectionReason?: string | undefined;
}

export type DepositStatus = "confirmed" | "verifying" | "rejected";

export interface DepositRecord {
  readonly id: string;
  readonly amount: number;
  readonly currency: string;
  readonly network: string;
  readonly txId: string;
  readonly toAddress: string;
  readonly status: DepositStatus;
  readonly createdAt: string;
}

export type TransactionType =
  | "deposit"
  | "withdrawal_reservation"
  | "withdrawal_completion"
  | "withdrawal_reversal"
  | "task_reward"
  | "task_reward_reversal"
  | "referral_commission"
  | "package_purchase"
  | "package_upgrade"
  | "admin_adjustment";

export interface LedgerTransaction {
  readonly id: string;
  readonly type: TransactionType;
  readonly title: string;
  readonly amount: number; // Signed: positive = credit, negative = debit
  readonly currency: string;
  readonly date: string;
  readonly status: "completed" | "pending" | "reversed" | "rejected";
  readonly reference: string;
  readonly details?: Record<string, string | number> | undefined;
}

export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly packageId: PackageId;
  readonly joinedAt: string;
  readonly status: "active" | "inactive";
  readonly totalCommissionEarned: number;
}

export interface TeamCommissionRecord {
  readonly id: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly event: string;
  readonly calculationBasis: number;
  readonly rate: number;
  readonly commissionAmount: number;
  readonly date: string;
}

export interface FinancialBalance {
  readonly total: number;
  readonly available: number;
  readonly reserved: number;
  readonly breakdown: {
    readonly deposits: number;
    readonly taskRewards: number;
    readonly referralCommissions: number;
  };
}
