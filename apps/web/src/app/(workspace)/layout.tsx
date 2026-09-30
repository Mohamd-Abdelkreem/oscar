import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <WorkspaceShell>{children}</WorkspaceShell>
    </ProtectedRoute>
  );
}
