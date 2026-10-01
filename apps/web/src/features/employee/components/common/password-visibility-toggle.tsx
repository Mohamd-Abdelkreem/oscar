"use client";

import { Eye, EyeOff } from "lucide-react";

interface PasswordVisibilityToggleProps {
  readonly visible: boolean;
  readonly onToggle: () => void;
}

export function PasswordVisibilityToggle({
  visible,
  onToggle,
}: PasswordVisibilityToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute top-1/2 left-1.5 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-600"
      aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
    >
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}
