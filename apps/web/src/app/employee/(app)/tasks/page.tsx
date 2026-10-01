import { Suspense } from "react";

import { EmployeeTasksScreen } from "@/features/employee/components/tasks/tasks-screen";

export default function EmployeeTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400">
          جارٍ تحميل المهام...
        </div>
      }
    >
      <EmployeeTasksScreen />
    </Suspense>
  );
}
