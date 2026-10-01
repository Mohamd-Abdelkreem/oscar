"use client";

import { Percent, Search, UserCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminSelect, type AdminSelectOption } from "../common/admin-select";
import { useAdminState } from "../../context/admin-state.context";
import type { AdminReferralMember } from "../../types/admin.types";
import {
  computeRelativeReferralHierarchy,
  type RelativeReferralNode,
} from "../../utils/referral.utils";

import { ReferralCommissionDetails } from "./referral-commission-details";
import { ReferralLevel } from "./referral-level";

export function ReferralsScreen() {
  const { referralMembers, referralCommissions, settings } = useAdminState();

  // Root member state (defaulting to محمد عبد الله usr_1001)
  const defaultRootId =
    referralMembers.find((m) => m.id === "usr_1001")?.id ??
    referralMembers[0]?.id ??
    "";
  const [selectedRootId, setSelectedRootId] = useState<string>(defaultRootId);

  // Search/Filter within the selected root's team
  const [withinTeamQuery, setWithinTeamQuery] = useState("");

  // Selected descendant for side details
  const [selectedMember, setSelectedMember] =
    useState<AdminReferralMember | null>(null);

  // Expanded levels toggles
  const [expandedLevels, setExpandedLevels] = useState<Record<number, boolean>>(
    {
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
    },
  );

  // Calculate Relative Referral Hierarchy using pure BFS utility (Requirement 12)
  const hierarchy = useMemo(() => {
    return computeRelativeReferralHierarchy(selectedRootId, referralMembers);
  }, [selectedRootId, referralMembers]);

  // Options for Root Selector
  const rootSelectOptions: readonly AdminSelectOption[] = useMemo(() => {
    return referralMembers.map((m) => ({
      value: m.id,
      label: `${m.name} (${m.id}) — ${m.packageId}`,
    }));
  }, [referralMembers]);

  const toggleLevel = (lvl: number) => {
    setExpandedLevels((prev) => ({ ...prev, [lvl]: !prev[lvl] }));
  };

  // Filter within displayed team descendants (does NOT change their relative levels)
  const filteredLevels = useMemo(() => {
    const q = withinTeamQuery.trim().toLowerCase();
    const result: Record<1 | 2 | 3 | 4 | 5, readonly RelativeReferralNode[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };

    for (let lvl = 1; lvl <= 5; lvl++) {
      const currentLevelNodes = hierarchy.levels[lvl as 1 | 2 | 3 | 4 | 5];
      if (!q) {
        result[lvl as 1 | 2 | 3 | 4 | 5] = currentLevelNodes;
      } else {
        result[lvl as 1 | 2 | 3 | 4 | 5] = currentLevelNodes.filter(
          (n) =>
            n.member.name.toLowerCase().includes(q) ||
            n.member.email.toLowerCase().includes(q) ||
            n.member.id.toLowerCase().includes(q),
        );
      }
    }

    return result;
  }, [hierarchy, withinTeamQuery]);

  const filteredTotalCount = useMemo(() => {
    return (
      filteredLevels[1].length +
      filteredLevels[2].length +
      filteredLevels[3].length +
      filteredLevels[4].length +
      filteredLevels[5].length
    );
  }, [filteredLevels]);

  // Root member's earned commissions (filtered strictly where root is beneficiary/sponsor)
  const rootCommissions = useMemo(() => {
    return referralCommissions.filter((c) => c.sponsorId === selectedRootId);
  }, [referralCommissions, selectedRootId]);

  // Selected descendant member commissions
  const selectedMemberCommissions = useMemo(() => {
    if (!selectedMember) return [];
    return referralCommissions.filter((c) => c.sponsorId === selectedMember.id);
  }, [referralCommissions, selectedMember]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="شبكة الإحالات والعمولات التراكمية"
        description="استعراض هيكل الفرق والمستويات النسبية الخمسة (L1: 12%, L2: 6%, L3: 4%, L4: 2%, L5: 2%)، ومتابعة سجلات احتساب العمولات"
        breadcrumbs={[{ label: "الإحالات والشبكة" }]}
      />

      {/* Commission Percentages Policy Bar */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Percent
              size={16}
              className="text-emerald-700"
              aria-hidden="true"
            />
            <h2 className="text-xs font-bold text-slate-900 sm:text-sm">
              نسب توزيع العمولات المعتمدة (أساس الاحتساب: شراء وترقية الباقات
              فقط)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            لا تحتسب أي عمولات على الإيداعات النقدية
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
          {settings.referralPercentages.map((pct, idx) => (
            <div
              key={idx}
              className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5"
            >
              <span className="block text-[11px] font-semibold text-slate-500">
                المستوى L{idx + 1}
              </span>
              <span className="font-mono text-base font-black text-emerald-800">
                {pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Requirement 12: Searchable Root/Person Picker & Selected Root Banner */}
      <div className="space-y-4 rounded-lg border border-emerald-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
          <div className="sm:col-span-5">
            <label
              htmlFor="root-picker"
              className="mb-1.5 block text-xs font-bold text-slate-700"
            >
              تحديد قائد الفريق / الحساب الجذر لاحتساب المستويات النسبية:
            </label>
            <AdminSelect
              id="root-picker"
              value={selectedRootId}
              onValueChange={(val) => {
                setSelectedRootId(val);
                setSelectedMember(null);
                setWithinTeamQuery("");
              }}
              options={rootSelectOptions}
              aria-label="اختر عضو لحساب فريقه"
            />
          </div>

          {/* Quick Presets for Demo (Requirement 12: محمد، أحمد، ياسمين، عمر) */}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-7 sm:pt-6">
            <span className="text-xs font-semibold text-slate-500">
              أمثلة سريعة:
            </span>
            {[
              { id: "usr_1001", label: "محمد عبد الله (الجذر 1)" },
              { id: "usr_9981", label: "أحمد مروان" },
              { id: "usr_1006", label: "ياسمين نور" },
              { id: "usr_1005", label: "عمر خالد (الجذر 2)" },
            ].map((preset) => (
              <AdminButton
                key={preset.id}
                variant={selectedRootId === preset.id ? "primary" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedRootId(preset.id);
                  setSelectedMember(null);
                  setWithinTeamQuery("");
                }}
              >
                {preset.label}
              </AdminButton>
            ))}
          </div>
        </div>

        {/* Selected Root Information Banner (Root is shown separately, NOT as L1) */}
        {hierarchy.root && (
          <div className="flex flex-col gap-3 rounded-lg border border-emerald-300 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 font-bold text-white">
                <UserCheck size={20} aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-950">
                    الحساب المختار: فريق {hierarchy.root.name}
                  </span>
                  <span className="rounded bg-emerald-200/80 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                    باقة {hierarchy.root.packageId}
                  </span>
                </div>
                <div className="text-xs text-emerald-800">
                  <span>المعرف: </span>
                  <bdi dir="ltr" className="font-mono">
                    {hierarchy.root.id}
                  </bdi>
                  <span> &bull; البريد: </span>
                  <bdi dir="ltr">{hierarchy.root.email}</bdi>
                  {hierarchy.root.sponsorName && (
                    <span>
                      {" "}
                      &bull; الكفيل السابق (Ancestor):{" "}
                      {hierarchy.root.sponsorName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-left sm:text-right">
                <span className="block text-[11px] font-semibold text-emerald-800">
                  إجمالي أعضاء الفريق النسبي
                </span>
                <span className="font-mono text-lg font-black text-emerald-950">
                  {hierarchy.totalTeamCount} عضو
                </span>
              </div>
              <Link
                href={`/admin/employees/${hierarchy.root.id}`}
                className="shrink-0 text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
              >
                ملف الحساب &larr;
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Layout: Hierarchy View & Details/Commissions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 Columns: Searchable Expandable Relative Levels */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                هيكل الفريق النسبي (L1 - L5)
              </h2>
              <p className="text-[11px] text-slate-500">
                المستويات مشتقة ديناميكياً بالنسبة للحساب المختار (
                {withinTeamQuery.trim()
                  ? `${String(filteredTotalCount)} من أصل ${String(hierarchy.totalTeamCount)}`
                  : `${String(hierarchy.totalTeamCount)} عضو`}
                )
              </p>
            </div>

            <div className="w-full sm:w-64">
              <AdminInput
                type="text"
                icon={Search}
                value={withinTeamQuery}
                onChange={(e) => {
                  setWithinTeamQuery(e.target.value);
                }}
                placeholder="تصفية أعضاء الفريق..."
                aria-label="تصفية أعضاء فريق الحساب المختار"
              />
            </div>
          </div>

          {hierarchy.totalTeamCount === 0 ? (
            <AdminEmptyState
              title="لا يوجد أعضاء في فريق هذا الحساب"
              description="هذا الحساب لم يقم بدعوة أعضاء مباشرين بعد، أو لم تتفرع منه شبكة إحالات."
            />
          ) : (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((lvlNum) => {
                const lvl = lvlNum as 1 | 2 | 3 | 4 | 5;
                const membersInLvl = filteredLevels[lvl];
                const totalInLvl = hierarchy.levelCounts[lvl] || 0;
                const isExpanded = expandedLevels[lvl];

                return (
                  <ReferralLevel
                    key={lvl}
                    lvl={lvl}
                    membersInLvl={membersInLvl}
                    totalInLvl={totalInLvl}
                    isExpanded={isExpanded}
                    withinTeamQuery={withinTeamQuery}
                    settings={settings}
                    selectedMember={selectedMember}
                    toggleLevel={toggleLevel}
                    setSelectedMember={setSelectedMember}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 Columns: Side Details & Commission Ledger */}
        <div className="space-y-4 lg:col-span-5">
          {/* Selected Member or Root Card */}
          <ReferralCommissionDetails
            selectedMember={selectedMember}
            selectedMemberCommissions={selectedMemberCommissions}
            root={hierarchy.root}
            rootCommissions={rootCommissions}
          />

          {/* Leadership Rank Draft Section */}
          <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs">
            <span className="block font-bold text-slate-700">
              الرتب القيادية (مسودة غير مفعلة)
            </span>
            <p className="text-[11px] leading-relaxed text-slate-500">
              شروط وأسماء الرتب القيادية قيد الدراسة والتحديد من قبل الإدارة. لا
              توجد قواعد ترقية أو مكافآت تلقائية مفعلة حالياً في النظام.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
