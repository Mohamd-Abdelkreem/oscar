import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { taskStatusSchema } from "@template/contracts";
import { expect, it, vi } from "vitest";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { task } from "@/test/p05-network";
import { reply } from "@/test/p04-network";
import { adminRead, observed } from "@/test/p05-admin-ui";
import { TasksListScreen } from "./tasks-list-screen";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
cleanupQueries();
it("uses server totals and confirms versioned publication before dispatch", async () => {
  let sent: Record<string, unknown> | null = null;
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") {
      sent = taskStatusSchema.parse(JSON.parse(String(config.data)));
      return reply(config, task);
    }
    if (config.url?.startsWith("/task-commands/"))
      return reply(
        config,
        observed(String(sent?.["commandId"]), "TASK_STATUS", task.id, task),
      );
    return adminRead(config);
  });
  render(<TasksListScreen />, { wrapper: h.wrapper });
  await screen.findByText(task.title);
  fireEvent.click(screen.getByRole("button", { name: "إيقاف" }));
  expect(sent).toBeNull();
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "تأكيد الإيقاف",
    }),
  );
  await waitFor(() => {
    expect(sent).toMatchObject({
      expectedTaskRevision: 1,
      publicationState: "PAUSED",
      confirmed: true,
    });
  });
});
