"use client";

import { useTaskToday } from "../../hooks/tasks.hooks";
import { Button } from "../common/button";
import { useState } from "react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { TaskCard } from "@/features/employee/components/tasks/task-card";
import { TaskHistoryList } from "@/features/employee/components/tasks/task-history-list";

export function EmployeeTasksScreen() {
  const today = useTaskToday();

  const [activeTab, setActiveTab] = useState<"today" | "history">("today");

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="المهام اليومية"
        subtitle="نافذة التنفيذ: 12:00 - 18:00 (توقيت بغداد)"
      />

      <div className="space-y-4 p-4 sm:p-5">
        {/* Navigation Tabs: مهمة اليوم / سجل المهام */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab("today");
            }}
            className={`min-h-[44px] border-b-2 px-5 py-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
              activeTab === "today"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            مهمة اليوم
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
            }}
            className={`min-h-[44px] border-b-2 px-5 py-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            سجل المهام
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "today" ? (
          today.isError ? (
            <div
              role="alert"
              className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
            >
              {today.error?.message}
              <Button
                variant="outline"
                onClick={() => {
                  void today.refetch();
                }}
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : today.data ? (
            <TaskCard
              key={
                String(today.scope.epoch) +
                ":" +
                (today.data.task?.id ?? "today")
              }
              day={today.data}
            />
          ) : (
            <div
              role="status"
              className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
            >
              جارٍ تحميل المهمة...
            </div>
          )
        ) : (
          <TaskHistoryList />
        )}
      </div>
    </div>
  );
}
