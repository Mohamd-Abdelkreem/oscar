import type { ReactNode } from "react";
import { EmployeeShell } from "@/features/employee/components/app-shell/employee-shell";
import { BottomNavigation } from "@/features/employee/components/navigation/bottom-navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";

interface AppSubtreeLayoutProps {
  readonly children: ReactNode;
}

export default function AppSubtreeLayout({ children }: AppSubtreeLayoutProps) {
  return (
    <ProtectedRoute allowedRoles={["USER"]}>
      <EmployeeShell showBottomNav={true}>
        <div className="flex flex-1 flex-col">{children}</div>
        <BottomNavigation />
      </EmployeeShell>
    </ProtectedRoute>
  );
}
