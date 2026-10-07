import { taskEditSchema } from "@template/contracts";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { task } from "@/test/p05-network";
import { reply } from "@/test/p04-network";
import { adminRead, observed } from "@/test/p05-admin-ui";
import { TaskFormScreen } from "./task-form-screen";
import { ProtectedRoute } from "@/components/auth/protected-route";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => `/admin/tasks/${task.id}/edit`,
}));
cleanupQueries();
beforeEach(() => push.mockClear());
it("requires distinct confirmation and sends a single-date revisioned edit without reward authority", async () => {
  let body: Record<string, unknown> | null = null;
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") {
      body = taskEditSchema.parse(JSON.parse(String(config.data)));
      return reply(config, { ...task, revision: 2 });
    }
    if (config.url?.startsWith("/task-commands/"))
      return reply(
        config,
        observed(String(body?.["commandId"]), "TASK_EDIT", task.id, {
          ...task,
          revision: 2,
        }),
      );
    return adminRead(config);
  });
  render(<TaskFormScreen taskId={task.id} isEdit />, { wrapper: h.wrapper });
  const title = await screen.findByLabelText(/عنوان المهمة/);
  expect(screen.getByDisplayValue("12:00")).toBeDisabled();
  fireEvent.change(title, { target: { value: "عنوان محرر" } });
  fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
  expect(body).toBeNull();
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "تأكيد الإجراء" }),
  );
  await waitFor(() => {
    expect(push).toHaveBeenCalledWith("/admin/tasks/" + task.id);
  });
  expect(body).toMatchObject({
    confirmed: true,
    expectedTaskRevision: 1,
    publicationDate: task.publicationDate,
    title: "عنوان محرر",
  });
  expect(body).not.toHaveProperty("rewardAmount");
  expect(body).not.toHaveProperty("windowStart");
});

it("does not substitute a refreshed revision into an already reviewed edit", async () => {
  let current = task;
  let edits = 0;
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") {
      edits++;
      throw new Error("Unexpected edit");
    }
    if (config.url === "/admin/tasks/" + task.id) return reply(config, current);
    return adminRead(config);
  });
  render(<TaskFormScreen taskId={task.id} isEdit />, { wrapper: h.wrapper });
  fireEvent.change(await screen.findByLabelText(/عنوان المهمة/), {
    target: { value: "مسودة مراجعة" },
  });
  fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
  const dialog = await screen.findByRole("dialog");
  current = { ...task, revision: 2, title: "تعديل مسؤول آخر" };
  await act(async () => {
    await h.client.invalidateQueries({ queryKey: ["p05"] });
  });
  await waitFor(() => {
    expect(
      within(dialog).getByRole("button", { name: "تأكيد الإجراء" }),
    ).toBeEnabled();
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "تأكيد الإجراء" }),
  );
  await screen.findByText(
    "تغيرت بيانات المهمة؛ راجع النسخة الحالية وأكد التعديل من جديد.",
  );
  expect(edits).toBe(0);
  expect(screen.getByDisplayValue("مسودة مراجعة")).toBeInTheDocument();
});
it("retains a dirty draft refreshed before confirmation until the current version is explicitly loaded", async () => {
  let current = task;
  let body: Record<string, unknown> | null = null;
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") {
      body = taskEditSchema.parse(JSON.parse(String(config.data)));
      return reply(config, { ...current, revision: 3 });
    }
    if (config.url?.startsWith("/task-commands/"))
      return reply(
        config,
        observed(String(body?.["commandId"]), "TASK_EDIT", task.id, {
          ...current,
          revision: 3,
        }),
      );
    if (config.url === "/admin/tasks/" + task.id) return reply(config, current);
    return adminRead(config);
  });
  render(<TaskFormScreen taskId={task.id} isEdit />, { wrapper: h.wrapper });
  fireEvent.change(await screen.findByLabelText(/عنوان المهمة/), {
    target: { value: "مسودة محلية" },
  });
  current = {
    ...task,
    revision: 2,
    title: "تعديل مسؤول آخر",
    description: "تعليمات مسؤول آخر",
    targetUrl: "https://example.com/remote",
  };
  await act(async () => {
    await h.client.invalidateQueries({ queryKey: ["p05"] });
  });
  expect(screen.getByDisplayValue("مسودة محلية")).toBeInTheDocument();
  const reconcile = await screen.findByRole("button", {
    name: "تحميل النسخة الحالية",
  });
  fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(body).toBeNull();
  fireEvent.click(reconcile);
  expect(screen.getByDisplayValue(current.title)).toBeInTheDocument();
  expect(screen.getByDisplayValue(current.description)).toBeInTheDocument();
  expect(screen.getByDisplayValue(current.targetUrl)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/عنوان المهمة/), {
    target: { value: "تعديل بعد المراجعة" },
  });
  fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "تأكيد الإجراء",
    }),
  );
  await waitFor(() => {
    expect(body).toMatchObject({
      expectedTaskRevision: 2,
      title: "تعديل بعد المراجعة",
      description: current.description,
      targetUrl: current.targetUrl,
    });
  });
});

it("refreshes pristine editable fields and their revision together before confirmation", async () => {
  let current = task;
  let body: Record<string, unknown> | null = null;
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") {
      body = taskEditSchema.parse(JSON.parse(String(config.data)));
      return reply(config, { ...current, revision: 3 });
    }
    if (config.url?.startsWith("/task-commands/"))
      return reply(
        config,
        observed(String(body?.["commandId"]), "TASK_EDIT", task.id, {
          ...current,
          revision: 3,
        }),
      );
    if (config.url === "/admin/tasks/" + task.id) return reply(config, current);
    return adminRead(config);
  });
  render(<TaskFormScreen taskId={task.id} isEdit />, { wrapper: h.wrapper });
  await screen.findByLabelText(/عنوان المهمة/);
  current = {
    ...task,
    revision: 2,
    title: "عنوان حالي",
    description: "تعليمات حالية",
    platform: "منصة حالية",
    targetUrl: "https://example.com/current",
    isCodeRequired: false,
    publicationDate: "2026-10-06",
    publicationState: "PAUSED",
  };
  await act(async () => {
    await h.client.invalidateQueries({ queryKey: ["p05"] });
  });
  expect(screen.getByDisplayValue(current.title)).toBeInTheDocument();
  expect(screen.getByDisplayValue(current.description)).toBeInTheDocument();
  expect(screen.getByDisplayValue(current.platform)).toBeInTheDocument();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "تأكيد الإجراء",
    }),
  );
  await waitFor(() => {
    expect(body).toMatchObject({
      expectedTaskRevision: 2,
      title: current.title,
      description: current.description,
      platform: current.platform,
      publicationDate: current.publicationDate,
      publicationState: "PAUSED",
      isCodeRequired: false,
    });
  });
});
it("preserves a dirty draft through a failed edit and offers original observation", async () => {
  let refreshFails = false;
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") {
      refreshFails = true;
      throw new Error("lost response");
    }
    if (refreshFails && config.url === "/admin/tasks/" + task.id)
      throw new Error("failed refresh");
    return adminRead(config);
  });
  render(<TaskFormScreen taskId={task.id} isEdit />, { wrapper: h.wrapper });
  fireEvent.change(await screen.findByLabelText(/عنوان المهمة/), {
    target: { value: "مسودة محفوظة" },
  });
  fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "تأكيد الإجراء",
    }),
  );
  await screen.findByRole("button", { name: "التحقق من الطلب" });
  expect(screen.getByDisplayValue("مسودة محفوظة")).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

it("preserves a dirty editor through same-account session revalidation and discards it when the scope retires", async () => {
  let current = task;
  const h = queryHarness("ADMIN", (config) =>
    config.url === "/admin/tasks/" + task.id
      ? reply(config, current)
      : adminRead(config),
  );
  render(
    <ProtectedRoute allowedRoles={["ADMIN"]} preserveStateDuringCheck>
      <TaskFormScreen taskId={task.id} isEdit />
    </ProtectedRoute>,
    { wrapper: h.wrapper },
  );
  fireEvent.change(await screen.findByLabelText(/عنوان المهمة/), {
    target: { value: "مسودة عبر التحقق" },
  });
  current = { ...task, revision: 2, description: "تعليمات بعيدة" };
  await act(async () => {
    h.runtime.beginCheck();
    await Promise.resolve();
  });
  await screen.findByRole("button", { name: "تحميل النسخة الحالية" });
  expect(screen.getByDisplayValue("مسودة عبر التحقق")).toBeInTheDocument();
  expect(screen.getByDisplayValue(task.description)).toBeInTheDocument();
  await act(async () => {
    h.runtime.retire();
    await Promise.resolve();
  });
  await waitFor(() => {
    expect(
      screen.queryByDisplayValue("مسودة عبر التحقق"),
    ).not.toBeInTheDocument();
  });
});
