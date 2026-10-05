"use client";
import { ChevronDown, ChevronLeft, GitFork } from "lucide-react";
import type { AdminMember } from "@template/contracts";
import { useReferralMembers } from "../../hooks/referrals.hooks";
import { FinancialFeedback } from "@/features/employee/components/common/financial-feedback";
import { formatMoney } from "@/features/employee/utils/money-display";
import { AdminPagination } from "../common/admin-pagination";

export function ReferralLevel({
  lvl,
  rootId,
  totalInLvl,
  rateBps,
  isExpanded,
  withinTeamQuery,
  selectedMember,
  toggleLevel,
  setSelectedMember,
}: {
  lvl: 1 | 2 | 3 | 4 | 5;
  rootId: string;
  totalInLvl: number;
  rateBps: number;
  isExpanded: boolean | undefined;
  withinTeamQuery: string;
  selectedMember: AdminMember | null;
  toggleLevel: (level: number) => void;
  setSelectedMember: (member: AdminMember) => void;
}) {
  const query = useReferralMembers(isExpanded ? rootId : null, {
    level: lvl,
    ...(withinTeamQuery ? { q: withinTeamQuery } : {}),
  });
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/30">
      <button
        type="button"
        onClick={() => {
          toggleLevel(lvl);
        }}
        className="flex w-full cursor-pointer items-center justify-between p-3.5 text-xs font-bold text-slate-800 hover:bg-slate-100/70"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-xs font-black text-emerald-800">
            L{lvl}
          </span>
          <span>
            المستوى {lvl} (النسبة الحالية: {rateBps / 100}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">
            {withinTeamQuery
              ? (query.data?.pagination.total ?? "—")
              : totalInLvl}{" "}
            أعضاء
          </span>
          {isExpanded ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronLeft size={16} aria-hidden="true" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white">
          <FinancialFeedback
            pending={query.isPending}
            error={query.error}
            retry={query.refetch}
          />
          {query.data?.items.length === 0 && (
            <p className="p-3 text-center text-xs text-slate-400">
              لا يوجد أعضاء في هذا المستوى يطابقون معايير التصفية.
            </p>
          )}
          {query.data?.items.map((member) => (
            <button
              type="button"
              key={member.id}
              disabled={!query.allowed}
              onClick={() => {
                setSelectedMember(member);
              }}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 p-3.5 text-right text-xs transition-colors ${selectedMember?.id === member.id ? "border-r-4 border-emerald-700 bg-emerald-50/80 font-bold" : "hover:bg-slate-50"}`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    {member.fullName}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                    {member.packageCode ?? "FREE"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                  <GitFork size={12} aria-hidden="true" />
                  <span>المسار:</span>
                  {member.path.map((step) => (
                    <span key={step.id}>{step.fullName} ← </span>
                  ))}
                </div>
                <div className="text-[11px] break-all text-slate-500">
                  <bdi dir="ltr">{member.email}</bdi>
                </div>
              </div>
              <div className="shrink-0 pl-2 text-left">
                <bdi dir="ltr" className="font-mono font-bold text-emerald-800">
                  {formatMoney(member.viewerEarnedFromMember)} USDT
                </bdi>
                <span className="block text-[10px] text-slate-400">
                  عمولات الجذر من هذا العضو
                </span>
              </div>
            </button>
          ))}
          {query.data && (
            <AdminPagination
              currentPage={query.page}
              totalPages={query.data.pagination.totalPages}
              totalItems={query.data.pagination.total}
              pageSize={25}
              onPageChange={query.setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
