"use client";

import {
  AlertCircle,
  Calendar,
  Clock,
} from "lucide-react";
import { useEmployeeState } from "../../context/employee-state.context";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

export function WithdrawalStatusCard() {
  const {
    withdrawals,
    pendingWithdrawal,
  } = useEmployeeState();

  return (
    <div className="space-y-4">
      {/* Active Pending Request Card */}
      {pendingWithdrawal && (
        <div className="bg-white border-2 border-amber-300 rounded-lg p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-800">
                <Clock size={16} aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  طلب سحب قيد الانتظار والمعالجة
                </h3>
                <p className="text-[11px] text-slate-500">
                  معرف الطلب: <bdi dir="ltr">{pendingWithdrawal.id}</bdi>
                </p>
              </div>
            </div>

            <StatusBadge status="pending" label="قيد المعالجة (72 ساعة)" size="sm" />
          </div>

          {/* Breakdown Card */}
          <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>المبلغ المحجوز:</span>
              <MoneyAmount amount={pendingWithdrawal.amount} size="sm" color="neutral" />
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>رسوم السحب (21%):</span>
              <span className="text-rose-700 font-semibold">
                -<MoneyAmount amount={pendingWithdrawal.fee} size="sm" color="negative" />
              </span>
            </div>

            <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
              <span>الصافي المتوقع استلامه:</span>
              <MoneyAmount amount={pendingWithdrawal.netAmount} size="md" color="positive" />
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px] text-slate-500">
              <div className="flex justify-between">
                <span>تاريخ التقديم:</span>
                <bdi dir="ltr">{pendingWithdrawal.requestedAt}</bdi>
              </div>
              <div className="flex justify-between">
                <span>الاستحقاق التلقائي التقريبي:</span>
                <bdi dir="ltr" className="font-semibold text-amber-800">
                  {pendingWithdrawal.dueAt} (خلال 72 ساعة)
                </bdi>
              </div>
              <div className="truncate pt-1">
                <span>عنوان المحفظة: </span>
                <bdi dir="ltr" className="font-mono text-slate-700">
                  {pendingWithdrawal.targetAddress}
                </bdi>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-3 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">
          سجل طلبات السحب
        </h3>

        {withdrawals.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            لا توجد طلبات سحب مسجلة.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
            {withdrawals.map((item) => (
              <div key={item.id} className="p-3 text-xs space-y-2 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <Calendar size={13} aria-hidden="true" />
                    <bdi dir="ltr">{item.requestedAt}</bdi>
                  </div>

                  <StatusBadge
                    status={
                      item.status === "completed"
                        ? "completed"
                        : item.status === "pending"
                        ? "pending"
                        : "rejected"
                    }
                    size="sm"
                  />
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-slate-500">المبلغ المحول:</span>
                  <div className="text-left">
                    <MoneyAmount amount={item.netAmount} size="md" color="neutral" />
                    <span className="text-[11px] text-slate-400 block">
                      (إجمالي الطلب: {item.amount.toFixed(2)} USDT - رسوم 21%)
                    </span>
                  </div>
                </div>

                {item.status === "rejected" && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 flex items-start gap-1.5">
                    <AlertCircle size={14} className="shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
                    <span>تم إلغاء الطلب من قبل الإدارة وإعادة المبلغ المحجوز للرصيد المتاح.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
