"use client";

import { CalendarClock, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminInput } from "../common/admin-input";
import type { AdminWithdrawal } from "../../types/admin.types";
import {
  calculateRemainingWithdrawalTime,
  computeExtendedDueAt,
  formatBaghdadDateTime,
} from "../../utils/time.utils";

interface ExtendScheduleDialogProps {
  readonly isOpen: boolean;
  readonly withdrawal: AdminWithdrawal | null;
  readonly currentTimeMs: number;
  readonly onConfirm: (
    additionalHours: number,
    reason: string,
  ) => void | Promise<void>;
  readonly onClose: () => void;
}

export function ExtendScheduleDialog({
  isOpen,
  withdrawal,
  currentTimeMs,
  onConfirm,
  onClose,
}: ExtendScheduleDialogProps) {
  const [hoursInput, setHoursInput] = useState<string>("12");
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setHoursInput("12");
    setReason("");
    setError(null);
    setIsSubmitting(false);
    onClose();
  }, [isSubmitting, onClose]);

  // Scroll lock & focus trapping
  useEffect(() => {
    if (!isOpen) return undefined;

    triggerElementRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
      if (
        triggerElementRef.current &&
        typeof triggerElementRef.current.focus === "function"
      ) {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]);

  if (!isOpen || !withdrawal) return null;

  const parsedHours = Number.parseInt(hoursInput, 10);
  const isHoursValid = Number.isInteger(parsedHours) && parsedHours > 0;

  const baseHours = withdrawal.originalDurationHours ?? 72;
  const currentAdded = withdrawal.addedHours ?? 0;
  const currentRemaining = calculateRemainingWithdrawalTime(
    withdrawal.dueAt,
    currentTimeMs,
  );

  let newDeadlineIso = withdrawal.dueAt;
  let newCumulativeAdded = currentAdded;
  let newRemainingText = currentRemaining.text;

  if (isHoursValid) {
    const ext = computeExtendedDueAt(withdrawal.dueAt, parsedHours);
    if (ext.valid) {
      newDeadlineIso = ext.newDueAtIso;
      newCumulativeAdded = currentAdded + parsedHours;
      const newRemaining = calculateRemainingWithdrawalTime(
        newDeadlineIso,
        currentTimeMs,
      );
      newRemainingText = newRemaining.text;
    }
  }

  const handleConfirm = async () => {
    if (isSubmitting) return;

    if (!isHoursValid) {
      setError("يرجى إدخال عدد ساعات إضافية صحيح وأكبر من الصفر.");
      return;
    }

    if (!reason.trim()) {
      setError("يرجى كتابة سبب زيادة الجدولة الإلزامي.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onConfirm(parsedHours, reason.trim());
      handleClose();
    } catch {
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
        if (e.target === e.currentTarget && !isSubmitting) {
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
            disabled={isSubmitting}
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
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">الموظف:</span>
              <span className="font-bold text-slate-900">
                {withdrawal.employeeName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">
                المبلغ المطلوب:
              </span>
              <span className="font-mono font-bold text-slate-900" dir="ltr">
                {withdrawal.amount.toFixed(2)} USDT
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">
                الجدولة الأساسية:
              </span>
              <span className="font-bold text-slate-700">{baseHours} ساعة</span>
            </div>
            {currentAdded > 0 && (
              <div className="flex items-center justify-between font-bold text-amber-800">
                <span>ساعات مضافة سابقاً:</span>
                <span dir="ltr">+{currentAdded} ساعة</span>
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between border-t border-slate-200 pt-1.5">
              <span className="font-semibold text-slate-500">
                موعد الاستحقاق الحالي:
              </span>
              <span className="font-mono text-slate-800" dir="ltr">
                {formatBaghdadDateTime(withdrawal.dueAt)} (توقيت بغداد)
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
              type="number"
              min={1}
              step={1}
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
                  onClick={() => {
                    setHoursInput(String(preset));
                    if (error) setError(null);
                  }}
                  className={`rounded border px-2 py-0.5 text-xs font-bold transition-colors ${
                    parsedHours === preset
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
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="يرجى ذكر سبب تمديد فترة الجدولة لحفظه في سجل التدقيق..."
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none sm:text-sm"
            />
          </div>

          {/* Live Preview Card */}
          {isHoursValid && (
            <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs">
              <span className="block border-b border-amber-200 pb-1 font-bold text-amber-900">
                معاينة نتيجة التمديد بعد التأكيد:
              </span>
              <div className="flex justify-between text-slate-700">
                <span>إجمالي الجدولة الكلية:</span>
                <span className="font-mono font-bold">
                  {baseHours + newCumulativeAdded} ساعة (الأساس {baseHours} س +
                  تراكمي {newCumulativeAdded} س)
                </span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>الموعد الجديد للاستحقاق:</span>
                <span className="font-mono font-bold" dir="ltr">
                  {formatBaghdadDateTime(newDeadlineIso)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-amber-950">
                <span>الوقت المتبقي الجديد:</span>
                <span>{newRemainingText}</span>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-600">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end sm:p-5">
          <AdminButton
            variant="outline"
            size="default"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            إلغاء
          </AdminButton>
          <AdminButton
            variant="warning"
            size="default"
            loading={isSubmitting}
            disabled={isSubmitting || !isHoursValid}
            onClick={() => {
              void handleConfirm();
            }}
          >
            تأكيد زيادة الجدولة
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
