"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { SessionLoader } from "@/components/auth/session-loader";
import { BrandMark } from "@/components/brand/brand-mark";
import { useLogout, useSession } from "@/features/auth/hooks/auth.hooks";
import { replaceWithLogin } from "@/features/auth/utils/session-navigation";
import { getApiError } from "@/services/api/api-client";

const navItems = [
  ["/dashboard", "Overview"],
  ["/settings", "Account"],
] as const;

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const logout = useLogout();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const user = session.data?.user ?? null;

  if (user === null) return <SessionLoader />;

  const signOut = (): void => {
    setLogoutError(null);

    logout.mutate(undefined, {
      onSuccess: () => {
        replaceWithLogin();
      },
      onError: (error: unknown) => {
        const apiError = getApiError(error);

        setLogoutError(
          `${apiError.message} Server sign-out could not be confirmed. Your session may still be active.`,
        );
      },
    });
  };

  return (
    <div className="workspace">
      <header className="workspace__header">
        <BrandMark />
        <nav aria-label="Workspace navigation">
          {navItems.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="workspace__identity">
          <span>{user.fullName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.fullName}</strong>
            <small>{user.role}</small>
          </div>
          <button type="button" onClick={signOut} disabled={logout.isPending}>
            {logout.isPending ? "Ending…" : "Sign out"}
          </button>
          {logoutError === null ? null : (
            <p role="alert" className="form-error">
              {logoutError}
            </p>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
