"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { DepositAddressData } from "@template/contracts";
import { getApiError, type ApiError } from "@/services/api/safe-error";
import {
  getSessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";
import {
  assertFinancialScope,
  useDepositRead,
  useDepositList,
} from "@/shared/query/financial-query";
import { useDepositCreditRefresh } from "@/shared/query/deposit-credit-refresh";
import { depositsApi } from "../api/deposits.api";

// One transient attempt per admitted account/epoch survives reader remounts.
// A failed or lost reply authorizes observation only, never another automatic POST.
const provisioningAttempts = new WeakMap<
  QueryClient,
  ReturnType<typeof createAttempt>
>();
function createAttempt(identity: string) {
  let snapshot: Readonly<{
    attempted: boolean;
    pending: boolean;
    error: ApiError | null;
  }> = {
    attempted: false,
    pending: false,
    error: null,
  };
  const listeners = new Set<() => void>();
  const publish = (next: typeof snapshot) => {
    snapshot = next;
    listeners.forEach((listener) => {
      listener();
    });
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
    start: async (scope: SessionScope) => {
      if (snapshot.attempted) return;
      publish({ attempted: true, pending: true, error: null });
      try {
        assertFinancialScope(scope, "USER");
        await depositsApi.provision();
        publish({ attempted: true, pending: false, error: null });
      } catch (failure: unknown) {
        publish({
          attempted: true,
          pending: false,
          error: getApiError(failure),
        });
      }
    },
  };
}
function provisioningAttempt(client: QueryClient, scope: SessionScope) {
  const identity = JSON.stringify([scope.epoch, scope.accountId, scope.role]);
  let attempt = provisioningAttempts.get(client);
  if (attempt?.identity !== identity) {
    attempt = createAttempt(identity);
    provisioningAttempts.set(client, attempt);
  }
  return attempt;
}
const receivingPending = (assignment: DepositAddressData) =>
  assignment.state === "UNASSIGNED" ||
  assignment.state === "PROVISIONING" ||
  (assignment.state === "UNAVAILABLE" && assignment.retryable);

export function useEmployeeDeposits() {
  const address = useDepositRead<DepositAddressData>({
    domain: "receiving-address",
    role: "USER",
    selection: [],
    read: (_scope, signal) => depositsApi.address(signal),
    pending: receivingPending,
  });
  const history = useDepositList({
    domain: "employee-history",
    role: "USER",
    filters: {},
    read: (_scope, query, signal) => depositsApi.history(query, signal),
    pending: (page) => page.detection.status !== "PAUSED",
  });
  const client = useQueryClient();
  const attempt = provisioningAttempt(client, address.scope);
  const provision = useSyncExternalStore(
    attempt.subscribe,
    attempt.snapshot,
    attempt.snapshot,
  );
  useEffect(() => {
    if (
      !address.allowed ||
      address.data?.state !== "UNASSIGNED" ||
      provision.attempted
    )
      return;
    const scope = address.scope;
    void attempt.start(scope).then(() => {
      if (!getSessionRuntime().isCurrentCheck(scope)) return;
      const error = attempt.snapshot().error;
      if (error?.category === "denied") address.reportDenial(error);
    });
  }, [address, attempt, provision.attempted]);
  const allowed = address.allowed && history.allowed;
  useDepositCreditRefresh({
    scope: history.scope,
    items: allowed ? history.data?.items : undefined,
  });
  const assignment = address.data;
  const ready: Extract<DepositAddressData, { state: "READY" }> | undefined =
    allowed && assignment?.state === "READY" ? assignment : undefined;
  const visibleHistory =
    allowed && history.error?.category !== "contract"
      ? history.acceptedData
      : undefined;
  return {
    address,
    history,
    ready,
    visibleHistory,
    provisioning: allowed && provision.pending,
    provisionError:
      allowed && address.data?.state === "UNASSIGNED" ? provision.error : null,
    detection: allowed
      ? (visibleHistory?.detection ?? ready?.detection)
      : undefined,
    refresh: () => Promise.all([address.refetch(), history.refetch()]),
  };
}
