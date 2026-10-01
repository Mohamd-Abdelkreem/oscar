import { Clock, Layers, Lock } from "lucide-react";
import { FINANCIAL_RULES } from "../../constants/branding";
import type { DailyTask } from "../../types/employee.types";
import { ButtonLink } from "../common/button";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

interface TaskAvailabilityCardProps {
  readonly status: "free" | "before_window" | "closed";
  readonly task: DailyTask;
}

export function TaskAvailabilityCard({
  status,
  task,
}: TaskAvailabilityCardProps) {
  // Free user state
  if (status === "free") {
    return (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Lock size={24} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            لا يوجد منصب نشط للمهام
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
            حسابك حالياً في الحساب المجاني. المهام اليومية ومكافآتها تتطلب تفعيل
            أحد مناصب أوسكار المعتمدة (مثل منصب S1 أو O1).
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
            <h2 className="text-lg font-bold text-slate-900">{task.title}</h2>
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
          <MoneyAmount amount={task.rewardAmount} size="md" color="positive" />
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
        <h2 className="text-lg font-bold text-slate-900">
          انتهت فترة تنفيذ مهمة اليوم
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
          نافذة أداء المهمة تنتهي يومياً عند الساعة 18:00 بتوقيت بغداد. عدم
          إنجاز المهمة اليوم يعني عدم صرف المكافأة الخاصة بها لهذا اليوم، دون
          المساس برصيدك الحالي.
        </p>
      </div>
      <p className="text-xs text-slate-400">
        تفتح النافذة القادمة غداً عند الساعة 12:00 ظهراً.
      </p>
    </div>
  );
}
