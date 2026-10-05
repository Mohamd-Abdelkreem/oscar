"use client";

import { ArrowDownLeft, ArrowUpRight, Lock, Wallet } from "lucide-react";
import { useWallet } from "../../hooks/wallet.hooks";
import { FinancialFeedback } from "../common/financial-feedback";
import { sumAmounts } from "../../utils/money-display";
import { ButtonLink } from "../common/button";
import { MoneyAmount } from "../common/money-amount";

export function BalanceSummary() {
  const query = useWallet();
  if (!query.data)
    return (
      <FinancialFeedback
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
    );
  const view = query.data;
  const balance = {
    available: view.withdrawalFunds.total,
    total: view.walletComponents.total,
    reserved: sumAmounts(
      view.walletComponents.reservedReferral,
      view.walletComponents.reservedNonReferral,
    ),
    breakdown: {
      availableNonReferral: view.walletComponents.availableNonReferral,
      lockedReferral: view.withdrawalFunds.lockedReferral,
      availableReferral: view.walletComponents.availableReferral,
    },
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      {/* Top Main Available Balance */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              الأموال المؤهلة للسحب حسب المصدر
            </span>
            <MoneyAmount
              amount={balance.available}
              size="xl"
              color="positive"
              className="tracking-tight"
            />
          </div>

          <div className="text-left text-xs text-slate-500">
            <span className="block text-[11px] text-slate-400">
              إجمالي الحساب:
            </span>
            <MoneyAmount amount={balance.total} size="md" color="neutral" />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          إجمالي الرصيد غير المحجوز:{" "}
          <MoneyAmount amount={view.purchaseEligibleAmount} size="sm" />
        </p>
        <p role="status" className="text-xs text-slate-500">
          {view.restrictions.accountUnavailable
            ? "الحساب غير متاح حالياً. السحب محظور دون تغيير ملكية الرصيد."
            : view.restrictions.withdrawalsBlocked
              ? "السحب محظور حالياً على الحساب. أهلية المصادر لا تعني السماح بالسحب."
              : "أهلية المصادر لا تعني جاهزية تنفيذ السحب؛ العنوان والحدود والجدولة تخضع للتحقق لاحقاً."}
        </p>

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
      <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
        <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <Lock
              size={15}
              className="shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <span>الرصيد المحجوز:</span>
          </span>
          <div className="space-y-1 text-left">
            <MoneyAmount amount={balance.reserved} size="sm" color="neutral" />
            <p>
              المحجوز الإحالي:{" "}
              <MoneyAmount
                amount={view.walletComponents.reservedReferral}
                size="sm"
              />
            </p>
            <p>
              المحجوز غير الإحالي:{" "}
              <MoneyAmount
                amount={view.walletComponents.reservedNonReferral}
                size="sm"
              />
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <Wallet
              size={15}
              className="shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <span>إجمالي رصيد المحفظة:</span>
          </span>
          <MoneyAmount amount={balance.total} size="sm" color="neutral" />
        </div>
      </div>

      {/* Sources Breakdown (Deposits, Tasks, Referrals) */}
      <div className="border-t border-slate-100 pt-2">
        <span className="mb-2 block text-xs font-bold tracking-wider text-slate-400 uppercase">
          تفاصيل مصادر الرصيد:
        </span>
        <div className="grid grid-cols-3 gap-1.5 text-center text-xs sm:gap-2">
          <div className="rounded-md border border-slate-200/80 bg-slate-50 p-2.5">
            <span className="mb-0.5 block text-[11px] font-medium text-slate-500">
              المتاح غير الإحالي
            </span>
            <MoneyAmount
              amount={balance.breakdown.availableNonReferral}
              size="sm"
              color="neutral"
            />
          </div>
          <div className="rounded-md border border-slate-200/80 bg-slate-50 p-2.5">
            <span className="mb-0.5 block text-[11px] font-medium text-slate-500">
              إحالات غير مؤهلة للسحب
            </span>
            <MoneyAmount
              amount={balance.breakdown.lockedReferral}
              size="sm"
              color="positive"
            />
          </div>
          <div className="rounded-md border border-slate-200/80 bg-slate-50 p-2.5">
            <span className="mb-0.5 block text-[11px] font-medium text-slate-500">
              المتاح الإحالي
            </span>
            <MoneyAmount
              amount={balance.breakdown.availableReferral}
              size="sm"
              color="positive"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
