import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { DepositCard } from "@/features/employee/components/deposit/deposit-card";

export function EmployeeDepositScreen() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="إيداع رصيد (USDT TRC20)"
        subtitle="شحن الرصيد المالي لتفعيل الباقات أو الترقية"
        showBackButton={true}
        backHref="/employee/wallet"
      />

      <div className="p-4 sm:p-5">
        <DepositCard />
      </div>
    </div>
  );
}
