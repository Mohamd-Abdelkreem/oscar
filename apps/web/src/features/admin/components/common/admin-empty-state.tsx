import { FolderOpen } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

interface AdminEmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly icon?: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  readonly action?: ReactNode;
}

export function AdminEmptyState({
  title,
  description,
  icon: Icon = FolderOpen,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500 sm:text-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
