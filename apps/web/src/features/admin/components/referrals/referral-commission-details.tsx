"use client";
import Link from "next/link";
import type { AdminMember } from "@template/contracts";
import {
  useReferralSummary,
  useReferralCommissions,
} from "../../hooks/referrals.hooks";
import { FinancialFeedback } from "@/features/employee/components/common/financial-feedback";
import { formatMoney } from "@/features/employee/utils/money-display";
import { AdminPagination } from "../common/admin-pagination";

export function ReferralCommissionDetails({
  selectedMember,
  rootId,
}: {
  selectedMember: AdminMember | null;
  rootId: string | null;
}) {
  const beneficiary = selectedMember?.id ?? rootId;
  const summary = useReferralSummary(beneficiary);
  const commissions = useReferralCommissions(beneficiary);
  if (!beneficiary)
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 text-xs text-slate-500">
        اختر الحساب الجذر لاستعراض عمولاته.
      </div>
    );
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <FinancialFeedback
        pending={summary.isPending}
        error={summary.error}
        retry={summary.refetch}
      />
      {summary.data && (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {summary.data.root.fullName}
            </h3>
            <Link
              href={`/admin/employees/${summary.data.root.id}`}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              ملف الحساب ←
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
              الإحالات المباشرة: {summary.data.levelCounts[0]?.members}
            </div>
            <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
              أعضاء L1–L5:{" "}
              {summary.data.levelCounts.reduce(
                (sum, count) => sum + count.members,
                0,
              )}
            </div>
          </div>
          <div className="flex items-center justify-between rounded border border-emerald-100 bg-emerald-50/50 p-2.5 text-xs">
            <span>إجمالي العمولات المكتسبة:</span>
            <bdi dir="ltr" className="font-mono font-bold text-emerald-950">
              {formatMoney(summary.data.ownEarned.total)} USDT
            </bdi>
          </div>
        </>
      )}
      <h4 className="text-xs font-bold text-slate-700">
        سجل القرارات المحفوظة للمستفيد
      </h4>
      <FinancialFeedback
        pending={commissions.isPending}
        error={commissions.error}
        retry={commissions.refetch}
      />
      {commissions.data?.items.length === 0 && (
        <p className="p-2 text-xs text-slate-400">
          لا توجد عمولات مسجلة بعد لهذا الحساب.
        </p>
      )}
      <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {commissions.data?.items.map((decision) => (
          <div key={decision.decisionId} className="space-y-1 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-800">
                {decision.buyer.fullName} · L{decision.level}
              </span>
              <bdi dir="ltr" className="font-mono font-bold text-emerald-700">
                {formatMoney(decision.award)} USDT
              </bdi>
            </div>
            <p>
              النسبة المحفوظة: {decision.rateBps / 100}% · الأساس:{" "}
              <bdi>{formatMoney(decision.commissionBase)} USDT</bdi>
            </p>
            <p>
              {decision.decision === "SKIPPED"
                ? `متخطاة: ${decision.skippedReason ?? ""}`
                : decision.decision === "ELIGIBLE_ZERO"
                  ? `استحقاق صفري: ${decision.zeroReason ?? ""}`
                  : "عمولة محفوظة"}
            </p>
            <bdi
              dir="ltr"
              className="block text-[11px] break-all text-slate-500"
            >
              {decision.occurredAt}
            </bdi>
          </div>
        ))}
      </div>
      {commissions.data && (
        <AdminPagination
          currentPage={commissions.page}
          totalPages={commissions.data.pagination.totalPages}
          totalItems={commissions.data.pagination.total}
          pageSize={25}
          onPageChange={commissions.setPage}
        />
      )}
    </div>
  );
}
