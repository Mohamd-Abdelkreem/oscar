"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  withdrawalConsumeBodySchema,
  type WithdrawalDestination,
} from "@template/contracts";
import {
  useCurrentSession,
  useSessionScope,
} from "@/features/auth/hooks/auth.hooks";
import {
  getSessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";
import {
  refreshWithdrawalQueries,
  useWithdrawalRead,
} from "@/shared/query/financial-query";
import { withdrawalsApi } from "../api/withdrawals.api";
import { getApiError } from "@/services/api/safe-error";

type LinkState =
  "idle" | "review" | "pending" | "confirmed" | "reopen" | "uncertain";
type PendingDestination = Extract<WithdrawalDestination, { state: "PENDING" }>;
type DestinationAttempt = Pick<
  PendingDestination,
  "address" | "network" | "version"
> & {
  scope: SessionScope;
};
const accountPath = "/employee/account";
const prefix = "#withdrawal-confirmation=";

function confirmationOutcome(
  saved: WithdrawalDestination,
  reviewed: DestinationAttempt,
): "confirmed" | "uncertain" | "reopen" {
  if (
    saved.state === "UNSET" ||
    saved.address !== reviewed.address ||
    saved.network !== reviewed.network
  )
    return "reopen";
  if (saved.state === "CONFIRMED") return "confirmed";
  // Only server-proven invalidation retires uncertainty; browser time cannot.
  return saved.version === reviewed.version && saved.proofStatus === "PENDING"
    ? "uncertain"
    : "reopen";
}

export function useWithdrawalDestinationLink(pathname: string) {
  const scope = useSessionScope();
  const session = useCurrentSession();
  const client = useQueryClient();
  // The credential never enters render state, props, Query, or browser storage.
  const proof = useRef<{ token: string; scope: SessionScope } | null>(null);
  const lifetime = useRef({ generation: 0 });
  const busy = useRef(false);
  const attempt = useRef<DestinationAttempt | null>(null);
  const [state, setState] = useState<LinkState>("idle");
  const allowed =
    pathname === accountPath &&
    !session.isPending &&
    !session.isFetching &&
    !session.isError &&
    session.data?.user.id === scope.accountId &&
    scope.role === "USER";

  useLayoutEffect(() => {
    const lifecycle = lifetime.current;
    const generation = ++lifecycle.generation;
    const drop = () => {
      if (proof.current !== null) proof.current.token = "";
      proof.current = null;
      attempt.current = null;
      setState("reopen");
    };
    const capture = () => {
      if (location.pathname !== accountPath || pathname !== accountPath) {
        drop();
        return;
      }
      if (!location.hash.startsWith(prefix)) return;
      const token = location.hash.slice(prefix.length);
      // Retain Next/native history state and remove the secret before passive guards navigate.
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
      if (proof.current !== null) proof.current.token = "";
      proof.current = null;
      const parsed = withdrawalConsumeBodySchema.safeParse({ token });
      if (!parsed.success || busy.current) {
        drop();
        return;
      }
      const current = getSessionRuntime().scope();
      if (current.role !== null && current.role !== "USER") {
        setState("reopen");
        return;
      }
      proof.current = { token: parsed.data.token, scope: current };
      setState("review");
    };
    capture();
    const retire = getSessionRuntime().onRetire(drop);
    window.addEventListener("hashchange", capture);
    window.addEventListener("pagehide", drop);
    return () => {
      retire();
      window.removeEventListener("hashchange", capture);
      window.removeEventListener("pagehide", drop);
      // React's synchronous Strict Mode setup replay keeps the ref; real departure disposes it.
      queueMicrotask(() => {
        if (lifecycle.generation === generation) {
          if (proof.current !== null) proof.current.token = "";
          proof.current = null;
          lifecycle.generation++;
        }
      });
    };
  }, [pathname]);

  useEffect(() => {
    if (
      state === "pending" &&
      attempt.current !== null &&
      !getSessionRuntime().isCurrentCheck(attempt.current.scope)
    )
      setState("uncertain");
    const retained = proof.current;
    if (retained === null) return;
    if (
      !getSessionRuntime().isCurrent(retained.scope) ||
      pathname !== accountPath ||
      (!session.isPending &&
        !session.isFetching &&
        !session.isError &&
        session.data === null) ||
      (scope.role !== null && scope.role !== "USER")
    ) {
      retained.token = "";
      proof.current = null;
      setState("reopen");
    } else if (allowed) retained.scope = scope;
  }, [
    scope,
    pathname,
    session.isPending,
    session.isFetching,
    session.isError,
    session.data,
    allowed,
    state,
  ]);

  const observation = useWithdrawalRead({
    domain: "destination-confirmation",
    role: "USER",
    selection: [],
    enabled: allowed && state === "uncertain",
    read: async (currentScope, signal) => {
      const expected = attempt.current;
      const saved = await withdrawalsApi.destination(signal);
      const runtime = getSessionRuntime();
      if (
        expected !== null &&
        attempt.current === expected &&
        !signal.aborted &&
        runtime.isCurrentCheck(currentScope) &&
        runtime.isCurrent(expected.scope)
      ) {
        const outcome = confirmationOutcome(saved, expected);
        setState((current) => (current === "uncertain" ? outcome : current));
        if (outcome === "confirmed" && saved.state === "CONFIRMED")
          refreshWithdrawalQueries(client, currentScope, {
            id: "destination",
            version: saved.addressVersion,
          });
      }
      return saved;
    },
    pending: (saved) =>
      attempt.current !== null &&
      confirmationOutcome(saved, attempt.current) === "uncertain",
  });

  const confirm = async (reviewed: PendingDestination) => {
    const runtime = getSessionRuntime();
    const retained = proof.current;
    if (
      !allowed ||
      retained === null ||
      busy.current ||
      !runtime.isCurrentCheck(scope)
    )
      return;
    const generation = lifetime.current.generation;
    const operation = {
      scope,
      address: reviewed.address,
      network: reviewed.network,
      version: reviewed.version,
    };
    const current = () =>
      attempt.current === operation &&
      lifetime.current.generation === generation &&
      runtime.isCurrentCheck(scope) &&
      location.pathname === accountPath;
    busy.current = true;
    attempt.current = operation;
    setState("pending");
    // One explicit attempt. A lost reply observes the destination and never replays the proof.
    try {
      const latest = await withdrawalsApi.destination();
      if (!current()) return;
      if (
        latest.state !== "PENDING" ||
        latest.version !== reviewed.version ||
        latest.address !== reviewed.address ||
        latest.network !== reviewed.network ||
        latest.proofStatus !== "PENDING"
      ) {
        setState("reopen");
        return;
      }
      try {
        const token = retained.token;
        retained.token = "";
        proof.current = null;
        await withdrawalsApi.consume(token);
        if (current()) setState("confirmed");
      } catch (failure) {
        if (!current()) return;
        const error = getApiError(failure);
        if (
          error.code === "WITHDRAWAL_PROOF_INVALID" ||
          error.code === "WITHDRAWAL_DESTINATION_STALE" ||
          error.category === "denied"
        ) {
          setState("reopen");
          return;
        }
        setState("uncertain");
        try {
          const observed = await withdrawalsApi.destination();
          if (current()) setState(confirmationOutcome(observed, operation));
        } catch {
          /* Keep uncertainty until an authorized destination read succeeds. */
        }
      }
    } catch {
      if (current()) setState("reopen");
    } finally {
      retained.token = "";
      if (proof.current === retained) proof.current = null;
      busy.current = false;
      if (current()) refreshWithdrawalQueries(client, scope);
    }
  };
  return {
    state,
    canConfirm: allowed && state === "review",
    confirm,
    observation,
  };
}
