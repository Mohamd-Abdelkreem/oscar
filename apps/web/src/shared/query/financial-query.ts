"use client";

import { useEffect, useState } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCurrentSession,
  useSessionScope,
} from "@/features/auth/hooks/auth.hooks";
import {
  getSessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";
import {
  getApiError,
  safeApiError,
  type ApiError,
} from "@/services/api/safe-error";

export const financialQueryKey = (scope: SessionScope) =>
  ["p04", scope.accountId, scope.role, scope.epoch, scope.check] as const;
export function recheckFinancialDenial(scope: SessionScope, failure: unknown) {
  const error = getApiError(failure);
  if (
    getSessionRuntime().isCurrentCheck(scope) &&
    (error.statusCode === 401 || error.statusCode === 403)
  )
    getSessionRuntime().beginCheck();
}
export function assertFinancialScope(
  scope: SessionScope,
  role: "USER" | "ADMIN",
) {
  if (!getSessionRuntime().isCurrentCheck(scope))
    throw safeApiError("obsolete", "OBSOLETE_SCOPE");
  if (scope.accountId === null || scope.role !== role)
    throw safeApiError("denied", "FORBIDDEN", 403);
}
export function useFinancialScope(role: "USER" | "ADMIN") {
  const scope = useSessionScope();
  // Route checks own revalidation; mounting a detail panel observes that check.
  const session = useCurrentSession();
  const client = useQueryClient();
  useEffect(
    () =>
      getSessionRuntime().onRetire(() => {
        void client.cancelQueries({ queryKey: ["p04"] });
        client.removeQueries({ queryKey: ["p04"] });
      }),
    [client],
  );
  const allowed =
    !session.isPending &&
    !session.isFetching &&
    !session.isError &&
    session.data?.user.id === scope.accountId &&
    session.data.user.role === role &&
    scope.role === role;
  return { scope, allowed };
}

export function useFinancialRead<T>(options: {
  domain: string;
  role: "USER" | "ADMIN";
  selection: readonly unknown[];
  read: (scope: SessionScope, signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
}) {
  const { scope, allowed } = useFinancialScope(options.role);
  const client = useQueryClient();
  const denialIdentity = JSON.stringify([
    scope.epoch,
    scope.accountId,
    scope.role,
    options.domain,
    options.selection,
  ]);
  // Route revalidation can unmount this reader. Keep denial with its private
  // actor/domain selection so remounting cannot start another denial loop.
  const denialKey = ["p04", "denial", denialIdentity] as const;
  const denied = useQuery<ApiError | null>({
    queryKey: denialKey,
    enabled: false,
    queryFn: skipToken,
  });
  const denial = denied.data ?? undefined;
  const enabled = allowed && options.enabled !== false && denial === undefined;
  const query = useQuery({
    queryKey: [
      ...financialQueryKey(scope),
      options.domain,
      ...options.selection,
    ],
    enabled,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      assertFinancialScope(scope, options.role);
      if (!allowed) throw safeApiError("denied", "FORBIDDEN", 403);
      try {
        const response = await options.read(scope, signal);
        assertFinancialScope(scope, options.role);
        if (signal.aborted) throw safeApiError("cancelled", "CANCELLED");
        client.setQueryData(denialKey, null);
        return response;
      } catch (failure: unknown) {
        assertFinancialScope(scope, options.role);
        const error = getApiError(failure);
        if (error.statusCode === 401 || error.statusCode === 403) {
          client.setQueryData(denialKey, error);
          getSessionRuntime().beginCheck();
        }
        throw error;
      }
    },
  });
  return {
    ...query,
    data: enabled && !query.isError ? query.data : undefined,
    error: denial ?? query.error,
    isError: denial !== undefined || query.isError,
    isPending: denial === undefined && query.isPending,
    isSuccess: denial === undefined && query.isSuccess,
    allowed: enabled,
    scope,
    refetch: () => {
      client.setQueryData(denialKey, null);
      return query.refetch();
    },
  };
}

export function useFinancialList<
  T extends { pagination: { totalPages: number } },
  F extends object,
>(options: {
  domain: string;
  role: "USER" | "ADMIN";
  filters: F;
  resource?: string | null;
  read: (
    scope: SessionScope,
    query: F & { page: number; limit: number },
    signal: AbortSignal,
  ) => Promise<T>;
}) {
  const scope = useSessionScope();
  const identity = JSON.stringify([
    scope.epoch,
    scope.accountId,
    scope.role,
    options.resource,
    options.filters,
  ]);
  const [selection, select] = useState({ identity, page: 1 });
  const page = selection.identity === identity ? selection.page : 1;
  const query = useFinancialRead({
    domain: options.domain,
    role: options.role,
    selection: [options.resource, options.filters, page, 25],
    enabled: options.resource !== null,
    read: (current, signal) =>
      options.read(current, { ...options.filters, page, limit: 25 }, signal),
  });
  useEffect(() => {
    const lastPage = query.data?.pagination.totalPages;
    if (
      query.isSuccess &&
      !query.isFetching &&
      lastPage !== undefined &&
      page > Math.max(1, lastPage)
    ) {
      queueMicrotask(() => {
        if (getSessionRuntime().isCurrentCheck(scope))
          select({ identity, page: Math.max(1, lastPage) });
      });
    }
  }, [query.data, query.isSuccess, query.isFetching, page, identity, scope]);
  return {
    ...query,
    page,
    setPage: (next: number) => {
      if (
        getSessionRuntime().isCurrentCheck(scope) &&
        Number.isSafeInteger(next) &&
        next >= 1
      )
        select({ identity, page: next });
    },
  };
}
