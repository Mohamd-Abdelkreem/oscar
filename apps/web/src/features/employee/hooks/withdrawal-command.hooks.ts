"use client";
import { useMemo, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assertFinancialScope,
  useFinancialScope,
  useWithdrawalRead,
  refreshWithdrawalQueries,
  recheckFinancialDenial,
} from "@/shared/query/financial-query";
import { getApiError, safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { withdrawalsApi } from "../api/withdrawals.api";
import { getWithdrawalCommandRuntime } from "../utils/withdrawal-command-runtime";

const serverState = Object.freeze({ state: "idle" as const, quoteId: null });
export function useWithdrawalCommand() {
  const authority = useFinancialScope("USER"),
    client = useQueryClient();
  const runtime = getWithdrawalCommandRuntime();
  const state = useSyncExternalStore(
    runtime.subscribe,
    runtime.snapshot,
    () => serverState,
  );
  const recovery = useMemo(() => {
    if (!authority.allowed || authority.scope.accountId === null)
      return { retained: null, coordinationError: null };
    try {
      return {
        retained: runtime.handle(authority.scope.accountId),
        coordinationError: null,
      };
    } catch (failure: unknown) {
      return { retained: null, coordinationError: getApiError(failure) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Storage is published through the command snapshot.
  }, [authority.allowed, authority.scope, runtime, state]);
  const observation = useWithdrawalRead({
    domain: "acceptance-outcome",
    role: "USER",
    selection: [recovery.retained?.quoteId],
    enabled:
      authority.allowed &&
      recovery.retained !== null &&
      state.state !== "pending",
    read: async (scope, signal) => {
      const outcome = await runtime.observe(
        scope,
        withdrawalsApi.outcome,
        signal,
      );
      if (outcome !== null && outcome.status !== "NOT_OBSERVED")
        refreshWithdrawalQueries(
          client,
          scope,
          outcome.status === "COMMITTED"
            ? outcome.withdrawal
            : { id: outcome.quoteId, version: 0 },
        );
      return outcome;
    },
    pending: (outcome) => outcome?.status === "NOT_OBSERVED",
  });
  const command = useMutation({
    retry: false,
    networkMode: "always",
    gcTime: 0,
    onError: (failure) => {
      recheckFinancialDenial(authority.scope, failure);
    },
    mutationFn: async (quoteId: string) => {
      assertFinancialScope(authority.scope, "USER");
      if (!authority.allowed) throw safeApiError("denied", "FORBIDDEN", 403);
      try {
        const result = await runtime.execute(authority.scope, quoteId, (key) =>
          withdrawalsApi.accept(quoteId, key),
        );
        assertFinancialScope(authority.scope, "USER");
        refreshWithdrawalQueries(client, authority.scope, result.withdrawal);
        return { scope: authority.scope, result };
      } catch (failure: unknown) {
        if (runtime.snapshot().state === "idle")
          refreshWithdrawalQueries(client, authority.scope);
        throw failure;
      }
    },
  });
  return {
    ...command,
    ...recovery,
    state,
    observation,
    allowed: authority.allowed && recovery.coordinationError === null,
    data:
      authority.allowed &&
      command.data &&
      getSessionRuntime().isCurrentCheck(command.data.scope)
        ? command.data.result
        : undefined,
    mutateAsync: async (quoteId: string) => {
      const result = await command.mutateAsync(quoteId);
      assertFinancialScope(result.scope, "USER");
      return result.result;
    },
  };
}
