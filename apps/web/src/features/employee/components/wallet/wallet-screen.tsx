"use client";

import { Filter } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { BalanceSummary } from "@/features/employee/components/wallet/balance-summary";
import { TransactionDetailSheet } from "@/features/employee/components/wallet/transaction-detail-sheet";
import { TransactionRow } from "@/features/employee/components/wallet/transaction-row";
import { useEmployeeState } from "@/features/employee/context/employee-state.context";
import type { LedgerTransaction } from "@/features/employee/types/employee.types";

export function EmployeeWalletScreen() {
  const { transactions } = useEmployeeState();
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null);

  const filterTabs = [
    { id: "all", label: "الكل" },
    { id: "deposit", label: "الإيداعات" },
    { id: "withdrawal", label: "السحوبات" },
    { id: "task_reward", label: "مكافآت المهام" },
    { id: "referral_commission", label: "عمولات الفريق" },
    { id: "other", label: "باقات وتسويات" },
  ] as const;

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === "all") return true;
    if (filterType === "deposit") return tx.type === "deposit";
    if (filterType === "withdrawal") {
      return (
        tx.type === "withdrawal_reservation" ||
        tx.type === "withdrawal_completion" ||
        tx.type === "withdrawal_reversal"
      );
    }
    if (filterType === "task_reward") {
      return tx.type === "task_reward" || tx.type === "task_reward_reversal";
    }
    if (filterType === "referral_commission") {
      return tx.type === "referral_commission";
    }
    if (filterType === "other") {
      return (
        tx.type === "package_purchase" ||
        tx.type === "package_upgrade" ||
        tx.type === "admin_adjustment"
      );
    }
    return true;
  });

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="المحفظة وسجل العمليات"
        subtitle="متابعة الرصيد المتاح والمحجوز وكشف الحساب التفصيلي"
        showBackButton={true}
        backHref="/employee"
      />

      <div className="space-y-4 p-4 sm:p-5">
        {/* Balance Overview */}
        <BalanceSummary />

        {/* Ledger Section */}
        <div className="space-y-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Filter size={16} className="text-slate-500" aria-hidden="true" />
              <span>كشف الحساب والعمليات المالية</span>
            </h2>
            <span className="text-xs text-slate-400">
              {filteredTransactions.length} عملية
            </span>
          </div>

          {/* Filter Tabs */}
          <div className="flex scrollbar-none items-center gap-1.5 overflow-x-auto pb-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilterType(tab.id);
                }}
                className={`min-h-[44px] shrink-0 rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                  filterType === tab.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Transaction List */}
          {filteredTransactions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              لا توجد عمليات مسجلة تحت هذا التصنيف.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
              {filteredTransactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onClick={(item) => {
                    setSelectedTx(item);
                  }}
                />
              ))}
            </div>
          )}
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
