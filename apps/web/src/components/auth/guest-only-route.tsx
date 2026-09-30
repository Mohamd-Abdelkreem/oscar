"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSession } from "@/features/auth/hooks/auth.hooks";
import { getApiError } from "@/services/api/api-client";

import { SessionLoader } from "./session-loader";

type SessionSnapshot = Readonly<{
  isPending: boolean;
  isFetched: boolean;
  isError: boolean;
}>;

export type GuestOnlyRouteState =
  | { readonly kind: "pending" }
  | { readonly kind: "error" }
  | { readonly kind: "redirecting"; readonly target: string }
  | { readonly kind: "authorized" };

export const resolveGuestOnlyRouteState = (
  session: SessionSnapshot,
  account: ReturnType<typeof useSession>["data"] | null,
): GuestOnlyRouteState => {
  if (session.isPending || !session.isFetched) return { kind: "pending" };
  if (session.isError) return { kind: "error" };
  if (account === null || account === undefined) return { kind: "authorized" };
  if (
    account.user.status !== "ACTIVE" ||
    account.user.emailVerifiedAt === null
  ) {
    return { kind: "authorized" };
  }
  return { kind: "redirecting", target: "/dashboard" };
};

export function GuestOnlyRoute({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const session = useSession();
  const state = resolveGuestOnlyRouteState(session, session.data ?? null);
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
