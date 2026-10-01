import type { ReactNode } from "react";

interface AdminTableShellProps {
  readonly children: ReactNode;
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

export function AdminTableShell({
  children,
  header,
  footer,
  className = "",
}: AdminTableShellProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs ${className}`}
    >
      {header && (
        <div className="border-b border-slate-200 bg-slate-50/70 p-3 sm:p-4">
          {header}
        </div>
      )}

      <div className="admin-table-container">{children}</div>

      {footer && footer}
    </div>
  );
}
