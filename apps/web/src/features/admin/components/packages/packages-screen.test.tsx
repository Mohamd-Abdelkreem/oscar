import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect } from "vitest";
import { reply, adminCatalog, change } from "@/test/p04-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { PackagesScreen } from "./packages-screen";

cleanupQueries();
it("preserves authoritative counts and requires exact text, reason and distinct review before PATCH", async () => {
  const bodies: unknown[] = [];
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") {
      const body: unknown = JSON.parse(String(config.data));
      bodies.push(body);
      return reply(
        config,
        typeof body === "object" && body !== null && "commandId" in body
          ? { ...change, commandId: body.commandId }
          : {},
      );
    }
    return reply(config, adminCatalog);
  });
  render(<PackagesScreen />, { wrapper: h.wrapper });
  expect(
    screen.getByRole("columnheader", {
      name: "الإجمالي المشروط بالمهام المعتمدة قبل تكلفة الباقة ورسوم السحب",
    }),
  ).toBeVisible();
  await screen.findAllByText("37 موظف");
  const edit = screen.getAllByRole("button", { name: "تعديل" })[0];
  if (!edit) throw new Error("Missing edit control");
  fireEvent.click(edit);
  await screen.findByLabelText("سعر الاشتراك (USDT)");
  fireEvent.change(screen.getByLabelText("سعر الاشتراك (USDT)"), {
    target: { value: "61.000001" },
  });
  fireEvent.change(screen.getByLabelText("سبب التعديل"), {
    target: { value: change.reason },
  });
  fireEvent.click(screen.getByRole("button", { name: "مراجعة التعديلات" }));
  await screen.findByRole("button", { name: "تأكيد حفظ الشروط المراجعة" });
  expect(bodies).toHaveLength(0);
  expect(screen.getByRole("dialog")).toHaveTextContent("61.000001");
  fireEvent.click(
    screen.getByRole("button", { name: "تأكيد حفظ الشروط المراجعة" }),
  );
  await waitFor(() => {
    expect(bodies).toHaveLength(1);
  });
  expect(bodies[0]).toMatchObject({
    price: "61.000001",
    expectedVersion: 1,
    reason: change.reason,
    confirmed: true,
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
it("missing active count is unavailable rather than invented zero or a removed column", async () => {
  const h = queryHarness("ADMIN", (config) =>
    reply(config, {
      ...adminCatalog,
      items: adminCatalog.items.map((item) => ({ terms: item.terms })),
    }),
  );
  render(<PackagesScreen />, { wrapper: h.wrapper });
  await screen.findByRole("alert");
  expect(
    screen.getByRole("columnheader", { name: "الاشتراكات النشطة" }),
  ).toBeVisible();
  expect(screen.queryByRole("button", { name: "تعديل" })).toBeNull();
});
