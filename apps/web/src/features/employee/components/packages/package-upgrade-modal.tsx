"use client";

import { useManagedTimeout } from "@/features/employee/hooks/use-managed-timeout";

import { AlertCircle, ArrowUpRight, CheckCircle2, Wallet } from "lucide-react";
import { useState } from "react";
import { useEmployeeState } from "../../context/employee-state.context";
import type { PackageTier } from "../../types/employee.types";
import {
  getRequiredDeposit,
  getUpgradeCost,
} from "../../utils/financial-calculations";
import { Button, ButtonLink } from "../common/button";
import { ConfirmationSheet } from "../common/confirmation-sheet";
import { MoneyAmount } from "../common/money-amount";

interface PackageUpgradeModalProps {
  readonly targetPackage: PackageTier | null;
  readonly onClose: () => void;
}

export function PackageUpgradeModal({
  targetPackage,
  onClose,
}: PackageUpgradeModalProps) {
  const scheduleTimeout = useManagedTimeout();
  const { currentPackage, balance, upgradeToPackage } = useEmployeeState();
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!targetPackage) return null;

  const currentPrice = currentPackage.price;
  const targetPrice = targetPackage.price;
  const isFromFree = currentPackage.id === "FREE";
  // Upgrade cost is the difference (or full price if FREE)
  const upgradeCost = getUpgradeCost(currentPackage, targetPackage);

  const availableBalance = balance.available;
  const isSufficient = availableBalance >= upgradeCost;
  const requiredAdditionalDeposit = getRequiredDeposit(
    upgradeCost,
    availableBalance,
  );

  const handleConfirmUpgrade = () => {
    setIsProcessing(true);
    scheduleTimeout(() => {
      const res = upgradeToPackage(targetPackage.id);
      setFeedback(res);
      setIsProcessing(false);
      if (res.success) {
        scheduleTimeout(() => {
          onClose();
        }, 1200);
      }
    }, 400);
  };

  return (
    <ConfirmationSheet
      isOpen={true}
      onClose={onClose}
      title={`تأكيد ترقية المنصب إلى ${targetPackage.name}`}
      description="تفاصيل احتساب تكلفة الترقية وخصم المنصب الحالي"
    >
      <div className="space-y-4">
        {/* Breakdown Card */}
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span>سعر المنصب المستهدف ({targetPackage.name}):</span>
            <MoneyAmount amount={targetPrice} size="sm" />
          </div>

          {!isFromFree && (
            <div className="flex items-center justify-between text-slate-600">
              <span>خصم سعر منصبك الحالي ({currentPackage.name}):</span>
              <span className="font-semibold text-rose-700">
                -
                <MoneyAmount amount={currentPrice} size="sm" color="negative" />
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
            <span>صافي تكلفة الترقية الفعلية:</span>
            <MoneyAmount amount={upgradeCost} size="md" color="neutral" />
          </div>
        </div>

        {/* Balance & Additional Required Deposit Breakdown */}
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5">
              <Wallet size={16} className="text-slate-500" aria-hidden="true" />
              الرصيد المتاح حالياً في حسابك:
            </span>
            <MoneyAmount amount={availableBalance} size="sm" />
          </div>

          {!isSufficient ? (
            <div className="-mx-4 -mb-4 space-y-2 rounded-b-lg border-t border-amber-200 border-slate-200 bg-amber-50/70 p-4 pt-2">
              <div className="flex items-center justify-between font-bold text-amber-900">
                <span>المبلغ الإضافي المطلوب إيداعه:</span>
                <MoneyAmount
                  amount={requiredAdditionalDeposit}
                  size="md"
                  color="negative"
                />
              </div>
              <p className="text-xs leading-relaxed text-amber-900">
                ملاحظة: تكلفة الترقية الكاملة هي {upgradeCost.toFixed(2)} USDT.
                الرصيد المتاح في حسابك ({availableBalance.toFixed(2)} USDT) يغطي
                جزءاً منها، ويتطلب إيداع {requiredAdditionalDeposit.toFixed(2)}{" "}
                USDT إضافية لتغذية الرصيد قبل إتمام الترقية.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-medium text-emerald-700">
              <span>الرصيد كافٍ لإتمام الترقية مباشرة من الرصيد المتاح.</span>
            </div>
          )}
        </div>

        {/* Policy notice */}
        <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-semibold text-slate-700">
            تنويه إداري حول مدة المنصب:
          </p>
          <p>
            لا يمكن إلغاء الاشتراك أو التراجع بعد إتمام الترقية. مدة سريان
            المنصب بعد الترقية وإعادة ضبطها قيد الاعتماد الإداري.
          </p>
        </div>

        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-md p-3 text-xs font-semibold ${
              feedback.success
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
            role="alert"
          >
            {feedback.success ? (
              <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-2">
          {isSufficient ? (
            <Button
              variant="primary"
              fullWidth
              loading={isProcessing}
              icon={ArrowUpRight}
              onClick={handleConfirmUpgrade}
            >
              {`تأكيد الترقية وخصم ${upgradeCost.toFixed(2)} USDT`}
            </Button>
          ) : (
            <ButtonLink
              href="/employee/deposit"
              variant="primary"
              fullWidth
              icon={Wallet}
            >
              {`الانتقال للإيداع وإضافة ${requiredAdditionalDeposit.toFixed(2)} USDT`}
            </ButtonLink>
          )}

          <Button variant="outline" fullWidth onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </div>
    </ConfirmationSheet>
  );
}
