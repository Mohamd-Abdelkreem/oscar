"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  focusManager,
  onlineManager,
  hashKey,
  type QueryClient,
  skipToken,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
export const taskQueryKey = (scope: SessionScope) =>
  ["p05", scope.accountId, scope.role, scope.epoch, scope.check] as const;
export const depositQueryKey = (scope: SessionScope) =>
  ["p07", scope.accountId, scope.role, scope.epoch, scope.check] as const;
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
        void client.cancelQueries({ queryKey: ["p05"] });
        client.removeQueries({ queryKey: ["p05"] });
        void client.cancelQueries({ queryKey: ["p07"] });
        client.removeQueries({ queryKey: ["p07"] });
        depositWindows.delete(client);
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

type PrivateReadOptions<T> = {
  domain: string;
  role: "USER" | "ADMIN";
  selection: readonly unknown[];
  read: (scope: SessionScope, signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
  pending?: (data: NoInfer<T>) => boolean;
};
export function useFinancialRead<T>(options: PrivateReadOptions<T>) {
  return usePrivateRead("p04", options);
}
export function useTaskRead<T>(options: PrivateReadOptions<T>) {
  return usePrivateRead("p05", options);
}
export function useDepositRead<T>(options: PrivateReadOptions<T>) {
  const selection = normalizeDepositSelection(options.selection);
  const query = usePrivateRead("p07", { ...options, selection });
  const observation = useDepositObservation({
    ...options,
    selection,
    scope: query.scope,
    allowed: query.allowed,
    canRefresh: query.canRefresh,
    acceptedData: query.acceptedData,
    hasFetched: query.isFetched,
    refetch: query.refetch,
  });
  return { ...query, ...observation };
}
function usePrivateRead<T>(
  namespace: "p04" | "p05" | "p07",
  options: PrivateReadOptions<T>,
) {
  const { scope, allowed } = useFinancialScope(options.role);
  const client = useQueryClient();
  const denialIdentity = (namespace === "p07" ? hashKey : JSON.stringify)([
    scope.epoch,
    scope.accountId,
    scope.role,
    options.domain,
    options.selection,
  ]);
  // Route revalidation can unmount this reader. Keep denial with its private
  // actor/domain selection so remounting cannot start another denial loop.
  const denialKey = [namespace, "denial", denialIdentity] as const;
  const reportDenial = useCallback(
    (failure: unknown) => {
      const runtime = getSessionRuntime();
      const error = getApiError(failure);
      if (
        runtime.isCurrentCheck(scope) &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        client.setQueryData([namespace, "denial", denialIdentity], error);
        runtime.beginCheck();
      }
    },
    [client, namespace, denialIdentity, scope],
  );
  const denied = useQuery<ApiError | null>({
    queryKey: denialKey,
    enabled: false,
    queryFn: skipToken,
  });
  const denial = denied.data ?? undefined;
  const enabled = allowed && options.enabled !== false && denial === undefined;
  const query = useQuery<T, ApiError>({
    queryKey: [
      ...(namespace === "p04"
        ? financialQueryKey(scope)
        : namespace === "p05"
          ? taskQueryKey(scope)
          : depositQueryKey(scope)),
      options.domain,
      ...options.selection,
    ],
    enabled: namespace === "p07" ? false : enabled,
    ...(namespace === "p07"
      ? {
          retry: false,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        }
      : {}),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (current) =>
      namespace === "p05" &&
      enabled &&
      current.state.data !== undefined &&
      current.state.dataUpdateCount < 20 &&
      options.pending?.(current.state.data)
        ? 15_000
        : false,
    refetchIntervalInBackground: false,
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
        reportDenial(error);
        throw error;
      }
    },
  });
  return {
    ...query,
    data: enabled && !query.isError ? query.data : undefined,
    acceptedData: enabled ? query.data : undefined,
    error: denial ?? query.error,
    isError: denial !== undefined || query.isError,
    isPending: denial === undefined && query.isPending,
    isSuccess: denial === undefined && query.isSuccess,
    allowed: enabled,
    canRefresh: allowed && options.enabled !== false,
    scope,
    reportDenial,
    refetch: () => {
      client.setQueryData(denialKey, null);
      return query.refetch({ cancelRefetch: namespace !== "p07" });
    },
  };
}

// Check keys authorize each request; this separate transient window bounds
// domain observation across checks and query garbage collection.
type DepositObservationState = Readonly<{
  count: number;
  nextAt: number;
  stopped: boolean;
  busy: boolean;
}>;
type DepositWindow = ReturnType<typeof createDepositWindow>;
const depositWindows = new WeakMap<QueryClient, Map<string, DepositWindow>>();
const depositDelays = [5_000, 10_000, 20_000, 30_000, 60_000] as const;
function createDepositWindow(identity: string) {
  let snapshot: DepositObservationState = {
    count: 0,
    nextAt: 0,
    stopped: false,
    busy: false,
  };
  let pending: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: DepositObservationState) => {
    snapshot = next;
    listeners.forEach((listener) => {
      listener();
    });
  };
  const observe = (fetch: () => Promise<{ error: ApiError | null }>) => {
    if (pending !== undefined) return pending;
    publish({ ...snapshot, busy: true });
    pending = fetch()
      .then((response) => {
        const category = response.error?.category;
        if (category === "contract" || category === "denied")
          publish({ ...snapshot, stopped: true });
      })
      .finally(() => {
        const count = snapshot.count + 1;
        pending = undefined;
        publish({
          ...snapshot,
          count,
          busy: false,
          nextAt:
            Date.now() + (depositDelays[Math.min(count - 1, 4)] ?? 60_000),
        });
      });
    return pending;
  };
  return {
    identity,
    snapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    observe,
    refresh: (fetch: () => Promise<{ error: ApiError | null }>) => {
      if (pending !== undefined) return pending;
      publish({ count: 0, nextAt: 0, stopped: false, busy: false });
      return observe(fetch);
    },
  };
}
function normalizeDepositSelection(selection: readonly unknown[]) {
  return selection.map((part) => {
    if (part === null || typeof part !== "object" || Array.isArray(part))
      return part;
    return Object.fromEntries(
      Object.entries(part).map(([key, value]) => [
        key,
        key === "q" && typeof value === "string"
          ? value.trim() || undefined
          : value,
      ]),
    );
  });
}
function depositWindow(
  client: QueryClient,
  scope: SessionScope,
  options: {
    domain: string;
    role: "USER" | "ADMIN";
    selection: readonly unknown[];
  },
) {
  let windows = depositWindows.get(client);
  if (windows === undefined) {
    windows = new Map();
    depositWindows.set(client, windows);
  }
  const owner = hashKey([options.role, options.domain]);
  const identity = hashKey([
    scope.epoch,
    scope.accountId,
    scope.role,
    options.selection,
  ]);
  let window = windows.get(owner);
  if (window?.identity !== identity) {
    window = createDepositWindow(identity);
    windows.set(owner, window);
  }
  return window;
}
function subscribeDepositActivity(listener: () => void) {
  const focus = focusManager.subscribe(listener);
  const online = onlineManager.subscribe(listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    focus();
    online();
    document.removeEventListener("visibilitychange", listener);
  };
}
const depositActive = () =>
  document.visibilityState !== "hidden" &&
  focusManager.isFocused() &&
  onlineManager.isOnline();

function useDepositObservation<T>(
  options: PrivateReadOptions<T> & {
    scope: SessionScope;
    allowed: boolean;
    canRefresh: boolean;
    acceptedData: T | undefined;
    hasFetched: boolean;
    refetch: () => Promise<{ error: ApiError | null }>;
  },
) {
  const client = useQueryClient();
  const window = depositWindow(client, options.scope, options);
  const state = useSyncExternalStore(
    window.subscribe,
    window.snapshot,
    window.snapshot,
  );
  const active = useSyncExternalStore(
    subscribeDepositActivity,
    depositActive,
    () => false,
  );
  const relevant =
    !options.hasFetched ||
    (options.pending !== undefined &&
      (options.acceptedData === undefined ||
        options.pending(options.acceptedData)));
  useEffect(() => {
    if (
      !options.allowed ||
      !active ||
      state.stopped ||
      state.count >= 20 ||
      state.busy ||
      (state.count > 0 && !relevant)
    )
      return;
    const timer = setTimeout(
      () => {
        if (
          getSessionRuntime().isCurrentCheck(options.scope) &&
          depositActive()
        )
          void window.observe(options.refetch);
      },
      Math.max(0, state.nextAt - Date.now()),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [options, active, window, state, relevant]);
  return {
    observationCount: state.count,
    observationExhausted: state.count >= 20,
    refetch: () => {
      if (
        !options.canRefresh ||
        !getSessionRuntime().isCurrentCheck(options.scope)
      )
        return Promise.resolve();
      return window.refresh(options.refetch);
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
  return usePrivateList("p04", 25, options);
}

export function useTaskList<
  T extends { pagination: { totalPages: number } },
  F extends object,
>(options: {
  domain: string;
  role: "USER" | "ADMIN";
  filters: F;
  resource?: string | null;
  limit?: 10 | 25;
  read: (
    scope: SessionScope,
    query: F & { page: number; limit: number },
    signal: AbortSignal,
  ) => Promise<T>;
}) {
  return usePrivateList("p05", options.limit ?? 25, options);
}

export function useDepositList<
  T extends { pagination: { totalPages: number } },
  F extends object,
>(options: {
  domain: string;
  role: "USER" | "ADMIN";
  filters: F;
  resource?: string | null;
  limit?: 10 | 25;
  enabled?: boolean;
  pending?: (data: NoInfer<T>) => boolean;
  read: (
    scope: SessionScope,
    query: F & { page: number; limit: number },
    signal: AbortSignal,
  ) => Promise<T>;
}) {
  return usePrivateList("p07", options.limit ?? 25, options);
}

function usePrivateList<
  T extends { pagination: { totalPages: number } },
  F extends object,
>(
  namespace: "p04" | "p05" | "p07",
  limit: number,
  options: {
    domain: string;
    role: "USER" | "ADMIN";
    filters: F;
    resource?: string | null;
    enabled?: boolean;
    pending?: (data: NoInfer<T>) => boolean;
    read: (
      scope: SessionScope,
      query: F & { page: number; limit: number },
      signal: AbortSignal,
    ) => Promise<T>;
  },
) {
  const scope = useSessionScope();
  const filters =
    namespace === "p07" &&
    "q" in options.filters &&
    typeof options.filters.q === "string"
      ? { ...options.filters, q: options.filters.q.trim() || undefined }
      : options.filters;
  const identity = (namespace === "p07" ? hashKey : JSON.stringify)([
    scope.epoch,
    scope.accountId,
    scope.role,
    options.resource,
    filters,
  ]);
  const [selection, select] = useState({ identity, page: 1 });
  const page = selection.identity === identity ? selection.page : 1;
  const readOptions = {
    domain: options.domain,
    role: options.role,
    selection: [options.resource, filters, page, limit],
    enabled: options.resource !== null && options.enabled !== false,
    ...(options.pending === undefined || page !== 1
      ? {}
      : {
          pending: options.pending,
        }),
    read: (current: SessionScope, signal: AbortSignal) =>
      options.read(current, { ...filters, page, limit }, signal),
  };
  // Both hooks keep a fixed hook order; only the P07 reader owns observation.
  const privateQuery = usePrivateRead(namespace, readOptions);
  const observation = useDepositObservation({
    ...readOptions,
    scope: privateQuery.scope,
    allowed: namespace === "p07" && privateQuery.allowed,
    canRefresh: namespace === "p07" && privateQuery.canRefresh,
    acceptedData: privateQuery.acceptedData,
    hasFetched: privateQuery.isFetched,
    refetch: privateQuery.refetch,
  });
  const query =
    namespace === "p07" ? { ...privateQuery, ...observation } : privateQuery;
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
    recoverFirstPage: () => {
      if (getSessionRuntime().isCurrentCheck(scope)) {
        if (page === 1) void query.refetch();
        else select({ identity, page: 1 });
      }
    },
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
