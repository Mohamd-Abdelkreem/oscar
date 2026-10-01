"use client";

import { Check, Clock, Layers, ShieldCheck, Zap } from "lucide-react";
import {
  calculateExpectedTotalIncome,
  type PackageTier,
} from "../../types/employee.types";
import { Button } from "../common/button";
import { MoneyAmount } from "../common/money-amount";

interface PackageCardProps {
  readonly pkg: PackageTier;
  readonly isCurrent: boolean;
  readonly currentPrice?: number | undefined;
  readonly daysRemaining?: number | undefined;
  readonly onSelectUpgrade: (pkg: PackageTier) => void;
}

export function PackageCard({
  pkg,
  isCurrent,
  currentPrice = 0,
  daysRemaining,
  onSelectUpgrade,
}: PackageCardProps) {
  const isLowerTier = !isCurrent && currentPrice > 0 && pkg.price <= currentPrice;
  const expectedTotal = calculateExpectedTotalIncome(pkg.dailyReward, pkg.durationDays);

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden transition-all flex flex-col justify-between shadow-xs ${
        isCurrent
          ? "border-emerald-600 ring-2 ring-emerald-600/20"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div>
        {/* Top Header */}
        <div
          className={`p-4 sm:p-5 border-b ${
            isCurrent
              ? "bg-emerald-50/60 border-emerald-100"
              : "bg-slate-50/60 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers
                size={18}
                className={isCurrent ? "text-emerald-700" : "text-slate-500"}
                aria-hidden="true"
              />
              <span>{pkg.name}</span>
            </h2>

            {isCurrent && (
              <span className="px-2.5 py-1 text-xs font-bold bg-emerald-700 text-white rounded-md flex items-center gap-1">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>المنصب الحالي</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            {pkg.description}
          </p>

          {/* Pricing & Key Metrics Matrix */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/80">
            <div className="p-2.5 bg-white rounded-md border border-slate-100">
              <span className="text-xs text-slate-500 block mb-0.5 font-medium">السعر</span>
              <MoneyAmount amount={pkg.price} size="md" color="neutral" />
            </div>

            <div className="p-2.5 bg-white rounded-md border border-slate-100 text-left">
              <span className="text-xs text-slate-500 block mb-0.5 font-medium">الربح اليومي</span>
              <MoneyAmount amount={pkg.dailyReward} size="md" color="positive" showSign />
            </div>

            <div className="p-2.5 bg-white rounded-md border border-slate-100">
              <span className="text-xs text-slate-500 block mb-0.5 font-medium">أيام العمل المطلوبة</span>
              <span className="text-sm font-bold text-slate-900">{pkg.durationDays} يوم</span>
            </div>

            <div className="p-2.5 bg-white rounded-md border border-slate-100 text-left">
              <span className="text-xs text-slate-500 block mb-0.5 font-medium">الدورة</span>
              <span className="text-sm font-bold text-slate-800">{pkg.cycle ?? "يومي"}</span>
            </div>
          </div>

          {/* Expected Total Income Callout */}
          <div className="mt-2.5 p-2.5 bg-emerald-50 rounded-md border border-emerald-100 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">إجمالي الدخل المتوقع</span>
            <MoneyAmount amount={expectedTotal} size="md" color="positive" />
          </div>
        </div>

        {/* Feature List */}
        <div className="p-4 sm:p-5 space-y-2.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            المواصفات والشروط:
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
            {pkg.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check
                  size={16}
                  className="text-emerald-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span className="leading-snug">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer / Action */}
      <div className="p-4 sm:p-5 pt-0">
        {isCurrent ? (
          <div className="p-3 bg-emerald-50 rounded-md border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
            <span className="font-semibold flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-600" aria-hidden="true" />
              <span>المنصب نشط ومفعل</span>
            </span>
            {daysRemaining !== undefined && daysRemaining > 0 && (
              <span className="text-emerald-700 flex items-center gap-1 font-medium">
                <Clock size={14} aria-hidden="true" />
                <span>متبقي {daysRemaining} يوماً</span>
              </span>
            )}
          </div>
        ) : isLowerTier ? (
          <Button
            variant="outline"
            fullWidth
            disabled
            className="opacity-70"
          >
            منصب أدنى من منصبك الحالي
          </Button>
        ) : (
          <Button
            id={`upgrade-btn-${pkg.id}`}
            variant="primary"
            fullWidth
            icon={Zap}
            onClick={() => {
              onSelectUpgrade(pkg);
            }}
          >
            تفعيل المنصب الآن
          </Button>
        )}
      </div>
    </div>
  );
}
