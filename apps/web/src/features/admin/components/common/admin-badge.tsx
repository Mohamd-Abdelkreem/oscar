import type { ReactNode } from "react";

export type AdminBadgeVariant =
  "success" | "warning" | "danger" | "info" | "neutral";

interface AdminBadgeProps {
  readonly children: ReactNode;
  readonly variant?: AdminBadgeVariant;
  readonly size?: "sm" | "md";
  readonly dot?: boolean;
}

const variantClasses: Record<
  AdminBadgeVariant,
  { badge: string; dot: string }
> = {
  success: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-600",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-600",
  },
  danger: {
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    dot: "bg-rose-600",
  },
  info: {
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    dot: "bg-sky-600",
  },
  neutral: {
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
  },
};

export function AdminBadge({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
}: AdminBadgeProps) {
  const styles = variantClasses[variant];
  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${styles.badge} ${sizeClass}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
