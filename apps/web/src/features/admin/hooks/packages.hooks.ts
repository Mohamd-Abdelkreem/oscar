"use client";
import { useMemo, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PackageCode, PackageEdit } from "@template/contracts";
import {
  useFinancialRead,
  useFinancialScope,
  assertFinancialScope,
  financialQueryKey,
  recheckFinancialDenial,
} from "@/shared/query/financial-query";
import { getApiError, safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { adminPackagesApi } from "../api/packages.api";
import { getConfigurationCommandRuntime } from "../utils/configuration-command-runtime";

export const useAdminCatalog = () =>
  useFinancialRead({
    domain: "admin-packages",
    role: "ADMIN",
    selection: [],
    read: (_scope, signal) => adminPackagesApi.catalog(signal),
  });
export function useConfigurationCommand() {
  const authority = useFinancialScope("ADMIN");
  const client = useQueryClient();
  const runtime = getConfigurationCommandRuntime();
  const state = useSyncExternalStore(
    runtime.subscribe,
    runtime.snapshot,
    runtime.snapshot,
  );
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
  const save = useMutation({
    retry: false,
    networkMode: "always",
    gcTime: 0,
    mutationFn: async (intent: { code: PackageCode; body: PackageEdit }) => {
      assertFinancialScope(authority.scope, "ADMIN");
      if (!authority.allowed) throw safeApiError("denied", "FORBIDDEN", 403);
      const result = await runtime.execute(
        authority.scope,
        intent.code,
        intent.body,
        adminPackagesApi.edit,
      );
      assertFinancialScope(authority.scope, "ADMIN");
      await client.invalidateQueries({
        queryKey: financialQueryKey(authority.scope),
      });
      return { scope: authority.scope, result };
    },
    onError: (error) => {
      recheckFinancialDenial(authority.scope, error);
      if (
        getApiError(error).code === "CONFIGURATION_SUPERSEDED" &&
        getSessionRuntime().isCurrentCheck(authority.scope)
      )
        void client.invalidateQueries({
          queryKey: financialQueryKey(authority.scope),
        });
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
      assertFinancialScope(authority.scope, "ADMIN");
      if (!authority.allowed) throw safeApiError("denied", "FORBIDDEN", 403);
      const result = await runtime.observe(
        authority.scope,
        adminPackagesApi.outcome,
      );
      assertFinancialScope(authority.scope, "ADMIN");
      if (result?.status === "COMMITTED")
        await client.invalidateQueries({
          queryKey: financialQueryKey(authority.scope),
        });
      return { scope: authority.scope, result };
    },
  });
  return {
    state,
    retained,
    coordinationError,
    allowed: authority.allowed && coordinationError === null,
    save: {
      ...save,
      data:
        authority.allowed &&
        save.data &&
        getSessionRuntime().isCurrentCheck(save.data.scope)
          ? save.data.result
          : undefined,
      mutateAsync: async (intent: { code: PackageCode; body: PackageEdit }) => {
        const result = await save.mutateAsync(intent);
        assertFinancialScope(result.scope, "ADMIN");
        return result.result;
      },
    },
    observation: {
      ...observation,
      data:
        authority.allowed &&
        observation.data &&
        getSessionRuntime().isCurrentCheck(observation.data.scope)
          ? observation.data.result
          : undefined,
      mutateAsync: async () => {
        const result = await observation.mutateAsync();
        assertFinancialScope(result.scope, "ADMIN");
        return result.result;
      },
    },
  };
}
