import type {
  PackageId,
  TransactionType,
} from "@/features/employee/types/employee.types";

export type AdminAccountStatus = "active" | "suspended" | "blocked";

export interface AdminEmployeeRestrictions {
  readonly tasksBlocked: boolean;
  readonly withdrawalsBlocked: boolean;
}

export interface AdminEmployee {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly invitationCode: string;
  readonly packageId: PackageId;
  readonly balance: {
    readonly total: number;
    readonly available: number;
    readonly reserved: number;
  };
  readonly walletAddress: string;
  readonly accountStatus: AdminAccountStatus;
  readonly restrictions: AdminEmployeeRestrictions;
  readonly registeredAt: string;
  readonly lastActiveAt: string;
  readonly sponsorId?: string | undefined;
  readonly sponsorName?: string | undefined;
  readonly notes?: string | undefined;
  readonly isDeleted?: boolean | undefined;
}

export interface AdminPackage {
  readonly id: PackageId;
  readonly name: string;
  readonly price: number;
  readonly dailyReward: number;
  readonly durationDays: number;
  readonly cycle: "يومي";
  readonly withdrawalFeePercent: number;
  readonly activeSubscriptionsCount: number;
  readonly isEditable: boolean;
}

export type AdminTaskState = "active" | "scheduled" | "paused" | "closed";

export interface AdminTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly targetUrl: string;
  readonly platform: string;
  readonly previewImageUrl: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly timezone: string;
  readonly rewardAmount: number;
  readonly status: AdminTaskState;
  readonly isCodeRequired: boolean;
  readonly startDate: string;
  readonly endDate: string;
  readonly createdAt: string;
}

export type CodeState = "active" | "paused";

export interface TaskUnlockCode {
  readonly id: string;
  readonly code: string;
  readonly taskId: string;
  readonly status: CodeState;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt?: string | undefined;
  readonly description?: string | undefined;
}

export type SubmissionState =
  "not_submitted" | "submitted" | "approved" | "rejected";

export interface CodeUsageRecord {
  readonly id: string;
  readonly codeId: string;
  readonly code: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeEmail: string;
  readonly unlockedAt: string;
  readonly submissionState: SubmissionState;
}

export type AdminSubmissionStatus = "pending" | "approved" | "rejected";

export interface AdminSubmission {
  readonly id: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeEmail: string;
  readonly screenshotUrl: string;
  readonly rewardAmount: number;
  readonly status: AdminSubmissionStatus;
  readonly submittedAt: string;
  readonly reviewedAt?: string | undefined;
  readonly reviewedBy?: string | undefined;
  readonly rejectionReason?: string | undefined;
  readonly isReversed?: boolean | undefined;
}

export type AdminDepositStatus = "confirmed" | "verifying" | "rejected";

export interface AdminDeposit {
  readonly id: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeEmail: string;
  readonly amount: number;
  readonly currency: string;
  readonly network: string;
  readonly txId: string;
  readonly toAddress: string;
  readonly status: AdminDepositStatus;
  readonly createdAt: string;
  readonly reference: string;
  readonly isManual?: boolean | undefined;
  readonly manualReason?: string | undefined;
}

export type AdminWithdrawalStatus =
  "scheduled" | "held" | "processing" | "completed" | "rejected";

export interface AdminWithdrawal {
  readonly id: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeEmail: string;
  readonly amount: number;
  readonly fee: number;
  readonly feeRate: number;
  readonly netAmount: number;
  readonly targetAddress: string;
  readonly status: AdminWithdrawalStatus;
  readonly requestedAt: string;
  readonly dueAt: string;
  readonly originalDurationHours?: number | undefined;
  readonly addedHours?: number | undefined;
  readonly holdReason?: string | undefined;
  readonly rejectionReason?: string | undefined;
  readonly completedAt?: string | undefined;
}

export interface AdminFinanceTransaction {
  readonly id: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly type: TransactionType;
  readonly title: string;
  readonly amount: number;
  readonly direction: "credit" | "debit" | "neutral";
  readonly isBalanceNeutral?: boolean | undefined;
  readonly status: "completed" | "reversed" | "pending";
  readonly reference: string;
  readonly source: string;
  readonly date: string;
  readonly details?: Record<string, string | number> | undefined;
}

export interface AdminReferralMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly packageId: PackageId;
  readonly joinedAt: string;
  readonly status: "active" | "inactive";
  readonly sponsorId?: string | undefined;
  readonly sponsorName?: string | undefined;
  readonly totalCommissionEarned: number;
  readonly directReferralsCount: number;
  readonly teamCount: number;
}

export interface AdminReferralCommission {
  readonly id: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly sponsorId: string;
  readonly sponsorName: string;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly event: string;
  readonly calculationBasis: number;
  readonly rate: number;
  readonly commissionAmount: number;
  readonly date: string;
}

export interface AdminAuditLog {
  readonly id: string;
  readonly adminName: string;
  readonly adminEmail: string;
  readonly action: string;
  readonly targetType:
    | "code"
    | "employee"
    | "task"
    | "submission"
    | "deposit"
    | "withdrawal"
    | "package"
    | "settings"
    | "banner"
    | "admin";
  readonly targetId: string;
  readonly targetTitle: string;
  readonly previousState?: string | undefined;
  readonly newState?: string | undefined;
  readonly reason?: string | undefined;
  readonly timestamp: string;
}

export interface AdminSystemSettings {
  readonly withdrawalMinAmount: number;
  readonly withdrawalMaxAmount: number;
  readonly withdrawalFeePercent: number;
  readonly withdrawalCooldownHours: number;
  readonly withdrawalProcessingHours: number;
  readonly taskWindowStart: string;
  readonly taskWindowEnd: string;
  readonly timezone: string;
  readonly referralPercentages: readonly [
    number,
    number,
    number,
    number,
    number,
  ];
}

export interface AdminAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: "ADMIN";
  readonly status: "active" | "inactive";
  readonly lastActiveAt: string;
  readonly createdAt: string;
}

export type UnlockCodeResult =
  | { success: true; message: "تم فتح المهمة بنجاح" }
  | { success: false; reason: "invalid_code"; message: "الرمز غير صحيح" }
  | { success: false; reason: "code_paused"; message: "هذا الرمز متوقف حالياً" }
  | {
      success: false;
      reason: "wrong_task";
      message: "هذا الرمز مخصص لمهمة أخرى";
    }
  | {
      success: false;
      reason: "task_restricted";
      message: "تم إيقاف صلاحية تنفيذ المهام لحسابك من قبل الإدارة";
    }
  | {
      success: false;
      reason: "account_suspended";
      message: "حسابك معلق حالياً من قبل الإدارة";
    };
