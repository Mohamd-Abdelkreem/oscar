import type { Route } from "next";
import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";

interface AccountNavigationRowProps {
  readonly href: Route;
  readonly icon: LucideIcon;
  readonly label: string;
}

export function AccountNavigationRow({
  href,
  icon: Icon,
  label,
}: AccountNavigationRowProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[48px] items-center justify-between p-4 transition-colors hover:bg-slate-50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Icon size={18} aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold text-slate-900">{label}</span>
      </div>
      <ChevronLeft
        size={16}
        className="shrink-0 text-slate-400"
        aria-hidden="true"
      />
    </Link>
  );
}
