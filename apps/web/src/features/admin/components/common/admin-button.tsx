import type { Route } from "next";
import Link from "next/link";
import type { ComponentType, MouseEventHandler, ReactNode } from "react";

export type AdminButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "destructive"
  | "ghost"
  | "warning"
  | "success";

export type AdminButtonSize = "default" | "sm" | "lg" | "icon";

interface AdminButtonBaseProps {
  readonly children?: ReactNode;
  readonly variant?: AdminButtonVariant;
  readonly size?: AdminButtonSize;
  readonly icon?: ComponentType<{
    size?: number;
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly title?: string;
  readonly "aria-label"?: string;
}

interface AdminButtonAsButtonProps extends AdminButtonBaseProps {
  readonly href?: undefined;
  readonly type?: "button" | "submit" | "reset";
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
}

interface AdminButtonAsLinkProps<
  T extends string,
> extends AdminButtonBaseProps {
  readonly href: Route<T>;
  readonly type?: undefined;
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export type AdminButtonProps<T extends string = string> =
  AdminButtonAsButtonProps | AdminButtonAsLinkProps<T>;

function isLinkButton<T extends string>(
  props: AdminButtonProps<T>,
): props is AdminButtonAsLinkProps<T> {
  return props.href !== undefined;
}

const variantStyles: Record<AdminButtonVariant, string> = {
  primary:
    "bg-emerald-700 text-white hover:bg-emerald-800 border border-emerald-700 shadow-xs active:bg-emerald-900",
  secondary:
    "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 active:bg-slate-300",
  outline:
    "bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 shadow-xs active:bg-slate-100",
  destructive:
    "bg-rose-600 text-white hover:bg-rose-700 border border-rose-600 shadow-xs active:bg-rose-800",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent active:bg-slate-200",
  warning:
    "bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 active:bg-amber-200",
  success:
    "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 active:bg-emerald-200",
};

const sizeStyles: Record<AdminButtonSize, string> = {
  lg: "min-h-[48px] px-5 py-2.5 text-base",
  default: "min-h-[44px] px-4 py-2 text-sm",
  sm: "min-h-[40px] px-3 py-1.5 text-xs sm:text-sm",
  icon: "min-h-[44px] min-w-[44px] p-2.5 text-sm justify-center",
};

export function AdminButton<T extends string>(props: AdminButtonProps<T>) {
  const {
    children,
    variant = "primary",
    size = "default",
    icon: Icon,
    loading = false,
    disabled = false,
    className = "",
    title,
    "aria-label": ariaLabel,
  } = props;

  const isDisabled = disabled || loading;
  const iconSize = size === "sm" ? 16 : size === "lg" ? 20 : 18;

  const baseClasses =
    "admin-button inline-flex flex-row items-center justify-center gap-2 rounded-lg font-bold transition-colors select-none text-center cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600";
  const stateClasses = isDisabled
    ? "opacity-60 cursor-not-allowed pointer-events-none"
    : "cursor-pointer";
  const combinedClasses = `${baseClasses} ${variantStyles[variant]} ${sizeStyles[size]} ${stateClasses} ${className}`;

  const content = (
    <span className="inline-flex max-w-full shrink-0 flex-row flex-nowrap items-center justify-center gap-2">
      {loading ? (
        <span
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : Icon ? (
        <Icon size={iconSize} className="shrink-0" aria-hidden="true" />
      ) : null}
      {children && <span className="shrink leading-snug">{children}</span>}
    </span>
  );

  if (isLinkButton(props)) {
    if (isDisabled) {
      return (
        <span
          className={combinedClasses}
          aria-disabled="true"
          {...(title !== undefined ? { title } : {})}
          {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
        >
          {content}
        </span>
      );
    }

    return (
      <Link
        href={props.href}
        className={combinedClasses}
        {...(title !== undefined ? { title } : {})}
        {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
        {...(props.onClick !== undefined ? { onClick: props.onClick } : {})}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      disabled={isDisabled}
      aria-disabled={isDisabled ? "true" : undefined}
      className={combinedClasses}
      {...(title !== undefined ? { title } : {})}
      {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
      {...(props.onClick !== undefined ? { onClick: props.onClick } : {})}
    >
      {content}
    </button>
  );
}
