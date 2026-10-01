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
    <div className="min-h-dvh bg-slate-100 flex flex-col items-center">
      {/* Container constrained for optimal reading & mobile app feel on desktop */}
      <div
        className={`w-full max-w-xl min-h-dvh bg-slate-50 flex flex-col shadow-sm border-x border-slate-200/60 relative ${
          showBottomNav ? "safe-bottom-pad" : "pb-8"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
