"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckSquare,
  ClipboardCheck,
  Image,
  KeyRound,
  Layers,
  LayoutDashboard,
  Network,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  ADMIN_NAV_GROUPS,
  type AdminNavItem,
} from "../../constants/admin.constants";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Layers,
  CheckSquare,
  KeyRound,
  ClipboardCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  Network,
  Image,
  ScrollText,
  Settings,
  ShieldCheck,
};

interface AdminSidebarProps {
  readonly isCollapsed: boolean;
  readonly isMobileOpen: boolean;
  readonly onCloseMobile: () => void;
  readonly onToggleCollapse: () => void;
}

export function AdminSidebar({
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer on route change
  useEffect(() => {
    onCloseMobile();
  }, [pathname, onCloseMobile]);

  // Handle Escape key on mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileOpen, onCloseMobile]);

  const isItemActive = (item: AdminNavItem) => {
    if (item.exactMatch) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
          title="أوسكار — لوحة التحكم الإدارية"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 font-bold text-white shadow-xs">
            أ
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm leading-tight font-bold tracking-tight text-slate-900">
                أوسكار | الإدارة
              </span>
              <span className="text-[11px] leading-tight font-semibold text-emerald-700">
                لوحة العمليات والرقابة
              </span>
            </div>
          )}
        </Link>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          aria-label="إغلاق القائمة الجانبية"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav
        aria-label="قائمة التنقل الرئيسية"
        className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
      >
        {ADMIN_NAV_GROUPS.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {!isCollapsed && (
              <h2 className="px-2.5 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                {group.label}
              </h2>
            )}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isItemActive(item);
                const IconComponent = iconMap[item.iconName] || LayoutDashboard;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={isCollapsed ? item.title : undefined}
                      className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors select-none ${
                        active
                          ? "border-r-3 border-emerald-700 bg-emerald-50 font-extrabold text-emerald-800"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      } ${isCollapsed ? "justify-center px-2" : ""}`}
                    >
                      <IconComponent
                        size={18}
                        className={`shrink-0 transition-colors ${
                          active
                            ? "text-emerald-700"
                            : "text-slate-500 group-hover:text-slate-800"
                        }`}
                        aria-hidden="true"
                      />
                      {!isCollapsed && (
                        <span className="flex-1 truncate">{item.title}</span>
                      )}
                      {!isCollapsed && item.badge && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer shortcut to employee portal */}
      <div className="shrink-0 border-t border-slate-200 p-3">
        <Link
          href="/employee/tasks"
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          title="معاينة بوابة الموظفين"
        >
          <CheckSquare size={15} aria-hidden="true" />
          {!isCollapsed && <span>واجهة الموظفين (معاينة)</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (RTL right-side) */}
      <aside
        className={`hidden border-l border-slate-200 bg-white transition-all duration-200 lg:fixed lg:top-0 lg:right-0 lg:bottom-0 lg:z-30 lg:flex lg:flex-col ${
          isCollapsed ? "w-18" : "w-64"
        }`}
      >
        {navContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="القائمة الجانبية"
        className={`fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] border-l border-slate-200 bg-white shadow-xl transition-transform duration-250 ease-in-out lg:hidden ${
          isMobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {navContent}
      </div>
    </>
  );
}
