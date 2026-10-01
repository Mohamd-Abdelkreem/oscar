import type { Route } from "next";
import type { AdminSystemSettings } from "../types/admin.types";

export const CURRENT_ADMIN = {
  id: "adm_01",
  name: "محمد عبد الكريم",
  email: "admin@oscar-platform.com",
  role: "ADMIN" as const,
  avatarInitial: "م",
};

export const DEFAULT_ADMIN_SETTINGS: AdminSystemSettings = {
  withdrawalMinAmount: 16,
  withdrawalMaxAmount: 500,
  withdrawalFeePercent: 21,
  withdrawalCooldownHours: 24,
  withdrawalProcessingHours: 72,
  taskWindowStart: "12:00",
  taskWindowEnd: "18:00",
  timezone: "Asia/Baghdad",
  referralPercentages: [12, 6, 4, 2, 2] as const,
};

export interface AdminNavItem {
  readonly title: string;
  readonly href: Route;
  readonly iconName: string;
  readonly badge?: string;
  readonly exactMatch?: boolean;
}

export interface AdminNavGroup {
  readonly label: string;
  readonly items: readonly AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    label: "الرئيسية",
    items: [
      {
        title: "نظرة عامة",
        href: "/admin",
        iconName: "LayoutDashboard",
        exactMatch: true,
      },
    ],
  },
  {
    label: "الموظفون والمناصب",
    items: [
      {
        title: "إدارة الموظفين",
        href: "/admin/employees",
        iconName: "Users",
      },
      {
        title: "الباقات والمناصب",
        href: "/admin/packages",
        iconName: "Layers",
      },
    ],
  },
  {
    label: "المهام والرموز",
    items: [
      {
        title: "إدارة المهام",
        href: "/admin/tasks",
        iconName: "CheckSquare",
      },
      {
        title: "رموز فتح المهام",
        href: "/admin/codes",
        iconName: "KeyRound",
      },
      {
        title: "مراجعة التنفيذ",
        href: "/admin/submissions",
        iconName: "ClipboardCheck",
      },
    ],
  },
  {
    label: "العمليات المالية",
    items: [
      {
        title: "الإيداعات",
        href: "/admin/deposits",
        iconName: "ArrowDownToLine",
      },
      {
        title: "طلبات السحب",
        href: "/admin/withdrawals",
        iconName: "ArrowUpFromLine",
      },
      {
        title: "السجل المالي",
        href: "/admin/finance",
        iconName: "Receipt",
      },
    ],
  },
  {
    label: "الشبكة والعمولات",
    items: [
      {
        title: "شبكة الإحالات",
        href: "/admin/referrals",
        iconName: "Network",
      },
    ],
  },
  {
    label: "النظام والرقابة",
    items: [
      {
        title: "سجل التدقيق والرقابة",
        href: "/admin/audit-log",
        iconName: "ScrollText",
      },
      {
        title: "إعدادات المنصة",
        href: "/admin/settings",
        iconName: "Settings",
        exactMatch: true,
      },
      {
        title: "مدراء النظام",
        href: "/admin/settings/admins",
        iconName: "ShieldCheck",
      },
    ],
  },
];
