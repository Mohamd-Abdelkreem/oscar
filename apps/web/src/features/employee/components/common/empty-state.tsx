import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode | undefined;
  readonly className?: string | undefined;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center ${className}`}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mb-4 max-w-sm text-sm leading-relaxed text-slate-500">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
