import { Suspense } from "react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { WithdrawalForm } from "@/features/employee/components/withdraw/withdrawal-form";
import { WithdrawalStatusCard } from "@/features/employee/components/withdraw/withdrawal-status-card";

function WithdrawContent() {
  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="طلب سحب الأرباح"
        subtitle="سحب فوري إلى محفظة TRON (TRC20) المعتمدة"
        showBackButton={true}
        backHref="/employee/wallet"
      />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Withdrawal Request Form & Address setup */}
        <WithdrawalForm />

        {/* Pending Request / 72h Status & History */}
        <WithdrawalStatusCard />
      </div>
    </div>
  );
}

export default function EmployeeWithdrawPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">جارٍ تحميل صفحة السحب...</div>}>
      <WithdrawContent />
    </Suspense>
  );
}
