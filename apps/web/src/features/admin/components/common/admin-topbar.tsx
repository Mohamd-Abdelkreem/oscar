"use client";

import {
  ExternalLink,
  LogOut,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useLogout, useSession } from "@/features/auth/hooks/auth.hooks";
import { getApiError } from "@/services/api/api-client";
import { useState } from "react";
import { AdminButton } from "./admin-button";

interface AdminTopbarProps {
  readonly isCollapsed: boolean;
  readonly onToggleCollapse: () => void;
  readonly onOpenMobile: () => void;
}

export function AdminTopbar({
  isCollapsed,
  onToggleCollapse,
  onOpenMobile,
}: AdminTopbarProps) {
  const session = useSession();
  const logout = useLogout();
  const [error, setError] = useState<string | null>(null);
  const currentAdmin = session.data?.user;
  const signOut = async () => {
    if (logout.isPending || logout.uncertain) return;
    setError(null);
    try {
      await logout.mutateAsync();
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category !== "obsolete") setError(safe.message);
    }
  };
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu hamburger */}
        <button
          type="button"
          onClick={onOpenMobile}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 lg:hidden"
          aria-label="فتح القائمة الجانبية"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        {/* Desktop sidebar rail collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 lg:flex"
          aria-label={
            isCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"
          }
          title={isCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
        >
          {isCollapsed ? (
            <PanelRightOpen size={18} aria-hidden="true" />
          ) : (
            <PanelRightClose size={18} aria-hidden="true" />
          )}
        </button>

        <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 md:flex">
          <span
            className="flex h-2 w-2 rounded-full bg-emerald-500"
            aria-hidden="true"
          />
          <span>منظومة العمليات التشغيلية والرقابة الفورية</span>
        </div>
      </div>

      {/* Right-side controls (in RTL, this appears on the left side of header) */}
      <div className="flex items-center gap-3">
        {/* Link to Employee View */}
        <Link
          href="/employee/tasks"
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
          title="الانتقال إلى واجهة الموظفين للمعاينة"
        >
          <span className="hidden sm:inline">واجهة الموظف التجريبية</span>
          <span className="sm:hidden">الموظف</span>
          <ExternalLink size={13} aria-hidden="true" />
        </Link>

        {/* Admin User Profile Tag */}
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-xs font-bold text-white shadow-xs">
            {currentAdmin?.fullName.slice(0, 1)}
          </div>
          <div className="hidden flex-col text-right sm:flex">
            <span
              className="max-w-32 truncate text-xs leading-tight font-bold text-slate-900"
              title={currentAdmin?.fullName}
            >
              {currentAdmin?.fullName}
            </span>
            <div className="flex items-center gap-1 text-[10px] leading-tight font-semibold text-slate-500">
              <Shield
                size={10}
                className="text-emerald-700"
                aria-hidden="true"
              />
              <span>مسؤول النظام (ADMIN)</span>
            </div>
          </div>
        </div>
        <AdminButton
          variant="outline"
          size="sm"
          icon={LogOut}
          aria-label="تسجيل الخروج"
          loading={logout.isPending}
          disabled={logout.isPending || logout.uncertain}
          onClick={() => {
            void signOut();
          }}
        >
          <span className="hidden sm:inline">تسجيل الخروج</span>
        </AdminButton>
        {error && (
          <p role="alert" className="text-xs text-rose-600">
            {error}
          </p>
        )}
      </div>
    </header>
  );
}
