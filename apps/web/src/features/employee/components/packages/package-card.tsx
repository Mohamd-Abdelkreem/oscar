"use client";

import { Check, Clock, Layers, ShieldCheck, Zap } from "lucide-react";
import type { PackageTier } from "../../types/employee.types";
import { calculateExpectedTotalIncome } from "../../utils/financial-calculations";
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
  const isLowerTier =
    !isCurrent && currentPrice > 0 && pkg.price <= currentPrice;
  const expectedTotal = calculateExpectedTotalIncome(
    pkg.dailyReward,
    pkg.durationDays,
  );

  return (
    <div
      className={`flex flex-col justify-between overflow-hidden rounded-lg border bg-white shadow-xs transition-all ${
        isCurrent
          ? "border-emerald-600 ring-2 ring-emerald-600/20"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div>
        {/* Top Header */}
        <div
          className={`border-b p-4 sm:p-5 ${
            isCurrent
              ? "border-emerald-100 bg-emerald-50/60"
              : "border-slate-200 bg-slate-50/60"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
              <Layers
                size={18}
                className={isCurrent ? "text-emerald-700" : "text-slate-500"}
                aria-hidden="true"
              />
              <span>{pkg.name}</span>
            </h2>

            {isCurrent && (
              <span className="flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white">
                <ShieldCheck size={14} aria-hidden="true" />
                <span>المنصب الحالي</span>
              </span>
            )}
          </div>

          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            {pkg.description}
          </p>

          {/* Pricing & Key Metrics Matrix */}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200/80 pt-3">
            <div className="rounded-md border border-slate-100 bg-white p-2.5">
              <span className="mb-0.5 block text-xs font-medium text-slate-500">
                السعر
              </span>
              <MoneyAmount amount={pkg.price} size="md" color="neutral" />
            </div>

            <div className="rounded-md border border-slate-100 bg-white p-2.5 text-left">
              <span className="mb-0.5 block text-xs font-medium text-slate-500">
                الربح اليومي
              </span>
              <MoneyAmount
                amount={pkg.dailyReward}
                size="md"
                color="positive"
                showSign
              />
            </div>

            <div className="rounded-md border border-slate-100 bg-white p-2.5">
              <span className="mb-0.5 block text-xs font-medium text-slate-500">
                أيام العمل المطلوبة
              </span>
              <span className="text-sm font-bold text-slate-900">
                {pkg.durationDays} يوم
              </span>
            </div>

            <div className="rounded-md border border-slate-100 bg-white p-2.5 text-left">
              <span className="mb-0.5 block text-xs font-medium text-slate-500">
                الدورة
              </span>
              <span className="text-sm font-bold text-slate-800">
                {pkg.cycle ?? "يومي"}
              </span>
            </div>
          </div>

          {/* Expected Total Income Callout */}
          <div className="mt-2.5 flex items-center justify-between rounded-md border border-emerald-100 bg-emerald-50 p-2.5">
            <span className="text-xs font-bold text-emerald-900">
              إجمالي الدخل المتوقع
            </span>
            <MoneyAmount amount={expectedTotal} size="md" color="positive" />
          </div>
        </div>

        {/* Feature List */}
        <div className="space-y-2.5 p-4 sm:p-5">
          <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            المواصفات والشروط:
          </h3>
          <ul className="space-y-2 text-xs text-slate-700 sm:text-sm">
            {pkg.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check
                  size={16}
                  className="mt-0.5 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <span className="leading-snug">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer / Action */}
      <div className="p-4 pt-0 sm:p-5">
        {isCurrent ? (
          <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <span className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck
                size={16}
                className="text-emerald-600"
                aria-hidden="true"
              />
              <span>المنصب نشط ومفعل</span>
            </span>
            {daysRemaining !== undefined && daysRemaining > 0 && (
              <span className="flex items-center gap-1 font-medium text-emerald-700">
                <Clock size={14} aria-hidden="true" />
                <span>متبقي {daysRemaining} يوماً</span>
              </span>
            )}
          </div>
        ) : isLowerTier ? (
          <Button variant="outline" fullWidth disabled className="opacity-70">
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
