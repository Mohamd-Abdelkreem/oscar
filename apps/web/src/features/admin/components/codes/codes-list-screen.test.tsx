import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { task, code } from "@/test/p05-network";
import { adminRead, onePage } from "@/test/p05-admin-ui";
import { reply } from "@/test/p04-network";
import { CodesListScreen } from "./codes-list-screen";

const { push, search } = vi.hoisted(() => ({
  push: vi.fn(),
  search: { value: "" },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
}));
cleanupQueries();
beforeEach(() => {
  search.value = "";
});
it("renders attributed successful counts from real limit-ten pages", async () => {
  const h = queryHarness("ADMIN", (config) => {
    if (config.url === "/admin/task-codes")
      expect(config.params).toMatchObject({ limit: 10, page: 1 });
    return adminRead(config);
  });
  render(<CodesListScreen />, { wrapper: h.wrapper });
  await screen.findByText(code.normalizedText);
  expect(screen.getByText(task.title)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "إيقاف" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});

it("shows the authorized query-selected task even outside the current options page", async () => {
  search.value = "task=" + task.id;
  const h = queryHarness("ADMIN", (config) =>
    config.url === "/admin/tasks"
      ? reply(config, onePage([]))
      : adminRead(config),
  );
  render(<CodesListScreen />, { wrapper: h.wrapper });
  await screen.findByText(code.normalizedText);
  expect(
    screen.getByRole("combobox", { name: "تصفية حسب المهمة" }),
  ).toHaveTextContent(task.title);
});
