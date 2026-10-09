import type { LedgerRow } from "@template/contracts";

export const operationLabels: Record<LedgerRow["origin"], string> = {
  WITHDRAWAL_SETTLEMENT: "سحب مكتمل",
  DEPOSIT: "إيداع رصيد",
  TASK_REWARD: "مكافأة مهمة معتمدة",
  REFERRAL_COMMISSION: "عمولة إحالة",
  PACKAGE_PURCHASE: "شراء منصب",
  WITHDRAWAL_RESERVATION: "حجز رصيد",
  RESERVATION_RELEASE: "فك حجز الرصيد",
  ADMIN_ADJUSTMENT: "تسوية إدارية",
};
