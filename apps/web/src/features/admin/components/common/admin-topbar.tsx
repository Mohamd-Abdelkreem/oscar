"use client";

import { ExternalLink, Menu, PanelRightClose, PanelRightOpen, Shield } from "lucide-react";
import Link from "next/link";
import { CURRENT_ADMIN } from "../../constants/admin.constants";

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
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
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
          aria-label={isCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
          title={isCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
        >
          {isCollapsed ? (
            <PanelRightOpen size={18} aria-hidden="true" />
          ) : (
            <PanelRightClose size={18} aria-hidden="true" />
          )}
        </button>

        <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 md:flex">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
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
            {CURRENT_ADMIN.avatarInitial}
          </div>
          <div className="hidden flex-col text-right sm:flex">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {CURRENT_ADMIN.name}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 leading-tight">
              <Shield size={10} className="text-emerald-700" aria-hidden="true" />
              <span>مسؤول النظام (ADMIN)</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
