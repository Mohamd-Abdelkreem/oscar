"use client";

import { CalendarPlus, CheckCircle2, Play, XCircle } from "lucide-react";
import Link from "next/link";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import type {
  AdminWithdrawal,
  AdminWithdrawalStatus,
} from "../../types/admin.types";
import {
  calculateRemainingWithdrawalTime,
  formatBaghdadDateTime,
} from "../../utils/time.utils";

const WITHDRAWAL_STATUS_LABELS: Record<
  AdminWithdrawalStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" }
> = {
  scheduled: { label: "مجدول", variant: "warning" },
  held: { label: "معلق بقرار إداري", variant: "danger" },
  processing: { label: "قيد التحويل والتنفيذ", variant: "info" },
  completed: { label: "مكتمل ومسوى", variant: "success" },
  rejected: { label: "مرفوض ومحرر", variant: "danger" },
};
export function WithdrawalRow({
  wth,
  currentTimeMs,
  onExtend,
  onRelease,
  onComplete,
  onReject,
}: {
  readonly wth: AdminWithdrawal;
  readonly currentTimeMs: number;
  readonly onExtend: (withdrawal: AdminWithdrawal) => void;
  readonly onRelease: (withdrawal: AdminWithdrawal) => void;
  readonly onComplete: (withdrawal: AdminWithdrawal) => void;
  readonly onReject: (withdrawal: AdminWithdrawal) => void;
}) {
  const statusMeta = WITHDRAWAL_STATUS_LABELS[wth.status];
  const baseDuration = wth.originalDurationHours ?? 72;
  const totalScheduleHours = baseDuration + (wth.addedHours ?? 0);

  // Requirement 3: calculate countdown strictly from max(0, dueAt - currentTime)
  const isScheduled = wth.status === "scheduled";
  const remaining = isScheduled
    ? calculateRemainingWithdrawalTime(wth.dueAt, currentTimeMs)
    : null;

  return (
    <tr key={wth.id} className="hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <div className="space-y-0.5">
          <Link
            href={`/admin/employees/${wth.employeeId}`}
            className="block font-bold text-slate-900 hover:text-emerald-700 hover:underline"
          >
            {wth.employeeName}
          </Link>
          <bdi dir="ltr" className="block text-[11px] text-slate-500">
            {wth.employeeEmail}
          </bdi>
        </div>
      </td>

      <td
        className="px-4 py-3 font-mono text-sm font-bold whitespace-nowrap text-slate-900"
        dir="ltr"
      >
        {wth.amount.toFixed(2)} USDT
      </td>

      <td
        className="px-4 py-3 font-mono whitespace-nowrap text-slate-500"
        dir="ltr"
      >
        {wth.fee.toFixed(2)} USDT
      </td>

      <td
        className="px-4 py-3 font-mono text-sm font-bold whitespace-nowrap text-emerald-700"
        dir="ltr"
      >
        {wth.netAmount.toFixed(2)} USDT
      </td>

      <td
        className="max-w-[9rem] truncate px-4 py-3 font-mono text-[11px] text-slate-600"
        dir="ltr"
        title={wth.targetAddress}
      >
        {wth.targetAddress}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
        <div className="space-y-0.5">
          <div className="font-mono text-[11px]">
            طلب: <bdi dir="ltr">{formatBaghdadDateTime(wth.requestedAt)}</bdi>
          </div>
          <div className="font-mono text-[11px] font-semibold text-slate-600">
            استحقاق: <bdi dir="ltr">{formatBaghdadDateTime(wth.dueAt)}</bdi>
          </div>
        </div>
      </td>

      {/* Requirement 3: Visible Remaining Time Column */}
      <td className="px-4 py-3 whitespace-nowrap">
        {isScheduled && remaining ? (
          remaining.isDue ? (
            <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
              {remaining.text}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">
              {remaining.text}
            </span>
          )
        ) : (
          <span className="text-sm font-bold text-slate-400">—</span>
        )}
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <AdminBadge variant={statusMeta.variant} size="sm" dot>
          {statusMeta.label}
          {isScheduled && ` (${String(totalScheduleHours)} ساعة)`}
        </AdminBadge>

        {wth.addedHours !== undefined && wth.addedHours > 0 && (
          <p className="mt-0.5 text-[10px] font-bold text-amber-800">
            تم تمديده (+{wth.addedHours} س)
          </p>
        )}

        {wth.holdReason && (
          <p
            className="mt-1 max-w-[12rem] truncate text-[10px] text-rose-600"
            title={wth.holdReason}
          >
            {wth.holdReason}
          </p>
        )}
      </td>

      <td className="px-4 py-3 text-center whitespace-nowrap">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {/* Requirement 10: Schedule Extension Action (Replaces Hold) */}
          {isScheduled && (
            <AdminButton
              variant="warning"
              size="sm"
              icon={CalendarPlus}
              onClick={() => {
                onExtend(wth);
              }}
              title="زيادة جدولة السحب"
            >
              زيادة الجدولة
            </AdminButton>
          )}

          {/* Legacy release action (for retained held rows) */}
          {wth.status === "held" && (
            <AdminButton
              variant="success"
              size="sm"
              icon={Play}
              onClick={() => {
                onRelease(wth);
              }}
              title="فك تعليق الطلب واستئناف الجدولة"
            >
              فك التعليق
            </AdminButton>
          )}

          {/* Complete action */}
          {(wth.status === "scheduled" || wth.status === "processing") && (
            <AdminButton
              variant="primary"
              size="sm"
              icon={CheckCircle2}
              onClick={() => {
                onComplete(wth);
              }}
              title="إتمام تسوية السحب وخصم الرصيد المحجوز"
            >
              إتمام
            </AdminButton>
          )}

          {/* Reject action */}
          {(wth.status === "scheduled" ||
            wth.status === "held" ||
            wth.status === "processing") && (
            <AdminButton
              variant="destructive"
              size="sm"
              icon={XCircle}
              onClick={() => {
                onReject(wth);
              }}
              title="رفض الطلب وتحرير الرصيد المحجوز"
            >
              رفض
            </AdminButton>
          )}
        </div>
      </td>
    </tr>
  );
}
