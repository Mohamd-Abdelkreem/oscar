import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import {
  adminSummary,
  pagination,
  reply,
  now,
  actorId,
  otherId,
} from "@/test/p04-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { ReferralsScreen } from "./referrals-screen";

cleanupQueries();
const originalScroll = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);
afterEach(() => {
  if (originalScroll)
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScroll,
    );
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
it("root search and within-team query use independent bounded requests without putting root in L1", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const requests: { path: string; q: unknown }[] = [];
  const h = queryHarness("ADMIN", (config) => {
    requests.push({
      path: config.url ?? "",
      q:
        typeof config.params === "object" && config.params !== null
          ? Reflect.get(config.params, "q")
          : undefined,
    });
    if (config.url === "/admin/referrals/roots")
      return reply(config, {
        items: [adminSummary.root],
        pagination: { ...pagination, total: 1, totalPages: 1 },
      });
    if (config.url?.endsWith("/members"))
      return reply(config, {
        rootId: actorId,
        memberCountScope: "FILTERED_MEMBERS",
        serverNow: now,
        items: [],
        pagination,
      });
    if (config.url?.endsWith("/commissions"))
      return reply(config, {
        beneficiaryId: actorId,
        serverNow: now,
        items: [],
        pagination,
        summary: { scope: "FILTERED_BENEFICIARY_DECISIONS", awarded: "0" },
      });
    return reply(config, {
      ...adminSummary,
      levelCounts: adminSummary.levelCounts.map((count) => ({
        ...count,
        members: count.level === 1 ? 1 : 0,
      })),
    });
  });
  render(<ReferralsScreen />, { wrapper: h.wrapper });
  fireEvent.change(
    screen.getByRole("textbox", { name: "بحث عن الحساب الجذر" }),
    { target: { value: "Employee" } },
  );
  await waitFor(() => {
    expect(
      requests.some(
        (request) =>
          request.path.endsWith("/roots") && request.q === "Employee",
      ),
    ).toBe(true);
  });
  // The custom select uses an accessible combobox and listbox.
  fireEvent.click(
    screen.getByRole("combobox", { name: "اختر عضو لحساب فريقه" }),
  );
  fireEvent.keyDown(await screen.findByRole("option", { name: /Employee/u }), {
    key: "Enter",
  });
  await screen.findByText("الحساب المختار: فريق Employee");
  fireEvent.change(
    screen.getByRole("textbox", { name: "تصفية أعضاء فريق الحساب المختار" }),
    { target: { value: "descendant" } },
  );
  await waitFor(() => {
    expect(
      requests.some(
        (request) =>
          request.path.endsWith("/members") && request.q === "descendant",
      ),
    ).toBe(true);
  });
  expect(
    requests.some(
      (request) => request.path.endsWith("/roots") && request.q === "Employee",
    ),
  ).toBe(true);
  expect(document.body).not.toHaveTextContent(otherId);
});
