import {
  positiveUsdtAmountSchema,
  type WithdrawalRequest,
} from "@template/contracts";

export const withdrawalStates = {
  SCHEDULED: { label: "مجدول للدفع التلقائي", badge: "pending" },
  SIGNING: { label: "جارٍ تجهيز التوقيع", badge: "pending" },
  SIGNED: { label: "تم التوقيع", badge: "pending" },
  SUBMITTED: { label: "أُرسل وبانتظار التأكيد", badge: "verifying" },
  UNKNOWN: { label: "نتيجة الدفع غير مؤكدة", badge: "locked" },
  COMPLETED: { label: "مكتمل — دفع مؤكد", badge: "completed" },
  REJECTED: { label: "مرفوض — أُعيد المبلغ", badge: "rejected" },
  CANCELLED: { label: "ملغى — أُعيد المبلغ", badge: "reversed" },
  FAILED: { label: "تعذر الدفع بأمان — أُعيد المبلغ", badge: "rejected" },
} as const;
export const withdrawalBlockers: Record<
  NonNullable<WithdrawalRequest["blocker"]>,
  string
> = {
  LIQUIDITY_SHORTFALL: "بانتظار توفر سيولة الشركة",
  RESOURCE_SHORTFALL: "بانتظار موارد الشبكة",
  PROVIDER_UNAVAILABLE: "مزود الشبكة غير متاح مؤقتاً",
  TREASURY_BUSY: "بانتظار انتهاء عملية الخزينة الحالية",
  RECOVERY_UNAVAILABLE: "بانتظار جاهزية الاسترداد الآمن",
  EVIDENCE_CONFLICT: "أدلة الدفع تحتاج إلى تسوية",
  DISPATCH_PAUSED: "الإرسال متوقف مؤقتاً",
};
export const withdrawalActions: Record<
  WithdrawalRequest["actions"][number]["kind"],
  string
> = {
  ACCEPT: "قبول الطلب",
  EXTEND: "تمديد الموعد",
  REJECT: "رفض الطلب",
  RESTRICTION_CANCEL: "إلغاء بسبب قيد الحساب",
  FUTURE_DESTINATION_CANCEL: "إلغاء قبل تغيير العنوان",
  CLAIM: "بدء تجهيز الدفع",
  SIGNED: "توقيع الدفع",
  BROADCAST_ADMISSION: "السماح بإرسال الدفع",
  OBSERVE: "التحقق من نتيجة الدفع",
  COMPLETE: "تأكيد الدفع",
  SAFE_FAIL: "تعذر الدفع بأمان",
};

export function normalizeWithdrawalAmount(input: string): string | null {
  if (!/^[0-9]+(?:\.[0-9]{1,6})?$/u.test(input)) return null;
  const [integer = "", fraction = ""] = input.split(".");
  const whole = integer.replace(/^0+(?=\d)/u, ""),
    decimal = fraction.replace(/0+$/u, "");
  const normalized = `${whole}${decimal ? `.${decimal}` : ""}`;
  return positiveUsdtAmountSchema.safeParse(normalized).success
    ? normalized
    : null;
}
export function withdrawalRate(feeBps: number): string {
  const fraction = (feeBps % 100)
    .toString()
    .padStart(2, "0")
    .replace(/0+$/u, "");
  return `${Math.trunc(feeBps / 100).toString()}${fraction ? `.${fraction}` : ""}%`;
}
export function withdrawalInstant(instant: string): string {
  return new Intl.DateTimeFormat("ar-IQ", {
    timeZone: "Asia/Baghdad",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(instant));
}
