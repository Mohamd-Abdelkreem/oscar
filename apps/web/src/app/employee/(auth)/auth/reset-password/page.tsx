import { Suspense } from "react";

import { EmployeeResetPasswordScreen } from "@/features/employee/components/auth/reset-password-screen";

export default function EmployeeResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400">
          جارٍ التحميل...
        </div>
      }
    >
      <EmployeeResetPasswordScreen />
    </Suspense>
  );
}
