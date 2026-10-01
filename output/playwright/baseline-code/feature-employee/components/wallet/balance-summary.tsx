"use client";

import { ArrowDownLeft, ArrowUpRight, Lock, Wallet } from "lucide-react";
import { useEmployeeState } from "../../context/employee-state.context";
import { ButtonLink } from "../common/button";
import { MoneyAmount } from "../common/money-amount";

export function BalanceSummary() {
  const { balance } = useEmployeeState();

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Top Main Available Balance */}
      <div className="flex flex-col gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="text-xs text-slate-500 font-semibold block mb-1">
              الرصيد المتاح للسحب
            </span>
            <MoneyAmount
              amount={balance.available}
              size="xl"
              color="positive"
              className="tracking-tight"
            />
          </div>

          <div className="text-left text-xs text-slate-500">
            <span className="block text-[11px] text-slate-400">إجمالي الحساب:</span>
            <MoneyAmount amount={balance.total} size="md" color="neutral" />
          </div>
        </div>

        {/* Action Buttons using typed ButtonLink */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <ButtonLink
            href="/employee/deposit"
            variant="primary"
            size="default"
            fullWidth
            icon={ArrowDownLeft}
          >
            إيداع رصيد
          </ButtonLink>

          <ButtonLink
            href="/employee/withdraw"
            variant="dark"
            size="default"
            fullWidth
            icon={ArrowUpRight}
          >
            طلب سحب
          </ButtonLink>
        </div>
      </div>

      {/* Reserved and Total Breakdown Row (Stacks on narrow screens to avoid cramped text) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-between gap-2">
          <span className="text-slate-600 flex items-center gap-1.5 font-medium">
            <Lock size={15} className="text-slate-400 shrink-0" aria-hidden="true" />
            <span>الرصيد المحجوز (طلبات سحب):</span>
          </span>
          <MoneyAmount amount={balance.reserved} size="sm" color="neutral" />
        </div>

        <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-between gap-2">
          <span className="text-slate-600 flex items-center gap-1.5 font-medium">
            <Wallet size={15} className="text-slate-400 shrink-0" aria-hidden="true" />
            <span>إجمالي رصيد المحفظة:</span>
          </span>
          <MoneyAmount amount={balance.total} size="sm" color="neutral" />
        </div>
      </div>

      {/* Sources Breakdown (Deposits, Tasks, Referrals) */}
      <div className="pt-2 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
          تفاصيل مصادر الرصيد:
        </span>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-xs">
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/80">
            <span className="text-slate-500 block text-[11px] mb-0.5 font-medium">الإيداعات</span>
            <MoneyAmount amount={balance.breakdown.deposits} size="sm" color="neutral" />
          </div>
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/80">
            <span className="text-slate-500 block text-[11px] mb-0.5 font-medium">مكافآت المهام</span>
            <MoneyAmount amount={balance.breakdown.taskRewards} size="sm" color="positive" />
          </div>
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/80">
            <span className="text-slate-500 block text-[11px] mb-0.5 font-medium">عمولات الفريق</span>
            <MoneyAmount amount={balance.breakdown.referralCommissions} size="sm" color="positive" />
          </div>
        </div>
      </div>
    </div>
  );
}
