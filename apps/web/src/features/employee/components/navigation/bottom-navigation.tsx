"use client";

import { ClipboardCheck, Home, Layers, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNavigation() {
  const pathname = usePathname();

  // 5 destinations in RTL order (Right to Left):
  // 1. الرئيسية, 2. المهام, 3. المناصب, 4. الفريق, 5. حسابي
  const navItems = [
    {
      href: "/employee" as const,
      label: "الرئيسية",
      icon: Home,
      isActive: pathname === "/employee",
    },
    {
      href: "/employee/tasks" as const,
      label: "المهام",
      icon: ClipboardCheck,
      isActive: pathname.startsWith("/employee/tasks"),
    },
    {
      href: "/employee/packages" as const,
      label: "المناصب",
      icon: Layers,
      isActive: pathname.startsWith("/employee/packages"),
    },
    {
      href: "/employee/team" as const,
      label: "الفريق",
      icon: Users,
      isActive: pathname.startsWith("/employee/team"),
    },
    {
      href: "/employee/account" as const,
      label: "حسابي",
      icon: User,
      isActive:
        pathname.startsWith("/employee/account") ||
        pathname.startsWith("/employee/support") ||
        pathname.startsWith("/employee/terms") ||
        pathname.startsWith("/employee/privacy") ||
        pathname.startsWith("/employee/faq"),
    },
  ];

  return (
    <nav
      className="safe-bottom-area fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white shadow-sm"
      aria-label="التنقل الرئيسي للتطبيق"
    >
      <div className="mx-auto flex h-16 max-w-xl items-center justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.isActive ? "page" : undefined}
              className={`relative flex h-full min-h-[48px] flex-1 flex-col items-center justify-center py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                item.isActive
                  ? "font-bold text-emerald-700"
                  : "font-medium text-slate-500 hover:text-slate-900"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  size={22}
                  className={`shrink-0 transition-transform ${
                    item.isActive ? "stroke-[2.25]" : "stroke-[1.75]"
                  }`}
                  aria-hidden="true"
                />
                {item.isActive && (
                  <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-emerald-600" />
                )}
              </div>
              <span className="mt-1 text-[11px] leading-none sm:text-xs">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
