"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useLogin, useRouteSession } from "@/features/auth/hooks/auth.hooks";
import { roleHomePath } from "@/features/auth/utils/session-navigation";
import type { UserRole } from "@template/contracts";
import { getApiError } from "@/services/api/api-client";

import { SessionLoader } from "./session-loader";

type SessionSnapshot = Readonly<{
  isPending: boolean;
  isFetched: boolean;
  isError: boolean;
  isFetching?: boolean;
}>;

export type GuestOnlyRouteState =
  | { readonly kind: "pending" }
  | { readonly kind: "error" }
  | { readonly kind: "redirecting"; readonly target: Route }
  | { readonly kind: "authorized" };

export const resolveGuestOnlyRouteState = (
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
): GuestOnlyRouteState => {
  if (session.isPending || session.isFetching || !session.isFetched)
    return { kind: "pending" };
  if (session.isError) return { kind: "error" };
  if (account === null || account === undefined) return { kind: "authorized" };
  if (
    account.user.status !== "ACTIVE" ||
    account.user.emailVerifiedAt === null
  ) {
    return { kind: "authorized" };
  }
  return { kind: "redirecting", target: roleHomePath(account.user.role) };
};

export function GuestOnlyRoute({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const session = useRouteSession(usePathname());
  const login = useLogin();
  const state = resolveGuestOnlyRouteState(session, session.data ?? null);
  // The public form owns its pending/error credential flow; authority retirement must not dismiss it.
  const ownsLoginFlow =
    login.isPending || (login.isError && session.data == null);
  const redirectTarget =
    !ownsLoginFlow && state.kind === "redirecting" ? state.target : null;

  useEffect(() => {
    if (redirectTarget !== null) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (ownsLoginFlow) return children;
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
            session.refetch();
          }}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return state.kind === "authorized" ? children : <SessionLoader />;
}
