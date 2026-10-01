"use client";

import { AlertCircle, Calendar } from "lucide-react";
import { useEmployeeState } from "../../context/employee-state.context";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

export function TaskHistoryList() {
  const { taskHistory } = useEmployeeState();

  if (taskHistory.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
        لا يوجد سجل مهام سابقة حتى الآن.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
      {taskHistory.map((item) => (
        <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Calendar size={13} aria-hidden="true" />
                <bdi dir="ltr">{item.date}</bdi>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                {item.title}
              </h3>
            </div>

            <StatusBadge
              status={item.status === "approved" ? "approved" : item.status === "rejected" ? "rejected" : "pending"}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">المكافأة المحتسبة:</span>
            <MoneyAmount
              amount={item.rewardAmount}
              size="sm"
              color={item.status === "approved" ? "positive" : "neutral"}
              showSign={item.status === "approved"}
            />
          </div>

          {item.status === "rejected" && item.rejectionReason && (
            <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-1.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>سبب الرفض: {item.rejectionReason}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
