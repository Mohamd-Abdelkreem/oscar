import { Suspense } from "react";

import { EmployeeVerifyEmailScreen } from "@/features/employee/components/auth/verify-email-screen";

export default function EmployeeVerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400">
          جارٍ التحميل...
        </div>
      }
    >
      <EmployeeVerifyEmailScreen />
    </Suspense>
  );
}
