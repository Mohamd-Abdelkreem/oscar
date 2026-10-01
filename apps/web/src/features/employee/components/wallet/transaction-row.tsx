"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  RefreshCcw,
  Sparkles,
  Users,
} from "lucide-react";
import type { LedgerTransaction, TransactionType } from "../../types/employee.types";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

interface TransactionRowProps {
  readonly transaction: LedgerTransaction;
  readonly onClick: (tx: LedgerTransaction) => void;
}

export function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const getIcon = (type: TransactionType) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft size={16} className="text-emerald-700" />;
      case "withdrawal_reservation":
      case "withdrawal_completion":
        return <ArrowUpRight size={16} className="text-slate-700" />;
      case "withdrawal_reversal":
        return <RefreshCcw size={16} className="text-amber-700" />;
      case "task_reward":
        return <Sparkles size={16} className="text-emerald-700" />;
      case "task_reward_reversal":
        return <RefreshCcw size={16} className="text-rose-700" />;
      case "referral_commission":
        return <Users size={16} className="text-emerald-700" />;
      case "package_purchase":
      case "package_upgrade":
        return <Layers size={16} className="text-slate-700" />;
      case "admin_adjustment":
        return <CheckCircle2 size={16} className="text-blue-700" />;
      default:
        return <ArrowDownLeft size={16} className="text-slate-500" />;
    }
  };

  const getStatusVariant = (status: LedgerTransaction["status"]) => {
    switch (status) {
      case "completed":
        return "completed";
      case "pending":
        return "pending";
      case "reversed":
        return "reversed";
      case "rejected":
        return "rejected";
    }
  };

  return (
    <button
      type="button"
      onClick={() => { onClick(transaction); }}
      className="w-full text-right p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          {getIcon(transaction.type)}
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">
            {transaction.title}
          </h3>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            <bdi dir="ltr">{transaction.date}</bdi> • مرجع: <bdi dir="ltr">{transaction.reference}</bdi>
          </p>
        </div>
      </div>

      <div className="text-left shrink-0">
        <MoneyAmount
          amount={transaction.amount}
          size="md"
          color={transaction.amount > 0 ? "positive" : "neutral"}
          showSign={transaction.amount > 0}
        />
        <div className="mt-1 flex justify-end">
          <StatusBadge status={getStatusVariant(transaction.status)} size="sm" />
        </div>
      </div>
    </button>
  );
}
