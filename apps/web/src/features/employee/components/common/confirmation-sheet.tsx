"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useId,
  type ReactNode,
} from "react";

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
  const titleId = useId();
  const descriptionId = useId();
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const closeSheet = useEffectEvent(onClose);

  useEffect(() => {
    if (!isOpen) return;

    // Store active element for focus return
    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const background: { element: HTMLElement; inert: boolean }[] = [];
    let ancestor: HTMLElement | null = sheetRef.current?.parentElement ?? null;
    while (ancestor !== null && ancestor !== document.body) {
      for (const sibling of ancestor.parentElement?.children ?? []) {
        if (sibling instanceof HTMLElement && sibling !== ancestor) {
          background.push({
            element: sibling,
            inert: sibling.hasAttribute("inert"),
          });
          sibling.inert = true;
        }
      }
      ancestor = ancestor.parentElement;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSheet();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) ?? []),
      ];
      const first = controls[0];
      const last = controls.at(-1);
      if (first === undefined || last === undefined) {
        event.preventDefault();
        sheetRef.current?.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === sheetRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === sheetRef.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus the sheet container
    sheetRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const item of background) item.element.inert = item.inert;

      // Restore focus
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 transition-opacity sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-xl focus:outline-none sm:rounded-lg"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3.5 sm:px-5">
          <div className="min-w-0 pr-2">
            <h2
              id={titleId}
              className="truncate text-base font-bold text-slate-900 sm:text-lg"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-0.5 truncate text-xs text-slate-500"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-label="إغلاق النافذة"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content with internal scroll */}
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
