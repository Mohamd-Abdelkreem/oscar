"use client";
import { ArrowUpRight, Wallet } from "lucide-react";
import { useState } from "react";
import { getApiError } from "@/services/api/safe-error";
import type { PurchaseQuote } from "@template/contracts";
import { usePurchaseCommand } from "../../hooks/purchase-command.hooks";
import { Button, ButtonLink } from "../common/button";
import { ConfirmationSheet } from "../common/confirmation-sheet";
import { MoneyAmount } from "../common/money-amount";

export function PackageUpgradeModal({
  quote,
  isOpen,
  loading,
  quoteError,
  onClose,
}: {
  quote: PurchaseQuote | null;
  isOpen: boolean;
  loading: boolean;
  quoteError: Error | null;
  onClose: () => void;
}) {
  const command = usePurchaseCommand();
  const [feedback, setFeedback] = useState<{
    scope: string;
    text: string;
    committed?: boolean;
  } | null>(null);
  const identity = quote?.quoteId ?? "";
  const pending =
    command.state.state === "pending" ||
    command.isPending ||
    command.observation.isPending;
  const send = async () => {
    if (
      !quote ||
      !command.allowed ||
      pending ||
      !quote.canPurchase ||
      (feedback?.scope === identity && feedback.committed)
    )
      return;
    try {
      await command.mutateAsync(quote.quoteId);
      setFeedback({
        scope: identity,
        committed: true,
        text: "تم تفعيل المنصب وتسجيل الشراء. أُعيد تحميل الأرصدة الحالية.",
      });
    } catch (failure: unknown) {
      const error = getApiError(failure);
      setFeedback({
        scope: identity,
        text:
          error.code === "OFFLINE"
            ? "لا يوجد اتصال. لم يُرسل طلب شراء جديد."
            : error.category === "coordination" && command.retained === null
              ? "تعذر تنسيق الشراء بأمان. تحقق من العملية الأصلية قبل إعادة المحاولة."
              : "لم تتأكد نتيجة العملية. تحقق من العملية الأصلية قبل شراء جديد.",
      });
    }
  };
  return (
    <ConfirmationSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        quote
          ? `تأكيد تفعيل المنصب ${quote.packageCode}`
          : "مراجعة تفعيل المنصب"
      }
      description="يُخصم سعر المنصب كاملاً. العرض ليس حجزاً للأموال."
    >
      <div className="space-y-4">
        {loading && <p role="status">جارٍ تحميل عرض الشراء…</p>}
        {quoteError && (
          <p role="alert">
            تعذر تحميل عرض الشراء. أغلق المراجعة وأعد المحاولة.
          </p>
        )}
        {quote && (
          <>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>سعر المنصب المستهدف:</span>
                <MoneyAmount amount={quote.terms.price} size="sm" />
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>إجمالي المبلغ المخصوم:</span>
                <MoneyAmount amount={quote.fullDebit} size="md" />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Wallet size={16} aria-hidden="true" />
                  الرصيد القابل للشراء:
                </span>
                <MoneyAmount amount={quote.usableFunds} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span>تمويل الإحالات:</span>
                <MoneyAmount
                  amount={quote.fundedAllocation.referral}
                  size="sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span>تمويل غير الإحالات:</span>
                <MoneyAmount
                  amount={quote.fundedAllocation.nonReferral}
                  size="sm"
                />
              </div>
              {quote.requiredTopUp !== "0" && (
                <div className="flex items-center justify-between border-t border-amber-200 pt-2 text-amber-900">
                  <span>المبلغ الإضافي المطلوب:</span>
                  <MoneyAmount amount={quote.requiredTopUp} size="sm" />
                </div>
              )}
            </div>
            <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              <p>التفعيل فوري بعد الشراء. لا يمكن إلغاء الشراء المكتمل.</p>
              <p>
                مكافأة المهمة المعتمدة:{" "}
                <MoneyAmount amount={quote.terms.dailyReward} size="sm" /> ·
                رسوم السحب:{" "}
                <bdi dir="ltr">{quote.terms.withdrawalFeeBps / 100}%</bdi>
              </p>
              <p>
                التقويم: <bdi dir="ltr">{quote.terms.calendar.zone}</bdi> · أيام
                الأسبوع:{" "}
                <bdi dir="ltr">{quote.terms.calendar.workdays.join(", ")}</bdi>{" "}
                · حد أول يوم:{" "}
                <bdi dir="ltr">{quote.terms.calendar.firstDateCutoff}</bdi>
              </p>
              <p>
                أيام العمل المحتسبة: {quote.terms.countedWorkDates} · أول يوم:{" "}
                <bdi>{quote.preview.firstWorkDate}</bdi> · آخر يوم:{" "}
                <bdi>{quote.preview.finalWorkDate}</bdi>
              </p>
              <p>
                انتهاء الصلاحية: <bdi dir="ltr">{quote.preview.expiresAt}</bdi>
              </p>
              <p>
                الإجمالي المشروط بإكمال المهام المعتمدة قبل تكلفة الباقة ورسوم
                السحب:{" "}
                <MoneyAmount amount={quote.terms.conditionalGross} size="sm" />
              </p>
            </div>
            {!quote.canPurchase && (
              <p role="alert">
                {quote.blockReason === "INSUFFICIENT_FUNDS"
                  ? "الرصيد غير كافٍ. لا تُخصم الأموال قبل تأكيد شراء صالح."
                  : "هذا الانتقال غير مسموح أو تغيّرت صلاحية العرض. أعد تحميل البيانات."}
              </p>
            )}
            {feedback?.scope === identity && (
              <p
                role="status"
                className="rounded-md border border-slate-200 p-3 text-xs"
              >
                {feedback.text}
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              {quote.canPurchase ? (
                <Button
                  variant="primary"
                  fullWidth
                  loading={command.isPending}
                  disabled={
                    !command.allowed ||
                    pending ||
                    (feedback?.scope === identity &&
                      feedback.committed === true)
                  }
                  icon={ArrowUpRight}
                  onClick={() => {
                    void send();
                  }}
                >
                  {command.retained && command.state.state !== "pending"
                    ? "إعادة إرسال الشراء الأصلي نفسه"
                    : "تأكيد الشراء وخصم السعر كاملاً"}
                </Button>
              ) : quote.blockReason === "INSUFFICIENT_FUNDS" ? (
                <ButtonLink
                  href="/employee/deposit"
                  variant="primary"
                  fullWidth
                  icon={Wallet}
                >
                  الانتقال للإيداع
                </ButtonLink>
              ) : null}
              {command.retained && (
                <Button
                  variant="outline"
                  fullWidth
                  disabled={!command.allowed || pending}
                  onClick={() => {
                    void command.observation.mutateAsync().catch(() => {
                      setFeedback({
                        scope: identity,
                        text: "تعذر التحقق. تظل العملية الأصلية غير محسومة.",
                      });
                    });
                  }}
                >
                  التحقق من نتيجة العملية
                </Button>
              )}
              <Button variant="outline" fullWidth onClick={onClose}>
                إغلاق
              </Button>
            </div>
          </>
        )}
      </div>
    </ConfirmationSheet>
  );
}
