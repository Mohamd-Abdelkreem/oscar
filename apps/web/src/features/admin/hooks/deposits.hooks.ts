"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  manualCreditBodySchema,
  type ManualCreditBody,
  type ManualCreditTarget,
  type AdminDepositHistoryQuery,
} from "@template/contracts";
import {
  useDepositList,
  useDepositRead,
  useFinancialScope,
  assertFinancialScope,
  depositQueryKey,
  financialQueryKey,
  recheckFinancialDenial,
} from "@/shared/query/financial-query";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { getApiError, type ApiError } from "@/services/api/safe-error";
import { getManualCreditCommandRuntime } from "../utils/manual-credit-command-runtime";
import { useDepositCreditRefresh } from "@/shared/query/deposit-credit-refresh";
import { depositsApi } from "../api/deposits.api";

export function useAdminDeposits(
  filters: Omit<AdminDepositHistoryQuery, "page" | "limit"> = {},
) {
  const history = useDepositList({
    domain: "admin-history",
    role: "ADMIN",
    filters,
    limit: 10,
    pending: () => true,
    read: (_scope, query, signal) => depositsApi.history(query, signal),
  });
  useDepositCreditRefresh({ scope: history.scope, items: history.data?.items });
  return {
    ...history,
    observationExhausted:
      "observationExhausted" in history && history.observationExhausted,
    visibleHistory:
      history.allowed && history.error?.category !== "contract"
        ? history.acceptedData
        : undefined,
  };
}

const emptyDraft = { amount: "", reason: "", reference: "" };
const draftSchema = manualCreditBodySchema.omit({ actionId: true });
type Draft = typeof emptyDraft;
type Reviewed = { employee: ManualCreditTarget; body: ManualCreditBody };
type Form = {
  identity: string;
  draft: Draft;
  selected: ManualCreditTarget | null;
  reviewed: Reviewed | null;
  error: ApiError | null;
};

export function useManualCredit(
  open: boolean,
  refreshHistory?: () => Promise<unknown>,
) {
  const authority = useFinancialScope("ADMIN");
  const { scope } = authority;
  const client = useQueryClient();
  const runtime = getManualCreditCommandRuntime();
  const state = useSyncExternalStore(
    runtime.subscribe,
    runtime.snapshot,
    runtime.snapshot,
  );
  const identity = JSON.stringify([scope.epoch, scope.accountId, scope.role]);
  const [form, setForm] = useState<Form>({
    identity,
    draft: emptyDraft,
    selected: null,
    reviewed: null,
    error: null,
  });
  useEffect(
    () =>
      getSessionRuntime().onRetire(() => {
        setForm({
          identity: "",
          draft: emptyDraft,
          selected: null,
          reviewed: null,
          error: null,
        });
      }),
    [],
  );
  const current = authority.allowed && form.identity === identity;
  const draft = current ? form.draft : emptyDraft;
  const selected = current ? form.selected : null;
  const reviewed = current ? form.reviewed : null;
  const update = (change: Partial<Omit<Form, "identity">>) => {
    if (!authority.allowed || !getSessionRuntime().isCurrentCheck(scope))
      return;
    setForm((previous) => ({
      ...(previous.identity === identity
        ? previous
        : {
            identity,
            draft: emptyDraft,
            selected: null,
            reviewed: null,
            error: null,
          }),
      ...change,
    }));
  };
  const recovery = useMemo(() => {
    if (!authority.allowed || scope.accountId === null)
      return { retained: null, error: null };
    try {
      return { retained: runtime.handle(scope.accountId), error: null };
    } catch (failure: unknown) {
      return { retained: null, error: getApiError(failure) };
    }
    // Storage notifications publish a new owner snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authority.allowed, scope, runtime, state]);
  const targets = useDepositList({
    domain: "manual-credit-targets",
    role: "ADMIN",
    filters: {},
    limit: 25,
    enabled: open,
    read: (_scope, query, signal) => depositsApi.targets(query, signal),
  });
  const targetReady =
    targets.allowed &&
    targets.isSuccess &&
    !targets.isFetching &&
    targets.data !== undefined;
  const blocked =
    recovery.retained !== null ||
    recovery.error !== null ||
    state.state !== "idle";
  const parsed = draftSchema.safeParse({
    employeeId: selected?.id,
    amount: draft.amount,
    reason: draft.reason,
    reference: { kind: "EXTERNAL", value: draft.reference },
    confirmed: true,
  });
  const canReview =
    authority.allowed &&
    targetReady &&
    selected !== null &&
    parsed.success &&
    !blocked;
  const refreshSettled = async () => {
    assertFinancialScope(scope, "ADMIN");
    await Promise.all([
      client.invalidateQueries({
        queryKey: depositQueryKey(scope),
        predicate: (query) => query.queryKey[5] === "admin-history",
      }),
      client.invalidateQueries({
        queryKey: financialQueryKey(scope),
        predicate: (query) =>
          ["finance", "finance-detail"].includes(String(query.queryKey[5])),
      }),
      refreshHistory?.(),
    ]);
  };
  const original = useDepositRead({
    domain: "manual-credit-original",
    role: "ADMIN",
    selection: [recovery.retained?.actionId ?? null],
    enabled: recovery.retained !== null && state.state !== "pending",
    pending: () => true,
    read: async () => {
      const result = await runtime.observe(scope, depositsApi.outcome);
      assertFinancialScope(scope, "ADMIN");
      if (result !== null) {
        update({
          draft: emptyDraft,
          selected: null,
          reviewed: null,
          error: null,
        });
        await refreshSettled();
      }
      return result;
    },
  });
  const confirm = async () => {
    if (!canReview || reviewed === null || reviewed.employee.id !== selected.id)
      return false;
    try {
      assertFinancialScope(scope, "ADMIN");
      await runtime.execute(scope, reviewed.body, depositsApi.grant);
      assertFinancialScope(scope, "ADMIN");
      update({
        draft: emptyDraft,
        selected: null,
        reviewed: null,
        error: null,
      });
      await refreshSettled();
      return true;
    } catch (failure: unknown) {
      recheckFinancialDenial(scope, failure);
      if (getSessionRuntime().isCurrentCheck(scope))
        update({ error: getApiError(failure) });
      return false;
    }
  };
  return {
    scope,
    allowed: authority.allowed,
    draft,
    selected,
    reviewed,
    targets,
    retained: recovery.retained,
    pending: state.state === "pending",
    uncertain: recovery.retained !== null && state.state !== "pending",
    blocked,
    canReview,
    error: authority.allowed
      ? (recovery.error ?? original.error ?? (current ? form.error : null))
      : null,
    original,
    confirm,
    options:
      targetReady && targets.data
        ? [
            ...targets.data.items,
            ...(selected &&
            !targets.data.items.some((row) => row.id === selected.id)
              ? [selected]
              : []),
          ].map((row) => ({
            value: row.id,
            label: `${row.name} (${row.email})`,
          }))
        : selected
          ? [
              {
                value: selected.id,
                label: `${selected.name} (${selected.email})`,
              },
            ]
          : [],
    select: (id: string) => {
      if (!targetReady || blocked) return;
      const employee = targets.data?.items.find((row) => row.id === id);
      if (employee) update({ selected: employee, reviewed: null });
    },
    edit: (field: keyof Draft, value: string) => {
      if (blocked) return;
      setForm((previous) => {
        if (!authority.allowed || !getSessionRuntime().isCurrentCheck(scope))
          return previous;
        const base =
          previous.identity === identity
            ? previous
            : {
                identity,
                draft: emptyDraft,
                selected: null,
                reviewed: null,
                error: null,
              };
        return {
          ...base,
          draft: { ...base.draft, [field]: value },
          reviewed: null,
          error: null,
        };
      });
    },
    review: () => {
      if (canReview)
        update({
          reviewed: {
            employee: { ...selected },
            body: { ...parsed.data, actionId: crypto.randomUUID() },
          },
          error: null,
        });
    },
    closeReview: () => {
      if (state.state !== "pending") update({ reviewed: null });
    },
  };
}
