import type { ReactNode } from "react";
import { EmployeeShell } from "@/features/employee/components/app-shell/employee-shell";
import { BottomNavigation } from "@/features/employee/components/navigation/bottom-navigation";
import { EmployeeRouteBoundary } from "@/features/employee/components/app-shell/employee-route-boundary";
import { WithdrawalDestinationBoundary } from "@/features/employee/components/withdraw/withdrawal-destination-boundary";

interface AppSubtreeLayoutProps {
  readonly children: ReactNode;
}

export default function AppSubtreeLayout({ children }: AppSubtreeLayoutProps) {
  return (
    <WithdrawalDestinationBoundary>
      <EmployeeRouteBoundary>
        <EmployeeShell showBottomNav={true}>
          <div className="flex flex-1 flex-col">{children}</div>
          <BottomNavigation />
        </EmployeeShell>
      </EmployeeRouteBoundary>
    </WithdrawalDestinationBoundary>
  );
}
