"use client";

import { Calendar } from "lucide-react";
import { useTeamCommissions } from "../../hooks/referrals.hooks";
import {
  FinancialFeedback,
  FinancialPages,
} from "../common/financial-feedback";
import { MoneyAmount } from "../common/money-amount";

export function TeamCommissionHistory() {
  const query = useTeamCommissions();
  const teamCommissions = query.data?.items ?? [];
  if (!query.data)
    return (
      <FinancialFeedback
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
    );

  if (teamCommissions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        لا توجد عمولات إحالة مسجلة حتى الآن.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {teamCommissions.map((record) => (
        <div
          key={record.decisionId}
          className="p-4 transition-colors hover:bg-slate-50"
        >
          <div className="mb-1.5 flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar size={13} aria-hidden="true" />
                <bdi dir="ltr">{record.occurredAt}</bdi>
                <span>•</span>
                <span className="font-semibold text-emerald-800">
                  المستوى {record.level} ({record.rateBps / 100}%)
                </span>
              </div>

              <h3 className="text-sm font-semibold text-slate-900">
                {record.decision === "AWARDED"
                  ? "عمولة محفوظة"
                  : "استحقاق صفري"}{" "}
                — {record.buyer.fullName}
              </h3>
            </div>

            <MoneyAmount
              amount={record.award}
              size="md"
              color="positive"
              showSign
            />
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
            <span>أساس احتساب العمولة:</span>
            <MoneyAmount
              amount={record.commissionBase}
              size="sm"
              color="neutral"
            />
          </div>
        </div>
      ))}
      <FinancialPages
        page={query.page}
        pages={query.data.pagination.totalPages}
        setPage={query.setPage}
      />
    </div>
  );
}
