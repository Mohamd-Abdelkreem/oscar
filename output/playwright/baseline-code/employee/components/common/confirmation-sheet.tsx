"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface ConfirmationSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string | undefined;
  readonly children: ReactNode;
}

export function ConfirmationSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
}: ConfirmationSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Store active element for focus return
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus the sheet container
    sheetRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";

      // Restore focus
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      aria-describedby={description ? "sheet-description" : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="w-full max-w-lg bg-white rounded-t-xl sm:rounded-lg border border-slate-200 shadow-xl overflow-hidden max-h-[88vh] flex flex-col focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 id="sheet-title" className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {title}
            </h2>
            {description && (
              <p id="sheet-description" className="text-xs text-slate-500 mt-0.5 truncate">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 shrink-0"
            aria-label="إغلاق النافذة"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content with internal scroll */}
        <div className="p-4 sm:p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
