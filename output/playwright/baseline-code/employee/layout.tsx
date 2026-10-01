import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EmployeeStateProvider } from "@/features/employee/context/employee-state.context";
import "@/styles/employee.css";

export const metadata: Metadata = {
  title: {
    default: "أوسكار | منصة مهام الموظفين",
    template: "%s | أوسكار",
  },
  description: "منصة أوسكار الرقمية لمهام الموظفين والعوائد اليومية",
};

interface EmployeeLayoutProps {
  readonly children: ReactNode;
}

export default function EmployeeLayout({ children }: EmployeeLayoutProps) {
  return (
    <div lang="ar" dir="rtl" className="employee-scope min-h-dvh bg-slate-100 text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      <EmployeeStateProvider>
        {children}
      </EmployeeStateProvider>
    </div>
  );
}
