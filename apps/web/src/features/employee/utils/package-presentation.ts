import type { PackageTerms } from "@template/contracts";
import { formatMoney } from "./money-display";

export type PackagePresentation = PackageTerms & {
  id: PackageTerms["code"];
  name: string;
  description: string;
  cycle: string;
  features: string[];
};
export function presentPackage(terms: PackageTerms): PackagePresentation {
  return {
    ...terms,
    id: terms.code,
    name: `منصب ${terms.code}`,
    cycle: "يومي",
    description:
      "المكافآت مشروطة بأداء المهام واعتمادها خلال أيام العمل المحفوظة.",
    features: [
      `مكافأة المهمة المعتمدة: ${formatMoney(terms.dailyReward)} USDT`,
      `أيام العمل المحتسبة: ${String(terms.countedWorkDates)}`,
      `رسوم السحب: ${String(terms.withdrawalFeeBps / 100)}%`,
      `التقويم: ${terms.calendar.zone} · أيام الأسبوع: ${terms.calendar.workdays.join(", ")} · حد أول يوم: ${terms.calendar.firstDateCutoff}`,
      "لا توجد مكافأة مضمونة دون مهمة معتمدة.",
    ],
  };
}
