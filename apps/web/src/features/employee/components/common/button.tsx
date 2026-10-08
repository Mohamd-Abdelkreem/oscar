"use client";

import type { Route } from "next";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  ComponentType,
  MouseEvent,
  ReactNode,
} from "react";

export type ButtonVariant =
  "primary" | "dark" | "outline" | "ghost" | "destructive" | "white";

export type ButtonSize = "default" | "compact";

export interface BaseButtonOptions {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly fullWidth?: boolean;
  readonly className?: string;
}

export function getButtonClassName({
  variant = "primary",
  size = "default",
  fullWidth = false,
  className = "",
}: BaseButtonOptions): string {
  const parts = ["emp-btn"];

  if (size === "compact") {
    parts.push("emp-btn--compact");
  } else {
    parts.push("emp-btn--default");
  }

  parts.push(`emp-btn--${variant}`);

  if (fullWidth) {
    parts.push("emp-btn--full");
  }

  if (className.length > 0) {
    parts.push(className);
  }

  return parts.join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly fullWidth?: boolean;
  readonly loading?: boolean;
  readonly icon?: ComponentType<{ size?: number; className?: string }>;
  readonly trailingIcon?: ComponentType<{ size?: number; className?: string }>;
  readonly children: ReactNode;
}

export function Button({
  type = "button",
  variant = "primary",
  size = "default",
  fullWidth = false,
  loading = false,
  disabled = false,
  icon: Icon,
  trailingIcon: TrailingIcon,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const buttonClass = getButtonClassName({
    variant,
    size,
    fullWidth,
    className,
  });
  const iconSize = size === "compact" ? 16 : 18;

  return (
    <button
      type={type}
      className={buttonClass}
      disabled={isDisabled}
      aria-busy={loading}
      aria-disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <Loader2
          size={iconSize}
          className="shrink-0 animate-spin text-current"
          aria-hidden="true"
        />
      ) : Icon ? (
        <Icon size={iconSize} className="shrink-0" aria-hidden="true" />
      ) : null}

      <span className="truncate">{children}</span>

      {!loading && TrailingIcon && (
        <TrailingIcon size={iconSize} className="shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}

export interface ButtonLinkProps {
  readonly href: Route;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly fullWidth?: boolean;
  readonly disabled?: boolean;
  readonly icon?: ComponentType<{ size?: number; className?: string }>;
  readonly trailingIcon?: ComponentType<{ size?: number; className?: string }>;
  readonly children: ReactNode;
  readonly className?: string;
  readonly onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  readonly ariaLabel?: string;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "default",
  fullWidth = false,
  disabled = false,
  icon: Icon,
  trailingIcon: TrailingIcon,
  children,
  className = "",
  onClick,
  ariaLabel,
}: ButtonLinkProps) {
  const linkClass = getButtonClassName({ variant, size, fullWidth, className });
  const iconSize = size === "compact" ? 16 : 18;

  if (disabled) {
    return (
      <span
        className={linkClass}
        aria-disabled="true"
        role="link"
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      >
        {Icon && (
          <Icon size={iconSize} className="shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{children}</span>
        {TrailingIcon && (
          <TrailingIcon
            size={iconSize}
            className="shrink-0"
            aria-hidden="true"
          />
        )}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={linkClass}
      {...(onClick ? { onClick } : {})}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
    >
      {Icon && <Icon size={iconSize} className="shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
      {TrailingIcon && (
        <TrailingIcon size={iconSize} className="shrink-0" aria-hidden="true" />
      )}
    </Link>
  );
}
