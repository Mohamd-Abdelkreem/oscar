"use client";

import { useState } from "react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { TeamMemberList } from "@/features/employee/components/team/member-row";
import { TeamCommissionHistory } from "@/features/employee/components/team/team-commission-history";
import { TeamStats } from "@/features/employee/components/team/team-stats";

export default function EmployeeTeamPage() {
  const [activeTab, setActiveTab] = useState<"stats" | "members" | "commissions">("stats");

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="الفريق والإحالات"
        subtitle="إدارة شبكة الإحالة وعمولات الترقية حتى المستوى الخامس"
      />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => { setActiveTab("stats"); }}
            className={`min-h-[44px] px-4 py-2.5 font-bold text-sm border-b-2 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600 ${
              activeTab === "stats"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            نظرة عامة والنسب
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("members"); }}
            className={`min-h-[44px] px-4 py-2.5 font-bold text-sm border-b-2 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600 ${
              activeTab === "members"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            أعضاء الفريق (L1 - L5)
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("commissions"); }}
            className={`min-h-[44px] px-4 py-2.5 font-bold text-sm border-b-2 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600 ${
              activeTab === "commissions"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            سجل العمولات
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "stats" && <TeamStats />}
        {activeTab === "members" && <TeamMemberList />}
        {activeTab === "commissions" && <TeamCommissionHistory />}
      </div>
    </div>
  );
}
