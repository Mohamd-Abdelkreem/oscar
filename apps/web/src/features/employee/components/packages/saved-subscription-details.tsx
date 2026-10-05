import type { Subscription } from "@template/contracts";
import { MoneyAmount } from "../common/money-amount";

export function SavedSubscriptionDetails({
  subscription,
}: {
  subscription: Pick<
    Subscription,
    "terms" | "firstWorkDate" | "finalWorkDate" | "expiresAt"
  >;
}) {
  const { terms } = subscription;
  return (
    <div
      className="space-y-1 text-xs text-slate-500"
      aria-label="شروط الاشتراك المحفوظة"
    >
      <p className="font-semibold">
        شروط الاشتراك المحفوظة عند الشراء · {terms.code} · النسخة{" "}
        {terms.version}
      </p>
      <p>
        السعر المحفوظ: <MoneyAmount amount={terms.price} size="sm" /> · مكافأة
        المهمة المعتمدة: <MoneyAmount amount={terms.dailyReward} size="sm" />
      </p>
      <p>
        أيام العمل المحتسبة: {terms.countedWorkDates} · رسوم السحب:{" "}
        {terms.withdrawalFeeBps / 100}%
      </p>
      <p>
        التقويم المحفوظ: <bdi dir="ltr">{terms.calendar.zone}</bdi> · أيام
        الأسبوع: <bdi dir="ltr">{terms.calendar.workdays.join(", ")}</bdi> · حد
        أول يوم: <bdi dir="ltr">{terms.calendar.firstDateCutoff}</bdi>
      </p>
      <p>
        أول يوم عمل: <bdi dir="ltr">{subscription.firstWorkDate}</bdi> · آخر يوم
        عمل: <bdi dir="ltr">{subscription.finalWorkDate}</bdi>
      </p>
      <p>
        انتهاء الاشتراك المحفوظ (حد حصري):{" "}
        <bdi dir="ltr" className="break-all">
          {subscription.expiresAt}
        </bdi>
      </p>
      <p>
        الإجمالي المشروط بإكمال المهام المعتمدة قبل تكلفة الباقة ورسوم السحب:{" "}
        <MoneyAmount amount={terms.conditionalGross} size="sm" />
      </p>
    </div>
  );
}
