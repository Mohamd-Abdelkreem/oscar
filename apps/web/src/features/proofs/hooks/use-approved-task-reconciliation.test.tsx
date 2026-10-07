import { renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import type { SubmissionDetail } from "@template/contracts";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { reply, now, wallet } from "@/test/p04-network";
import { submission } from "@/test/p05-network";
import { useWallet } from "@/features/employee/hooks/wallet.hooks";
import { useApprovedTaskReconciliation } from "./use-approved-task-reconciliation";

cleanupQueries();
it("refreshes the current financial scope once on saved approval and never for pending or rejected work", async () => {
  let reads = 0;
  const h = queryHarness("USER", (config) => {
    reads++;
    return reply(config, wallet);
  });
  const scope = h.runtime.scope();
  const hook = renderHook(
    ({ saved }: { saved: SubmissionDetail }) => {
      useApprovedTaskReconciliation(scope, saved);
      return useWallet();
    },
    {
      wrapper: h.wrapper,
      initialProps: { saved: submission },
    },
  );
  await waitFor(() => {
    expect(hook.result.current.data).toEqual(wallet);
  });
  expect(reads).toBe(1);
  hook.rerender({
    saved: {
      ...submission,
      status: "REJECTED",
      canReplace: false,
      finalDecision: {
        decision: "REJECT",
        decidedAt: now,
        reviewedSubmissionVersion: 1,
        reviewedEvidenceVersion: 1,
      },
    },
  });
  expect(reads).toBe(1);
  const approved: SubmissionDetail = {
    ...submission,
    status: "APPROVED",
    canReplace: false,
    finalDecision: {
      decision: "APPROVE",
      decidedAt: now,
      reviewedSubmissionVersion: 1,
      reviewedEvidenceVersion: 1,
    },
  };
  hook.rerender({ saved: approved });
  await waitFor(() => {
    expect(reads).toBe(2);
  });
  hook.rerender({ saved: { ...approved } });
  expect(reads).toBe(2);
});
