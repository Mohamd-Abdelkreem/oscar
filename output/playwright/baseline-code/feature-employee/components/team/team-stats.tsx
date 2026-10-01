"use client";

import { Info, Share2 } from "lucide-react";
import { useCallback, useState } from "react";
import { FINANCIAL_RULES } from "../../constants/branding";
import { useEmployeeState } from "../../context/employee-state.context";
import { Button } from "../common/button";
import { CopyAction } from "../common/copy-action";
import { MoneyAmount } from "../common/money-amount";

export function TeamStats() {
  const { user, teamMembers, balance } = useEmployeeState();
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const referralCode = user.invitationCode;
  const referralUrl = `https://oscar.app/employee/auth/register?ref=${referralCode}`;

  const totalTeamMembers = teamMembers.length;
  const activeTeamMembers = teamMembers.filter((m) => m.status === "active").length;
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
        setTimeout(() => {
          setShareFeedback(null);
        }, 2500);
      } catch {
        // fallback
      }
    }
  }, [referralCode, referralUrl]);

  return (
    <div className="space-y-4">
      {/* Referral Code & Link Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            رابط وكود الدعوة الخاص بك
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            شارك رابطك لبناء فريقك والاستفادة من عمولات الترقية وتفعيل المناصب حتى المستوى الخامس
          </p>
        </div>

        {/* Code Box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">كود الدعوة:</span>
            <bdi dir="ltr" className="text-base font-bold text-emerald-800 tracking-wider">
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
          <p className="text-xs text-emerald-700 font-medium">{shareFeedback}</p>
        )}

        {/* URL Box */}
        <div className="space-y-1">
          <span className="text-xs text-slate-500">رابط التسجيل المباشر:</span>
          <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700">
            <bdi dir="ltr" className="truncate text-slate-600">
              {referralUrl}
            </bdi>
            <CopyAction value={referralUrl} variant="icon" />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">إجمالي الفريق</span>
          <span className="text-lg sm:text-xl font-bold text-slate-900">{totalTeamMembers}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">عضو مسجل</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">الأعضاء النشطين</span>
          <span className="text-lg sm:text-xl font-bold text-emerald-700">{activeTeamMembers}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">منصب نشط</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">إجمالي العمولات</span>
          <div className="text-sm sm:text-base font-bold text-emerald-700">
            <MoneyAmount amount={totalCommissionEarned} size="sm" color="positive" />
          </div>
          <span className="text-[11px] text-slate-400 block mt-0.5">أرباح مضافة</span>
        </div>
      </div>

      {/* Commission Rates Breakdown */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            نسب عمولات الإحالة الرسمية (L1 - L5)
          </h3>
          <span className="text-xs text-slate-400 font-medium">قابلة للتحديث إدارياً</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
          {FINANCIAL_RULES.referralRates.map((item) => (
            <div
              key={item.level}
              className="p-2.5 rounded bg-slate-50 border border-slate-200/80 space-y-1"
            >
              <span className="text-[11px] text-slate-500 block font-medium">
                مستوى {item.level}
              </span>
              <span className="text-sm font-bold text-emerald-800 block">
                {item.percentage}
              </span>
            </div>
          ))}
        </div>

        {/* Concrete calculation examples */}
        <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Info size={14} className="text-emerald-700 shrink-0" aria-hidden="true" />
            أمثلة لاحتساب العمولات المضافة لنفس الرصيد:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-600 pr-1">
            <li>
              شراء عضو في المستوى الأول (L1) باقة بقيمة 100 USDT يمنحك عمولة بنسبة 12% = <span className="font-bold text-slate-900">12.00 USDT</span>.
            </li>
            <li>
              ترقية عضو في المستوى الأول (L1) بتكلفة صافية 540 USDT تمنحك عمولة بنسبة 12% = <span className="font-bold text-slate-900">64.80 USDT</span>.
            </li>
            <li>
              تحتسب العمولات فقط من شراء الباقات وتجديدها وترقيتها، ولا تحتسب من الإيداعات أو مكافآت المهام.
            </li>
          </ul>
        </div>

        {/* Unresolved leadership rules note */}
        <div className="p-2.5 bg-amber-50/70 border border-amber-200/70 rounded text-[11px] text-amber-900 leading-normal">
          <span className="font-bold">تنويه إداري:</span> قواعد الرتب القيادية الإضافية والحوافز الخاصة قيد المراجعة والاعتماد ولم تحدد شروطها بعد.
        </div>
      </div>
    </div>
  );
}
