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
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {showBackButton &&
          (backHref ? (
            <Link
              href={backHref}
              className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
              aria-label="الرجوع للصفحة السابقة"
            >
              <ArrowRight size={20} className="shrink-0" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                router.back();
              }}
              className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
              aria-label="الرجوع للخلف"
            >
              <ArrowRight size={20} className="shrink-0" aria-hidden="true" />
            </button>
          ))}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>

      {action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </header>
  );
}
