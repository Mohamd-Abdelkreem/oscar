import type { ReactNode } from "react";
import { EmployeeShell } from "@/features/employee/components/app-shell/employee-shell";
import { BottomNavigation } from "@/features/employee/components/navigation/bottom-navigation";

interface AppSubtreeLayoutProps {
  readonly children: ReactNode;
}

export default function AppSubtreeLayout({ children }: AppSubtreeLayoutProps) {
  return (
    <EmployeeShell showBottomNav={true}>
      <div className="flex-1 flex flex-col">{children}</div>
      <BottomNavigation />
    </EmployeeShell>
  );
}
