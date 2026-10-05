import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import {
  AdminStateProvider,
  useAdminState,
} from "../../context/admin-state.context";
import { AdminConfirmDialog } from "./admin-confirm-dialog";

afterEach(cleanup);

it("preserves a reviewed reason on denial and blocks synchronous double confirmation", async () => {
  let settle: (committed: boolean) => void = () => {
    throw new Error("NOT_STARTED");
  };
  const confirm = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        settle = resolve;
      }),
  );
  const close = vi.fn();
  render(
    <AdminConfirmDialog
      isOpen
      title="Reasoned action"
      description="Review"
      requireReason
      onConfirm={confirm}
      onClose={close}
    />,
  );
  const reason = screen.getByRole("textbox");
  fireEvent.change(reason, { target: { value: "reviewed reason" } });
  const button = screen.getByRole("button", { name: "تأكيد الإجراء" });
  button.focus();
  fireEvent.click(button);
  fireEvent.click(button);
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "إلغاء" })).toBeDisabled();
  expect(button).not.toHaveFocus();
  expect(screen.getByRole("dialog")).toContainElement(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  fireEvent.keyDown(window, { key: "Tab" });
  expect(screen.getByRole("dialog")).toContainElement(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  settle(false);
  await waitFor(() => expect(button).toBeEnabled());
  expect(reason).toHaveValue("reviewed reason");
  expect(close).not.toHaveBeenCalled();
});

function CodeStatusControl() {
  const { codes, toggleCodeStatus } = useAdminState();
  const [isOpen, setIsOpen] = useState(false);
  const code = codes.find((c) => c.id === "cod_2026_01");
  return (
    <>
      <p>Code status: {code?.status}</p>
      <button
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Pause code
      </button>
      <AdminConfirmDialog
        isOpen={isOpen}
        title="Confirm pause"
        description="Pause future access"
        requireReason
        onConfirm={() => {
          toggleCodeStatus("cod_2026_01");
        }}
        onClose={() => {
          setIsOpen(false);
        }}
      />
    </>
  );
}

it("cancel preserves the code; confirmation requires a reason and pauses it", async () => {
  render(
    <AdminStateProvider>
      <CodeStatusControl />
    </AdminStateProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Pause code" });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
  expect(
    screen.queryByRole("dialog", { name: "Confirm pause" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Code status: active")).toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "تأكيد الإجراء" }));
  expect(
    screen.getByText(
      "يرجى كتابة سبب الإجراء للاعتماد في سجل التدقيق والرقابة.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Code status: active")).toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("textbox", { name: /سبب الإجراء الإلزامي/ }),
    { target: { value: "review" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "تأكيد الإجراء" }));
  await waitFor(() => {
    expect(
      screen.queryByRole("dialog", { name: "Confirm pause" }),
    ).not.toBeInTheDocument();
  });
  expect(screen.getByText("Code status: paused")).toBeInTheDocument();
});
