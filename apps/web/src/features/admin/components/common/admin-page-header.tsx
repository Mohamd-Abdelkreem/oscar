import type { ReactNode } from "react";
import { AdminBreadcrumbs, type BreadcrumbItem } from "./admin-breadcrumbs";

interface AdminPageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly breadcrumbs?: readonly BreadcrumbItem[];
}

export function AdminPageHeader({
  title,
  description,
  action,
  breadcrumbs,
}: AdminPageHeaderProps) {
  return (
    <div className="mb-6 space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <AdminBreadcrumbs items={breadcrumbs} />
      )}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-[26px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              {description}
            </p>
          )}
        </div>

        {action && (
          <div className="flex shrink-0 items-center gap-2.5">{action}</div>
        )}
      </div>
    </div>
  );
}
