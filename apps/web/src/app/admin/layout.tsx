import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminRouteBoundary } from "@/features/admin/components/common/admin-route-boundary";
import "@/styles/admin.css";

export const metadata: Metadata = {
  title: {
    default: "أوسكار | لوحة التحكم الإدارية",
    template: "%s | لوحة التحكم أوسكار",
  },
  description: "لوحة التحكم الإدارية والرقابة التشغيلية لمنصة أوسكار",
};

interface AdminLayoutProps {
  readonly children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div
      lang="ar"
      dir="rtl"
      className="admin-scope min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900"
    >
      <AdminRouteBoundary>{children}</AdminRouteBoundary>
    </div>
  );
}
