import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { WithdrawalForm } from "@/features/employee/components/withdraw/withdrawal-form";
import { WithdrawalStatusCard } from "@/features/employee/components/withdraw/withdrawal-status-card";

export function EmployeeWithdrawScreen() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="طلب سحب الأرباح"
        subtitle="سحب تلقائي مجدول إلى محفظة TRON (TRC20) المؤكدة"
        showBackButton={true}
        backHref="/employee/wallet"
      />

      <div className="space-y-4 p-4 sm:p-5">
        {/* Withdrawal Request Form & Address setup */}
        <WithdrawalForm />

        <WithdrawalStatusCard />
      </div>
    </div>
  );
}
