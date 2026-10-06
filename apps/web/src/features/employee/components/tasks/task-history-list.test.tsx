import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { reply, pagination } from "@/test/p04-network";
import { submission, proof } from "@/test/p05-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { TaskHistoryList } from "./task-history-list";

cleanupQueries();
afterEach(cleanup);
it("reads bounded history and saved detail without inferring reward or resubmission", async () => {
  const requests: string[] = [];
  const final = {
    ...submission,
    status: "APPROVED",
    canReplace: false,
    finalDecision: {
      decision: "APPROVE",
      decidedAt: submission.submittedAt,
      reviewedSubmissionVersion: 1,
      reviewedEvidenceVersion: 1,
    },
  };
  const h = queryHarness("USER", (config) => {
    requests.push(config.url ?? "");
    if (config.url === "/task-submissions")
      return reply(config, {
        items: [
          {
            id: submission.id,
            taskId: submission.taskId,
            businessDate: submission.businessDate,
            taskTitle: submission.taskTitle,
            reward: submission.reward,
            submittedAt: submission.submittedAt,
            status: "APPROVED",
            version: 1,
            currentEvidenceVersion: 1,
          },
        ],
        pagination: { ...pagination, total: 1, totalPages: 1 },
      });
    if (config.url?.startsWith("/proofs/"))
      return reply(config, { ...proof, availability: "REMOVED" });
    return reply(config, final);
  });
  render(<TaskHistoryList />, { wrapper: h.wrapper });
  fireEvent.click(await screen.findByRole("button", { name: "عرض التفاصيل" }));
  await screen.findByText("تم اعتماد المهمة وصرف المكافأة نهائياً");
  await waitFor(() => {
    expect(requests).toContain("/task-submissions/" + submission.id);
  });
  expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
