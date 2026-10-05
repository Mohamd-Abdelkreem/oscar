import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { adminsApi } from "../../api/admins.api";
import { AdminsListScreen } from "./admins-list-screen";

const id = "00000000-0000-4000-8000-000000000002";
const date = "2026-10-01T00:00:00.000Z";
const admin = {
  id,
  fullName: "مسؤول حقيقي",
  email: "real@example.test",
  phone: null,
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  emailVerifiedAt: date,
  createdAt: date,
  updatedAt: date,
  accountVersion: 2,
};
const invitation = {
  id,
  fullName: "دعوة حقيقية",
  email: "invite@example.test",
  issuerUserId: id,
  tokenVersion: 3,
  issuedAt: date,
  expiresAt: date,
  acceptedAt: null,
  revokedAt: null,
  status: "PENDING" as const,
  deliveryStatus: "UNKNOWN" as const,
};
const pagination = {
  page: 1,
  limit: 25,
  total: 26,
  totalPages: 2,
  hasNextPage: true,
  hasPreviousPage: false,
};
let client: QueryClient;
const submitForm = (name: string) => {
  const form = screen.getByRole("button", { name }).closest("form");
  if (form === null) throw new Error("MISSING_FORM");
  fireEvent.submit(form);
};

const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <AdminsListScreen />
    </QueryClientProvider>,
  );
beforeEach(() => {
  getSessionRuntime().dispose();
  localStorage.clear();
  const runtime = getSessionRuntime();
  runtime.admitIdentity(runtime.scope(), {
    id: "00000000-0000-4000-8000-000000000001",
    role: "ADMIN",
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(adminsApi, "listAdmins").mockResolvedValue({
    items: [admin],
    pagination,
  });
  vi.spyOn(adminsApi, "listInvitations").mockResolvedValue({
    items: [invitation],
    pagination,
  });
  vi.spyOn(adminsApi, "getAdmin").mockResolvedValue({ admin });
  vi.spyOn(adminsApi, "getInvitation").mockResolvedValue({ invitation });
});
afterEach(async () => {
  cleanup();
  await client.cancelQueries();
  client.clear();
  vi.restoreAllMocks();
  getSessionRuntime().dispose();
  localStorage.clear();
});

it("uses independent server pages and totals with unavailable aggregates and disabled unsupported controls", async () => {
  mount();
  await screen.findByText(admin.fullName);
  expect(
    screen.getByRole("textbox", {
      name: "بحث المسؤولين غير متاح",
    }),
  ).toBeDisabled();
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(screen.getByRole("button", { name: "تعديل" })).toBeDisabled();
  expect(screen.getAllByText("غير متاح حالياً").length).toBeGreaterThanOrEqual(
    3,
  );
  expect(screen.getByText("نتيجة الإرسال غير مؤكدة")).toBeInTheDocument();
  expect(screen.getByText("بانتظار القبول")).toBeInTheDocument();
  fireEvent.click(
    within(screen.getByRole("region", { name: "دعوات المسؤولين" })).getByRole(
      "button",
      { name: "التالي" },
    ),
  );
  await waitFor(() => {
    expect(adminsApi.listInvitations).toHaveBeenCalledWith(
      { page: 2, limit: 25 },
      expect.any(AbortSignal),
    );
  });
  expect(adminsApi.listAdmins).toHaveBeenCalledTimes(1);
});

it("requires entered reason and explicit review before issuing a pending invitation", async () => {
  const issue = vi
    .spyOn(adminsApi, "issueInvitation")
    .mockResolvedValue({ invitation });
  mount();
  await screen.findByText(admin.fullName);
  fireEvent.click(screen.getByRole("button", { name: "إضافة مسؤول جديد" }));
  fireEvent.change(screen.getByLabelText(/الاسم الكامل/u), {
    target: { value: "Invited" },
  });
  fireEvent.change(screen.getByLabelText(/البريد الإلكتروني/u), {
    target: { value: "invited@example.test" },
  });
  submitForm("مراجعة الدعوة");
  expect(issue).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog", {
    name: "تأكيد إرسال دعوة المسؤول",
  });
  fireEvent.change(within(dialog).getByRole("textbox"), {
    target: { value: "حاجة العمل" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "تأكيد إرسال الدعوة" }),
  );
  await waitFor(() => {
    expect(issue).toHaveBeenCalledWith({
      fullName: "Invited",
      email: "invited@example.test",
      reason: "حاجة العمل",
      confirmed: true,
    });
  });
  expect(
    await screen.findByText(
      "تم تسجيل الدعوة. لا يصبح المستلم مسؤولاً حتى يقبلها.",
    ),
  ).toBeInTheDocument();
});

it("refreshes a stale target while retaining the reason and never claims command success", async () => {
  const change = vi
    .spyOn(adminsApi, "changeStatus")
    .mockRejectedValue(safeApiError("request", "CONFLICT", 409));
  mount();
  await screen.findByText(admin.fullName);
  fireEvent.click(screen.getByRole("button", { name: "تعطيل" }));
  const reason = await screen.findByRole("textbox", { name: /سبب الإجراء/u });
  fireEvent.change(reason, { target: { value: "سبب محفوظ" } });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "تأكيد التعطيل" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "تأكيد التعطيل" }));
  await screen.findByText(/تغير السجل أو تعذر تنفيذ الإجراء/u);
  expect(reason).toHaveValue("سبب محفوظ");
  expect(change).toHaveBeenCalledWith(id, {
    status: "DEACTIVATED",
    reason: "سبب محفوظ",
    confirmed: true,
    expectedVersion: 2,
  });
});

it("keeps unknown issuance unresolved and blocks duplicate submission after dialog remount", async () => {
  const issue = vi
    .spyOn(adminsApi, "issueInvitation")
    .mockRejectedValue(safeApiError("transient", "NETWORK_ERROR"));
  mount();
  await screen.findByText(admin.fullName);
  fireEvent.click(screen.getByRole("button", { name: "إضافة مسؤول جديد" }));
  fireEvent.change(screen.getByLabelText(/الاسم الكامل/u), {
    target: { value: "Invited" },
  });
  fireEvent.change(screen.getByLabelText(/البريد الإلكتروني/u), {
    target: { value: "invited@example.test" },
  });
  submitForm("مراجعة الدعوة");
  fireEvent.change(screen.getByRole("textbox", { name: /سبب الإجراء/u }), {
    target: { value: "سبب" },
  });
  fireEvent.click(screen.getByRole("button", { name: "تأكيد إرسال الدعوة" }));
  await screen.findByText(/تعذر تأكيد نتيجة الطلب/u);
  fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
  fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
  fireEvent.click(screen.getByRole("button", { name: "إضافة مسؤول جديد" }));
  expect(screen.getByRole("button", { name: "مراجعة الدعوة" })).toBeDisabled();
  expect(issue).toHaveBeenCalledTimes(1);
});

it.each(["empty", "unavailable", "denied"])(
  "distinguishes %s list state without fixture fallback",
  async (outcome) => {
    const list = vi.mocked(adminsApi.listAdmins);
    if (outcome === "empty")
      list.mockResolvedValue({
        items: [],
        pagination: {
          ...pagination,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
        },
      });
    else
      list.mockRejectedValue(
        safeApiError(
          outcome === "denied" ? "denied" : "transient",
          outcome === "denied" ? "FORBIDDEN" : "NETWORK_ERROR",
          outcome === "denied" ? 403 : 0,
        ),
      );
    mount();
    if (outcome === "empty")
      await screen.findByText("لم يتم العثور على مسؤولين");
    else
      await screen.findByText(
        outcome === "denied" ? /تعذر السماح بهذا الطلب/u : /الخدمة غير متاحة/u,
      );
    expect(screen.queryByText(admin.fullName)).not.toBeInTheDocument();
    await act(() => Promise.resolve());
  },
);
