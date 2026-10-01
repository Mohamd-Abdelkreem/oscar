"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import { Info, Share2 } from "lucide-react";
import { useCallback, useState } from "react";
import { FINANCIAL_RULES } from "../../constants/branding";
import { useEmployeeState } from "../../context/employee-state.context";
import { Button } from "../common/button";
import { CopyAction } from "../common/copy-action";
import { MoneyAmount } from "../common/money-amount";

export function TeamStats() {
  const scheduleTimeout = useManagedTimeout();
  const { user, teamMembers, balance } = useEmployeeState();
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const referralCode = user.invitationCode;
  const referralUrl = `https://oscar.app/employee/auth/register?ref=${referralCode}`;

  const totalTeamMembers = teamMembers.length;
  const activeTeamMembers = teamMembers.filter(
    (m) => m.status === "active",
  ).length;
  const totalCommissionEarned = balance.breakdown.referralCommissions;

  const handleShare = useCallback(async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "انضم إلى منصة أوسكار لمهام الموظفين",
          text: `سجل الآن عبر رابط الدعوة الخاص بي باستخدام كود الدعوة: ${referralCode}`,
          url: referralUrl,
        });
      } catch {
        // User cancelled or unsupported
      }
    } else {
      // Fallback to copy link
      try {
        await navigator.clipboard.writeText(referralUrl);
        setShareFeedback("تم نسخ رابط الدعوة للحافظة");
        scheduleTimeout(() => {
          setShareFeedback(null);
        }, 2500);
      } catch {
        // fallback
      }
    }
  }, [referralCode, referralUrl, scheduleTimeout]);

  return (
    <div className="space-y-4">
      {/* Referral Code & Link Card */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">
            رابط وكود الدعوة الخاص بك
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            شارك رابطك لبناء فريقك والاستفادة من عمولات الترقية وتفعيل المناصب
            حتى المستوى الخامس
          </p>
        </div>

        {/* Code Box */}
        <div className="flex flex-col items-stretch justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              كود الدعوة:
            </span>
            <bdi
              dir="ltr"
              className="text-base font-bold tracking-wider text-emerald-800"
            >
              {referralCode}
            </bdi>
          </div>
          <div className="flex items-center gap-2">
            <CopyAction value={referralCode} label="نسخ الكود" />
            <Button
              variant="primary"
              size="compact"
              icon={Share2}
              onClick={() => {
                void handleShare();
              }}
            >
              مشاركة
            </Button>
          </div>
        </div>

        {shareFeedback && (
          <p className="text-xs font-medium text-emerald-700">
            {shareFeedback}
          </p>
        )}

        {/* URL Box */}
        <div className="space-y-1">
          <span className="text-xs text-slate-500">رابط التسجيل المباشر:</span>
          <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
            <bdi dir="ltr" className="truncate text-slate-600">
              {referralUrl}
            </bdi>
            <CopyAction value={referralUrl} variant="icon" />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-xs">
          <span className="mb-1 block text-xs text-slate-500">
            إجمالي الفريق
          </span>
          <span className="text-lg font-bold text-slate-900 sm:text-xl">
            {totalTeamMembers}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-400">
            عضو مسجل
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-xs">
          <span className="mb-1 block text-xs text-slate-500">
            الأعضاء النشطين
          </span>
          <span className="text-lg font-bold text-emerald-700 sm:text-xl">
            {activeTeamMembers}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-400">
            منصب نشط
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-xs">
          <span className="mb-1 block text-xs text-slate-500">
            إجمالي العمولات
          </span>
          <div className="text-sm font-bold text-emerald-700 sm:text-base">
            <MoneyAmount
              amount={totalCommissionEarned}
              size="sm"
              color="positive"
            />
          </div>
          <span className="mt-0.5 block text-[11px] text-slate-400">
            أرباح مضافة
          </span>
        </div>
      </div>

      {/* Commission Rates Breakdown */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            نسب عمولات الإحالة الرسمية (L1 - L5)
          </h3>
          <span className="text-xs font-medium text-slate-400">
            قابلة للتحديث إدارياً
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
          {FINANCIAL_RULES.referralRates.map((item) => (
            <div
              key={item.level}
              className="space-y-1 rounded border border-slate-200/80 bg-slate-50 p-2.5"
            >
              <span className="block text-[11px] font-medium text-slate-500">
                مستوى {item.level}
              </span>
              <span className="block text-sm font-bold text-emerald-800">
                {item.percentage}
              </span>
            </div>
          ))}
        </div>

        {/* Concrete calculation examples */}
        <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <p className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Info
              size={14}
              className="shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            أمثلة لاحتساب العمولات المضافة لنفس الرصيد:
          </p>
          <ul className="list-inside list-disc space-y-1 pr-1 text-slate-600">
            <li>
              شراء عضو في المستوى الأول (L1) باقة بقيمة 100 USDT يمنحك عمولة
              بنسبة 12% ={" "}
              <span className="font-bold text-slate-900">12.00 USDT</span>.
            </li>
            <li>
              ترقية عضو في المستوى الأول (L1) بتكلفة صافية 540 USDT تمنحك عمولة
              بنسبة 12% ={" "}
              <span className="font-bold text-slate-900">64.80 USDT</span>.
            </li>
            <li>
              تحتسب العمولات فقط من شراء الباقات وتجديدها وترقيتها، ولا تحتسب من
              الإيداعات أو مكافآت المهام.
            </li>
          </ul>
        </div>

        {/* Unresolved leadership rules note */}
        <div className="rounded border border-amber-200/70 bg-amber-50/70 p-2.5 text-[11px] leading-normal text-amber-900">
          <span className="font-bold">تنويه إداري:</span> قواعد الرتب القيادية
          الإضافية والحوافز الخاصة قيد المراجعة والاعتماد ولم تحدد شروطها بعد.
        </div>
      </div>
    </div>
  );
}
