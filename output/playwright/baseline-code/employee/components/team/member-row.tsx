"use client";

import { useState } from "react";
import { useEmployeeState } from "../../context/employee-state.context";
import { MoneyAmount } from "../common/money-amount";

export function TeamMemberList() {
  const { teamMembers } = useEmployeeState();
  const [selectedLevel, setSelectedLevel] = useState<number | "all">("all");

  const levels = ["all", 1, 2, 3, 4, 5] as const;

  const filteredMembers = teamMembers.filter((m) => {
    if (selectedLevel === "all") return true;
    return m.level === selectedLevel;
  });

  return (
    <div className="space-y-3">
      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {levels.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => { setSelectedLevel(lvl); }}
            className={`min-h-[44px] px-3.5 py-1.5 text-xs font-semibold rounded-md border transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600 ${
              selectedLevel === lvl
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {lvl === "all" ? "جميع المستويات" : "المستوى " + lvl.toString()}
          </button>
        ))}
      </div>

      {/* Member Cards / Rows */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          لا يوجد أعضاء مسجلين في هذا المستوى حالياً.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0 text-sm">
                  {member.name.slice(0, 1)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {member.name}
                    </h3>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      L{member.level.toString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    انضم: <bdi dir="ltr">{member.joinedAt}</bdi> • باقة: {member.packageId}
                  </p>
                </div>
              </div>

              <div className="text-left shrink-0">
                <span className="text-[11px] text-slate-400 block mb-0.5">عمولات محققة</span>
                <MoneyAmount
                  amount={member.totalCommissionEarned}
                  size="sm"
                  color={member.totalCommissionEarned > 0 ? "positive" : "neutral"}
                  showSign={member.totalCommissionEarned > 0}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
