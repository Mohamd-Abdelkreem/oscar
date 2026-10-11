"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { WithdrawalQuote } from "@template/contracts";
import {
  assertFinancialScope,
  recheckFinancialDenial,
} from "@/shared/query/financial-query";
import { getApiError, safeApiError } from "@/services/api/safe-error";
import { useSessionScope } from "@/features/auth/hooks/auth.hooks";
import {
  getSessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lock,
} from "lucide-react";
import { withdrawalsApi } from "../../api/withdrawals.api";
import { useEmployeeWithdrawalStatus } from "../../hooks/withdrawals.hooks";
import { useWithdrawalCommand } from "../../hooks/withdrawal-command.hooks";
import { useWallet } from "../../hooks/wallet.hooks";
import {
  normalizeWithdrawalAmount,
  withdrawalRate,
  withdrawalInstant,
} from "../../utils/withdrawal-presentation";
import { Button } from "../common/button";
import { ConfirmationSheet } from "../common/confirmation-sheet";
import { MoneyAmount } from "../common/money-amount";
import { WithdrawalAddressCard } from "./withdrawal-address-card";

export function WithdrawalForm() {
  const scope = useSessionScope();
  return (
    <WithdrawalFormContent
      key={`${scope.accountId ?? "anonymous"}:${String(scope.epoch)}`}
    />
  );
}
function WithdrawalFormContent() {
  const status = useEmployeeWithdrawalStatus();
  const command = useWithdrawalCommand();
  const wallet = useWallet();

  const [amountInput, setAmountInput] = useState<string>("100");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const reviewing = useRef(false);
  const reviewTrigger = useRef<HTMLButtonElement | null>(null);
  const [review, setReview] = useState<{
    quote: WithdrawalQuote;
    scope: SessionScope;
  } | null>(null);
  const [requestFeedback, setRequestFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const facts = status.displayData;
  const savedAddress =
    facts?.destination.state === "CONFIRMED" ? facts.destination.address : null;
  const hasPendingWithdrawal =
    facts?.activeWithdrawal !== null && facts?.activeWithdrawal !== undefined;
  const parsedAmount = normalizeWithdrawalAmount(amountInput);
  const unresolved =
    command.retained !== null || command.state.state !== "idle";
  const canReview =
    status.allowed &&
    status.data !== undefined &&
    !status.isDisplayStale &&
    facts?.withdrawalExecutionReady === true &&
    !facts.withdrawalsBlocked &&
    !hasPendingWithdrawal &&
    savedAddress !== null &&
    command.allowed &&
    !unresolved;
  const isAmountValid = parsedAmount !== null && canReview;
  const currentReview =
    review !== null &&
    getSessionRuntime().isCurrentCheck(review.scope) &&
    review.quote.gross === parsedAmount
      ? review.quote
      : null;
  const quoteCommand = useMutation({
    retry: false,
    networkMode: "always",
    gcTime: 0,
    mutationFn: (gross: string) => withdrawalsApi.quote(gross),
    onError: (failure) => {
      recheckFinancialDenial(status.scope, failure);
    },
  });
  const isSubmitting = command.isPending || command.state.state === "pending";
  const handleOpenConfirm = async (
    event: React.SyntheticEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!isAmountValid || reviewing.current || quoteCommand.isPending) return;
    // The async quote disables this control before the sheet can capture focus.
    reviewTrigger.current =
      event.currentTarget.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
    reviewing.current = true;
    const scope = status.scope;
    try {
      assertFinancialScope(scope, "USER");
      if (!navigator.onLine) throw safeApiError("request", "OFFLINE");
      const quote = await quoteCommand.mutateAsync(parsedAmount);
      assertFinancialScope(scope, "USER");
      setReview({ quote, scope });
      setIsConfirmOpen(true);
      setRequestFeedback(null);
    } catch (failure: unknown) {
      if (getSessionRuntime().isCurrentCheck(scope))
        setRequestFeedback({
          success: false,
          message: getApiError(failure).message,
        });
    } finally {
      reviewing.current = false;
    }
  };
  const handleConfirmSubmit = async () => {
    if (
      !isAmountValid ||
      currentReview === null ||
      !currentReview.canAccept ||
      parsedAmount !== currentReview.gross ||
      isSubmitting
    )
      return;
    const scope = status.scope;
    try {
      await command.mutateAsync(currentReview.quoteId);
      assertFinancialScope(scope, "USER");
      setRequestFeedback({
        success: true,
        message: "تم حجز المبلغ وجدولة السحب تلقائياً.",
      });
      setIsConfirmOpen(false);
      setReview(null);
    } catch (failure: unknown) {
      if (!getSessionRuntime().isCurrentCheck(scope)) return;
      const error = getApiError(failure);
      setRequestFeedback({
        success: false,
        message:
          error.code === "WITHDRAWAL_QUOTE_STALE" &&
          command.state.state !== "uncertain"
            ? "تغيرت شروط الطلب. راجع عرضاً جديداً قبل التأكيد."
            : error.message,
      });
      setIsConfirmOpen(false);
      setReview(null);
    }
  };

  return (
    <div className="space-y-4">
      <WithdrawalAddressCard />

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">
            طلب سحب جديد
          </h2>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>الرصيد المتاح للسحب حالياً:</span>
            {wallet.data ? (
              <MoneyAmount
                amount={wallet.data.withdrawalFunds.total}
                size="sm"
                color="positive"
              />
            ) : (
              <span>
                {wallet.error ? wallet.error.message : "جارٍ التحميل"}
              </span>
            )}
          </div>
        </div>

        {hasPendingWithdrawal ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <Clock size={18} aria-hidden="true" />
              <span>لديك طلب سحب قيد المعالجة</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-800">
              يسمح بطلب سحب نشط واحد فقط. يبقى المبلغ محجوزاً حتى تأكيد الدفع أو
              التحرير الآمن. لا توجد مهلة 24 ساعة بين الطلبات.
              <bdi dir="ltr">{facts.activeWithdrawal?.gross} USDT</bdi>
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
          <form
            onSubmit={(event) => {
              void handleOpenConfirm(event);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="withdraw-amount-input"
                  className="font-semibold text-slate-700"
                >
                  المبلغ المطلوب سحبه (USDT)
                </label>
                <span className="text-slate-400">
                  الحدود:{" "}
                  {currentReview
                    ? `${currentReview.minimumGross} - ${currentReview.maximumGross} USDT`
                    : "حسب العرض الحالي"}
                </span>
              </div>

              <div className="relative">
                <input
                  id="withdraw-amount-input"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setReview(null);
                  }}
                  className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 pl-16 text-base font-bold text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 sm:text-lg"
                  required
                />
                <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-xs font-bold text-slate-400">
                  USDT
                </span>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setAmountInput(amt.toString());
                      setReview(null);
                    }}
                    className="min-h-[44px] flex-1 rounded-md border border-slate-200 bg-slate-50 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>المبلغ المطلوب خصمه من الرصيد:</span>
                {parsedAmount !== null ? (
                  <MoneyAmount amount={parsedAmount} size="sm" />
                ) : (
                  <span>—</span>
                )}
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>
                  رسوم المعالجة الإدارية (
                  {currentReview
                    ? withdrawalRate(currentReview.feeBps)
                    : "حسب العرض"}
                  ):
                </span>
                <span className="font-semibold text-rose-700">
                  -
                  {currentReview ? (
                    <MoneyAmount
                      amount={currentReview.fee}
                      size="sm"
                      color="negative"
                    />
                  ) : (
                    "—"
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>المبلغ الصافي المتوقع استلامه:</span>
                {currentReview ? (
                  <MoneyAmount
                    amount={currentReview.net}
                    size="md"
                    color="positive"
                  />
                ) : (
                  <span>بعد مراجعة العرض</span>
                )}
              </div>
            </div>

            {parsedAmount === null && (
              <p
                className="flex items-center gap-1.5 text-xs font-medium text-rose-600"
                role="alert"
              >
                <AlertCircle
                  size={14}
                  className="shrink-0"
                  aria-hidden="true"
                />
                أدخل مبلغاً موجباً بدقة لا تتجاوز ست منازل عشرية.
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="default"
              fullWidth
              disabled={!isAmountValid || quoteCommand.isPending}
              loading={quoteCommand.isPending}
              icon={ArrowUpRight}
            >
              متابعة تأكيد طلب السحب
            </Button>
          </form>
        )}
      </div>

      {status.allowed && requestFeedback && (
        <p
          role={requestFeedback.success ? "status" : "alert"}
          className={`rounded border p-2.5 text-xs font-medium ${requestFeedback.success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
        >
          {requestFeedback.message}
        </p>
      )}
      {status.isPending &&
        !status.displayData &&
        !status.observationExhausted && (
          <p role="status" className="text-xs text-slate-600">
            جارٍ تحميل شروط السحب.
          </p>
        )}
      {status.error && (
        <p role="alert" className="text-xs text-rose-600">
          {status.error.message}
        </p>
      )}
      {(status.isDisplayStale || status.observationExhausted) && (
        <p role="status">
          آخر بيانات معروفة؛ حدّث حالة السحب قبل مراجعة طلب جديد.
        </p>
      )}
      {facts && !facts.withdrawalExecutionReady && (
        <p role="status" className="text-xs text-slate-600">
          استقبال طلبات السحب غير متاح حالياً.
        </p>
      )}
      {facts?.withdrawalsBlocked && (
        <p role="alert" className="text-xs text-rose-600">
          السحب مقيد لهذا الحساب.
        </p>
      )}
      {unresolved && (
        <p role="status" className="text-xs text-amber-800">
          نتيجة الطلب غير مؤكدة. نتحقق من الطلب الأصلي؛ لا تكرر السحب.
        </p>
      )}
      {command.coordinationError && (
        <p role="alert" className="text-xs text-rose-600">
          {command.coordinationError.message}
        </p>
      )}
      <Button
        variant="outline"
        size="default"
        onClick={() => {
          void status.refetch();
          if (command.retained !== null) void command.observation.refetch();
        }}
      >
        تحديث
      </Button>

      <ConfirmationSheet
        returnFocusRef={reviewTrigger}
        isOpen={isConfirmOpen && currentReview !== null && status.allowed}
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
              <MoneyAmount amount={currentReview?.gross ?? "0"} size="sm" />
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>
                نسبة الرسوم المقتطعة (
                {currentReview ? withdrawalRate(currentReview.feeBps) : ""}):
              </span>
              <span className="font-semibold text-rose-700">
                -
                <MoneyAmount
                  amount={currentReview?.fee ?? "0"}
                  size="sm"
                  color="negative"
                />
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
              <span>الصافي المحول لمحفظتك:</span>
              <MoneyAmount
                amount={currentReview?.net ?? "0"}
                size="md"
                color="positive"
              />
            </div>
            <div className="space-y-1 border-t border-slate-200 pt-2">
              <span className="block text-xs text-slate-500">
                عنوان المحفظة المستلمة:
              </span>
              <bdi
                dir="ltr"
                className="block font-mono text-xs font-semibold break-all text-slate-800 select-all"
              >
                {currentReview?.recipient}
              </bdi>
              <bdi dir="ltr">{currentReview?.network}</bdi>
              <p>
                الأموال المؤهلة غير الإحالية:{" "}
                <bdi dir="ltr">{currentReview?.eligibleNonReferral}</bdi> —
                الإحالية: <bdi dir="ltr">{currentReview?.eligibleReferral}</bdi>
              </p>
              <p>
                المبلغ الإضافي المطلوب:{" "}
                <bdi dir="ltr">{currentReview?.requiredTopUp}</bdi> USDT
              </p>
              <p>
                مصادر الحجز غير الإحالية:{" "}
                <bdi dir="ltr">
                  {currentReview?.fundedAllocation.nonReferral}
                </bdi>{" "}
                — الإحالية:{" "}
                <bdi dir="ltr">{currentReview?.fundedAllocation.referral}</bdi>
              </p>
              <p>
                الموعد المتوقع بتوقيت بغداد:{" "}
                {currentReview
                  ? withdrawalInstant(currentReview.preview.dueAt)
                  : ""}
              </p>
              <p>
                أقرب إرسال بتوقيت بغداد:{" "}
                {currentReview
                  ? withdrawalInstant(currentReview.preview.dispatchAt)
                  : ""}
              </p>
              {currentReview?.canAccept === false && (
                <p role="alert" className="text-rose-600">
                  {currentReview.blockReason === "INSUFFICIENT_FUNDS"
                    ? "الرصيد المؤهل لا يكفي لهذا الطلب."
                    : currentReview.blockReason === "WITHDRAWAL_ACTIVE"
                      ? "لديك طلب سحب نشط بالفعل."
                      : "السحب مقيد لهذا الحساب."}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <p className="flex items-center gap-1.5 font-semibold text-blue-900">
              <HelpCircle size={14} className="shrink-0" aria-hidden="true" />
              سياسة الحجز والجدولة:
            </p>
            <p className="leading-relaxed text-blue-800">
              سيتم حجز إجمالي <bdi dir="ltr">{currentReview?.gross} USDT</bdi>{" "}
              عند قبول الطلب. السحب تلقائي بعد 72 ساعة محتسبة بتوقيت بغداد،
              باستثناء السبت والأحد. تكاليف الشبكة على الشركة. لا يعني بلوغ
              الموعد اكتمال الدفع.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              size="default"
              fullWidth
              loading={isSubmitting}
              disabled={
                isSubmitting ||
                !isAmountValid ||
                currentReview?.canAccept !== true ||
                parsedAmount !== currentReview.gross
              }
              icon={CheckCircle2}
              onClick={() => {
                void handleConfirmSubmit();
              }}
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
