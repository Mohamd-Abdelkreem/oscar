import type {
  LedgerTransaction,
  WithdrawalRequest,
} from "../types/employee.types";

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
