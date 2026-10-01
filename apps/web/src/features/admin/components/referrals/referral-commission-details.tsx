"use client";

import Link from "next/link";
import type { AdminReferralMember } from "../../types/admin.types";

import type { AdminReferralCommission } from "../../types/admin.types";

export function ReferralCommissionDetails({
  selectedMember,
  selectedMemberCommissions,
  root,
  rootCommissions,
}: {
  readonly selectedMember: AdminReferralMember | null;
  readonly selectedMemberCommissions: readonly AdminReferralCommission[];
  readonly root: AdminReferralMember | null;
  readonly rootCommissions: readonly AdminReferralCommission[];
}) {
  return selectedMember ? (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {selectedMember.name}
            </h3>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
              باقة {selectedMember.packageId}
            </span>
          </div>
          <p className="font-mono text-[11px] text-slate-500" dir="ltr">
            المعرف: {selectedMember.id} &bull; الكفيل:{" "}
            {selectedMember.sponsorName ?? "مباشر"}
          </p>
        </div>
        <Link
          href={`/admin/employees/${selectedMember.id}`}
          className="text-xs font-bold text-emerald-700 hover:underline"
        >
          عرض ملف الحساب &larr;
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
          <span className="block text-[11px] text-slate-500">
            الإحالات المباشرة
          </span>
          <span className="text-base font-bold text-slate-900">
            {selectedMember.directReferralsCount} عضو
          </span>
        </div>

        <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
          <span className="block text-[11px] text-slate-500">
            إجمالي أعضاء الفريق
          </span>
          <span className="text-base font-bold text-slate-900">
            {selectedMember.teamCount} عضو
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded border border-emerald-100 bg-emerald-50/50 p-2.5 text-xs">
        <span className="font-semibold text-emerald-900">
          إجمالي العمولات المكتسبة:
        </span>
        <span
          className="font-mono text-sm font-bold text-emerald-950"
          dir="ltr"
        >
          {selectedMember.totalCommissionEarned.toFixed(2)} USDT
        </span>
      </div>

      {/* Commission History for this member as beneficiary (Requirement 12) */}
      <div className="space-y-2 pt-1">
        <h4 className="text-xs font-bold text-slate-700">
          سجل العمولات المكتسبة لهذا العضو ({selectedMemberCommissions.length})
        </h4>

        {selectedMemberCommissions.length === 0 ? (
          <p className="p-2 text-xs text-slate-400">
            لا توجد عمولات مسجلة بعد لهذا العضو.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {selectedMemberCommissions.map((comm) => (
              <div key={comm.id} className="space-y-1 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{comm.event}</span>
                  <span
                    className="font-mono font-bold text-emerald-700"
                    dir="ltr"
                  >
                    +{comm.commissionAmount.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    أساس الاحتساب: {comm.calculationBasis} USDT ({comm.rate}%)
                  </span>
                  <bdi dir="ltr">{comm.date}</bdi>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : root ? (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-slate-900">
            عمولات قائد الفريق ({root.name})
          </h3>
          <p className="text-[11px] text-slate-500">
            العمولات المكتسبة ككفيل مستفيد من ترقيات أعضاء فريقه
          </p>
        </div>
        <Link
          href={`/admin/employees/${root.id}`}
          className="text-xs font-bold text-emerald-700 hover:underline"
        >
          عرض ملف الحساب &larr;
        </Link>
      </div>

      <div className="space-y-2">
        {rootCommissions.length === 0 ? (
          <p className="p-2 text-xs text-slate-400">
            لا توجد عمولات مسجلة لقائد الفريق الحالي.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {rootCommissions.map((comm) => (
              <div key={comm.id} className="space-y-1 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{comm.event}</span>
                  <span
                    className="font-mono font-bold text-emerald-700"
                    dir="ltr"
                  >
                    +{comm.commissionAmount.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    بواسطة: {comm.memberName} &bull; الأساس:{" "}
                    {comm.calculationBasis} USDT ({comm.rate}%)
                  </span>
                  <bdi dir="ltr">{comm.date}</bdi>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;
}
