"use client";

import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";

export interface AdminInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  readonly icon?:
    | ComponentType<{
        size?: number;
        className?: string;
        "aria-hidden"?: boolean | "true" | "false";
      }>
    | undefined;
  readonly trailingAction?: ReactNode | undefined;
}

export function AdminInput({
  icon: Icon,
  trailingAction,
  className = "",
  disabled,
  ...props
}: AdminInputProps) {
  const hasIcon = Boolean(Icon);

  return (
    <div className="relative w-full">
      {Icon && (
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400">
          <Icon size={16} aria-hidden="true" />
        </span>
      )}

      <input
        disabled={disabled}
        className={`h-11 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-xs text-slate-900 shadow-xs transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 sm:text-sm ${
          hasIcon ? "pr-10 pl-3.5" : "px-3.5"
        } ${trailingAction ? "pl-11" : ""} ${className}`}
        {...props}
      />

      {trailingAction && (
        <div className="absolute top-1/2 left-2 -translate-y-1/2">
          {trailingAction}
        </div>
      )}
    </div>
  );
}
