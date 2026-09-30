"use client";

import type { UserRole } from "@template/contracts";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSession } from "@/features/auth/hooks/auth.hooks";
import { sanitizeReturnPath } from "@/features/auth/utils/safe-return-path";
import { getApiError } from "@/services/api/api-client";

import { SessionLoader } from "./session-loader";

type SessionSnapshot = Readonly<{
  isPending: boolean;
  isFetched: boolean;
  isError: boolean;
}>;

export type ProtectedRouteState =
  | { readonly kind: "pending" }
  | { readonly kind: "error" }
  | { readonly kind: "redirecting"; readonly target: string }
  | { readonly kind: "authorized" };

export const resolveProtectedRouteState = (
  session: SessionSnapshot,
  account: ReturnType<typeof useSession>["data"] | null,
  returnTo: string,
  allowedRoles: readonly UserRole[] | undefined,
): ProtectedRouteState => {
  if (session.isPending || !session.isFetched) return { kind: "pending" };
  if (session.isError) return { kind: "error" };
  if (account === null || account === undefined) {
    const safe = sanitizeReturnPath(returnTo);
    return {
      kind: "redirecting",
      target:
        safe === null
          ? "/auth/login"
          : `/auth/login?returnTo=${encodeURIComponent(safe)}`,
    };
  }
  if (
    account.user.status !== "ACTIVE" ||
    account.user.emailVerifiedAt === null
  ) {
    return { kind: "redirecting", target: "/auth/verify-email" };
  }
  if (allowedRoles !== undefined && !allowedRoles.includes(account.user.role)) {
    return { kind: "redirecting", target: "/dashboard" };
  }
  return { kind: "authorized" };
};

export function ProtectedRoute({
  allowedRoles,
  children,
}: Readonly<{
  allowedRoles?: readonly UserRole[];
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const state = resolveProtectedRouteState(
    session,
    session.data ?? null,
    pathname,
    allowedRoles,
  );
  const redirectTarget = state.kind === "redirecting" ? state.target : null;

  useEffect(() => {
    if (redirectTarget !== null) router.replace(redirectTarget as Route);
  }, [redirectTarget, router]);

  if (state.kind === "error") {
    const error = getApiError(session.error);
    return (
      <div className="route-state">
        <p className="form-notice form-notice--error" role="alert">
          {error.message}
        </p>
        {error.requestId.length === 0 ? null : (
          <small>Request ID: {error.requestId}</small>
        )}
        <button
          className="button"
          type="button"
          onClick={() => {
            void session.refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return state.kind === "authorized" ? children : <SessionLoader />;
}
