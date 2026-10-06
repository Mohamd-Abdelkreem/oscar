import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { task, code } from "@/test/p05-network";
import { adminRead } from "@/test/p05-admin-ui";
import { TaskDetailScreen } from "./task-detail-screen";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
cleanupQueries();
it("reads current detail and separately bounded related records without local totals", async () => {
  const reads: string[] = [];
  const h = queryHarness("ADMIN", (config) => {
    reads.push(config.url ?? "");
    return adminRead(config);
  });
  render(<TaskDetailScreen taskId={task.id} />, { wrapper: h.wrapper });
  await screen.findByRole("heading", { name: task.title });
  await screen.findByText(code.normalizedText);
  expect(reads).toContain("/admin/tasks/" + task.id);
  expect(reads).toContain("/admin/task-codes");
  expect(reads).toContain("/admin/task-submissions");
  fireEvent.click(screen.getByRole("button", { name: "إيقاف الرمز" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});
