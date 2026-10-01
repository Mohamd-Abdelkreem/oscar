"use client";

import { AdminBadge } from "../common/admin-badge";
import type { AdminEmployee } from "../../types/admin.types";

export function EmployeeOverviewTab({
  employee,
}: {
  readonly employee: AdminEmployee;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Account Details */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
        <h2 className="text-sm font-bold text-slate-900">
          بيانات الحساب الأساسية
        </h2>
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-slate-500">الاسم الكامل:</span>
            <p className="text-sm font-bold text-slate-900">{employee.name}</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500">البريد الإلكتروني:</span>
            <p className="font-mono font-bold text-slate-900" dir="ltr">
              {employee.email}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500">رمز الدعوة الشخصي:</span>
            <p className="font-mono font-bold text-emerald-700" dir="ltr">
              {employee.invitationCode}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500">حساب الكفيل / الراعي:</span>
            <p className="font-bold text-slate-900">
              {employee.sponsorName ?? "لا يوجد (تسجيل مباشر)"}
            </p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <span className="text-slate-500">عنوان محفظة السحب (TRC20):</span>
            <p
              className="rounded border border-slate-200 bg-slate-50 p-2 font-mono font-bold break-all text-slate-800"
              dir="ltr"
            >
              {employee.walletAddress}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500">تاريخ التسجيل:</span>
            <p className="font-mono font-semibold text-slate-700" dir="ltr">
              {employee.registeredAt}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500">آخر ظهور ونشاط:</span>
            <p className="font-mono font-semibold text-slate-700" dir="ltr">
              {employee.lastActiveAt}
            </p>
          </div>
        </div>
      </div>

      {/* Balance Breakdown Card */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">ملخص الرصيد المالي</h2>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 text-center">
          <span className="text-xs font-semibold text-emerald-800">
            الرصيد المتاح للسحب والترقية
          </span>
          <div
            className="mt-1 font-mono text-2xl font-black text-emerald-800"
            dir="ltr"
          >
            {employee.balance.available.toFixed(2)} USDT
          </div>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-500">الرصيد المحجوز (طلبات سحب):</span>
            <span className="font-mono font-bold text-slate-800" dir="ltr">
              {employee.balance.reserved.toFixed(2)} USDT
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-500">إجمالي الرصيد الكلي:</span>
            <span className="font-mono font-bold text-slate-900" dir="ltr">
              {employee.balance.total.toFixed(2)} USDT
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-500">المنصب المفعل:</span>
            <AdminBadge variant="success" size="sm">
              {employee.packageId === "FREE"
                ? "الحساب المجاني"
                : `منصب ${employee.packageId}`}
            </AdminBadge>
          </div>
        </div>
      </div>
    </div>
  );
}
