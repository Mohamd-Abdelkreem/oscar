"use client";
import { useMutation } from "@tanstack/react-query";
import type { PackageCode } from "@template/contracts";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";
import {
  assertFinancialScope,
  useFinancialRead,
  useFinancialList,
  useFinancialScope,
  recheckFinancialDenial,
} from "@/shared/query/financial-query";
import { packagesApi } from "../api/packages.api";

export const usePackageCatalog = () =>
  useFinancialRead({
    domain: "catalog",
    role: "USER",
    selection: [],
    read: (_scope, signal) => packagesApi.catalog(signal),
  });
export const useMembership = () =>
  useFinancialRead({
    domain: "membership",
    role: "USER",
    selection: [],
    read: (scope, signal) => {
      if (scope.accountId === null)
        throw safeApiError("denied", "FORBIDDEN", 403);
      return packagesApi.membership(scope.accountId, signal);
    },
  });
export const useSubscriptionHistory = () =>
  useFinancialList({
    domain: "subscription-history",
    role: "USER",
    filters: {},
    read: (_scope, query, signal) =>
      packagesApi.subscriptionHistory(query, signal),
  });
export const usePurchaseQuote = () => {
  const authority = useFinancialScope("USER");
  const mutation = useMutation({
    onError: (failure) => {
      recheckFinancialDenial(authority.scope, failure);
    },
    retry: false,
    networkMode: "always",
    gcTime: 0,
    mutationFn: async (code: PackageCode) => {
      assertFinancialScope(authority.scope, "USER");
      if (!authority.allowed) throw safeApiError("denied", "FORBIDDEN", 403);
      const quote = await packagesApi.quote(code);
      assertFinancialScope(authority.scope, "USER");
      return { scope: authority.scope, quote };
    },
  });
  return {
    ...mutation,
    data:
      authority.allowed &&
      mutation.data !== undefined &&
      getSessionRuntime().isCurrentCheck(mutation.data.scope)
        ? mutation.data.quote
        : undefined,
    mutateAsync: async (code: PackageCode) => {
      const observed = await mutation.mutateAsync(code);
      assertFinancialScope(observed.scope, "USER");
      return observed.quote;
    },
    allowed: authority.allowed,
  };
};
