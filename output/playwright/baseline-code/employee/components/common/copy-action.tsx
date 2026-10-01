"use client";

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
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Ignore clipboard error
    }
  }, [value]);

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => {
          void handleCopy();
        }}
        className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${className}`}
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
      className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 text-sm font-semibold rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
        copied ? "border-emerald-300 text-emerald-700 bg-emerald-50/50" : ""
      } ${className}`}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{copiedLabel}</span>
        </>
      ) : (
        <>
          <Copy size={16} className="text-slate-500 shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
