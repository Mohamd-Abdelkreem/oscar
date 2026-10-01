"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckSquare,
  ClipboardCheck,
  KeyRound,
  Receipt,
  Users,
} from "lucide-react";
import Link from "next/link";
import { AdminBadge } from "../common/admin-badge";
import { AdminPageHeader } from "../common/admin-page-header";
import { useAdminState } from "../../context/admin-state.context";

export function OverviewScreen() {
  const {
    employees,
    codes,
    codeUsages,
    submissions,
    deposits,
    withdrawals,
    financeTransactions,
    auditLogs,
  } = useAdminState();

  // Metrics derived from actual fixtures
  const totalEmployeesCount = employees.filter((e) => !e.isDeleted).length;
  const activeSubscriptionsCount = employees.filter(
    (e) => !e.isDeleted && e.packageId !== "FREE",
  ).length;
  const pendingSubmissionsCount = submissions.filter(
    (s) => s.status === "pending",
  ).length;
  const scheduledWithdrawalsCount = withdrawals.filter(
    (w) => w.status === "scheduled" || w.status === "held",
  ).length;
  const heldWithdrawalsCount = withdrawals.filter((w) => w.status === "held").length;
  const activeCodesCount = codes.filter((c) => c.status === "active").length;

  // Today's distinct unlocks (task tsk_today_1001)
  const todayUnlocksCount = new Set(
    codeUsages
      .filter((u) => u.taskId === "tsk_today_1001")
      .map((u) => u.employeeId),
  ).size;

  // Unconfirmed deposits
  const pendingDepositsCount = deposits.filter((d) => d.status === "verifying").length;

  const recentTransactions = financeTransactions.slice(0, 5);
  const recentAudit = auditLogs.slice(0, 5);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="نظرة عامة على العمليات"
        description="مؤشرات الأداء المباشرة وسجلات النشاط المالي والتدقيقي لمنصة أوسكار"
      />

      {/* Primary KPI Grid (derived from real fixture counts) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        {/* Metric 1: Total Employees & Active Subscriptions */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي الموظفين</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Users size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {totalEmployeesCount}
            </span>
            <span className="text-xs font-semibold text-emerald-700">
              ({activeSubscriptionsCount} باقة مفعّلة)
            </span>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <Link href="/admin/employees" className="font-bold text-emerald-700 hover:underline">
              استعراض الموظفين &larr;
            </Link>
          </div>
        </div>

        {/* Metric 2: Pending Submissions */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مهام بانتظار التدقيق</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <ClipboardCheck size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {pendingSubmissionsCount}
            </span>
            {pendingSubmissionsCount > 0 && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                يتطلب مراجعة
              </span>
            )}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <Link href="/admin/submissions" className="font-bold text-amber-700 hover:underline">
              طابور المراجعة &larr;
            </Link>
          </div>
        </div>

        {/* Metric 3: Scheduled / Held Withdrawals */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">سحوبات قيد المعالجة</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sky-700">
              <ArrowUpFromLine size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {scheduledWithdrawalsCount}
            </span>
            {heldWithdrawalsCount > 0 && (
              <span className="text-xs font-semibold text-rose-600">
                ({heldWithdrawalsCount} معلق)
              </span>
            )}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <Link href="/admin/withdrawals" className="font-bold text-sky-700 hover:underline">
              إدارة السحوبات &larr;
            </Link>
          </div>
        </div>

        {/* Metric 4: Task Codes & Today's Unlocks */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">رموز المهام النشطة</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <KeyRound size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {activeCodesCount}
            </span>
            <span className="text-xs font-semibold text-emerald-700">
              ({todayUnlocksCount} فتح اليوم)
            </span>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <Link href="/admin/codes" className="font-bold text-emerald-700 hover:underline">
              إدارة الرموز &larr;
            </Link>
          </div>
        </div>
      </div>

      {/* Review Queue Shortcuts Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <h2 className="mb-3 text-sm font-bold text-slate-900">
          اختصارات طوابير العمليات المباشرة
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/admin/submissions"
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-amber-300 hover:bg-amber-50/50"
          >
            <div className="flex items-center gap-3">
              <ClipboardCheck size={20} className="text-amber-700" aria-hidden="true" />
              <div>
                <span className="block text-xs font-bold text-slate-900">مراجعة المهام المرسلة</span>
                <span className="text-[11px] text-slate-500">
                  {pendingSubmissionsCount} بانتظار اتخاذ القرار
                </span>
              </div>
            </div>
            <AdminBadge variant={pendingSubmissionsCount > 0 ? "warning" : "neutral"} size="sm">
              {pendingSubmissionsCount}
            </AdminBadge>
          </Link>

          <Link
            href="/admin/withdrawals"
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-sky-300 hover:bg-sky-50/50"
          >
            <div className="flex items-center gap-3">
              <ArrowUpFromLine size={20} className="text-sky-700" aria-hidden="true" />
              <div>
                <span className="block text-xs font-bold text-slate-900">طلبات السحب المجدولة</span>
                <span className="text-[11px] text-slate-500">
                  {scheduledWithdrawalsCount} طلب تحت المعالجة (72 ساعة)
                </span>
              </div>
            </div>
            <AdminBadge variant={scheduledWithdrawalsCount > 0 ? "info" : "neutral"} size="sm">
              {scheduledWithdrawalsCount}
            </AdminBadge>
          </Link>

          <Link
            href="/admin/deposits"
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
          >
            <div className="flex items-center gap-3">
              <ArrowDownToLine size={20} className="text-emerald-700" aria-hidden="true" />
              <div>
                <span className="block text-xs font-bold text-slate-900">إيداعات قيد التحقق</span>
                <span className="text-[11px] text-slate-500">
                  {pendingDepositsCount} إيداع قيد المراجعة
                </span>
              </div>
            </div>
            <AdminBadge variant={pendingDepositsCount > 0 ? "warning" : "neutral"} size="sm">
              {pendingDepositsCount}
            </AdminBadge>
          </Link>
        </div>
      </div>

      {/* Two Column Layout: Recent Financial Operations & Recent Audit Logs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Recent Financial Activity */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-emerald-700" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">أحدث العمليات المالية</h2>
            </div>
            <Link
              href="/admin/finance"
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              عرض السجل الكامل
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3.5 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">{tx.title}</span>
                  <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                    <span>{tx.employeeName}</span>
                    <span>&bull;</span>
                    <bdi dir="ltr">{tx.date}</bdi>
                  </div>
                </div>

                <div className="text-left font-mono font-bold" dir="ltr">
                  <span
                    className={
                      tx.amount > 0
                        ? "text-emerald-700"
                        : tx.amount < 0
                          ? "text-rose-600"
                          : "text-slate-500"
                    }
                  >
                    {tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)} USDT
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Recent Audit Log */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-slate-700" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">أحدث سجلات التدقيق الإداري</h2>
            </div>
            <Link
              href="/admin/audit-log"
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              عرض سجل التدقيق
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentAudit.map((log) => (
              <div key={log.id} className="space-y-1 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{log.action}</span>
                  <bdi dir="ltr" className="text-[11px] text-slate-400">
                    {log.timestamp}
                  </bdi>
                </div>
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-800">{log.targetTitle}</span>
                  {log.reason && (
                    <span className="text-slate-500"> — {log.reason}</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  بواسطة: {log.adminName}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
