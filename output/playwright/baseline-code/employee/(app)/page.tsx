"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ClipboardCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/features/employee/components/common/button";
import { MoneyAmount } from "@/features/employee/components/common/money-amount";
import { TransactionDetailSheet } from "@/features/employee/components/wallet/transaction-detail-sheet";
import { TransactionRow } from "@/features/employee/components/wallet/transaction-row";
import { useEmployeeState } from "@/features/employee/context/employee-state.context";
import type { LedgerTransaction } from "@/features/employee/types/employee.types";

export default function EmployeeHomePage() {
  const {
    user,
    balance,
    currentPackage,
    packageExpiryDays,
    task,
    transactions,
    teamMembers,
  } = useEmployeeState();

  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null);

  const isFree = currentPackage.id === "FREE";
  const recentTransactions = transactions.slice(0, 4);

  return (
    <div className="flex-1 flex flex-col">
      {/* Top Header / Greeting */}
      <header className="p-4 sm:p-5 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-900 font-bold text-sm">
            {user.name.slice(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                أهلاً، {user.name}
              </h1>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {currentPackage.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              كود الدعوة: <bdi dir="ltr" className="font-semibold text-slate-700">{user.invitationCode}</bdi>
            </p>
          </div>
        </div>

        <Link
          href="/employee/account"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 p-2 rounded-md hover:bg-slate-100 transition-colors"
        >
          إعدادات الحساب
        </Link>
      </header>

      {/* Main Content Area */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Company Notice Banner (Restrained, no gradients) */}
        <div className="border border-emerald-800 rounded-lg overflow-hidden bg-emerald-900 text-white p-4 sm:p-5 relative">
          <span className="text-xs font-semibold text-emerald-300 block mb-1">
            نافذة المهام اليومية مفتوحة
          </span>
          <h2 className="text-lg sm:text-xl font-bold mb-2">
            مهمتك اليومية بانتظارك
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 max-w-sm mb-3 leading-relaxed">
            أكمل مراجعة التقييم المعتمدة بين 12:00 و 18:00 بتوقيت بغداد لإضافة مكافأة {task.rewardAmount.toFixed(2)} USDT لرصيدك.
          </p>
          <ButtonLink
            href="/employee/tasks"
            variant="white"
            size="compact"
            icon={ClipboardCheck}
            trailingIcon={ChevronLeft}
          >
            تنفيذ المهمة اليوم
          </ButtonLink>
        </div>

        {/* Balance Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Wallet size={15} className="text-slate-400" aria-hidden="true" />
              الرصيد المتاح للسحب
            </span>
            <Link
              href="/employee/wallet"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
            >
              <span>تفاصيل المحفظة</span>
              <ChevronLeft size={14} aria-hidden="true" />
            </Link>
          </div>

          <div className="flex items-baseline justify-between">
            <MoneyAmount amount={balance.available} size="xl" color="positive" />
            <div className="text-left text-xs text-slate-500">
              <span>الإجمالي: </span>
              <MoneyAmount amount={balance.total} size="sm" color="neutral" />
            </div>
          </div>

          {/* Shortcuts: Deposit, Withdraw using ButtonLink */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
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

        {/* Current Package & Today's Task Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Current Package Summary */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">الباقة الحالية</span>
              <Link
                href="/employee/packages"
                className="text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                ترقية
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">{currentPackage.name}</span>
              <span className="text-xs text-slate-500 font-medium">
                {isFree ? "مجانية" : "متبقي " + packageExpiryDays.toString() + " يوم"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isFree ? "لا توجد عوائد يومية" : `عائد المهمة اليومية: ${currentPackage.dailyReward.toFixed(2)} USDT`}
            </p>
          </div>

          {/* Referral Mini Summary */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">فريق الإحالة</span>
              <Link
                href="/employee/team"
                className="text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                استعراض
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                {teamMembers.length} أعضاء مسجلين
              </span>
              <span className="text-xs text-emerald-700 font-bold">
                +{balance.breakdown.referralCommissions.toFixed(2)} USDT
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              عمولات تصل حتى 12% للمستوى الأول
            </p>
          </div>
        </div>

        {/* Recent Financial Activity */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900">
              النشاط المالي الأخير
            </h2>
            <Link
              href="/employee/wallet"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
            >
              <span>عرض السجل كاملاً</span>
              <ChevronLeft size={14} aria-hidden="true" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentTransactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onClick={(item) => { setSelectedTx(item); }}
              />
            ))}
          </div>
        </div>
      </div>

      <TransactionDetailSheet
        transaction={selectedTx}
        onClose={() => { setSelectedTx(null); }}
      />
    </div>
  );
}
