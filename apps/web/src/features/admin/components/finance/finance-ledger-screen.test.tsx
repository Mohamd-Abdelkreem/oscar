import { render, screen, fireEvent } from "@testing-library/react";
import { adminLedgerFilterSchema } from "@template/contracts";
import { it, expect } from "vitest";
import { finance, reply, operation, actorId } from "@/test/p04-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { FinanceLedgerScreen } from "./finance-ledger-screen";

cleanupQueries();
it("renders filtered server neutral count across page changes and sends search to the server", async () => {
  const searches: unknown[] = [];
  const h = queryHarness("ADMIN", (config) => {
    searches.push(config.params);
    const { page } = adminLedgerFilterSchema.parse(config.params);
    return reply(config, {
      ...finance,
      items: Array.from({ length: page === 1 ? 25 : 16 }, (_, index) => ({
        ...operation,
        operationId: `00000000-0000-4000-8000-${String(index + (page - 1) * 25 + 10).padStart(12, "0")}`,
        employee: {
          id: actorId,
          fullName: "Employee",
          email: "employee@example.test",
        },
      })),
      summary: { ...finance.summary, neutralOperationsCount: 41 },
      pagination: {
        page,
        limit: 25,
        total: 41,
        totalPages: 2,
        hasPreviousPage: page > 1,
        hasNextPage: page < 2,
      },
    });
  });
  render(<FinanceLedgerScreen />, { wrapper: h.wrapper });
  await screen.findByText("41 عملية");
  fireEvent.click(screen.getByRole("button", { name: "التالي" }));
  await screen.findByText("عرض السجلات من", { exact: false });
  expect(screen.getByText("41 عملية")).toBeVisible();
  fireEvent.change(
    screen.getByRole("textbox", { name: "بحث في السجل المالي" }),
    { target: { value: "source" } },
  );
  await screen.findByText("41 عملية");
  expect(
    searches.some(
      (query) =>
        typeof query === "object" &&
        query !== null &&
        "q" in query &&
        query.q === "source",
    ),
  ).toBe(true);
});
it("malformed required neutral count does not render a zero metric", async () => {
  const h = queryHarness("ADMIN", (config) =>
    reply(config, {
      ...finance,
      summary: {
        scope: "FILTERED_OPERATIONS",
        credits: "0",
        debits: "0",
        net: "0",
      },
    }),
  );
  render(<FinanceLedgerScreen />, { wrapper: h.wrapper });
  await screen.findByRole("alert");
  expect(screen.queryByText("0 عملية")).toBeNull();
  expect(screen.queryByText("لا توجد عمليات مالية مطابقة")).toBeNull();
});
