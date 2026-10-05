"use client";

import { Percent, Search, UserCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminSelect, type AdminSelectOption } from "../common/admin-select";
import type { AdminMember } from "@template/contracts";
import {
  useReferralRoots,
  useReferralSummary,
} from "../../hooks/referrals.hooks";
import { FinancialFeedback } from "@/features/employee/components/common/financial-feedback";
import { AdminPagination } from "../common/admin-pagination";

import { ReferralCommissionDetails } from "./referral-commission-details";
import { ReferralLevel } from "./referral-level";

export function ReferralsScreen() {
  const [rootQuery, setRootQuery] = useState("");
  const roots = useReferralRoots(rootQuery.trim());
  const [rootSelection, setRootSelection] = useState<{
    id: string;
    actor: string;
  } | null>(null);
  const actor = JSON.stringify([
    roots.scope.accountId,
    roots.scope.role,
    roots.scope.epoch,
  ]);
  const selectedRootId = rootSelection?.actor === actor ? rootSelection.id : "";
  const summary = useReferralSummary(selectedRootId || null);
  const [withinTeamQuery, setWithinTeamQuery] = useState("");
  const identity = JSON.stringify([
    roots.scope,
    selectedRootId,
    withinTeamQuery,
  ]);
  const [memberSelection, setMemberSelection] = useState<{
    member: AdminMember;
    identity: string;
  } | null>(null);
  const selectedMember =
    memberSelection?.identity === identity && summary.allowed
      ? memberSelection.member
      : null;
  const setSelectedMember = (member: AdminMember | null) => {
    setMemberSelection(member ? { member, identity } : null);
  };
  const setSelectedRootId = (id: string) => {
    if (roots.allowed) setRootSelection({ id, actor });
  };
  const [expandedLevels, setExpandedLevels] = useState<Record<number, boolean>>(
    { 1: true, 2: true, 3: true, 4: true, 5: true },
  );
  const toggleLevel = (level: number) => {
    setExpandedLevels((previous) => ({
      ...previous,
      [level]: !previous[level],
    }));
  };
  const rootSelectOptions: readonly AdminSelectOption[] = [
    ...(roots.data?.items.map((root) => ({
      value: root.id,
      label: root.fullName + " (" + root.email + ")",
    })) ?? []),
  ];
  const totalTeamCount = summary.data?.levelCounts.reduce(
    (total, count) => total + count.members,
    0,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="شبكة الإحالات والعمولات التراكمية"
        description="استعراض هيكل الفرق والمستويات النسبية الخمسة ومتابعة النسب الحالية والعمولات المحفوظة"
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
          {(summary.data?.currentRates.ratesBps ?? []).map((pct, idx) => (
            <div
              key={idx}
              className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5"
            >
              <span className="block text-[11px] font-semibold text-slate-500">
                المستوى L{idx + 1}
              </span>
              <span className="font-mono text-base font-black text-emerald-800">
                {pct / 100}%
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

          <div className="sm:col-span-7 sm:pt-6">
            <AdminInput
              icon={Search}
              value={rootQuery}
              maxLength={200}
              onChange={(event) => {
                setRootQuery(event.target.value);
              }}
              aria-label="بحث عن الحساب الجذر"
              placeholder="بحث عن الحساب الجذر..."
            />
            <FinancialFeedback
              pending={roots.isPending}
              error={roots.error}
              retry={roots.refetch}
            />
            {roots.data && (
              <AdminPagination
                currentPage={roots.page}
                totalPages={roots.data.pagination.totalPages}
                totalItems={roots.data.pagination.total}
                pageSize={25}
                onPageChange={roots.setPage}
              />
            )}
          </div>
        </div>

        {/* Selected Root Information Banner (Root is shown separately, NOT as L1) */}
        {summary.data?.root && (
          <div className="flex flex-col gap-3 rounded-lg border border-emerald-300 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 font-bold text-white">
                <UserCheck size={20} aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-950">
                    الحساب المختار: فريق {summary.data.root.fullName}
                  </span>
                </div>
                <div className="text-xs text-emerald-800">
                  <span>المعرف: </span>
                  <bdi dir="ltr" className="font-mono">
                    {summary.data.root.id}
                  </bdi>
                  <span> &bull; البريد: </span>
                  <bdi dir="ltr">{summary.data.root.email}</bdi>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-left sm:text-right">
                <span className="block text-[11px] font-semibold text-emerald-800">
                  إجمالي أعضاء الفريق النسبي
                </span>
                <span className="font-mono text-lg font-black text-emerald-950">
                  {totalTeamCount} عضو
                </span>
              </div>
              <Link
                href={`/admin/employees/${summary.data.root.id}`}
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
                {totalTeamCount ?? "—"} عضو )
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

          <FinancialFeedback
            pending={selectedRootId !== "" && summary.isPending}
            error={summary.error}
            retry={summary.refetch}
          />
          {summary.data && totalTeamCount === 0 ? (
            <AdminEmptyState
              title="لا يوجد أعضاء في فريق هذا الحساب"
              description="هذا الحساب لم يقم بدعوة أعضاء مباشرين بعد، أو لم تتفرع منه شبكة إحالات."
            />
          ) : (
            <div className="space-y-3">
              {summary.data &&
                ([1, 2, 3, 4, 5] as const).map((level) => (
                  <ReferralLevel
                    key={`${String(level)}${identity}`}
                    lvl={level}
                    rootId={selectedRootId}
                    totalInLvl={
                      summary.data?.levelCounts[level - 1]?.members ?? 0
                    }
                    rateBps={
                      summary.data?.currentRates.ratesBps[level - 1] ?? 0
                    }
                    isExpanded={expandedLevels[level]}
                    withinTeamQuery={withinTeamQuery.trim()}
                    selectedMember={selectedMember}
                    toggleLevel={toggleLevel}
                    setSelectedMember={setSelectedMember}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Right 5 Columns: Side Details & Commission Ledger */}
        <div className="space-y-4 lg:col-span-5">
          {/* Selected Member or Root Card */}
          <ReferralCommissionDetails
            key={identity}
            selectedMember={selectedMember}
            rootId={summary.data ? selectedRootId : null}
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
