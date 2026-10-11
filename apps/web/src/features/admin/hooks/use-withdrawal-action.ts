"use client";
import { useMemo, useSyncExternalStore } from "react";
import {
  withdrawalExtensionBodySchema,
  withdrawalRejectionBodySchema,
} from "@template/contracts";
import { financialInput } from "@/services/api/financial-response";
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
import { adminWithdrawalsApi } from "../api/withdrawals.api";
import {
  getAdminWithdrawalRuntime,
  type AdminWithdrawalIntent,
} from "../utils/withdrawal-command-runtime";
import { canChangeWithdrawal } from "../utils/withdrawal-presentation";

const serverState = Object.freeze({
  state: "idle" as const,
  target: null,
  outcome: null,
});
export function useWithdrawalAction() {
  const authority = useFinancialScope("ADMIN"),
    client = useQueryClient(),
    runtime = getAdminWithdrawalRuntime();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- The runtime publishes storage changes through its snapshot.
  }, [authority.allowed, authority.scope, runtime, state]);
  const observation = useWithdrawalRead({
    domain: "admin-action-outcome",
    role: "ADMIN",
    selection: [
      recovery.retained?.target,
      recovery.retained?.requestKey,
      recovery.retained?.kind,
      recovery.retained?.expectedVersion,
    ],
    enabled: recovery.retained !== null && state.state !== "pending",
    read: async (scope, signal) => {
      const outcome = await runtime.observe(
        scope,
        (saved, currentSignal) =>
          adminWithdrawalsApi.outcome(
            saved.target,
            {
              kind: saved.kind,
              requestKey: saved.requestKey,
              expectedVersion: saved.expectedVersion,
            },
            currentSignal,
          ),
        signal,
      );
      if (outcome && outcome.status !== "NOT_OBSERVED")
        refreshWithdrawalQueries(client, scope, outcome.withdrawal);
      return outcome;
    },
    pending: (outcome) => outcome?.status === "NOT_OBSERVED",
  });
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    gcTime: 0,
    onError: (failure) => {
      if (
        getApiError(failure).code === "WITHDRAWAL_VERSION_CONFLICT" &&
        runtime.snapshot().state === "idle"
      )
        refreshWithdrawalQueries(client, authority.scope);
      recheckFinancialDenial(authority.scope, failure);
    },
    mutationFn: async ({
      intent: raw,
      retry,
    }: {
      intent: AdminWithdrawalIntent;
      retry: boolean;
    }) => {
      assertFinancialScope(authority.scope, "ADMIN");
      if (!authority.allowed) throw safeApiError("denied", "FORBIDDEN", 403);
      const intent: AdminWithdrawalIntent =
        raw.kind === "EXTEND"
          ? {
              target: raw.target,
              kind: "EXTEND",
              body: Object.freeze(
                financialInput(withdrawalExtensionBodySchema, raw.body),
              ),
            }
          : {
              target: raw.target,
              kind: "REJECT",
              body: Object.freeze(
                financialInput(withdrawalRejectionBodySchema, raw.body),
              ),
            };
      const dispatch = (key: string) =>
        intent.kind === "EXTEND"
          ? adminWithdrawalsApi.extend(intent.target, intent.body, key)
          : adminWithdrawalsApi.reject(intent.target, intent.body, key);
      const review = async () => {
        const current = await adminWithdrawalsApi.detail(intent.target);
        assertFinancialScope(authority.scope, "ADMIN");
        if (
          current.version !== intent.body.expectedVersion ||
          !canChangeWithdrawal(current, intent.kind)
        )
          throw safeApiError("request", "WITHDRAWAL_VERSION_CONFLICT", 409);
      };
      if (retry) await review();
      const result = retry
        ? await runtime.retry(authority.scope, intent, dispatch)
        : await runtime.execute(authority.scope, intent, { review, dispatch });
      assertFinancialScope(authority.scope, "ADMIN");
      refreshWithdrawalQueries(client, authority.scope, result.withdrawal);
      return { scope: authority.scope, result };
    },
  });
  return {
    ...mutation,
    ...recovery,
    state,
    observation,
    outcome: authority.allowed ? state.outcome : null,
    canRetry:
      authority.allowed &&
      authority.scope.accountId !== null &&
      recovery.coordinationError === null &&
      runtime.canRetry(authority.scope.accountId),
    allowed: authority.allowed && recovery.coordinationError === null,
    data:
      authority.allowed &&
      mutation.data &&
      getSessionRuntime().isCurrentCheck(mutation.data.scope)
        ? mutation.data.result
        : undefined,
    execute: async (intent: AdminWithdrawalIntent) =>
      (await mutation.mutateAsync({ intent, retry: false })).result,
    retryOriginal: async (intent: AdminWithdrawalIntent) =>
      (await mutation.mutateAsync({ intent, retry: true })).result,
  };
}
