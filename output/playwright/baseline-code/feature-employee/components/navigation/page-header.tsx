"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";

interface PageHeaderProps {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly backHref?: Route | undefined;
  readonly showBackButton?: boolean | undefined;
  readonly action?: ReactNode | undefined;
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  showBackButton = false,
  action,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
      <div className="flex items-center gap-3 min-w-0">
        {showBackButton && (
          backHref ? (
            <Link
              href={backHref}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] -mr-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600"
              aria-label="الرجوع للصفحة السابقة"
            >
              <ArrowRight size={20} className="shrink-0" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => { router.back(); }}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] -mr-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600"
              aria-label="الرجوع للخلف"
            >
              <ArrowRight size={20} className="shrink-0" aria-hidden="true" />
            </button>
          )
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </header>
  );
}
