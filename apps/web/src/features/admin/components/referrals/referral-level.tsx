"use client";

import { ChevronDown, ChevronLeft, GitFork } from "lucide-react";
import type { AdminReferralMember } from "../../types/admin.types";
import type { RelativeReferralNode } from "../../utils/referral.utils";
import type { AdminSystemSettings } from "../../types/admin.types";

export function ReferralLevel({
  lvl,
  membersInLvl,
  totalInLvl,
  isExpanded,
  withinTeamQuery,
  settings,
  selectedMember,
  toggleLevel,
  setSelectedMember,
}: {
  readonly lvl: 1 | 2 | 3 | 4 | 5;
  readonly membersInLvl: readonly RelativeReferralNode[];
  readonly totalInLvl: number;
  readonly isExpanded: boolean | undefined;
  readonly withinTeamQuery: string;
  readonly settings: AdminSystemSettings;
  readonly selectedMember: AdminReferralMember | null;
  readonly toggleLevel: (level: number) => void;
  readonly setSelectedMember: (member: AdminReferralMember) => void;
}) {
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
            المستوى {lvl} (نسبة العمولة: {settings.referralPercentages[lvl - 1]}
            %)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">
            {withinTeamQuery.trim()
              ? `${String(membersInLvl.length)} من ${String(totalInLvl)} أعضاء`
              : `${String(totalInLvl)} أعضاء`}
          </span>
          {isExpanded ? (
            <ChevronDown
              size={16}
              className="text-slate-400"
              aria-hidden="true"
            />
          ) : (
            <ChevronLeft
              size={16}
              className="text-slate-400"
              aria-hidden="true"
            />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white">
          {membersInLvl.length === 0 ? (
            <p className="p-3 text-center text-xs text-slate-400">
              لا يوجد أعضاء في هذا المستوى يطابقون معايير التصفية.
            </p>
          ) : (
            membersInLvl.map((node) => {
              const isSelected = selectedMember?.id === node.member.id;

              return (
                <div
                  key={node.member.id}
                  onClick={() => {
                    setSelectedMember(node.member);
                  }}
                  className={`flex cursor-pointer items-center justify-between p-3.5 text-xs transition-colors ${
                    isSelected
                      ? "border-r-4 border-emerald-700 bg-emerald-50/80 font-bold"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {node.member.name}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                        {node.member.packageId}
                      </span>
                      {node.member.status === "inactive" && (
                        <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          معلق
                        </span>
                      )}
                    </div>

                    {/* Ancestry Chain Path View (Requirement 12) */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <GitFork size={12} className="shrink-0 text-slate-400" />
                      <span>المسار: </span>
                      {node.path.map((step, sIdx) => (
                        <span key={step.id} className="flex items-center gap-1">
                          <span className="font-medium text-slate-700">
                            {step.name}
                          </span>
                          {sIdx < node.path.length - 1 && (
                            <span className="text-slate-300">&larr;</span>
                          )}
                        </span>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-500">
                      <span>المعرف: </span>
                      <bdi dir="ltr" className="font-mono">
                        {node.member.id}
                      </bdi>
                      <span> &bull; </span>
                      <bdi dir="ltr">{node.member.email}</bdi>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2 text-left">
                    <div
                      className="font-mono font-bold text-emerald-800"
                      dir="ltr"
                    >
                      {node.member.totalCommissionEarned.toFixed(2)} USDT
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {node.directChildrenCount} إحالات مباشرة
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
