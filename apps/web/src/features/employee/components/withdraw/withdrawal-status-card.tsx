"use client";

import { AlertCircle, Calendar, Clock } from "lucide-react";
import { useEmployeeState } from "../../context/employee-state.context";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

export function WithdrawalStatusCard() {
  const { withdrawals, pendingWithdrawal } = useEmployeeState();

  return (
    <div className="space-y-4">
      {/* Active Pending Request Card */}
      {pendingWithdrawal && (
        <div className="space-y-4 rounded-lg border-2 border-amber-300 bg-white p-4 shadow-xs sm:p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800">
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

            <StatusBadge
              status="pending"
              label="قيد المعالجة (72 ساعة)"
              size="sm"
            />
          </div>

          {/* Breakdown Card */}
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>المبلغ المحجوز:</span>
              <MoneyAmount
                amount={pendingWithdrawal.amount}
                size="sm"
                color="neutral"
              />
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>رسوم السحب (21%):</span>
              <span className="font-semibold text-rose-700">
                -
                <MoneyAmount
                  amount={pendingWithdrawal.fee}
                  size="sm"
                  color="negative"
                />
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
              <span>الصافي المتوقع استلامه:</span>
              <MoneyAmount
                amount={pendingWithdrawal.netAmount}
                size="md"
                color="positive"
              />
            </div>

            <div className="space-y-1 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
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
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <h3 className="text-sm font-bold text-slate-900">سجل طلبات السحب</h3>

        {withdrawals.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">
            لا توجد طلبات سحب مسجلة.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
            {withdrawals.map((item) => (
              <div
                key={item.id}
                className="space-y-2 p-3 text-xs transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
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
                    <MoneyAmount
                      amount={item.netAmount}
                      size="md"
                      color="neutral"
                    />
                    <span className="block text-[11px] text-slate-400">
                      (إجمالي الطلب: {item.amount.toFixed(2)} USDT - رسوم 21%)
                    </span>
                  </div>
                </div>

                {item.status === "rejected" && (
                  <div className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800">
                    <AlertCircle
                      size={14}
                      className="mt-0.5 shrink-0 text-rose-600"
                      aria-hidden="true"
                    />
                    <span>
                      تم إلغاء الطلب من قبل الإدارة وإعادة المبلغ المحجوز للرصيد
                      المتاح.
                    </span>
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
