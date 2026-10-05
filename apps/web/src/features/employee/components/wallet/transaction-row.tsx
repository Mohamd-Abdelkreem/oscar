"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  RefreshCcw,
  Sparkles,
  Users,
} from "lucide-react";
import type { LedgerRow } from "@template/contracts";
import { operationLabels } from "../../utils/ledger-presentation";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

interface TransactionRowProps {
  readonly transaction: LedgerRow;
  readonly onClick: (tx: LedgerRow) => void;
}

export function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const getIcon = () => {
    if (transaction.origin === "PACKAGE_PURCHASE")
      return <Layers size={16} className="text-slate-700" />;
    if (transaction.origin === "REFERRAL_COMMISSION")
      return <Users size={16} className="text-emerald-700" />;
    if (transaction.origin === "TASK_REWARD")
      return <Sparkles size={16} className="text-emerald-700" />;
    if (transaction.direction === "NEUTRAL")
      return <RefreshCcw size={16} className="text-amber-700" />;
    return transaction.direction === "CREDIT" ? (
      <ArrowDownLeft size={16} className="text-emerald-700" />
    ) : (
      <ArrowUpRight size={16} className="text-slate-700" />
    );
  };

  return (
    <button
      type="button"
      onClick={() => {
        onClick(transaction);
      }}
      className="flex w-full items-center justify-between gap-3 p-4 text-right transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
          {getIcon()}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {operationLabels[transaction.origin]}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            <bdi dir="ltr">{transaction.recordedAt}</bdi> • مرجع:{" "}
            <bdi dir="ltr">{transaction.referenceLabel}</bdi>
          </p>
        </div>
      </div>

      <div className="shrink-0 text-left">
        <MoneyAmount
          amount={transaction.signedOwnershipDelta}
          size="md"
          color={transaction.direction === "CREDIT" ? "positive" : "neutral"}
          showSign={transaction.direction === "CREDIT"}
        />
        <div className="mt-1 flex justify-end">
          <StatusBadge status={"completed"} size="sm" />
        </div>
      </div>
    </button>
  );
}
