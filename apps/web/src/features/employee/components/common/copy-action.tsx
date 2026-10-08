"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CopyActionProps {
  readonly value: string;
  readonly label?: string | undefined;
  readonly copiedLabel?: string | undefined;
  readonly className?: string | undefined;
  readonly variant?: "button" | "icon" | undefined;
  readonly onCopyError?: (() => void) | undefined;
}

export function CopyAction({
  value,
  label = "نسخ",
  copiedLabel = "تم النسخ بنجاح",
  className = "",
  variant = "button",
  onCopyError,
}: CopyActionProps) {
  const scheduleTimeout = useManagedTimeout();
  const [copyState, setCopyState] = useState({ value, copied: false });
  if (copyState.value !== value) setCopyState({ value, copied: false });
  const lifetime = useRef({ value, active: true, attempt: 0 });
  const copied = copyState.value === value && copyState.copied;
  useEffect(() => {
    const current = { value, active: true, attempt: 0 };
    lifetime.current = current;
    return () => {
      current.active = false;
    };
  }, [value]);

  const handleCopy = useCallback(async () => {
    const current = lifetime.current;
    const attempt = ++current.attempt;
    const isCurrent = () =>
      current.active && current.value === value && current.attempt === attempt;
    try {
      await navigator.clipboard.writeText(value);
      if (!isCurrent()) return;
      setCopyState({ value, copied: true });
      scheduleTimeout(() => {
        if (isCurrent()) setCopyState({ value, copied: false });
      }, 2000);
    } catch {
      if (isCurrent()) {
        setCopyState({ value, copied: false });
        onCopyError?.();
      }
    }
  }, [scheduleTimeout, value, onCopyError]);

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => {
          void handleCopy();
        }}
        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 ${className}`}
        title={copied ? copiedLabel : label}
        aria-label={copied ? copiedLabel : label}
      >
        {copied ? (
          <Check size={18} className="text-emerald-600" aria-hidden="true" />
        ) : (
          <Copy size={18} aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleCopy();
      }}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 ${
        copied ? "border-emerald-300 bg-emerald-50/50 text-emerald-700" : ""
      } ${className}`}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check
            size={16}
            className="shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <span>{copiedLabel}</span>
        </>
      ) : (
        <>
          <Copy
            size={16}
            className="shrink-0 text-slate-500"
            aria-hidden="true"
          />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
