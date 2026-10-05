"use client";
import { useMemo, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assertFinancialScope,
  financialQueryKey,
  useFinancialScope,
  recheckFinancialDenial,
} from "@/shared/query/financial-query";
import { getApiError, safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { packagesApi } from "../api/packages.api";
import { getPurchaseCommandRuntime } from "../utils/purchase-command-runtime";

const serverState = Object.freeze({ state: "idle" as const, quoteId: null });
export function usePurchaseCommand() {
  const authority = useFinancialScope("USER");
  const client = useQueryClient();
  const runtime = getPurchaseCommandRuntime();
  const state = useSyncExternalStore(
    runtime.subscribe,
    runtime.snapshot,
    () => serverState,
  );
  const command = useMutation({
    onError: (failure) => {
      recheckFinancialDenial(authority.scope, failure);
    },
    retry: false,
    networkMode: "always",
    gcTime: 0,
    mutationFn: async (quoteId: string) => {
      assertFinancialScope(authority.scope, "USER");
      if (!authority.allowed) throw safeApiError("denied", "FORBIDDEN", 403);
      const result = await getPurchaseCommandRuntime().execute(
        authority.scope,
        quoteId,
        () => packagesApi.purchase({ quoteId, confirmed: true }),
      );
      assertFinancialScope(authority.scope, "USER");
      await client.invalidateQueries({
        queryKey: financialQueryKey(authority.scope),
      });
      return { scope: authority.scope, result };
    },
  });
  const observation = useMutation({
    onError: (failure) => {
      recheckFinancialDenial(authority.scope, failure);
    },
    retry: false,
    networkMode: "always",
    gcTime: 0,
    mutationFn: async () => {
      assertFinancialScope(authority.scope, "USER");
      if (!authority.allowed) throw safeApiError("denied", "FORBIDDEN", 403);
      const outcome = await getPurchaseCommandRuntime().observe(
        authority.scope,
        packagesApi.outcome,
      );
      assertFinancialScope(authority.scope, "USER");
      if (outcome !== null && outcome.status !== "NOT_OBSERVED")
        await client.invalidateQueries({
          queryKey: financialQueryKey(authority.scope),
        });
      return { scope: authority.scope, outcome };
    },
  });
  // Storage is external mutable state. Reobserve it when its owner publishes;
  // otherwise the React compiler can reuse a read from before the command.
  const { retained, coordinationError } = useMemo(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- External storage changes with the command owner snapshot.
  }, [authority.allowed, authority.scope, runtime, state]);
  return {
    ...command,
    data:
      authority.allowed &&
      command.data !== undefined &&
      getSessionRuntime().isCurrentCheck(command.data.scope)
        ? command.data.result
        : undefined,
    mutateAsync: async (quoteId: string) => {
      const observed = await command.mutateAsync(quoteId);
      assertFinancialScope(observed.scope, "USER");
      return observed.result;
    },
    state,
    retained,
    coordinationError,
    observation: {
      ...observation,
      data:
        authority.allowed &&
        observation.data !== undefined &&
        getSessionRuntime().isCurrentCheck(observation.data.scope)
          ? observation.data.outcome
          : undefined,
      mutateAsync: async () => {
        const observed = await observation.mutateAsync();
        assertFinancialScope(observed.scope, "USER");
        return observed.outcome;
      },
    },
    allowed: authority.allowed && coordinationError === null,
  };
}
