import { Suspense } from "react";

import { EmployeeWithdrawScreen } from "@/features/employee/components/withdraw/withdraw-screen";

export default function EmployeeWithdrawPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400">
          جارٍ تحميل صفحة السحب...
        </div>
      }
    >
      <EmployeeWithdrawScreen />
    </Suspense>
  );
}
