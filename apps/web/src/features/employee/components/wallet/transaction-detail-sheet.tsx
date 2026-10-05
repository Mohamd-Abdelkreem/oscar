"use client";

import type { EmployeeLedgerDetail } from "@template/contracts";
import { operationLabels } from "../../utils/ledger-presentation";
import { ConfirmationSheet } from "../common/confirmation-sheet";
import { CopyAction } from "../common/copy-action";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

interface TransactionDetailSheetProps {
  readonly transaction: EmployeeLedgerDetail | null;
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
      description={`المرجع: ${transaction.referenceLabel}`}
    >
      <div className="space-y-4">
        {/* Main Amount Card */}
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
          <span className="block text-xs font-medium text-slate-500">
            المبلغ الصافي للعملية
          </span>
          <MoneyAmount
            amount={transaction.signedOwnershipDelta}
            size="xl"
            color={transaction.direction === "CREDIT" ? "positive" : "neutral"}
            showSign={transaction.direction === "CREDIT"}
          />
          <div>
            <StatusBadge status="completed" size="sm" />
          </div>
        </div>

        {/* Details list */}
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-slate-600">
            <span className="text-slate-400">نوع العملية:</span>
            <span className="font-semibold text-slate-900">
              {operationLabels[transaction.origin]}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-slate-600">
            <span className="text-slate-400">تاريخ ووقت المعاملة:</span>
            <bdi
              dir="ltr"
              className="max-w-full font-medium break-all text-slate-800"
            >
              {transaction.recordedAt}
            </bdi>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-slate-600">
            <span className="text-slate-400">الرقم المرجعي (Ref):</span>
            <div className="flex max-w-full min-w-0 items-center gap-1.5">
              <bdi
                dir="ltr"
                className="min-w-0 font-mono break-all text-slate-800"
              >
                {transaction.referenceLabel}
              </bdi>
              <CopyAction value={transaction.referenceLabel} variant="icon" />
            </div>
          </div>

          {transaction.sourceMovements.map((movement) => (
            <div
              key={movement.source}
              className="flex flex-wrap justify-between gap-2 p-3 text-slate-600"
            >
              <span>
                {movement.source === "REFERRAL" ? "إحالات" : "غير إحالات"}
              </span>
              <span>
                المتاح:{" "}
                <MoneyAmount amount={movement.availableDelta} size="sm" /> ·
                المحجوز:{" "}
                <MoneyAmount amount={movement.reservedDelta} size="sm" />
              </span>
            </div>
          ))}
          {transaction.savedTerms && (
            <div className="p-3 text-slate-600">
              شروط الشراء المحفوظة: {transaction.savedTerms.code} ·{" "}
              <MoneyAmount amount={transaction.savedTerms.price} size="sm" /> ·{" "}
              {transaction.savedTerms.countedWorkDates} يوم
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] w-full rounded-md bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
        >
          إغلاق
        </button>
      </div>
    </ConfirmationSheet>
  );
}
