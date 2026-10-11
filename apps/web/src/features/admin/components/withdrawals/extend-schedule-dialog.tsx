"use client";

import { CalendarClock, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminInput } from "../common/admin-input";
import { withdrawalExtensionBodySchema } from "@template/contracts";
import type { AdminWithdrawalRequest } from "../../api/withdrawals.api";
import { withdrawalInstant } from "../../utils/withdrawal-presentation";
import { useManualCreditDialog } from "../../hooks/use-manual-credit-dialog";

interface ExtendScheduleDialogProps {
  readonly isOpen: boolean;
  readonly withdrawal: AdminWithdrawalRequest | null;
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
  readonly errorMessage?: string | null;
  readonly retryOriginal?: boolean;
  readonly reviewNewVersion?: boolean;
  readonly onConfirm: (
    additionalHours: string,
    reason: string,
    expectedVersion: number,
  ) => unknown;
  readonly onClose: () => void;
}

export function ExtendScheduleDialog({
  isOpen,
  withdrawal,
  disabled = false,
  isLoading = false,
  errorMessage,
  retryOriginal = false,
  reviewNewVersion = false,
  onConfirm,
  onClose,
}: ExtendScheduleDialogProps) {
  const [hoursInput, setHoursInput] = useState<string>("12");
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitting = useRef(false);
  const busy = isSubmitting || isLoading;

  const handleClose = useCallback(() => {
    if (busy || submitting.current) return;
    setHoursInput("12");
    setReason("");
    setError(null);
    setIsSubmitting(false);
    onClose();
  }, [busy, onClose]);
  const dialogRef = useManualCreditDialog({
    open: isOpen,
    active: isOpen,
    close: handleClose,
  });

  // The existing dialog hook owns focus containment and restoration.
  useEffect(() => {
    if (!isOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !withdrawal) return null;

  const parsed = withdrawalExtensionBodySchema.safeParse({
    expectedVersion: withdrawal.version,
    countedHours: hoursInput,
    reason,
    confirmed: true,
  });
  const isHoursValid =
    withdrawalExtensionBodySchema.shape.countedHours.safeParse(
      hoursInput,
    ).success;
  const baseHours = withdrawal.calendar.countedHours;
  const currentRemaining = { text: withdrawal.remainingCountedHours };

  const handleConfirm = async () => {
    if (busy || submitting.current || disabled) return;

    if (!isHoursValid) {
      setError("يرجى إدخال عدد ساعات إضافية صحيح وأكبر من الصفر.");
      return;
    }

    if (!parsed.success) {
      setError("يرجى كتابة سبب زيادة الجدولة الإلزامي.");
      return;
    }

    setError(null);
    submitting.current = true;
    setIsSubmitting(true);

    try {
      const committed = await onConfirm(
        hoursInput,
        reason.trim(),
        withdrawal.version,
      );
      if (committed === false) return;
      setHoursInput("12");
      setReason("");
      onClose();
    } catch {
      setError(
        errorMessage ??
          "تعذر تأكيد التمديد؛ احتُفظ بالمدخلات. راجع العملية الأصلية.",
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="extend-dialog-title"
      className="admin-scope fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          handleClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl focus:outline-none"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <CalendarClock size={18} aria-hidden="true" />
            </div>
            <h2
              id="extend-dialog-title"
              className="text-base font-bold text-slate-900 sm:text-lg"
            >
              زيادة جدولة معالجة طلب السحب
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-label="إغلاق"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs sm:p-5 sm:text-sm">
          {/* Affected Record Summary */}
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <p dir="ltr" className="break-all">
              {withdrawal.id} — v{withdrawal.version}
            </p>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">الموظف:</span>
              <span className="font-bold text-slate-900">
                {withdrawal.employee.fullName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">
                المبلغ المطلوب:
              </span>
              <span className="font-mono font-bold text-slate-900" dir="ltr">
                {withdrawal.gross} USDT
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">
                الجدولة الأساسية:
              </span>
              <span className="font-bold text-slate-700">{baseHours} ساعة</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-slate-200 pt-1.5">
              <span className="font-semibold text-slate-500">
                موعد الاستحقاق الحالي:
              </span>
              <span className="font-mono text-slate-800" dir="ltr">
                {withdrawalInstant(withdrawal.dueAt)} (توقيت بغداد)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">
                الوقت المتبقي الحالي:
              </span>
              <span className="font-bold text-slate-800">
                {currentRemaining.text}
              </span>
            </div>
          </div>

          {/* Additional Hours Input */}
          <div className="space-y-2">
            <label
              htmlFor="additional-hours"
              className="block text-xs font-bold text-slate-700 sm:text-sm"
            >
              الساعات الإضافية المراد زيادتها{" "}
              <span className="text-rose-600">*</span>
            </label>
            <AdminInput
              id="additional-hours"
              type="text"
              inputMode="decimal"
              disabled={busy}
              value={hoursInput}
              onChange={(e) => {
                setHoursInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="مثال: 12"
            />
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="ml-1 text-[11px] font-semibold text-slate-500">
                خيارات سريعة:
              </span>
              {[6, 12, 24, 48].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setHoursInput(String(preset));
                    if (error) setError(null);
                  }}
                  className={`rounded border px-2 py-0.5 text-xs font-bold transition-colors ${
                    hoursInput === String(preset)
                      ? "border-amber-500 bg-amber-100 text-amber-900"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  +{preset} س
                </button>
              ))}
            </div>
          </div>

          {/* Required Reason Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="extend-reason"
              className="block text-xs font-bold text-slate-700 sm:text-sm"
            >
              سبب زيادة الجدولة (إلزامي للرقابة){" "}
              <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="extend-reason"
              rows={2}
              disabled={busy}
              maxLength={500}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="يرجى ذكر سبب تمديد فترة الجدولة لحفظه في سجل التدقيق..."
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none sm:text-sm"
            />
          </div>

          {/* Reviewed duration; the server owns the resulting counted deadline. */}
          {isHoursValid && (
            <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs">
              <span className="block border-b border-amber-200 pb-1 font-bold text-amber-900">
                مراجعة الساعات الإضافية:
              </span>
              <div className="flex justify-between text-slate-700">
                <span>المدة المضافة:</span>
                <span className="font-mono font-bold">{hoursInput} ساعة</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>الموعد الأصلي:</span>
                <span className="font-mono font-bold" dir="ltr">
                  {withdrawalInstant(withdrawal.originalDueAt)}
                </span>
              </div>
              <p>
                الموعد الجديد المحتسب يعود من الخادم بعد التأكيد؛ السبت والأحد
                مستثنيان.
              </p>
            </div>
          )}

          {(error || errorMessage) && (
            <p className="rounded border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-600">
              {error || errorMessage}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end sm:p-5">
          <AdminButton
            variant="outline"
            size="default"
            onClick={handleClose}
            disabled={busy}
          >
            إلغاء
          </AdminButton>
          <AdminButton
            variant="warning"
            size="default"
            loading={busy}
            disabled={busy || disabled || !parsed.success}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {reviewNewVersion
              ? "مراجعة الإصدار الجديد"
              : retryOriginal
                ? "إعادة محاولة الإجراء الأصلي فقط"
                : "تأكيد زيادة الجدولة"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
