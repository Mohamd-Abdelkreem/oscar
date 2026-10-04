"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import {
  useCallback,
  useId,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AdminButton } from "./admin-button";
import { useDialogBackground } from "@/shared/hooks/use-dialog-background";

export interface AdminConfirmRecordInfo {
  readonly label: string;
  readonly value: string;
  readonly secondary?: string | undefined;
}

export interface AdminConfirmAffectedRecord {
  readonly id?: string | undefined;
  readonly label: string;
  readonly subtitle?: string | undefined;
}

export interface AdminConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description: ReactNode;
  readonly recordInfo?: AdminConfirmRecordInfo | undefined;
  readonly affectedRecord?: AdminConfirmAffectedRecord | undefined;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: "destructive" | "primary" | "warning";
  readonly requireReason?: boolean;
  readonly reasonLabel?: string;
  readonly reasonPlaceholder?: string;
  readonly isLoading?: boolean;
  readonly confirmDisabled?: boolean;
  readonly error?: string | null;
  readonly onConfirm: (reason?: string) => unknown;
  readonly onClose: () => void;
}

export function AdminConfirmDialog({
  isOpen,
  title,
  description,
  recordInfo,
  affectedRecord,
  confirmLabel = "تأكيد الإجراء",
  cancelLabel = "إلغاء",
  variant = "destructive",
  requireReason = false,
  reasonLabel = "سبب الإجراء الإلزامي",
  reasonPlaceholder = "يرجى توضيح سبب الإجراء لحفظه في سجل التدقيق والرقابة...",
  isLoading = false,
  confirmDisabled = false,
  error,
  onConfirm,
  onClose,
}: AdminConfirmDialogProps) {
  const titleId = useId();
  const reasonId = useId();
  const submitting = useRef(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isLoading || isSubmitting;

  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  useDialogBackground(dialogRef, isOpen);

  useEffect(() => {
    if (isOpen && isBusy) dialogRef.current?.focus();
  }, [isOpen, isBusy]);

  const handleClose = useCallback(() => {
    if (isSubmitting || isLoading) return;
    setReason("");
    setReasonError(false);
    setIsSubmitting(false);
    onClose();
  }, [isSubmitting, isLoading, onClose]);

  // Safe scroll lock & focus return
  useEffect(() => {
    if (!isOpen) return undefined;

    // Capture currently focused element to return focus on close
    triggerElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => {
      if (requireReason && textareaRef.current) {
        textareaRef.current.focus();
      } else {
        dialogRef.current?.focus();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      // Focus return
      if (
        triggerElementRef.current &&
        typeof triggerElementRef.current.focus === "function"
      ) {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen, requireReason]);

  // Keyboard navigation & focus trap
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements =
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          );
        if (focusableElements.length === 0) {
          e.preventDefault();
          dialogRef.current.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === firstElement ||
            document.activeElement === dialogRef.current
          ) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (
            document.activeElement === lastElement ||
            document.activeElement === dialogRef.current
          ) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (submitting.current || isSubmitting || isLoading || confirmDisabled)
      return;

    if (
      requireReason &&
      (!reason.trim() || reason.trim().length > 500 || reason.includes("\0"))
    ) {
      setReasonError(true);
      textareaRef.current?.focus();
      return;
    }

    const confirmedReason = reason.trim() || undefined;
    submitting.current = true;
    setIsSubmitting(true);

    try {
      const committed = await onConfirm(confirmedReason);
      if (committed === false) return;
      setReason("");
      setReasonError(false);
      setIsSubmitting(false);
      onClose();
    } catch {
      setIsSubmitting(false);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="admin-scope fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
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
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                variant === "destructive"
                  ? "bg-rose-100 text-rose-700"
                  : variant === "warning"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {variant === "destructive" || variant === "warning" ? (
                <AlertTriangle size={18} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={18} aria-hidden="true" />
              )}
            </div>
            <h2
              id={titleId}
              className="text-base font-bold text-slate-900 sm:text-lg"
            >
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50"
            aria-label="إغلاق النافذة"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {/* Affected Record Preview Badge/Card */}
          {(recordInfo || affectedRecord) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">
                  {recordInfo
                    ? `${recordInfo.label}:`
                    : affectedRecord?.id
                      ? `المعرف: ${affectedRecord.id}`
                      : "السجل المستهدف:"}
                </span>
                <span className="font-bold text-slate-900">
                  {recordInfo?.value ?? affectedRecord?.label}
                </span>
              </div>
              {(recordInfo?.secondary || affectedRecord?.subtitle) && (
                <div className="mt-1 text-[11px] text-slate-500">
                  {recordInfo?.secondary ?? affectedRecord?.subtitle}
                </div>
              )}
            </div>
          )}

          <div className="text-xs leading-relaxed text-slate-600 sm:text-sm">
            {description}
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-600">
              {error}
            </p>
          )}

          {requireReason && (
            <div className="space-y-1.5 pt-1">
              <label
                htmlFor={reasonId}
                className="block text-xs font-bold text-slate-700 sm:text-sm"
              >
                {reasonLabel} <span className="text-rose-600">*</span>
              </label>
              <textarea
                id={reasonId}
                ref={textareaRef}
                rows={3}
                maxLength={500}
                disabled={isBusy}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (e.target.value.trim()) setReasonError(false);
                }}
                placeholder={reasonPlaceholder}
                className={`w-full rounded-md border p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:outline-none sm:text-sm ${
                  reasonError
                    ? "border-rose-400 focus:border-rose-600 focus:ring-rose-600"
                    : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-600"
                }`}
              />
              {reasonError && (
                <p className="text-xs font-medium text-rose-600">
                  يرجى كتابة سبب الإجراء للاعتماد في سجل التدقيق والرقابة.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end sm:p-5">
          <AdminButton
            variant="outline"
            size="default"
            disabled={isBusy}
            onClick={handleClose}
          >
            {cancelLabel}
          </AdminButton>
          <AdminButton
            variant={
              variant === "destructive"
                ? "destructive"
                : variant === "warning"
                  ? "warning"
                  : "primary"
            }
            size="default"
            loading={isBusy}
            disabled={isBusy || confirmDisabled}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {confirmLabel}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
