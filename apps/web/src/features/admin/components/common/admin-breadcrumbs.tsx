import { ChevronLeft, Home } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

export interface BreadcrumbItem {
  readonly label: string;
  readonly href?: Route;
}

interface AdminBreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
}

export function AdminBreadcrumbs({ items }: AdminBreadcrumbsProps) {
  return (
    <nav
      aria-label="مسار التنقل"
      className="flex items-center text-xs text-slate-500"
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        <li className="flex items-center">
          <Link
            href="/admin"
            className="flex items-center gap-1 text-slate-600 transition-colors hover:text-emerald-700"
            title="الرئيسية"
          >
            <Home size={14} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only sm:inline">
              لوحة الإدارة
            </span>
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5">
              <ChevronLeft
                size={13}
                className="shrink-0 text-slate-400"
                aria-hidden="true"
              />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="font-medium text-slate-600 transition-colors hover:text-emerald-700"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="font-bold text-slate-900"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
