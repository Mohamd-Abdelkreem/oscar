"use client";

import type { AdminPackage } from "../../types/admin.types";

export function EmployeePackageTab({
  employeePackage,
}: {
  readonly employeePackage: AdminPackage | undefined;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <h2 className="text-sm font-bold text-slate-900">
        تفاصيل منصب الموظف المفعّل
      </h2>
      {employeePackage ? (
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-slate-200 p-3">
            <span className="text-slate-500">المنصب:</span>
            <p className="text-base font-bold text-slate-900">
              {employeePackage.name}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <span className="text-slate-500">سعر المنصب:</span>
            <p
              className="font-mono text-base font-bold text-slate-900"
              dir="ltr"
            >
              {employeePackage.price.toFixed(2)} USDT
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <span className="text-slate-500">الربح اليومي المعتمد:</span>
            <p
              className="font-mono text-base font-bold text-emerald-700"
              dir="ltr"
            >
              +{employeePackage.dailyReward.toFixed(2)} USDT
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <span className="text-slate-500">مدة الاشتراك المقررة:</span>
            <p className="text-base font-bold text-slate-900">
              {employeePackage.durationDays} يوم
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          الموظف على الحساب المجاني بدون منصب مفعّل.
        </p>
      )}
    </div>
  );
}
