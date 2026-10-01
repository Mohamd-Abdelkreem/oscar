"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FINANCIAL_RULES } from "../constants/branding";
import {
  INITIAL_BALANCE,
  INITIAL_DEPOSITS,
  INITIAL_TASK,
  INITIAL_TASK_HISTORY,
  INITIAL_TEAM_COMMISSIONS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_TRANSACTIONS,
  INITIAL_USER,
  INITIAL_WITHDRAWALS,
  PACKAGES,
} from "../fixtures/employee.fixtures";
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
  readonly submitTask: (screenshotUrl: string) => { success: boolean; message: string };
  readonly replaceTaskScreenshot: (screenshotUrl: string) => { success: boolean; message: string };
  readonly setTaskScenario: (scenario: TaskStatus) => void;
  readonly upgradeToPackage: (targetPackageId: PackageId) => { success: boolean; message: string };
  readonly setupWithdrawalAddress: (address: string) => { success: boolean; message: string };
  readonly requestWithdrawal: (amount: number) => { success: boolean; message: string };
  readonly checkDepositStatus: (depositId: string) => void;
  readonly simulateRejectPendingWithdrawal: () => void;
  readonly simulateApprovePendingWithdrawal: () => void;
  readonly hasPendingWithdrawal: boolean;
  readonly pendingWithdrawal: WithdrawalRequest | undefined;
}

const EmployeeStateContext = createContext<EmployeeContextValue | null>(null);

export function EmployeeStateProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<EmployeeUser>(INITIAL_USER);
  const [currentPackageId, setCurrentPackageId] = useState<PackageId>("S1");
  const [packageExpiryDays] = useState(22);
  const [balance, setBalance] = useState<FinancialBalance>(INITIAL_BALANCE);
  const [task, setTask] = useState<DailyTask>(INITIAL_TASK);
  const [taskHistory] = useState<readonly TaskHistoryItem[]>(INITIAL_TASK_HISTORY);
  const [withdrawals, setWithdrawals] = useState<readonly WithdrawalRequest[]>(INITIAL_WITHDRAWALS);
  const [deposits, setDeposits] = useState<readonly DepositRecord[]>(INITIAL_DEPOSITS);
  const [transactions, setTransactions] = useState<readonly LedgerTransaction[]>(INITIAL_TRANSACTIONS);
  const [teamMembers] = useState<readonly TeamMember[]>(INITIAL_TEAM_MEMBERS);
  const [teamCommissions] = useState<readonly TeamCommissionRecord[]>(INITIAL_TEAM_COMMISSIONS);

  const currentPackage = useMemo(() => {
    const pkg = PACKAGES.find((p) => p.id === currentPackageId);
    return pkg ?? (PACKAGES[1] as PackageTier);
  }, [currentPackageId]);

  const pendingWithdrawal = useMemo(() => {
    return withdrawals.find((w) => w.status === "pending");
  }, [withdrawals]);

  const hasPendingWithdrawal = pendingWithdrawal !== undefined;

  // 1. Submit daily task
  const submitTask = useCallback(
    (screenshotUrl: string): { success: boolean; message: string } => {
      if (task.status === "submitted" || task.status === "approved") {
        return { success: false, message: "تم إرسال مهمة اليوم مسبقاً." };
      }

      const reward = task.rewardAmount;
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      setTask((prev) => ({
        ...prev,
        status: "submitted",
        submittedScreenshot: screenshotUrl,
        submittedAt: timeStr,
      }));

      // In the demo, reward is added immediately on submission
      setBalance((prev) => ({
        total: Number((prev.total + reward).toFixed(2)),
        available: Number((prev.available + reward).toFixed(2)),
        reserved: prev.reserved,
        breakdown: {
          ...prev.breakdown,
          taskRewards: Number((prev.breakdown.taskRewards + reward).toFixed(2)),
        },
      }));

      const newTx: LedgerTransaction = {
        id: "tx_" + Date.now().toString(),
        type: "task_reward",
        title: "مكافأة مهمة يومية (قيد المراجعة التدقيقية)",
        amount: reward,
        currency: "USDT",
        date: "اليوم " + timeStr,
        status: "pending",
        reference:
          "TSK-" +
          now.getFullYear().toString() +
          (now.getMonth() + 1).toString().padStart(2, "0") +
          now.getDate().toString().padStart(2, "0"),
      };

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
          message: "يمكن استبدال لقطة الشاشة فقط عندما تكون المهمة قيد المراجعة.",
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
          message: "لا يمكن التراجع لمنصب أدنى. تقتصر الترقية على المناصب الأعلى فقط.",
        };
      }

      const upgradeCost = currentPackage.id === "FREE" ? targetPrice : targetPrice - currentPrice;

      if (balance.available < upgradeCost) {
        const requiredDeposit = upgradeCost - balance.available;
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
      setBalance((prev) => ({
        total: Number((prev.total - upgradeCost).toFixed(2)),
        available: Number((prev.available - upgradeCost).toFixed(2)),
        reserved: prev.reserved,
        breakdown: prev.breakdown,
      }));

      setCurrentPackageId(targetPackageId);

      // Future unsubmitted tasks reflect the new position's daily reward
      setTask((prev) => {
        if (prev.status === "submitted" || prev.status === "approved" || prev.status === "rejected") {
          return prev;
        }
        return {
          ...prev,
          rewardAmount: target.dailyReward,
        };
      });

      const newTx: LedgerTransaction = {
        id: "tx_" + Date.now().toString(),
        type: "package_upgrade",
        title: "ترقية المنصب من " + currentPackage.name + " إلى " + target.name,
        amount: -upgradeCost,
        currency: "USDT",
        date: "الآن",
        status: "completed",
        reference: "POS-UPG-" + Date.now().toString().slice(-6),
        details: {
          "سعر المنصب الجديد": targetPrice.toFixed(2) + " USDT",
          "خصم المنصب الحالي": currentPrice.toFixed(2) + " USDT",
          "صافي المدفوع": upgradeCost.toFixed(2) + " USDT",
        },
      };

      setTransactions((prev) => [newTx, ...prev]);

      return {
        success: true,
        message: "تم تفعيل " + target.name + " بنجاح.",
      };
    },
    [balance.available, currentPackage.id, currentPackage.name, currentPackage.price, currentPackageId],
  );

  // 5. Setup withdrawal address (one-time setup)
  const setupWithdrawalAddress = useCallback(
    (address: string): { success: boolean; message: string } => {
      const trimmed = address.trim();
      if (!trimmed.startsWith("T") || trimmed.length !== 34) {
        return {
          success: false,
          message: "يرجى إدخال عنوان TRC20 صالح يبدأ بحرف T ويتكون من 34 رمزاً.",
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
          message: "لديك طلب سحب قيد المعالجة حالياً. لا يمكن تقديم أكثر من طلب في وقت واحد.",
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

      const fee = Number((amount * FINANCIAL_RULES.withdrawalFeeRate).toFixed(2));
      const netAmount = Number((amount - fee).toFixed(2));
      const now = new Date();
      const dueTime = new Date(now.getTime() + FINANCIAL_RULES.withdrawalProcessingHours * 3600 * 1000);

      const formatDate = (d: Date) =>
        `${d.getFullYear().toString()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

      const newReq: WithdrawalRequest = {
        id: "wth_" + Date.now().toString().slice(-6),
        amount,
        fee,
        feeRate: FINANCIAL_RULES.withdrawalFeeRate,
        netAmount,
        targetAddress: user.savedWithdrawalAddress,
        status: "pending",
        requestedAt: formatDate(now),
        dueAt: formatDate(dueTime),
      };

      // Reserve funds: available decreases, reserved increases, total stays same!
      setBalance((prev) => ({
        total: prev.total,
        available: Number((prev.available - amount).toFixed(2)),
        reserved: Number((prev.reserved + amount).toFixed(2)),
        breakdown: prev.breakdown,
      }));

      setWithdrawals((prev) => [newReq, ...prev]);

      const newTx: LedgerTransaction = {
        id: "tx_" + Date.now().toString(),
        type: "withdrawal_reservation",
        title: "حجز رصيد لطلب سحب (" + amount.toFixed(2) + " USDT)",
        amount: -amount,
        currency: "USDT",
        date: "الآن",
        status: "pending",
        reference: "WTH-REQ-" + newReq.id,
        details: {
          "المبلغ المطلوب": amount.toFixed(2) + " USDT",
          "الرسوم (21%)": fee.toFixed(2) + " USDT",
          "الصافي المتوقع": netAmount.toFixed(2) + " USDT",
          "العنوان": user.savedWithdrawalAddress,
          "وقت الاستحقاق التقريبي": formatDate(dueTime),
        },
      };

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
    setBalance((prev) => ({
      total: prev.total,
      available: Number((prev.available + amount).toFixed(2)),
      reserved: Number(Math.max(0, prev.reserved - amount).toFixed(2)),
      breakdown: prev.breakdown,
    }));

    setWithdrawals((prev) =>
      prev.map((w) =>
        w.id === pendingWithdrawal.id
          ? {
              ...w,
              status: "rejected",
              rejectionReason: "تم إيقاف الطلب من قبل الإدارة للتحقق الأمني من ملكية العنوان.",
            }
          : w,
      ),
    );

    const reversalTx: LedgerTransaction = {
      id: "tx_" + Date.now().toString(),
      type: "withdrawal_reversal",
      title: "إلغاء حجز سحب وإعادة الرصيد للمتاح",
      amount: amount,
      currency: "USDT",
      date: "الآن",
      status: "reversed",
      reference: "WTH-REV-" + pendingWithdrawal.id,
      details: {
        "المبلغ المعاد": amount.toFixed(2) + " USDT",
        "السبب": "إيقاف إداري وإلغاء حجز الرصيد",
      },
    };

    setTransactions((prev) => [reversalTx, ...prev]);
  }, [pendingWithdrawal]);

  // 9. Completion of pending withdrawal simulation
  const simulateApprovePendingWithdrawal = useCallback(() => {
    if (!pendingWithdrawal) return;

    const amount = pendingWithdrawal.amount;

    // Completed: reserved decreases, total decreases
    setBalance((prev) => ({
      total: Number((prev.total - amount).toFixed(2)),
      available: prev.available,
      reserved: Number(Math.max(0, prev.reserved - amount).toFixed(2)),
      breakdown: prev.breakdown,
    }));

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
    throw new Error("useEmployeeState must be used within EmployeeStateProvider");
  }
  return context;
}
