import Link from "next/link";
import type { ReactNode } from "react";
import { EmployeeShell } from "@/features/employee/components/app-shell/employee-shell";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <EmployeeShell showBottomNav={false}>
      <header className="flex items-center justify-between border-b border-slate-200/80 bg-white p-4 sm:p-6">
        <Link
          href="/employee"
          className="flex items-center gap-2 text-lg font-bold text-slate-900 transition-opacity hover:opacity-90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/employee/oscar-logo.svg"
            alt="شعار أوسكار"
            className="h-8 w-auto"
          />
        </Link>
        <span className="text-xs font-medium text-slate-500">
          بوابة الموظفين
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4 sm:p-6">
        {children}
      </main>

      <footer className="border-t border-slate-200/60 bg-white p-4 text-center text-xs text-slate-400">
        <div className="mb-2 flex items-center justify-center gap-4">
          <Link
            href="/employee/terms"
            className="transition-colors hover:text-slate-600"
          >
            الشروط والأحكام
          </Link>
          <span>•</span>
          <Link
            href="/employee/privacy"
            className="transition-colors hover:text-slate-600"
          >
            سياسة الخصوصية
          </Link>
          <span>•</span>
          <Link
            href="/employee/support"
            className="transition-colors hover:text-slate-600"
          >
            الدعم الفني
          </Link>
        </div>
        <p className="text-[11px]">
          أوسكار © 2026 — منصة مهام الموظفين (نموذج العرض التجريبي)
        </p>
      </footer>
    </EmployeeShell>
  );
}
