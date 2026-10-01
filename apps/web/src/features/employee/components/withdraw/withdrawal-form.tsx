"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { FINANCIAL_RULES } from "../../constants/branding";
import { useEmployeeState } from "../../context/employee-state.context";
import { getWithdrawalAmounts } from "../../utils/financial-calculations";
import { Button } from "../common/button";
import { ConfirmationSheet } from "../common/confirmation-sheet";
import { MoneyAmount } from "../common/money-amount";
import { WithdrawalAddressCard } from "./withdrawal-address-card";

export function WithdrawalForm() {
  const scheduleTimeout = useManagedTimeout();
  const { user, balance, hasPendingWithdrawal, requestWithdrawal } =
    useEmployeeState();

  // Amount input state
  const [amountInput, setAmountInput] = useState<string>("100");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const savedAddress = user.savedWithdrawalAddress;

  const parsedAmount = Number(amountInput) || 0;
  const isAmountValid =
    parsedAmount >= FINANCIAL_RULES.withdrawalMinAmount &&
    parsedAmount <= FINANCIAL_RULES.withdrawalMaxAmount &&
    parsedAmount <= balance.available;

  const { fee: calculatedFee, netAmount: calculatedNet } =
    getWithdrawalAmounts(parsedAmount);

  const handleOpenConfirm = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!isAmountValid) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = () => {
    setIsSubmitting(true);
    scheduleTimeout(() => {
      const res = requestWithdrawal(parsedAmount);
      setRequestFeedback(res);
      setIsSubmitting(false);
      setIsConfirmOpen(false);
    }, 400);
  };

  return (
    <div className="space-y-4">
      <WithdrawalAddressCard />

      {/* 2. Amount Input & Calculation Section */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">
            طلب سحب جديد
          </h2>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>الرصيد المتاح للسحب حالياً:</span>
            <MoneyAmount
              amount={balance.available}
              size="sm"
              color="positive"
            />
          </div>
        </div>

        {hasPendingWithdrawal ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <Clock size={18} aria-hidden="true" />
              <span>لديك طلب سحب قيد المعالجة</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-800">
              تنص السياسة المعتمدة على السماح بطلب سحب واحد فقط في نفس الوقت، مع
              اشتراط فاصل زمني لا يقل عن 24 ساعة بين كل طلب وآخر. يمكنك متابعة
              حالة طلبك الحالي أدناه.
            </p>
          </div>
        ) : !savedAddress ? (
          <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-600">
            <Lock
              size={20}
              className="mx-auto mb-1 text-slate-400"
              aria-hidden="true"
            />
            <p className="font-semibold text-slate-800">
              يرجى حفظ وتأمين عنوان محفظتك أولاً لتتمكن من تقديم طلب السحب.
            </p>
          </div>
        ) : (
          <form onSubmit={handleOpenConfirm} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="withdraw-amount-input"
                  className="font-semibold text-slate-700"
                >
                  المبلغ المطلوب سحبه (USDT)
                </label>
                <span className="text-slate-400">
                  الحدود: {FINANCIAL_RULES.withdrawalMinAmount} -{" "}
                  {FINANCIAL_RULES.withdrawalMaxAmount} USDT
                </span>
              </div>

              <div className="relative">
                <input
                  id="withdraw-amount-input"
                  type="number"
                  step="1"
                  min={FINANCIAL_RULES.withdrawalMinAmount}
                  max={FINANCIAL_RULES.withdrawalMaxAmount}
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                  }}
                  className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 pl-16 text-base font-bold text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 sm:text-lg"
                  required
                />
                <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-xs font-bold text-slate-400">
                  USDT
                </span>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setAmountInput(amt.toString());
                    }}
                    className="min-h-[44px] flex-1 rounded-md border border-slate-200 bg-slate-50 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Arithmetic Fee Breakdown Card */}
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>المبلغ المطلوب خصمه من الرصيد:</span>
                <MoneyAmount amount={parsedAmount} size="sm" />
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>رسوم المعالجة الإدارية (21%):</span>
                <span className="font-semibold text-rose-700">
                  -
                  <MoneyAmount
                    amount={calculatedFee}
                    size="sm"
                    color="negative"
                  />
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>المبلغ الصافي المتوقع استلامه:</span>
                <MoneyAmount
                  amount={calculatedNet}
                  size="md"
                  color="positive"
                />
              </div>
            </div>

            {/* Validation notice */}
            {parsedAmount > 0 && !isAmountValid && (
              <p
                className="flex items-center gap-1.5 text-xs font-medium text-rose-600"
                role="alert"
              >
                <AlertCircle
                  size={14}
                  className="shrink-0"
                  aria-hidden="true"
                />
                {parsedAmount < FINANCIAL_RULES.withdrawalMinAmount
                  ? `الحد الأدنى للسحب هو ${String(FINANCIAL_RULES.withdrawalMinAmount)} USDT.`
                  : parsedAmount > FINANCIAL_RULES.withdrawalMaxAmount
                    ? `الحد الأقصى للسحب هو ${String(FINANCIAL_RULES.withdrawalMaxAmount)} USDT.`
                    : "المبلغ يتجاوز رصيدك المتاح حالياً."}
              </p>
            )}

            {requestFeedback && (
              <p
                className={`rounded border p-2.5 text-xs font-medium ${
                  requestFeedback.success
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {requestFeedback.message}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="default"
              fullWidth
              disabled={!isAmountValid}
              icon={ArrowUpRight}
            >
              متابعة تأكيد طلب السحب
            </Button>
          </form>
        )}
      </div>

      {/* Confirmation Sheet */}
      <ConfirmationSheet
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
        }}
        title="تأكيد تقديم طلب السحب"
        description="مراجعة تفاصيل المبلغ والرسوم قبل الحجز النهائي"
      >
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>المبلغ المطلوب:</span>
              <MoneyAmount amount={parsedAmount} size="sm" />
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>نسبة الرسوم المقتطعة (21%):</span>
              <span className="font-semibold text-rose-700">
                -
                <MoneyAmount
                  amount={calculatedFee}
                  size="sm"
                  color="negative"
                />
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
              <span>الصافي المحول لمحفظتك:</span>
              <MoneyAmount amount={calculatedNet} size="md" color="positive" />
            </div>
            <div className="space-y-1 border-t border-slate-200 pt-2">
              <span className="block text-xs text-slate-500">
                عنوان المحفظة المستلمة:
              </span>
              <bdi
                dir="ltr"
                className="block font-mono text-xs font-semibold break-all text-slate-800 select-all"
              >
                {savedAddress}
              </bdi>
            </div>
          </div>

          <div className="space-y-1 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <p className="flex items-center gap-1.5 font-semibold text-blue-900">
              <HelpCircle size={14} className="shrink-0" aria-hidden="true" />
              سياسة الحجز والجدولة:
            </p>
            <p className="leading-relaxed text-blue-800">
              سيتم حجز مبلغ {parsedAmount.toFixed(2)} USDT فوراً من رصيدك
              المتاح. فترة المعالجة والانتظار التلقائية هي 72 ساعة، وللإدارة
              الحق في إيقاف الطلب أو رفضه واسترجاع الرصيد المحجوز للمتاح في حال
              ثبوت مخالفة.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              size="default"
              fullWidth
              loading={isSubmitting}
              icon={CheckCircle2}
              onClick={handleConfirmSubmit}
            >
              تأكيد طلب السحب وحجز الرصيد
            </Button>

            <Button
              variant="outline"
              size="default"
              fullWidth
              onClick={() => {
                setIsConfirmOpen(false);
              }}
            >
              تراجع
            </Button>
          </div>
        </div>
      </ConfirmationSheet>
    </div>
  );
}
