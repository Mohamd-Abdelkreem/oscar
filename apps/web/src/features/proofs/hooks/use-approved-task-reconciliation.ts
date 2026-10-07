"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SubmissionDetail } from "@template/contracts";
import type { SessionScope } from "@/services/api/session-runtime";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { financialQueryKey } from "@/shared/query/financial-query";

export function useApprovedTaskReconciliation(
  scope: SessionScope,
  submission: SubmissionDetail | undefined,
) {
  const client = useQueryClient(),
    seen = useRef("");
  useEffect(() => {
    if (
      submission?.status !== "APPROVED" ||
      !getSessionRuntime().isCurrentCheck(scope)
    )
      return;
    const identity = JSON.stringify([
      scope,
      submission.id,
      submission.finalDecision?.decidedAt,
    ]);
    if (seen.current === identity) return;
    seen.current = identity;
    void client.invalidateQueries({ queryKey: financialQueryKey(scope) });
  }, [client, scope, submission]);
}
