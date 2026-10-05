import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authApi } from "@/features/auth/api/auth.api";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { AcceptInvitationScreen } from "./accept-invitation-screen";

let client: QueryClient;
const submitForm = (name: string) => {
  const form = screen.getByRole("button", { name }).closest("form");
  if (form === null) throw new Error("MISSING_FORM");
  fireEvent.submit(form);
};

beforeEach(() => {
  getSessionRuntime().dispose();
  localStorage.clear();
  window.history.replaceState(
    null,
    "",
    "/admin/auth/accept-invitation?token=PRIVATE_SENTINEL",
  );
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(authApi, "validateAdminInvitation").mockResolvedValue({
    success: true,
    statusCode: 200,
    data: { valid: true },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  getSessionRuntime().dispose();
  localStorage.clear();
});
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <AcceptInvitationScreen />
    </QueryClientProvider>,
  );
it("previews without consumption and accepts explicitly with matching passwords and separate sign-in", async () => {
  const date = "2026-10-01T00:00:00.000Z";
  const accept = vi.spyOn(authApi, "acceptAdminInvitation").mockResolvedValue({
    success: true,
    statusCode: 201,
    data: {
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        fullName: "Admin",
        email: "admin@example.test",
        phone: null,
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: date,
        createdAt: date,
        updatedAt: date,
        accountVersion: 0,
        referralCode: null,
        tasksBlocked: false,
        withdrawalsBlocked: false,
      },
    },
  });
  const login = vi.spyOn(authApi, "adminLogin");
  mount();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "قبول الدعوة" })).toBeEnabled(),
  );
  expect(window.location.search).toBe("");
  expect(accept).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^كلمة المرور الجديدة/u), {
    target: { value: "long matching password" },
  });
  fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), {
    target: { value: "different password" },
  });
  submitForm("قبول الدعوة");
  await screen.findByRole("alert");
  expect(accept).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), {
    target: { value: "long matching password" },
  });
  submitForm("قبول الدعوة");
  await screen.findByText("تم قبول الدعوة");
  expect(login).not.toHaveBeenCalled();
  expect(
    screen.getByRole("link", { name: "تسجيل دخول المسؤول" }),
  ).toHaveAttribute("href", "/admin/auth/login");
  expect(JSON.stringify(client.getQueryCache().getAll())).not.toContain(
    "PRIVATE_SENTINEL",
  );
  expect(client.getMutationCache().getAll()).toHaveLength(0);
});
it.each(["invalid", "uncertain", "missing"])(
  "grants no success/session for %s credentials",
  async (outcome) => {
    vi.spyOn(authApi, "acceptAdminInvitation").mockRejectedValue(
      safeApiError("transient", "NETWORK_ERROR"),
    );
    if (outcome === "missing")
      window.history.replaceState(null, "", "/admin/auth/accept-invitation");
    if (outcome === "invalid")
      vi.mocked(authApi.validateAdminInvitation).mockRejectedValue(
        safeApiError("denied", "UNAUTHORIZED", 401),
      );
    mount();
    if (outcome === "uncertain") {
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "قبول الدعوة" }),
        ).toBeEnabled(),
      );
      for (const label of ["كلمة المرور الجديدة", "تأكيد كلمة المرور"])
        fireEvent.change(screen.getByLabelText(label, { exact: false }), {
          target: { value: "long matching password" },
        });
      submitForm("قبول الدعوة");
      await screen.findByText(/تعذر تأكيد قبول الدعوة/u);
      expect(
        screen.getByRole("button", { name: "قبول الدعوة" }),
      ).toBeDisabled();
      expect(screen.getByLabelText(/^كلمة المرور الجديدة/u)).toHaveValue("");
    } else await screen.findByText("رابط الدعوة غير صالح أو منتهي");
    expect(screen.queryByText("تم قبول الدعوة")).not.toBeInTheDocument();
  },
);
