"use client";

import type { LedgerTransaction } from "../../types/employee.types";
import { ConfirmationSheet } from "../common/confirmation-sheet";
import { CopyAction } from "../common/copy-action";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

interface TransactionDetailSheetProps {
  readonly transaction: LedgerTransaction | null;
  readonly onClose: () => void;
}

export function TransactionDetailSheet({
  transaction,
  onClose,
}: TransactionDetailSheetProps) {
  if (!transaction) return null;

  return (
    <ConfirmationSheet
      isOpen={true}
      onClose={onClose}
      title="تفاصيل العملية المالية"
      description={`المرجع: ${transaction.reference}`}
    >
      <div className="space-y-4">
        {/* Main Amount Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2">
          <span className="text-xs text-slate-500 font-medium block">المبلغ الصافي للعملية</span>
          <MoneyAmount
            amount={transaction.amount}
            size="xl"
            color={transaction.amount > 0 ? "positive" : "neutral"}
            showSign={transaction.amount > 0}
          />
          <div>
            <StatusBadge
              status={
                transaction.status === "completed"
                  ? "completed"
                  : transaction.status === "pending"
                  ? "pending"
                  : transaction.status === "reversed"
                  ? "reversed"
                  : "rejected"
              }
              size="sm"
            />
          </div>
        </div>

        {/* Details list */}
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs sm:text-sm">
          <div className="p-3 flex justify-between items-center text-slate-600">
            <span className="text-slate-400">نوع العملية:</span>
            <span className="font-semibold text-slate-900">{transaction.title}</span>
          </div>

          <div className="p-3 flex justify-between items-center text-slate-600">
            <span className="text-slate-400">تاريخ ووقت المعاملة:</span>
            <bdi dir="ltr" className="font-medium text-slate-800">
              {transaction.date}
            </bdi>
          </div>

          <div className="p-3 flex justify-between items-center text-slate-600">
            <span className="text-slate-400">الرقم المرجعي (Ref):</span>
            <div className="flex items-center gap-1.5">
              <bdi dir="ltr" className="font-mono text-slate-800">
                {transaction.reference}
              </bdi>
              <CopyAction value={transaction.reference} variant="icon" />
            </div>
          </div>

          {transaction.details &&
            Object.entries(transaction.details).map(([key, val]) => (
              <div key={key} className="p-3 flex justify-between items-center text-slate-600">
                <span className="text-slate-400">{key}:</span>
                <span className="font-medium text-slate-900">{val}</span>
              </div>
            ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] py-2.5 px-4 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
        >
          إغلاق
        </button>
      </div>
    </ConfirmationSheet>
  );
}
