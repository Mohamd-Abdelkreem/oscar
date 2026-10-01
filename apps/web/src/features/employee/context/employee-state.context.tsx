"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FINANCIAL_RULES } from "../constants/branding";
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
  PackageTier,
  TaskHistoryItem,
  TaskStatus,
  TeamCommissionRecord,
  TeamMember,
  WithdrawalRequest,
} from "../types/employee.types";
import {
  completeWithdrawal,
  creditTaskReward,
  releaseWithdrawal,
  reserveWithdrawal,
  spendAvailable,
} from "../utils/balance-transitions";
import {
  formatLocalTime,
  getRequiredDeposit,
  getUpgradeCost,
} from "../utils/financial-calculations";
import {
  createPackageUpgradeTransaction,
  createTaskRewardTransaction,
  createWithdrawalReservationTransaction,
  createWithdrawalReversalTransaction,
} from "../utils/ledger-transactions";
import { createWithdrawalRequest } from "../utils/withdrawal-request";

interface EmployeeContextValue {
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
  readonly upgradeToPackage: (targetPackageId: PackageId) => {
    success: boolean;
    message: string;
  };
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

const EmployeeStateContext = createContext<EmployeeContextValue | null>(null);

export function EmployeeStateProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [user, setUser] = useState<EmployeeUser>(INITIAL_USER);
  const [currentPackageId, setCurrentPackageId] = useState<PackageId>("S1");
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

  // 1. Submit daily task
  const submitTask = useCallback(
    (screenshotUrl: string): { success: boolean; message: string } => {
      if (task.status === "submitted" || task.status === "approved") {
        return { success: false, message: "تم إرسال مهمة اليوم مسبقاً." };
      }

      const reward = task.rewardAmount;
      const now = new Date();
      const timeStr = formatLocalTime(now);

      setTask((prev) => ({
        ...prev,
        status: "submitted",
        submittedScreenshot: screenshotUrl,
        submittedAt: timeStr,
      }));

      // In the demo, reward is added immediately on submission
      setBalance((prev) => creditTaskReward(prev, reward));

      const newTx = createTaskRewardTransaction(reward, now);

      setTransactions((prev) => [newTx, ...prev]);

      return {
        success: true,
        message:
          "تم إرسال المهمة بنجاح وإضافة المكافأة (" +
          reward.toFixed(2) +
          " USDT) قيد المراجعة.",
      };
    },
    [task.rewardAmount, task.status],
  );

  // 2. Replace screenshot while pending review (does NOT add duplicate reward)
  const replaceTaskScreenshot = useCallback(
    (screenshotUrl: string): { success: boolean; message: string } => {
      if (task.status !== "submitted") {
        return {
          success: false,
          message:
            "يمكن استبدال لقطة الشاشة فقط عندما تكون المهمة قيد المراجعة.",
        };
      }

      setTask((prev) => ({
        ...prev,
        submittedScreenshot: screenshotUrl,
      }));

      return {
        success: true,
        message: "تم تحديث لقطة الشاشة المرفقة بنجاح دون تغيير المكافأة.",
      };
    },
    [task.status],
  );

  // 3. Scenario override for task
  const setTaskScenario = useCallback((scenario: TaskStatus) => {
    setTask((prev) => ({
      ...prev,
      status: scenario,
      submittedScreenshot:
        scenario === "submitted"
          ? prev.submittedScreenshot || "/employee/task-preview.svg"
          : undefined,
      rejectionReason:
        scenario === "rejected"
          ? "لقطة الشاشة غير واضحة ولا تثبت التفاعل المطلوب على المنصة."
          : undefined,
    }));
  }, []);

  // 4. Upgrade package / position
  const upgradeToPackage = useCallback(
    (targetPackageId: PackageId): { success: boolean; message: string } => {
      const target = PACKAGES.find((p) => p.id === targetPackageId);
      if (!target) return { success: false, message: "المنصب غير موجود." };

      if (currentPackageId === targetPackageId) {
        return { success: false, message: "أنت مفعّل بالفعل في هذا المنصب." };
      }

      const currentPrice = currentPackage.price;
      const targetPrice = target.price;

      if (currentPackage.id !== "FREE" && targetPrice <= currentPrice) {
        return {
          success: false,
          message:
            "لا يمكن التراجع لمنصب أدنى. تقتصر الترقية على المناصب الأعلى فقط.",
        };
      }

      const upgradeCost = getUpgradeCost(currentPackage, target);

      if (balance.available < upgradeCost) {
        const requiredDeposit = getRequiredDeposit(
          upgradeCost,
          balance.available,
        );
        return {
          success: false,
          message:
            "الرصيد المتاح (" +
            balance.available.toFixed(2) +
            " USDT) غير كافٍ. يتطلب إيداع إضافي قدره " +
            requiredDeposit.toFixed(2) +
            " USDT.",
        };
      }

      // Deduct upgrade cost
      setBalance((prev) => spendAvailable(prev, upgradeCost));

      setCurrentPackageId(targetPackageId);

      // Future unsubmitted tasks reflect the new position's daily reward
      setTask((prev) => {
        if (
          prev.status === "submitted" ||
          prev.status === "approved" ||
          prev.status === "rejected"
        ) {
          return prev;
        }
        return {
          ...prev,
          rewardAmount: target.dailyReward,
        };
      });

      const newTx = createPackageUpgradeTransaction(
        currentPackage,
        target,
        upgradeCost,
        new Date(),
      );

      setTransactions((prev) => [newTx, ...prev]);

      return {
        success: true,
        message: "تم تفعيل " + target.name + " بنجاح.",
      };
    },
    [balance.available, currentPackage, currentPackageId],
  );

  // 5. Setup withdrawal address (one-time setup)
  const setupWithdrawalAddress = useCallback(
    (address: string): { success: boolean; message: string } => {
      const trimmed = address.trim();
      if (!trimmed.startsWith("T") || trimmed.length !== 34) {
        return {
          success: false,
          message:
            "يرجى إدخال عنوان TRC20 صالح يبدأ بحرف T ويتكون من 34 رمزاً.",
        };
      }

      setUser((prev) => ({
        ...prev,
        savedWithdrawalAddress: trimmed,
      }));

      return {
        success: true,
        message: "تم حفظ عنوان السحب وتأمينه بنجاح.",
      };
    },
    [],
  );

  // 6. Request withdrawal
  const requestWithdrawal = useCallback(
    (amount: number): { success: boolean; message: string } => {
      if (hasPendingWithdrawal) {
        return {
          success: false,
          message:
            "لديك طلب سحب قيد المعالجة حالياً. لا يمكن تقديم أكثر من طلب في وقت واحد.",
        };
      }

      if (!user.savedWithdrawalAddress) {
        return {
          success: false,
          message: "يرجى تعيين وتأكيد عنوان السحب أولاً في حسابك.",
        };
      }

      if (amount < FINANCIAL_RULES.withdrawalMinAmount) {
        return {
          success: false,
          message:
            "الحد الأدنى للسحب هو " +
            FINANCIAL_RULES.withdrawalMinAmount.toString() +
            " USDT.",
        };
      }

      if (amount > FINANCIAL_RULES.withdrawalMaxAmount) {
        return {
          success: false,
          message:
            "الحد الأقصى للسحب هو " +
            FINANCIAL_RULES.withdrawalMaxAmount.toString() +
            " USDT.",
        };
      }

      if (amount > balance.available) {
        return {
          success: false,
          message:
            "الرصيد المتاح (" +
            balance.available.toFixed(2) +
            " USDT) غير كافٍ لتغطية المبلغ المطلوب.",
        };
      }

      const now = new Date();
      const newReq = createWithdrawalRequest(
        amount,
        user.savedWithdrawalAddress,
        now,
      );
      const netAmount = newReq.netAmount;

      // Reserve funds: available decreases, reserved increases, total stays same!
      setBalance((prev) => reserveWithdrawal(prev, amount));

      setWithdrawals((prev) => [newReq, ...prev]);

      const newTx = createWithdrawalReservationTransaction(newReq, now);

      setTransactions((prev) => [newTx, ...prev]);

      return {
        success: true,
        message:
          "تم تقديم طلب السحب بنجاح وحجز " +
          amount.toFixed(2) +
          " USDT. الصافي المتوقع " +
          netAmount.toFixed(2) +
          " USDT بعد خصم الرسوم 21%.",
      };
    },
    [balance.available, hasPendingWithdrawal, user.savedWithdrawalAddress],
  );

  // 7. Check / confirm deposit status
  const checkDepositStatus = useCallback((depositId: string) => {
    setDeposits((prev) =>
      prev.map((d) => (d.id === depositId ? { ...d, status: "confirmed" } : d)),
    );
  }, []);

  // 8. Rejection of pending withdrawal simulation (unlocks funds)
  const simulateRejectPendingWithdrawal = useCallback(() => {
    if (!pendingWithdrawal) return;

    const amount = pendingWithdrawal.amount;

    // Unlock reservation: available increases, reserved decreases
    setBalance((prev) => releaseWithdrawal(prev, amount));

    setWithdrawals((prev) =>
      prev.map((w) =>
        w.id === pendingWithdrawal.id
          ? {
              ...w,
              status: "rejected",
              rejectionReason:
                "تم إيقاف الطلب من قبل الإدارة للتحقق الأمني من ملكية العنوان.",
            }
          : w,
      ),
    );

    const reversalTx = createWithdrawalReversalTransaction(
      pendingWithdrawal,
      new Date(),
    );

    setTransactions((prev) => [reversalTx, ...prev]);
  }, [pendingWithdrawal]);

  // 9. Completion of pending withdrawal simulation
  const simulateApprovePendingWithdrawal = useCallback(() => {
    if (!pendingWithdrawal) return;

    const amount = pendingWithdrawal.amount;

    // Completed: reserved decreases, total decreases
    setBalance((prev) => completeWithdrawal(prev, amount));

    setWithdrawals((prev) =>
      prev.map((w) =>
        w.id === pendingWithdrawal.id
          ? {
              ...w,
              status: "completed",
            }
          : w,
      ),
    );
  }, [pendingWithdrawal]);

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
      upgradeToPackage,
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
      upgradeToPackage,
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
