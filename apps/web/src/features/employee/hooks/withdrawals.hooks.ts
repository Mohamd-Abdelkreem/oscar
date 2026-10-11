"use client";

import { useEffect, useRef } from "react";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  WithdrawalFilter,
  WithdrawalRequest,
  WithdrawalDestination,
} from "@template/contracts";
import {
  useWithdrawalRead,
  useWithdrawalList,
  refreshWithdrawalQueries,
  useFinancialScope,
  assertFinancialScope,
} from "@/shared/query/financial-query";
import type { SessionScope } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { withdrawalsApi } from "../api/withdrawals.api";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { getApiError } from "@/services/api/safe-error";

const isActiveWithdrawal = (request: WithdrawalRequest) =>
  ["SCHEDULED", "SIGNING", "SIGNED", "SUBMITTED", "UNKNOWN"].includes(
    request.state,
  );

function usePersistedRefresh(
  scope: SessionScope,
  allowed: boolean,
  requests: readonly WithdrawalRequest[],
) {
  const client = useQueryClient();
  useEffect(() => {
    if (!allowed) return;
    for (const request of requests)
      refreshWithdrawalQueries(client, scope, request);
  }, [client, scope, allowed, requests]);
}
const noRequests: readonly WithdrawalRequest[] = [];
export function useEmployeeWithdrawalStatus() {
  const client = useQueryClient();
  const observed = useRef<{ authority: string; id: string } | null>(null);
  const query = useWithdrawalRead({
    domain: "status",
    role: "USER",
    selection: [],
    read: async (scope, signal) => {
      const authority = JSON.stringify([
        scope.accountId,
        scope.role,
        scope.epoch,
      ]);
      const status = await withdrawalsApi.status(signal);
      assertFinancialScope(scope, "USER");
      if (observed.current?.authority !== authority) observed.current = null;
      if (status.activeWithdrawal !== null) {
        observed.current = { authority, id: status.activeWithdrawal.id };
      } else if (observed.current !== null) {
        // Absence is not release/settlement evidence. Resolve the original
        // request even when no history/detail consumer is mounted.
        const saved = await withdrawalsApi.detail(observed.current.id, signal);
        assertFinancialScope(scope, "USER");
        if (!isActiveWithdrawal(saved)) {
          observed.current = null;
          refreshWithdrawalQueries(client, scope, saved);
        }
      }
      return status;
    },
    pending: (status) =>
      status.activeWithdrawal !== null ||
      observed.current !== null ||
      status.destination.state === "PENDING",
  });
  usePersistedRefresh(
    query.scope,
    query.allowed,
    query.data?.activeWithdrawal ? [query.data.activeWithdrawal] : noRequests,
  );
  return query;
}
export function useEmployeeWithdrawalDestination() {
  const query = useWithdrawalRead({
    domain: "destination",
    role: "USER",
    selection: [],
    read: (_scope, signal) => withdrawalsApi.destination(signal),
    pending: (destination) => destination.state === "PENDING",
  });
  const client = useQueryClient();
  useEffect(() => {
    const destination = query.data;
    if (destination?.state === "CONFIRMED")
      refreshWithdrawalQueries(client, query.scope, {
        id: "destination",
        version: destination.addressVersion,
      });
  }, [client, query.scope, query.data]);
  return query;
}

type WithdrawalNetwork = Extract<
  WithdrawalDestination,
  { state: "PENDING" }
>["network"];
type PendingDestination = Extract<WithdrawalDestination, { state: "PENDING" }>;
type DestinationIntent =
  | { kind: "issue"; address: string; network: WithdrawalNetwork }
  | {
      kind: "resend";
      reviewed: PendingDestination;
      network: WithdrawalNetwork;
    };
type IssuanceObservation = { minimumVersion: number; observed: boolean };
export function useWithdrawalDestinationCommand() {
  const authority = useFinancialScope("USER"),
    client = useQueryClient();
  const key = [
    "p09",
    authority.scope.accountId,
    authority.scope.role,
    authority.scope.epoch,
    "destination-command",
  ];
  const marker = useQuery<IssuanceObservation | null>({
    queryKey: key,
    queryFn: skipToken,
    enabled: false,
    gcTime: Infinity,
  });
  const uncertain =
    authority.allowed &&
    marker.data !== null &&
    marker.data !== undefined &&
    !marker.data.observed;
  const observation = useWithdrawalRead({
    domain: "destination-issuance",
    role: "USER",
    selection: [marker.data?.minimumVersion],
    enabled: uncertain,
    read: async (scope, signal) => {
      const saved = await withdrawalsApi.destination(signal);
      assertFinancialScope(scope, "USER");
      const minimum = marker.data?.minimumVersion;
      if (
        minimum !== undefined &&
        (saved.state === "CONFIRMED" ||
          (saved.state === "PENDING" && saved.version >= minimum))
      ) {
        client.setQueryData(key, { minimumVersion: minimum, observed: true });
        refreshWithdrawalQueries(client, scope);
      }
      return saved;
    },
    pending: () => true,
  });
  const mutation = useMutation({
    mutationKey: key,
    retry: false,
    networkMode: "always",
    gcTime: 0,
    mutationFn: async (intent: DestinationIntent) => {
      assertFinancialScope(authority.scope, "USER");
      if (!authority.allowed || !navigator.onLine)
        throw safeApiError("denied", "FORBIDDEN", 403);
      const status = await withdrawalsApi.status();
      assertFinancialScope(authority.scope, "USER");
      if (status.network !== intent.network)
        throw safeApiError("request", "WITHDRAWAL_DESTINATION_STALE", 409);
      const saved = await withdrawalsApi.destination();
      assertFinancialScope(authority.scope, "USER");
      if (
        saved.state === "CONFIRMED" ||
        (saved.state === "PENDING" && saved.network !== intent.network)
      )
        throw safeApiError("request", "WITHDRAWAL_DESTINATION_REQUIRED", 409);
      if (
        intent.kind === "resend" &&
        (saved.state !== "PENDING" ||
          saved.version !== intent.reviewed.version ||
          saved.address !== intent.reviewed.address ||
          intent.reviewed.serverNow < intent.reviewed.nextIssuanceAt ||
          saved.serverNow < saved.nextIssuanceAt)
      )
        throw safeApiError("request", "WITHDRAWAL_DESTINATION_REQUIRED", 409);
      const minimumVersion =
        (saved.state === "PENDING" ? saved.version : 0) + 1;
      client.setQueryData(key, { minimumVersion, observed: false });
      try {
        const result =
          intent.kind === "issue"
            ? await withdrawalsApi.issue(intent.address)
            : await withdrawalsApi.resend(intent.reviewed.version);
        assertFinancialScope(authority.scope, "USER");
        client.setQueryData(key, { minimumVersion, observed: true });
        return result;
      } catch (failure: unknown) {
        const error = getApiError(failure);
        // Address checksum rejection occurs before proof issuance in the owning service.
        if (
          getSessionRuntime().isCurrentCheck(authority.scope) &&
          intent.kind === "issue" &&
          error.statusCode === 400 &&
          error.code === "WITHDRAWAL_ADDRESS_INVALID"
        )
          client.setQueryData(key, null);
        throw error;
      } finally {
        if (getSessionRuntime().isCurrentCheck(authority.scope))
          refreshWithdrawalQueries(client, authority.scope);
      }
    },
  });
  const send = (intent: DestinationIntent) => {
    const retained = client.getQueryData<IssuanceObservation | null>(key);
    if (
      client.isMutating({ mutationKey: key }) > 0 ||
      (retained !== undefined && retained !== null && !retained.observed)
    )
      return Promise.reject(safeApiError("uncertain", "COMMAND_PENDING"));
    client.setQueryData(key, null);
    return mutation.mutateAsync(intent);
  };
  return {
    ...mutation,
    allowed: authority.allowed,
    uncertain,
    observation,
    observed: authority.allowed && marker.data?.observed === true,
    issue: (address: string, network: WithdrawalNetwork) =>
      send({ kind: "issue", address, network }),
    resend: (reviewed: PendingDestination, network: WithdrawalNetwork) =>
      send({ kind: "resend", reviewed, network }),
  };
}
export function useEmployeeWithdrawalHistory(
  filters: Omit<WithdrawalFilter, "page" | "limit"> = {},
) {
  const query = useWithdrawalList({
    domain: "employee-history",
    role: "USER",
    filters,
    read: (_scope, selection, signal) =>
      withdrawalsApi.history(selection, signal),
    pending: (page) => page.items.some(isActiveWithdrawal),
  });
  usePersistedRefresh(
    query.scope,
    query.allowed,
    query.data?.items ?? noRequests,
  );
  return query;
}
export function useEmployeeWithdrawalDetail(withdrawalId: string | null) {
  const query = useWithdrawalRead<WithdrawalRequest>({
    domain: "detail",
    role: "USER",
    selection: [withdrawalId],
    enabled: withdrawalId !== null,
    read: (_scope, signal) => {
      if (withdrawalId === null)
        throw safeApiError("request", "NOT_FOUND", 404);
      return withdrawalsApi.detail(withdrawalId, signal);
    },
    pending: isActiveWithdrawal,
  });
  usePersistedRefresh(
    query.scope,
    query.allowed,
    query.data ? [query.data] : noRequests,
  );
  return query;
}
