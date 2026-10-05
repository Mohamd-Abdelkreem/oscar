import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authApi } from "@/features/auth/api/auth.api";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { ChangePasswordModal } from "./change-password-modal";

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient();
});
afterEach(() => {
  client.clear();
  getSessionRuntime().dispose();
  localStorage.clear();
});
const open = () =>
  render(
    <QueryClientProvider client={client}>
      <ChangePasswordModal isOpen onClose={vi.fn()} />
    </QueryClientProvider>,
  );
const fill = (
  current = "short",
  next = "US4 new password!",
  confirmation = next,
) => {
  for (const [label, value] of [
    ["كلمة المرور الحالية", current],
    ["كلمة المرور الجديدة (15 - 128 حرفاً)", next],
    ["تأكيد كلمة المرور الجديدة", confirmation],
  ]) {
    if (label !== undefined)
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
};
const submit = () => {
  const form = screen
    .getByRole("button", { name: "حفظ كلمة المرور الجديدة" })
    .closest("form");
  if (form === null) throw new Error("US4_FORM_MISSING");
  fireEvent.submit(form);
};
it("rejects unchanged, mismatched and out-of-policy input before dispatch and retains correctable wrong-current input", async () => {
  const request = vi
    .spyOn(authApi, "changePassword")
    .mockRejectedValue(safeApiError("request", "BAD_REQUEST", 400));
  open();
  for (const [current, next, confirmation] of [
    ["US4 new password!", "US4 new password!", "US4 new password!"],
    ["short", "short", "short"],
    ["short", "x".repeat(129), "x".repeat(129)],
    ["short", "US4 new password!", "different"],
  ]) {
    fill(current, next, confirmation);
    submit();
    expect(request).not.toHaveBeenCalled();
  }
  fill();
  submit();
  await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
  expect(screen.getByLabelText("كلمة المرور الحالية")).toHaveValue("short");
  expect(request).toHaveBeenCalledWith({
    currentPassword: "short",
    newPassword: "US4 new password!",
    passwordConfirmation: "US4 new password!",
  });
});
it("dismissal clears fields but cannot unlock a pending change on remount; uncertain settlement never shows success", async () => {
  let reject!: (failure: unknown) => void;
  const pending = new Promise<never>((_resolve, fail) => {
    reject = fail;
  });
  const request = vi.spyOn(authApi, "changePassword").mockReturnValue(pending);
  const first = open();
  fill();
  submit();
  expect(
    screen.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
  ).toBeDisabled();
  first.unmount();
  open();
  expect(screen.getByLabelText("كلمة المرور الحالية")).toHaveValue("");
  fill();
  submit();
  expect(request).toHaveBeenCalledOnce();
  await act(async () => {
    reject(safeApiError("transient", "NETWORK_ERROR"));
    await pending.catch(() => undefined);
  });
  expect(screen.queryByText("تم تحديث كلمة المرور بنجاح")).toBeNull();
  expect(
    screen.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
  ).toBeDisabled();
  expect(client.getMutationCache().getAll()).toEqual([]);
});
it("contains keyboard focus, restores the opener and makes background inert only while open", () => {
  const opener = document.createElement("button");
  document.body.append(opener);
  opener.focus();
  const view = open();
  expect(opener.inert).toBe(true);
  const close = screen.getByRole("button", { name: "إغلاق النافذة" });
  close.focus();
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(screen.getByRole("button", { name: "إلغاء" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
  expect(close).toHaveFocus();
  view.unmount();
  expect(opener).toHaveFocus();
  expect(opener.inert).toBe(false);
  opener.remove();
});
