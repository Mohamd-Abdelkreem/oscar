import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AxiosHeaders } from "axios";
import { afterEach, expect, it, vi } from "vitest";
import { reply } from "@/test/p04-network";
import { submission, proof } from "@/test/p05-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { TaskCard } from "./task-card";

cleanupQueries();
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("reopens persisted evidence with a fresh owned URL and revokes it on leaving", async () => {
  let count = 0;
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:owned-" + String(++count),
      revokeObjectURL: revoke,
    }),
  );
  const h = queryHarness("USER", (config) =>
    config.url?.endsWith("/content")
      ? {
          config,
          status: 200,
          statusText: "OK",
          data: new Blob(["synthetic"], { type: "image/png" }),
          headers: new AxiosHeaders({
            "content-type": "image/png",
            "content-length": "9",
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
            "content-disposition": 'inline; filename="image.png"',
          }),
        }
      : reply(config, proof),
  );
  const first = render(<TaskCard savedSubmission={submission} />, {
    wrapper: h.wrapper,
  });
  await waitFor(() =>
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:owned-1"),
  );
  expect(screen.getByText(/لا تُضاف إلى/)).toBeInTheDocument();
  first.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:owned-1");
  const second = render(<TaskCard savedSubmission={submission} />, {
    wrapper: h.wrapper,
  });
  await waitFor(() =>
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:owned-2"),
  );
  second.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:owned-2");
});
it("keeps final rejected facts after retention without resubmission controls", async () => {
  const removed = { ...proof, availability: "REMOVED" };
  let binaryReads = 0;
  const h = queryHarness("USER", (config) => {
    if (config.url?.endsWith("/content")) binaryReads++;
    return reply(config, removed);
  });
  render(
    <TaskCard
      savedSubmission={{
        ...submission,
        status: "REJECTED",
        canReplace: false,
        evidence: {
          ...submission.evidence,
          asset: { ...proof, availability: "REMOVED" },
        },
        finalDecision: {
          decision: "REJECT",
          reason: "الصورة لا تثبت التنفيذ",
          decidedAt: submission.submittedAt,
          reviewedSubmissionVersion: 1,
          reviewedEvidenceVersion: 1,
        },
      }}
    />,
    { wrapper: h.wrapper },
  );
  await screen.findByText(/حُذفت الصورة/);
  expect(screen.getByText("الصورة لا تثبت التنفيذ")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /إرسال|تحديث/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(binaryReads).toBe(0);
});
