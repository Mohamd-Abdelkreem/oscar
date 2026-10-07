"use client";

import { Calendar } from "lucide-react";
import { useState } from "react";
import { useTaskHistory, useOwnSubmission } from "../../hooks/tasks.hooks";
import { Button } from "../common/button";
import { TaskCard } from "./task-card";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

export function TaskHistoryList() {
  const history = useTaskHistory();
  const [selected, select] = useState<string | null>(null);
  const detail = useOwnSubmission(selected);
  const taskHistory = history.data?.items;
  if (history.isError)
    return (
      <div
        role="alert"
        className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
      >
        {history.error?.message}
        <Button
          variant="outline"
          onClick={() => {
            void history.refetch();
          }}
        >
          إعادة المحاولة
        </Button>
      </div>
    );
  if (!taskHistory)
    return (
      <div
        role="status"
        className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
      >
        جارٍ تحميل السجل...
      </div>
    );

  if (taskHistory.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        لا يوجد سجل مهام سابقة حتى الآن.
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {taskHistory.map((item) => (
          <div
            key={item.id}
            className="p-4 transition-colors hover:bg-slate-50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar size={13} aria-hidden="true" />
                  <bdi dir="ltr">{item.businessDate}</bdi>
                </div>
                <h3 className="text-sm leading-snug font-semibold text-slate-900">
                  {item.taskTitle}
                </h3>
              </div>

              <StatusBadge
                status={
                  item.status === "APPROVED"
                    ? "approved"
                    : item.status === "REJECTED"
                      ? "rejected"
                      : "pending"
                }
                size="sm"
              />
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
              <span className="text-slate-500">المكافأة المحتسبة:</span>
              <MoneyAmount
                amount={item.reward}
                size="sm"
                color={item.status === "APPROVED" ? "positive" : "neutral"}
                showSign={item.status === "APPROVED"}
              />
            </div>

            <Button
              variant="outline"
              onClick={() => {
                select(item.id);
              }}
            >
              عرض التفاصيل
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={history.page <= 1}
          onClick={() => {
            history.setPage(history.page - 1);
          }}
        >
          السابق
        </Button>
        <bdi dir="ltr">{history.page}</bdi>
        <Button
          variant="outline"
          disabled={!history.data?.pagination.hasNextPage}
          onClick={() => {
            history.setPage(history.page + 1);
          }}
        >
          التالي
        </Button>
      </div>
      {selected &&
        (detail.isError ? (
          <div role="alert">
            {detail.error?.message}
            <Button
              variant="outline"
              onClick={() => {
                void detail.refetch();
              }}
            >
              إعادة المحاولة
            </Button>
          </div>
        ) : detail.data ? (
          <TaskCard
            key={String(detail.scope.epoch) + ":" + detail.data.id}
            savedSubmission={detail.data}
          />
        ) : (
          <div role="status">جارٍ تحميل التفاصيل...</div>
        ))}
    </>
  );
}
