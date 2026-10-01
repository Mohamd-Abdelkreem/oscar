"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

export interface AdminSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean | undefined;
}

export interface AdminSelectProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly AdminSelectOption[];
  readonly placeholder?: string | undefined;
  readonly "aria-label"?: string | undefined;
  readonly id?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
  readonly triggerClassName?: string | undefined;
  readonly icon?: ReactNode | undefined;
}

export function AdminSelect({
  value,
  onValueChange,
  options,
  placeholder = "اختر...",
  "aria-label": ariaLabel,
  id,
  disabled = false,
  className = "",
  triggerClassName = "",
  icon,
}: AdminSelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative ${className}`}>
      <Select.Root
        dir="rtl"
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <Select.Trigger
          id={id}
          aria-label={ariaLabel ?? placeholder}
          className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-xs transition-colors hover:border-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 sm:text-sm ${triggerClassName}`}
        >
          <div className="flex items-center gap-2 truncate">
            {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
            <Select.Value placeholder={placeholder}>
              {selectedOption ? selectedOption.label : placeholder}
            </Select.Value>
          </div>
          <Select.Icon asChild>
            <ChevronDown
              size={16}
              className="shrink-0 text-slate-400"
              aria-hidden="true"
            />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            dir="rtl"
            className="admin-scope admin-portal animate-in fade-in-80 z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          >
            <Select.ScrollUpButton className="flex h-6 items-center justify-center bg-slate-50 text-slate-500">
              <ChevronUp size={14} />
            </Select.ScrollUpButton>

            <Select.Viewport className="p-1">
              {options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled ?? false}
                  className="relative flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs text-slate-700 outline-none select-none hover:bg-emerald-50 hover:text-emerald-900 focus:bg-emerald-50 focus:text-emerald-900 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[state=checked]:bg-emerald-50 data-[state=checked]:font-bold data-[state=checked]:text-emerald-800 sm:text-sm"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check
                      size={14}
                      className="text-emerald-700"
                      aria-hidden="true"
                    />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>

            <Select.ScrollDownButton className="flex h-6 items-center justify-center bg-slate-50 text-slate-500">
              <ChevronDown size={14} />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
