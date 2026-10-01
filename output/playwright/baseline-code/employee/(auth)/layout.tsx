import Link from "next/link";
import type { ReactNode } from "react";
import { EmployeeShell } from "@/features/employee/components/app-shell/employee-shell";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <EmployeeShell showBottomNav={false}>
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-slate-200/80 bg-white">
        <Link
          href="/employee"
          className="flex items-center gap-2 text-slate-900 font-bold text-lg hover:opacity-90 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/employee/oscar-logo.svg" alt="شعار أوسكار" className="h-8 w-auto" />
        </Link>
        <span className="text-xs text-slate-500 font-medium">بوابة الموظفين</span>
      </header>

      <main className="flex-1 flex flex-col justify-center p-4 sm:p-6 max-w-md mx-auto w-full">
        {children}
      </main>

      <footer className="p-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white">
        <div className="flex items-center justify-center gap-4 mb-2">
          <Link href="/employee/terms" className="hover:text-slate-600 transition-colors">
            الشروط والأحكام
          </Link>
          <span>•</span>
          <Link href="/employee/privacy" className="hover:text-slate-600 transition-colors">
            سياسة الخصوصية
          </Link>
          <span>•</span>
          <Link href="/employee/support" className="hover:text-slate-600 transition-colors">
            الدعم الفني
          </Link>
        </div>
        <p className="text-[11px]">أوسكار © 2026 — منصة مهام الموظفين (نموذج العرض التجريبي)</p>
      </footer>
    </EmployeeShell>
  );
}
