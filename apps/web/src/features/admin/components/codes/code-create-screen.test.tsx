import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { task } from "@/test/p05-network";
import { adminRead } from "@/test/p05-admin-ui";
import { CodeCreateScreen } from "./code-create-screen";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
cleanupQueries();
it("confirms normalized draft and initial state only after authorized task selection", async () => {
  const h = queryHarness("ADMIN", adminRead);
  render(<CodeCreateScreen />, { wrapper: h.wrapper });
  await screen.findByRole(
    "option",
    {
      name: task.title + " (" + task.platform + ")",
    },
    { timeout: 5000 },
  );
  fireEvent.change(screen.getByLabelText(/المهمة المرتبطة بالرمز/), {
    target: { value: task.id },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /Code/ }), {
    target: { value: " abc " },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "حفظ وإنشاء الرمز" }),
    ).not.toBeDisabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: /إنشاء الرمز/ }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/ABC/)).toBeInTheDocument();
  expect(screen.getByDisplayValue("ABC")).toBeInTheDocument();
});
