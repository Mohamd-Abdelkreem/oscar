"use client";

import type { UserRole } from "@template/contracts";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { Activity, useEffect, useState, type ReactNode } from "react";

import {
  useRouteSession,
  useSessionScope,
} from "@/features/auth/hooks/auth.hooks";
import { roleHomePath } from "@/features/auth/utils/session-navigation";
import { sanitizeReturnPath } from "@/features/auth/utils/safe-return-path";
import { getApiError } from "@/services/api/api-client";

import { SessionLoader } from "./session-loader";

type SessionSnapshot = Readonly<{
  isPending: boolean;
  isFetched: boolean;
  isError: boolean;
  isFetching?: boolean;
}>;

export type ProtectedRouteState =
  | { readonly kind: "pending" }
  | { readonly kind: "error" }
  | { readonly kind: "redirecting"; readonly target: Route }
  | { readonly kind: "authorized" };

export const resolveProtectedRouteState = (
  session: SessionSnapshot,
  account:
    | {
        user: {
          status: string;
          emailVerifiedAt: string | null;
          role: UserRole;
        };
      }
    | null
    | undefined,
  returnTo: string,
  allowedRoles: readonly UserRole[] | undefined,
): ProtectedRouteState => {
  if (session.isPending || session.isFetching || !session.isFetched)
    return { kind: "pending" };
  if (session.isError) return { kind: "error" };
  if (account === null || account === undefined) {
    const safe = sanitizeReturnPath(
      returnTo,
      allowedRoles?.length === 1 ? allowedRoles[0] : undefined,
    );
    const login = allowedRoles?.includes("USER")
      ? "/employee/auth/login"
      : returnTo.startsWith("/admin")
        ? "/admin/auth/login"
        : "/auth/login";
    return {
      kind: "redirecting",
      target: (safe === null
        ? login
        : `${login}?returnTo=${encodeURIComponent(safe)}`) as Route,
    };
  }
  if (
    account.user.status !== "ACTIVE" ||
    account.user.emailVerifiedAt === null
  ) {
    return { kind: "redirecting", target: "/auth/login" };
  }
  if (allowedRoles !== undefined && !allowedRoles.includes(account.user.role)) {
    return { kind: "redirecting", target: roleHomePath(account.user.role) };
  }
  return { kind: "authorized" };
};

export function ProtectedRoute({
  allowedRoles,
  children,
  preserveStateDuringCheck = false,
}: Readonly<{
  allowedRoles?: readonly UserRole[];
  children: ReactNode;
  preserveStateDuringCheck?: boolean;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useRouteSession(pathname);
  const scope = useSessionScope();
  const state = resolveProtectedRouteState(
    session,
    session.data ?? null,
    pathname,
    allowedRoles,
  );
  const redirectTarget = state.kind === "redirecting" ? state.target : null;
  const identity = JSON.stringify([
    scope.epoch,
    scope.accountId,
    scope.role,
    pathname,
  ]);
  const [authorizedIdentity, setAuthorizedIdentity] = useState<string | null>(
    null,
  );
  const failure = state.kind === "error" ? getApiError(session.error) : null;
  const terminalDenial =
    state.kind === "redirecting" ||
    (failure !== null && failure.category !== "transient");
  if (
    preserveStateDuringCheck &&
    state.kind === "authorized" &&
    authorizedIdentity !== identity
  )
    setAuthorizedIdentity(identity);
  else if (terminalDenial && authorizedIdentity !== null)
    setAuthorizedIdentity(null);

  useEffect(() => {
    if (redirectTarget !== null) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  const fallback = failure ? (
    <div className="route-state">
      <p className="form-notice form-notice--error" role="alert">
        {failure.message}
      </p>
      {failure.requestId.length === 0 ? null : (
        <small>Request ID: {failure.requestId}</small>
      )}
      <button
        className="button"
        type="button"
        onClick={() => {
          session.refetch();
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  ) : (
    <SessionLoader />
  );

  if (preserveStateDuringCheck) {
    const retain =
      state.kind === "authorized" ||
      (authorizedIdentity === identity && !terminalDenial);
    return (
      <>
        {retain && (
          <Activity mode={state.kind === "authorized" ? "visible" : "hidden"}>
            {children}
          </Activity>
        )}
        {state.kind !== "authorized" && fallback}
      </>
    );
  }

  return state.kind === "authorized" ? children : fallback;
}
