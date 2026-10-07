"use client";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFinancialScope,
  assertFinancialScope,
  taskQueryKey,
  financialQueryKey,
  recheckFinancialDenial,
} from "@/shared/query/financial-query";
import {
  getApiError,
  safeApiError,
  type ApiError,
} from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { getBrowserTaskCommandRuntime } from "../browser-task-command-runtime";
import type {
  TaskOperation,
  TaskTerminalObservation,
} from "../task-command-runtime";

export function useTaskCommand(
  role: "USER" | "ADMIN",
  operation: TaskOperation,
) {
  const authority = useFinancialScope(role);
  const client = useQueryClient();
  const runtime = getBrowserTaskCommandRuntime(role);
  useSyncExternalStore(runtime.subscribe, runtime.snapshot, runtime.snapshot);
  const identity = JSON.stringify([authority.scope, operation]);
  const activeIdentity = useRef(identity);
  useLayoutEffect(() => {
    activeIdentity.current = identity;
    return () => {
      activeIdentity.current = "";
    };
  }, [identity]);
  const [feedback, setFeedback] = useState<{
    identity: string;
    pending: boolean;
    error: ApiError | null;
  } | null>(null);
  let retained = null;
  let coordinationError: ApiError | null = null;
  if (authority.allowed) {
    try {
      retained = runtime.outstanding(authority.scope, operation);
    } catch (failure: unknown) {
      coordinationError = getApiError(failure);
    }
  }
  const current = feedback?.identity === identity ? feedback : null;
  const run = async (action: () => Promise<TaskTerminalObservation | null>) => {
    assertFinancialScope(authority.scope, role);
    if (!authority.allowed || coordinationError)
      throw coordinationError ?? safeApiError("denied", "FORBIDDEN", 403);
    setFeedback({ identity, pending: true, error: null });
    try {
      const observation = await action();
      assertFinancialScope(authority.scope, role);
      if (activeIdentity.current !== identity)
        throw safeApiError("obsolete", "OBSOLETE_SCOPE");
      if (
        observation &&
        ["OBSERVED", "CANCELLED", "READY", "FAILED"].includes(observation.state)
      ) {
        await client.invalidateQueries({
          queryKey: taskQueryKey(authority.scope),
        });
        if (
          observation.state === "OBSERVED" &&
          observation.command.kind === "FINAL_REVIEW" &&
          observation.command.outcome.submission.status === "APPROVED"
        ) {
          await client.invalidateQueries({
            queryKey: financialQueryKey(authority.scope),
          });
        }
      }
      assertFinancialScope(authority.scope, role);
      if (activeIdentity.current !== identity)
        throw safeApiError("obsolete", "OBSOLETE_SCOPE");
      setFeedback({ identity, pending: false, error: null });
      return observation;
    } catch (failure: unknown) {
      const error = getApiError(failure);
      if (getSessionRuntime().isCurrentCheck(authority.scope))
        setFeedback({ identity, pending: false, error });
      recheckFinancialDenial(authority.scope, error);
      throw error;
    }
  };
  return {
    allowed: authority.allowed && coordinationError === null,
    scope: authority.scope,
    retained,
    isPending: current?.pending ?? false,
    error: coordinationError ?? current?.error ?? null,
    execute: (dispatch: (commandId: string) => Promise<unknown>) =>
      run(() => runtime.execute(authority.scope, operation, dispatch)),
    observe: () => run(() => runtime.observe(authority.scope, operation)),
    cancel: () => run(() => runtime.cancel(authority.scope, operation)),
  };
}
