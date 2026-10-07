import { Clock, Layers, Lock } from "lucide-react";
import { FINANCIAL_RULES } from "../../constants/branding";
import type { EmployeeTaskDay } from "@template/contracts";
import { ButtonLink } from "../common/button";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

interface TaskAvailabilityCardProps {
  readonly day: EmployeeTaskDay;
}
export function TaskAvailabilityCard({ day }: TaskAvailabilityCardProps) {
  const status =
    day.workEligibility === "FREE" || day.workEligibility === "EXPIRED"
      ? "free"
      : day.unavailableReason === "UPCOMING"
        ? "before_window"
        : "closed";
  const task = day.task;
  const nextOpening = new Intl.DateTimeFormat("ar-IQ", {
    timeZone: "Asia/Baghdad",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(day.window.nextOpeningAt));
  const unavailableLabels = {
    HOLIDAY: "اليوم عطلة للمهام",
    NO_TASK: "لا توجد مهمة منشورة اليوم",
    PAUSED: "المهمة متوقفة مؤقتاً",
    TASK_RESTRICTED: "المهام مقيدة لحسابك",
    CLOSED: "انتهت فترة تنفيذ مهمة اليوم",
  };
  const unavailableLabel =
    day.workEligibility === "TASK_RESTRICTED"
      ? unavailableLabels.TASK_RESTRICTED
      : day.calendarState === "HOLIDAY"
        ? unavailableLabels.HOLIDAY
        : day.opportunityState === "NO_TASK"
          ? unavailableLabels.NO_TASK
          : day.opportunityState === "PAUSED"
            ? unavailableLabels.PAUSED
            : unavailableLabels.CLOSED;
  // Free user state
  if (status === "free") {
    return (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Lock size={24} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {day.workEligibility === "EXPIRED"
              ? "انتهت مدة المنصب"
              : "لا يوجد منصب نشط للمهام"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
            {day.workEligibility === "EXPIRED"
              ? "انتهت مدة منصبك الحالي."
              : "حسابك حالياً مجاني."}{" "}
            المهام اليومية ومكافآتها تتطلب تفعيل أحد مناصب أوسكار المعتمدة (مثل
            منصب S1 أو O1).
          </p>
        </div>
        <div className="flex justify-center pt-2">
          <ButtonLink
            href="/employee/packages"
            variant="primary"
            size="default"
            icon={Layers}
          >
            استعراض وتفعيل منصب الآن
          </ButtonLink>
        </div>
      </div>
    );
  }

  // Before window state
  if (status === "before_window") {
    return (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{task?.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              نافذة المهمة: {FINANCIAL_RULES.taskTimeWindow.start} -{" "}
              {FINANCIAL_RULES.taskTimeWindow.end} (
              {FINANCIAL_RULES.taskTimeWindow.timezoneLabel})
            </p>
          </div>
          <StatusBadge status="pending" label="قبل موعد النافذة" />
        </div>

        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50/70 p-4 text-amber-900">
          <Clock
            size={20}
            className="mt-0.5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <div className="space-y-1 text-sm">
            <p className="font-bold">
              تبدأ فترة تنفيذ المهمة عند الساعة 12:00 ظهراً
            </p>
            <p className="text-xs leading-relaxed text-amber-800">
              يتاح للموظفين إرسال لقطات الشاشة وتأكيد الإنجاز حصرياً خلال فترة
              النافذة المحددة يومياً بين 12:00 و 18:00 بتوقيت بغداد.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 text-sm text-slate-600">
          <span>المكافأة المقررة للمهمة:</span>
          {day.currentEntitlement.effective && (
            <MoneyAmount
              amount={day.currentEntitlement.dailyReward}
              size="md"
              color="positive"
            />
          )}
        </div>
      </div>
    );
  }

  // Closed / missed state
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Clock size={24} aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900">{unavailableLabel}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
          {day.calendarState === "CLOSED" &&
          day.opportunityState === "PUBLISHED"
            ? "نافذة أداء المهمة تنتهي يومياً عند الساعة 18:00 بتوقيت بغداد. عدم إنجاز المهمة اليوم يعني عدم صرف المكافأة الخاصة بها لهذا اليوم، دون المساس برصيدك الحالي."
            : "لا يمكن إرسال مهمة جديدة في الحالة الحالية. لا تُصرف مكافأة دون إنجاز معتمد، ولا يتغير رصيدك الحالي."}
        </p>
      </div>
      <p className="text-xs text-slate-400">النافذة القادمة: {nextOpening}</p>
    </div>
  );
}
