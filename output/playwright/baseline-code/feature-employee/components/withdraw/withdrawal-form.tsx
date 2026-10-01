"use client";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FINANCIAL_RULES } from "../../constants/branding";
import { useEmployeeState } from "../../context/employee-state.context";
import { Button } from "../common/button";
import { ConfirmationSheet } from "../common/confirmation-sheet";
import { CopyAction } from "../common/copy-action";
import { MoneyAmount } from "../common/money-amount";

export function WithdrawalForm() {
  const {
    user,
    balance,
    hasPendingWithdrawal,
    setupWithdrawalAddress,
    requestWithdrawal,
  } = useEmployeeState();

  // Address setup state
  const [addressInput, setAddressInput] = useState("");
  const [addressFeedback, setAddressFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Amount input state
  const [amountInput, setAmountInput] = useState<string>("100");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const savedAddress = user.savedWithdrawalAddress;

  const handleSaveAddress = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const res = setupWithdrawalAddress(addressInput);
    setAddressFeedback(res);
  };

  const parsedAmount = Number(amountInput) || 0;
  const isAmountValid =
    parsedAmount >= FINANCIAL_RULES.withdrawalMinAmount &&
    parsedAmount <= FINANCIAL_RULES.withdrawalMaxAmount &&
    parsedAmount <= balance.available;

  const calculatedFee = Number(
    (parsedAmount * FINANCIAL_RULES.withdrawalFeeRate).toFixed(2),
  );
  const calculatedNet = Number((parsedAmount - calculatedFee).toFixed(2));

  const handleOpenConfirm = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!isAmountValid) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const res = requestWithdrawal(parsedAmount);
      setRequestFeedback(res);
      setIsSubmitting(false);
      setIsConfirmOpen(false);
    }, 400);
  };

  return (
    <div className="space-y-4">
      {/* 1. Wallet Address Status / Setup Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-700" aria-hidden="true" />
            <span>عنوان محفظة السحب (TRON / TRC20)</span>
          </h2>
          {savedAddress && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              مثبت ومؤمن
            </span>
          )}
        </div>

        {savedAddress ? (
          <div className="space-y-2">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
              <span className="text-xs text-slate-500 block mb-1">
                العنوان المحفوظ المعتمد لاستلام الحوالات:
              </span>
              <div className="flex items-center justify-between gap-2">
                <bdi dir="ltr" className="font-mono text-xs sm:text-sm text-slate-900 break-all select-all font-semibold">
                  {savedAddress}
                </bdi>
                <CopyAction value={savedAddress} variant="icon" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Lock size={13} aria-hidden="true" />
                العنوان مقفل للحماية المالية
              </span>
              <Link
                href="/employee/support"
                className="text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                طلب تعديل العنوان عبر الدعم
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveAddress} className="space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              يتم تثبيت عنوان محفظتك لأول مرة لضمان وصول السحوبات بأمان. أي تعديل مستقبلي يتطلب التواصل مع الدعم الفني.
            </p>

            <div className="space-y-1">
              <label htmlFor="address-input" className="block text-xs font-semibold text-slate-700">
                أدخل عنوان محفظة TRON (TRC20):
              </label>
              <input
                id="address-input"
                type="text"
                dir="ltr"
                value={addressInput}
                onChange={(e) => {
                  setAddressInput(e.target.value);
                }}
                placeholder="T..."
                className="w-full min-h-[48px] px-3.5 py-2 text-base font-mono rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                required
              />
            </div>

            {addressFeedback && (
              <p
                className={`text-xs font-medium ${
                  addressFeedback.success ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {addressFeedback.message}
              </p>
            )}

            <Button
              type="submit"
              variant="dark"
              size="default"
              fullWidth
            >
              حفظ وتأمين عنوان السحب
            </Button>
          </form>
        )}
      </div>

      {/* 2. Amount Input & Calculation Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4 shadow-xs">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            طلب سحب جديد
          </h2>
          <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
            <span>الرصيد المتاح للسحب حالياً:</span>
            <MoneyAmount amount={balance.available} size="sm" color="positive" />
          </div>
        </div>

        {hasPendingWithdrawal ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
              <Clock size={18} aria-hidden="true" />
              <span>لديك طلب سحب قيد المعالجة</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              تنص السياسة المعتمدة على السماح بطلب سحب واحد فقط في نفس الوقت، مع اشتراط فاصل زمني لا يقل عن 24 ساعة بين كل طلب وآخر. يمكنك متابعة حالة طلبك الحالي أدناه.
            </p>
          </div>
        ) : !savedAddress ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs text-center space-y-1">
            <Lock size={20} className="mx-auto text-slate-400 mb-1" aria-hidden="true" />
            <p className="font-semibold text-slate-800">
              يرجى حفظ وتأمين عنوان محفظتك أولاً لتتمكن من تقديم طلب السحب.
            </p>
          </div>
        ) : (
          <form onSubmit={handleOpenConfirm} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="withdraw-amount-input" className="font-semibold text-slate-700">
                  المبلغ المطلوب سحبه (USDT)
                </label>
                <span className="text-slate-400">
                  الحدود: {FINANCIAL_RULES.withdrawalMinAmount} - {FINANCIAL_RULES.withdrawalMaxAmount} USDT
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
                  className="w-full min-h-[48px] px-3.5 py-2.5 text-base sm:text-lg font-bold rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 pl-16 text-slate-900"
                  required
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
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
                    className="flex-1 min-h-[44px] py-1 text-xs font-semibold rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Arithmetic Fee Breakdown Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>المبلغ المطلوب خصمه من الرصيد:</span>
                <MoneyAmount amount={parsedAmount} size="sm" />
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>رسوم المعالجة الإدارية (21%):</span>
                <span className="font-semibold text-rose-700">
                  -<MoneyAmount amount={calculatedFee} size="sm" color="negative" />
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
                <span>المبلغ الصافي المتوقع استلامه:</span>
                <MoneyAmount amount={calculatedNet} size="md" color="positive" />
              </div>
            </div>

            {/* Validation notice */}
            {parsedAmount > 0 && !isAmountValid && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium" role="alert">
                <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
                {parsedAmount < FINANCIAL_RULES.withdrawalMinAmount
                  ? `الحد الأدنى للسحب هو ${String(FINANCIAL_RULES.withdrawalMinAmount)} USDT.`
                  : parsedAmount > FINANCIAL_RULES.withdrawalMaxAmount
                  ? `الحد الأقصى للسحب هو ${String(FINANCIAL_RULES.withdrawalMaxAmount)} USDT.`
                  : "المبلغ يتجاوز رصيدك المتاح حالياً."}
              </p>
            )}

            {requestFeedback && (
              <p
                className={`text-xs font-medium p-2.5 rounded border ${
                  requestFeedback.success
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
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
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-slate-600">
              <span>المبلغ المطلوب:</span>
              <MoneyAmount amount={parsedAmount} size="sm" />
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>نسبة الرسوم المقتطعة (21%):</span>
              <span className="text-rose-700 font-semibold">
                -<MoneyAmount amount={calculatedFee} size="sm" color="negative" />
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900">
              <span>الصافي المحول لمحفظتك:</span>
              <MoneyAmount amount={calculatedNet} size="md" color="positive" />
            </div>
            <div className="pt-2 border-t border-slate-200 space-y-1">
              <span className="text-xs text-slate-500 block">عنوان المحفظة المستلمة:</span>
              <bdi dir="ltr" className="font-mono text-xs text-slate-800 break-all select-all font-semibold block">
                {savedAddress}
              </bdi>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 space-y-1">
            <p className="font-semibold text-blue-900 flex items-center gap-1.5">
              <HelpCircle size={14} className="shrink-0" aria-hidden="true" />
              سياسة الحجز والجدولة:
            </p>
            <p className="leading-relaxed text-blue-800">
              سيتم حجز مبلغ {parsedAmount.toFixed(2)} USDT فوراً من رصيدك المتاح. فترة المعالجة والانتظار التلقائية هي 72 ساعة، وللإدارة الحق في إيقاف الطلب أو رفضه واسترجاع الرصيد المحجوز للمتاح في حال ثبوت مخالفة.
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
