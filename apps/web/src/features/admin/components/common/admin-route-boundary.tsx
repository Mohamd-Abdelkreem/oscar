"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminShell } from "./admin-shell";

export const isPublicAdminPath = (pathname: string) =>
  pathname === "/admin/auth/login" ||
  pathname === "/admin/auth/accept-invitation";

export function AdminRouteBoundary({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  if (isPublicAdminPath(pathname)) return children;
  return (
    <ProtectedRoute
      allowedRoles={["ADMIN"]}
      preserveStateDuringCheck={/^\/admin\/tasks\/[0-9a-f-]+\/edit$/u.test(
        pathname,
      )}
    >
      <AdminShell>{children}</AdminShell>
    </ProtectedRoute>
  );
}
