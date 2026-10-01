"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { TaskCard } from "@/features/employee/components/tasks/task-card";
import { TaskHistoryList } from "@/features/employee/components/tasks/task-history-list";

export function EmployeeTasksScreen() {
  const searchParams = useSearchParams();
  const scenarioParam = searchParams.get("scenario");

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
          <TaskCard currentScenario={scenarioParam ?? undefined} />
        ) : (
          <TaskHistoryList />
        )}
      </div>
    </div>
  );
}
