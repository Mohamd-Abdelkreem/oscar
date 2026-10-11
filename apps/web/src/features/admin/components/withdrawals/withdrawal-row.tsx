"use client";
import { useState } from "react";
import { CalendarPlus, XCircle } from "lucide-react";
import Link from "next/link";
import type { AdminWithdrawalRequest } from "../../api/withdrawals.api";
import { useAdminWithdrawalDetail } from "../../hooks/withdrawals.hooks";
import {
  withdrawalStates,
  withdrawalInstant,
  withdrawalRate,
  withdrawalActions,
  withdrawalBlockers,
  canChangeWithdrawal,
} from "../../utils/withdrawal-presentation";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { TaskQueryState } from "../common/task-query-state";

function WithdrawalDetails({ target }: { readonly target: string }) {
  const detail = useAdminWithdrawalDetail(target),
    row = detail.displayData;
  if (!row)
    return (
      <TaskQueryState
        error={
          detail.isError || detail.observationExhausted
            ? (detail.error?.message ??
              "تعذر قراءة التفاصيل الحالية. لا يمكن تنفيذ إجراء.")
            : undefined
        }
        retry={detail.refetch}
      />
    );
  return (
    <div className="space-y-1 pt-2 break-all">
      {(detail.observationExhausted || detail.isDisplayStale) && (
        <p role="status">هذه آخر بيانات معروفة؛ حدّث التفاصيل قبل أي إجراء.</p>
      )}
      <p>
        {row.employee.fullName} — <bdi>{row.employee.email}</bdi>
      </p>
      <p>
        معرف الطلب: <bdi>{row.id}</bdi> — إصدار {row.version} /{" "}
        {row.scheduleVersion}
      </p>
      <p>
        المستلم الثابت: <bdi>{row.recipient}</bdi> — <bdi>{row.network}</bdi>
      </p>
      <p>الموعد الأصلي: {withdrawalInstant(row.originalDueAt)} (بغداد)</p>
      <p>الموعد الحالي: {withdrawalInstant(row.dueAt)} (بغداد)</p>
      <p>أقرب إرسال: {withdrawalInstant(row.dispatchAt)} (بغداد)</p>
      <p>لقطة الخادم: {withdrawalInstant(row.serverNow)} (بغداد)</p>
      <p>
        الساعات المحتسبة المتبقية: <bdi>{row.remainingCountedHours}</bdi> —{" "}
        <bdi>{row.remainingCountedMilliseconds}</bdi> ms
      </p>
      <p>
        غير إحالي: <bdi>{row.sourceAllocation.nonReferral}</bdi> USDT — إحالات:{" "}
        <bdi>{row.sourceAllocation.referral}</bdi> USDT
      </p>
      <p>
        العضوية المحفوظة: {row.effectiveMembership} — رسوم:{" "}
        {withdrawalRate(row.feeBps)}
      </p>
      <p>
        أساس الرسوم: {row.feeBasis} — إصدار السياسة: {row.policyVersion} — إصدار
        العنوان: {row.addressVersion}
      </p>
      {row.subscriptionExpiresAt && (
        <p>
          انتهاء العضوية المحفوظ: {withdrawalInstant(row.subscriptionExpiresAt)}{" "}
          (بغداد)
        </p>
      )}
      {row.finalizedAt && (
        <p>
          وقت النتيجة النهائية: {withdrawalInstant(row.finalizedAt)} (بغداد)
        </p>
      )}
      {row.transactionId && (
        <p>
          معرف المعاملة: <bdi>{row.transactionId}</bdi>
        </p>
      )}
      {row.blocker && <p>{withdrawalBlockers[row.blocker]}</p>}
      {row.release ? (
        <p>
          أُعيد {row.release.gross} USDT إلى المصادر الأصلية؛ رسوم محصلة:{" "}
          {row.release.chargedFee} USDT.
        </p>
      ) : row.settlement ? (
        <p>
          دفع مؤكد: {row.settlement.net} USDT — رسوم محصلة: {row.settlement.fee}{" "}
          USDT.
        </p>
      ) : (
        <p>يبقى المبلغ محجوزاً؛ صفر لا يعني اكتمال الدفع.</p>
      )}
      <p>آخر الإجراءات المحفوظة (حتى 100 إجراء):</p>
      {row.actions.map((action) => (
        <p key={action.id}>
          {withdrawalActions[action.kind]} —{" "}
          {withdrawalInstant(action.occurredAt)} (بغداد) — المنفذ:{" "}
          <bdi>{action.actorUserId ?? "النظام"}</bdi> — {action.reason} — إصدار{" "}
          {action.committedVersion} / {action.scheduleVersion}
        </p>
      ))}
      <AdminButton
        variant="outline"
        size="sm"
        onClick={() => {
          void detail.refetch();
        }}
      >
        تحديث التفاصيل
      </AdminButton>
    </div>
  );
}
export function WithdrawalRow({
  wth,
  disabled,
  retainedKind,
  onExtend,
  onReject,
}: {
  readonly wth: AdminWithdrawalRequest;
  readonly disabled: boolean;
  readonly retainedKind?: "EXTEND" | "REJECT" | undefined;
  readonly onExtend: (row: AdminWithdrawalRequest) => void;
  readonly onReject: (row: AdminWithdrawalRequest) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = withdrawalStates[wth.state];
  return (
    <tr className="hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <div className="space-y-0.5">
          <Link
            href={`/admin/employees/${wth.employee.id}`}
            className="block font-bold text-slate-900 hover:text-emerald-700 hover:underline"
          >
            {wth.employee.fullName}
          </Link>
          <bdi dir="ltr" className="block text-[11px] text-slate-500">
            {wth.employee.email}
          </bdi>
        </div>
      </td>
      <td
        className="px-4 py-3 font-mono text-sm font-bold whitespace-nowrap text-slate-900"
        dir="ltr"
      >
        {wth.gross} USDT
      </td>
      <td
        className="px-4 py-3 font-mono whitespace-nowrap text-slate-500"
        dir="ltr"
      >
        {wth.fee} USDT ({withdrawalRate(wth.feeBps)})
      </td>
      <td
        className="px-4 py-3 font-mono text-sm font-bold whitespace-nowrap text-emerald-700"
        dir="ltr"
      >
        {wth.net} USDT
      </td>
      <td
        className="max-w-[9rem] truncate px-4 py-3 font-mono text-[11px] text-slate-600"
        dir="ltr"
        title={wth.recipient}
      >
        {wth.recipient}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
        <div className="space-y-0.5">
          <div className="font-mono text-[11px]">
            طلب: <bdi>{withdrawalInstant(wth.acceptedAt)}</bdi>
          </div>
          <div className="font-mono text-[11px] font-semibold text-slate-600">
            استحقاق: <bdi>{withdrawalInstant(wth.dueAt)}</bdi>
          </div>
        </div>
        <details
          className={expanded ? "w-72 whitespace-normal" : "whitespace-normal"}
          onToggle={(event) => {
            setExpanded(event.currentTarget.open);
          }}
        >
          <summary className="cursor-pointer font-semibold text-slate-700">
            تفاصيل الطلب
          </summary>
          {expanded && <WithdrawalDetails target={wth.id} />}
        </details>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">
          <bdi>{wth.remainingCountedHours}</bdi> ساعة محتسبة
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <AdminBadge
          variant={
            wth.state === "COMPLETED"
              ? "success"
              : wth.release
                ? "danger"
                : "warning"
          }
          size="sm"
          dot
        >
          {status.label}
        </AdminBadge>
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {canChangeWithdrawal(wth, "EXTEND") && (
            <AdminButton
              variant="warning"
              size="sm"
              icon={CalendarPlus}
              disabled={disabled || retainedKind === "REJECT"}
              onClick={() => {
                onExtend(wth);
              }}
              title="زيادة جدولة السحب"
            >
              زيادة الجدولة
            </AdminButton>
          )}
          {canChangeWithdrawal(wth, "REJECT") && (
            <AdminButton
              variant="destructive"
              size="sm"
              icon={XCircle}
              disabled={disabled || retainedKind === "EXTEND"}
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
