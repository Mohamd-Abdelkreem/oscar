"use client";

import { Calendar } from "lucide-react";
import { useEmployeeState } from "../../context/employee-state.context";
import { MoneyAmount } from "../common/money-amount";

export function TeamCommissionHistory() {
  const { teamCommissions } = useEmployeeState();

  if (teamCommissions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
        لا توجد عمولات إحالة مسجلة حتى الآن.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden">
      {teamCommissions.map((record) => (
        <div key={record.id} className="p-4 hover:bg-slate-50 transition-colors">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Calendar size={13} aria-hidden="true" />
                <bdi dir="ltr">{record.date}</bdi>
                <span>•</span>
                <span className="font-semibold text-emerald-800">
                  المستوى {record.level} ({(record.rate * 100).toFixed(0)}%)
                </span>
              </div>

              <h3 className="text-sm font-semibold text-slate-900">
                {record.event} — {record.memberName}
              </h3>
            </div>

            <MoneyAmount
              amount={record.commissionAmount}
              size="md"
              color="positive"
              showSign
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>أساس احتساب العمولة:</span>
            <MoneyAmount amount={record.calculationBasis} size="sm" color="neutral" />
          </div>
        </div>
      ))}
    </div>
  );
}
