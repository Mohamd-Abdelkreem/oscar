"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";

export function EmployeeRouteBoundary({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  return (
    <ProtectedRoute
      allowedRoles={["USER"]}
      preserveStateDuringCheck={pathname === "/employee/withdraw"}
    >
      {children}
    </ProtectedRoute>
  );
}
