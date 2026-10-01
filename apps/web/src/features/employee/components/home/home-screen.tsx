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

export function EmployeeHomeScreen() {
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
    <div className="flex flex-1 flex-col">
      {/* Top Header / Greeting */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-sm font-bold text-emerald-900">
            {user.name.slice(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base leading-tight font-bold text-slate-900 sm:text-lg">
                أهلاً، {user.name}
              </h1>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">
                {currentPackage.name}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              كود الدعوة:{" "}
              <bdi dir="ltr" className="font-semibold text-slate-700">
                {user.invitationCode}
              </bdi>
            </p>
          </div>
        </div>

        <Link
          href="/employee/account"
          className="rounded-md p-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          إعدادات الحساب
        </Link>
      </header>

      {/* Main Content Area */}
      <div className="space-y-4 p-4 sm:p-5">
        {/* Company Notice Banner (Restrained, no gradients) */}
        <div className="relative overflow-hidden rounded-lg border border-emerald-800 bg-emerald-900 p-4 text-white sm:p-5">
          <span className="mb-1 block text-xs font-semibold text-emerald-300">
            نافذة المهام اليومية مفتوحة
          </span>
          <h2 className="mb-2 text-lg font-bold sm:text-xl">
            مهمتك اليومية بانتظارك
          </h2>
          <p className="mb-3 max-w-sm text-xs leading-relaxed text-emerald-100/90 sm:text-sm">
            أكمل مراجعة التقييم المعتمدة بين 12:00 و 18:00 بتوقيت بغداد لإضافة
            مكافأة {task.rewardAmount.toFixed(2)} USDT لرصيدك.
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
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Wallet size={15} className="text-slate-400" aria-hidden="true" />
              الرصيد المتاح للسحب
            </span>
            <Link
              href="/employee/wallet"
              className="flex items-center gap-0.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              <span>تفاصيل المحفظة</span>
              <ChevronLeft size={14} aria-hidden="true" />
            </Link>
          </div>

          <div className="flex items-baseline justify-between">
            <MoneyAmount
              amount={balance.available}
              size="xl"
              color="positive"
            />
            <div className="text-left text-xs text-slate-500">
              <span>الإجمالي: </span>
              <MoneyAmount amount={balance.total} size="sm" color="neutral" />
            </div>
          </div>

          {/* Shortcuts: Deposit, Withdraw using ButtonLink */}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Current Package Summary */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500">الباقة الحالية</span>
              <Link
                href="/employee/packages"
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                ترقية
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                {currentPackage.name}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {isFree
                  ? "مجانية"
                  : "متبقي " + packageExpiryDays.toString() + " يوم"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isFree
                ? "لا توجد عوائد يومية"
                : `عائد المهمة اليومية: ${currentPackage.dailyReward.toFixed(2)} USDT`}
            </p>
          </div>

          {/* Referral Mini Summary */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500">فريق الإحالة</span>
              <Link
                href="/employee/team"
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                استعراض
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                {teamMembers.length} أعضاء مسجلين
              </span>
              <span className="text-xs font-bold text-emerald-700">
                +{balance.breakdown.referralCommissions.toFixed(2)} USDT
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              عمولات تصل حتى 12% للمستوى الأول
            </p>
          </div>
        </div>

        {/* Recent Financial Activity */}
        <div className="space-y-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-4">
            <h2 className="text-sm font-bold text-slate-900">
              النشاط المالي الأخير
            </h2>
            <Link
              href="/employee/wallet"
              className="flex items-center gap-0.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
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
                onClick={(item) => {
                  setSelectedTx(item);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <TransactionDetailSheet
        transaction={selectedTx}
        onClose={() => {
          setSelectedTx(null);
        }}
      />
    </div>
  );
}
