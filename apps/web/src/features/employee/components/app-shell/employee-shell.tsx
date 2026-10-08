import type { ReactNode } from "react";

interface EmployeeShellProps {
  readonly children: ReactNode;
  readonly showBottomNav?: boolean | undefined;
}

export function EmployeeShell({
  children,
  showBottomNav = true,
}: EmployeeShellProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-slate-100">
      {/* Container constrained for optimal reading & mobile app feel on desktop */}
      <div
        className={`relative flex min-h-dvh w-full max-w-xl flex-col border-x border-slate-200/60 bg-slate-50 shadow-sm ${
          showBottomNav ? "safe-bottom-pad" : "pb-8"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
