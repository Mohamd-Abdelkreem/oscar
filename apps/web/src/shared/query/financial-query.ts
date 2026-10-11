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
export const withdrawalQueryKey = (scope: SessionScope) =>
  ["p09", scope.accountId, scope.role, scope.epoch, scope.check] as const;
const privateQueryKeys = {
  p04: financialQueryKey,
  p05: taskQueryKey,
  p07: depositQueryKey,
  p09: withdrawalQueryKey,
};
type PrivateNamespace = keyof typeof privateQueryKeys;
const boundedNamespace = (namespace: string) =>
  namespace === "p07" || namespace === "p09";
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
        void client.cancelQueries({ queryKey: ["p09"] });
        client.removeQueries({ queryKey: ["p09"] });
        observationWindows.delete(client);
        withdrawalTransitions.delete(client);
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
  return useBoundedRead("p07", options);
}
export function useWithdrawalRead<T>(options: PrivateReadOptions<T>) {
  const query = useBoundedRead("p09", options);
  return { ...query, ...useWithdrawalDisplay(query) };
}
function useWithdrawalDisplay<T>(query: {
  displayKey: readonly unknown[];
  allowed: boolean;
  data: T | undefined;
  acceptedData: T | undefined;
  isError: boolean;
}) {
  const retained = useQuery<T | null>({
    queryKey: query.displayKey,
    queryFn: skipToken,
    enabled: false,
    gcTime: Infinity,
  });
  // This snapshot is display-only. Commands keep using the current check's data.
  const displayData = query.allowed
    ? (query.acceptedData ?? retained.data ?? undefined)
    : undefined;
  return {
    displayData,
    isDisplayStale:
      displayData !== undefined && (query.data === undefined || query.isError),
  };
}
function useBoundedRead<T>(
  namespace: "p07" | "p09",
  options: PrivateReadOptions<T>,
) {
  const selection = normalizePrivateSelection(options.selection);
  const query = usePrivateRead(namespace, { ...options, selection });
  const observation = useBoundedObservation(namespace, {
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
  namespace: PrivateNamespace,
  options: PrivateReadOptions<T>,
) {
  const { scope, allowed } = useFinancialScope(options.role);
  const client = useQueryClient();
  const denialIdentity = (
    boundedNamespace(namespace) ? hashKey : JSON.stringify
  )([
    scope.epoch,
    scope.accountId,
    scope.role,
    options.domain,
    options.selection,
  ]);
  // Route revalidation can unmount this reader. Keep denial with its private
  // actor/domain selection so remounting cannot start another denial loop.
  const denialKey = [namespace, "denial", denialIdentity] as const;
  const displayKey = [namespace, "display", denialIdentity] as const;
  const reportDenial = useCallback(
    (failure: unknown) => {
      const runtime = getSessionRuntime();
      const error = getApiError(failure);
      if (
        runtime.isCurrentCheck(scope) &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        client.setQueryData([namespace, "denial", denialIdentity], error);
        if (namespace === "p09")
          client.setQueryData([namespace, "display", denialIdentity], null);
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
      ...privateQueryKeys[namespace](scope),
      options.domain,
      ...options.selection,
    ],
    enabled: boundedNamespace(namespace) ? false : enabled,
    ...(boundedNamespace(namespace)
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
        if (namespace === "p09") client.setQueryData(displayKey, response);
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
    displayKey,
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
      return query.refetch({ cancelRefetch: !boundedNamespace(namespace) });
    },
  };
}

// Check keys authorize each request; this separate transient window bounds
// domain observation across checks and query garbage collection.
type BoundedObservationState = Readonly<{
  count: number;
  nextAt: number;
  stopped: boolean;
  busy: boolean;
}>;
type ObservationWindow = ReturnType<typeof createObservationWindow>;
const observationWindows = new WeakMap<
  QueryClient,
  Map<string, ObservationWindow>
>();
const withdrawalTransitions = new WeakMap<QueryClient, Map<string, number>>();
const observationAuthority = (scope: SessionScope) =>
  hashKey([scope.epoch, scope.accountId, scope.role]);

// Call only for an explicit refresh or a newly validated persisted outcome.
// Invalidation alone cannot restart disabled queries or replenish their budget.
export function refreshWithdrawalQueries(
  client: QueryClient,
  scope: SessionScope,
  transition?: Readonly<{ id: string; version: number }>,
) {
  if (
    !getSessionRuntime().isCurrentCheck(scope) ||
    scope.accountId === null ||
    (scope.role !== "USER" && scope.role !== "ADMIN")
  )
    return;
  const authority = observationAuthority(scope);
  if (transition !== undefined) {
    if (
      transition.id.length === 0 ||
      !Number.isSafeInteger(transition.version) ||
      transition.version < 0
    )
      return;
    let seen = withdrawalTransitions.get(client);
    if (seen === undefined) {
      seen = new Map();
      withdrawalTransitions.set(client, seen);
    }
    const identity = hashKey([authority, transition.id]);
    if ((seen.get(identity) ?? -1) >= transition.version) return;
    seen.set(identity, transition.version);
  }
  for (const window of observationWindows.get(client)?.values() ?? []) {
    if (window.namespace === "p09" && window.authority === authority)
      window.reset();
  }
  void client.invalidateQueries({
    queryKey: withdrawalQueryKey(scope),
    refetchType: "none",
  });
  for (const domain of [
    "wallet",
    "ledger",
    "ledger-detail",
    "membership",
    "finance",
    "finance-detail",
  ]) {
    void client.invalidateQueries({
      queryKey: [...financialQueryKey(scope), domain],
    });
  }
}
const observationDelays = [5_000, 10_000, 20_000, 30_000, 60_000] as const;
function createObservationWindow(
  identity: string,
  authority: string,
  namespace: "p07" | "p09",
) {
  let snapshot: BoundedObservationState = {
    count: 0,
    nextAt: 0,
    stopped: false,
    busy: false,
  };
  let pending: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: BoundedObservationState) => {
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
            Date.now() + (observationDelays[Math.min(count - 1, 4)] ?? 60_000),
        });
      });
    return pending;
  };
  return {
    identity,
    authority,
    namespace,
    reset: () => {
      publish({ ...snapshot, count: 0, nextAt: 0, stopped: false });
    },
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
function normalizePrivateSelection(selection: readonly unknown[]) {
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
function observationWindow(
  namespace: "p07" | "p09",
  client: QueryClient,
  scope: SessionScope,
  options: {
    domain: string;
    role: "USER" | "ADMIN";
    selection: readonly unknown[];
  },
) {
  let windows = observationWindows.get(client);
  if (windows === undefined) {
    windows = new Map();
    observationWindows.set(client, windows);
  }
  const identity = hashKey([
    scope.epoch,
    scope.accountId,
    scope.role,
    options.selection,
  ]);
  // Retain resource budgets through remount/GC until authority retirement.
  const owner = hashKey([
    namespace,
    options.role,
    options.domain,
    ...(namespace === "p09" ? [identity] : []),
  ]);
  let window = windows.get(owner);
  if (window?.identity !== identity) {
    window = createObservationWindow(
      identity,
      observationAuthority(scope),
      namespace,
    );
    windows.set(owner, window);
  }
  return window;
}
function subscribeObservationActivity(listener: () => void) {
  const focus = focusManager.subscribe(listener);
  const online = onlineManager.subscribe(listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    focus();
    online();
    document.removeEventListener("visibilitychange", listener);
  };
}
const observationActive = () =>
  document.visibilityState !== "hidden" &&
  focusManager.isFocused() &&
  onlineManager.isOnline();

function useBoundedObservation<T>(
  namespace: "p07" | "p09",
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
  const window = observationWindow(namespace, client, options.scope, options);
  const state = useSyncExternalStore(
    window.subscribe,
    window.snapshot,
    window.snapshot,
  );
  const active = useSyncExternalStore(
    subscribeObservationActivity,
    observationActive,
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
          observationActive()
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

export function useWithdrawalList<
  T extends { pagination: { totalPages: number } },
  F extends object,
>(options: {
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
}) {
  const query = usePrivateList(
    "p09",
    options.role === "USER" ? 25 : 10,
    options,
  );
  return {
    ...query,
    ...useWithdrawalDisplay(query),
    observationExhausted:
      "observationExhausted" in query && query.observationExhausted,
  };
}

function usePrivateList<
  T extends { pagination: { totalPages: number } },
  F extends object,
>(
  namespace: PrivateNamespace,
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
    boundedNamespace(namespace) &&
    "q" in options.filters &&
    typeof options.filters.q === "string"
      ? { ...options.filters, q: options.filters.q.trim() || undefined }
      : options.filters;
  const identity = (boundedNamespace(namespace) ? hashKey : JSON.stringify)([
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
    ...(options.pending === undefined || (namespace !== "p09" && page !== 1)
      ? {}
      : {
          pending: options.pending,
        }),
    read: (current: SessionScope, signal: AbortSignal) =>
      options.read(current, { ...filters, page, limit }, signal),
  };
  // Keep a fixed hook order; only bounded readers activate observation.
  const privateQuery = usePrivateRead(namespace, readOptions);
  const observation = useBoundedObservation(
    namespace === "p09" ? "p09" : "p07",
    {
      ...readOptions,
      scope: privateQuery.scope,
      allowed: boundedNamespace(namespace) && privateQuery.allowed,
      canRefresh: boundedNamespace(namespace) && privateQuery.canRefresh,
      acceptedData: privateQuery.acceptedData,
      hasFetched: privateQuery.isFetched,
      refetch: privateQuery.refetch,
    },
  );
  const query = boundedNamespace(namespace)
    ? { ...privateQuery, ...observation }
    : privateQuery;
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
