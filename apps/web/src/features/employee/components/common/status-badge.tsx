import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lock,
  RefreshCcw,
  XCircle,
} from "lucide-react";

export type BadgeVariant =
  | "completed"
  | "confirmed"
  | "approved"
  | "pending"
  | "verifying"
  | "rejected"
  | "reversed"
  | "active"
  | "inactive"
  | "free"
  | "locked";

interface StatusBadgeProps {
  readonly status: BadgeVariant;
  readonly label?: string | undefined;
  readonly size?: "sm" | "md" | undefined;
}

export function StatusBadge({ status, label, size = "md" }: StatusBadgeProps) {
  const configs: Record<
    BadgeVariant,
    {
      readonly text: string;
      readonly icon: typeof CheckCircle2;
      readonly bg: string;
      readonly textCol: string;
      readonly border: string;
    }
  > = {
    completed: {
      text: "مكتمل",
      icon: CheckCircle2,
      bg: "bg-emerald-50",
      textCol: "text-emerald-800",
      border: "border-emerald-200",
    },
    confirmed: {
      text: "مؤكد",
      icon: CheckCircle2,
      bg: "bg-emerald-50",
      textCol: "text-emerald-800",
      border: "border-emerald-200",
    },
    approved: {
      text: "معتمد ومقبول",
      icon: CheckCircle2,
      bg: "bg-emerald-50",
      textCol: "text-emerald-800",
      border: "border-emerald-200",
    },
    active: {
      text: "نشط",
      icon: CheckCircle2,
      bg: "bg-emerald-50",
      textCol: "text-emerald-800",
      border: "border-emerald-200",
    },
    pending: {
      text: "قيد المراجعة",
      icon: Clock,
      bg: "bg-amber-50",
      textCol: "text-amber-800",
      border: "border-amber-200",
    },
    verifying: {
      text: "قيد التحقق",
      icon: Clock,
      bg: "bg-amber-50",
      textCol: "text-amber-800",
      border: "border-amber-200",
    },
    rejected: {
      text: "مرفوض",
      icon: XCircle,
      bg: "bg-rose-50",
      textCol: "text-rose-800",
      border: "border-rose-200",
    },
    reversed: {
      text: "مسترجع للمتاح",
      icon: RefreshCcw,
      bg: "bg-slate-100",
      textCol: "text-slate-700",
      border: "border-slate-200",
    },
    inactive: {
      text: "غير مفعل",
      icon: AlertCircle,
      bg: "bg-slate-100",
      textCol: "text-slate-600",
      border: "border-slate-200",
    },
    free: {
      text: "مجاني",
      icon: HelpCircle,
      bg: "bg-slate-100",
      textCol: "text-slate-700",
      border: "border-slate-200",
    },
    locked: {
      text: "مغلق / محجوز",
      icon: Lock,
      bg: "bg-slate-100",
      textCol: "text-slate-700",
      border: "border-slate-200",
    },
  };

  const config = configs[status];
  const Icon = config.icon;
  const displayText = label ?? config.text;

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-xs gap-1"
      : "px-2.5 py-1 text-xs sm:text-sm gap-1.5";
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${config.bg} ${config.textCol} ${config.border} ${sizeClasses}`}
    >
      <Icon size={iconSize} className="shrink-0" aria-hidden="true" />
      <span>{displayText}</span>
    </span>
  );
}
