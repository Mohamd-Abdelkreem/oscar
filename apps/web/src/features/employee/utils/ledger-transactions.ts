import type {
  LedgerTransaction,
  PackageTier,
  WithdrawalRequest,
} from "../types/employee.types";
import { formatLocalTime } from "./financial-calculations";

export function createTaskRewardTransaction(
  reward: number,
  now: Date,
): LedgerTransaction {
  return {
    id: "tx_" + now.getTime().toString(),
    type: "task_reward",
    title: "مكافأة مهمة يومية (قيد المراجعة التدقيقية)",
    amount: reward,
    currency: "USDT",
    date: "اليوم " + formatLocalTime(now),
    status: "pending",
    reference:
      "TSK-" +
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0"),
  };
}

export function createPackageUpgradeTransaction(
  current: PackageTier,
  target: PackageTier,
  cost: number,
  now: Date,
): LedgerTransaction {
  return {
    id: "tx_" + now.getTime().toString(),
    type: "package_upgrade",
    title: "ترقية المنصب من " + current.name + " إلى " + target.name,
    amount: -cost,
    currency: "USDT",
    date: "الآن",
    status: "completed",
    reference: "POS-UPG-" + now.getTime().toString().slice(-6),
    details: {
      "سعر المنصب الجديد": target.price.toFixed(2) + " USDT",
      "خصم المنصب الحالي": current.price.toFixed(2) + " USDT",
      "صافي المدفوع": cost.toFixed(2) + " USDT",
    },
  };
}

export function createWithdrawalReservationTransaction(
  request: WithdrawalRequest,
  now: Date,
): LedgerTransaction {
  return {
    id: "tx_" + now.getTime().toString(),
    type: "withdrawal_reservation",
    title: "حجز رصيد لطلب سحب (" + request.amount.toFixed(2) + " USDT)",
    amount: -request.amount,
    currency: "USDT",
    date: "الآن",
    status: "pending",
    reference: "WTH-REQ-" + request.id,
    details: {
      "المبلغ المطلوب": request.amount.toFixed(2) + " USDT",
      "الرسوم (21%)": request.fee.toFixed(2) + " USDT",
      "الصافي المتوقع": request.netAmount.toFixed(2) + " USDT",
      العنوان: request.targetAddress,
      "وقت الاستحقاق التقريبي": request.dueAt,
    },
  };
}

export function createWithdrawalReversalTransaction(
  request: WithdrawalRequest,
  now: Date,
): LedgerTransaction {
  return {
    id: "tx_" + now.getTime().toString(),
    type: "withdrawal_reversal",
    title: "إلغاء حجز سحب وإعادة الرصيد للمتاح",
    amount: request.amount,
    currency: "USDT",
    date: "الآن",
    status: "reversed",
    reference: "WTH-REV-" + request.id,
    details: {
      "المبلغ المعاد": request.amount.toFixed(2) + " USDT",
      السبب: "إيقاف إداري وإلغاء حجز الرصيد",
    },
  };
}
