"use client";

import { useState } from "react";
import { useTeamMembers } from "../../hooks/referrals.hooks";
import {
  FinancialFeedback,
  FinancialPages,
} from "../common/financial-feedback";
import { MoneyAmount } from "../common/money-amount";

export function TeamMemberList() {
  const [selectedLevel, setSelectedLevel] = useState<number | "all">("all");

  const levels = ["all", 1, 2, 3, 4, 5] as const;

  const query = useTeamMembers(
    selectedLevel === "all" ? {} : { level: selectedLevel },
  );
  const filteredMembers = query.data?.items ?? [];

  return (
    <div className="space-y-3">
      {/* Filter Tabs */}
      <div className="flex scrollbar-none items-center gap-1.5 overflow-x-auto pb-1">
        {levels.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => {
              setSelectedLevel(lvl);
            }}
            className={`min-h-[44px] shrink-0 rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
              selectedLevel === lvl
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {lvl === "all" ? "جميع المستويات" : "المستوى " + lvl.toString()}
          </button>
        ))}
      </div>

      {/* Member Cards / Rows */}
      <FinancialFeedback
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data && filteredMembers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          لا يوجد أعضاء مسجلين في هذا المستوى حالياً.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                  {member.fullName.slice(0, 1)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {member.fullName}
                    </h3>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                      L{member.level.toString()}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    انضم: <bdi dir="ltr">{member.joinedAt}</bdi> • باقة:{" "}
                    {member.packageCode ?? "FREE"}
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-left">
                <span className="mb-0.5 block text-[11px] text-slate-400">
                  عمولاتك من هذا العضو
                </span>
                <MoneyAmount
                  amount={member.viewerEarnedFromMember}
                  size="sm"
                  color={
                    member.viewerEarnedFromMember !== "0"
                      ? "positive"
                      : "neutral"
                  }
                  showSign={member.viewerEarnedFromMember !== "0"}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {query.data && (
        <FinancialPages
          page={query.page}
          pages={query.data.pagination.totalPages}
          setPage={query.setPage}
        />
      )}
    </div>
  );
}
