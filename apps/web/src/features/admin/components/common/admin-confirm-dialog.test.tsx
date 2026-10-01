import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";

import {
  AdminStateProvider,
  useAdminState,
} from "../../context/admin-state.context";
import { AdminConfirmDialog } from "./admin-confirm-dialog";

afterEach(cleanup);

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
