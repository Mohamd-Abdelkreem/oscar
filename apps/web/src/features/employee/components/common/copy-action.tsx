"use client";

import { useManagedTimeout } from "@/features/employee/hooks/use-managed-timeout";

import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

interface CopyActionProps {
  readonly value: string;
  readonly label?: string | undefined;
  readonly copiedLabel?: string | undefined;
  readonly className?: string | undefined;
  readonly variant?: "button" | "icon" | undefined;
}

export function CopyAction({
  value,
  label = "نسخ",
  copiedLabel = "تم النسخ بنجاح",
  className = "",
  variant = "button",
}: CopyActionProps) {
  const scheduleTimeout = useManagedTimeout();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      scheduleTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Ignore clipboard error
    }
  }, [scheduleTimeout, value]);

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
