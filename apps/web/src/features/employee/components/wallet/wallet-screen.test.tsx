import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { ledger, operation, wallet, reply, reject } from "@/test/p04-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { EmployeeWalletScreen } from "./wallet-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn() }) }));
cleanupQueries();
it("a withdrawal restriction preserves every source and distinguishes funds from action permission", async () => {
  const h = queryHarness("USER", (config) =>
    reply(
      config,
      config.url === "/wallet/me"
        ? {
            ...wallet,
            restrictions: {
              accountUnavailable: false,
              withdrawalsBlocked: true,
            },
          }
        : ledger,
    ),
  );
  render(<EmployeeWalletScreen />, { wrapper: h.wrapper });
  expect(
    await screen.findByText(/السحب محظور حالياً على الحساب/u),
  ).toHaveTextContent("أهلية المصادر لا تعني السماح بالسحب");
  expect(screen.getByText(/المحجوز الإحالي:/u)).toHaveTextContent("3.00");
  expect(screen.getByText(/المحجوز غير الإحالي:/u)).toHaveTextContent("2.00");
  expect(screen.getByText(/إجمالي الرصيد غير المحجوز:/u)).toHaveTextContent(
    "40.00",
  );
  expect(screen.getByText("المتاح الإحالي").parentElement).toHaveTextContent(
    "10.00",
  );
  expect(
    screen.getByText("المتاح غير الإحالي").parentElement,
  ).toHaveTextContent("30.00");
  expect(screen.getAllByText("45.00")).toHaveLength(2);
  expect(
    screen.getByText("إحالات غير مؤهلة للسحب").parentElement,
  ).toHaveTextContent("10.00");
});
it("neutral reservation details preserve sources and filter changes retire the sheet", async () => {
  const h = queryHarness("USER", (config) =>
    reply(
      config,
      config.url === "/wallet/me"
        ? wallet
        : config.url?.endsWith(operation.operationId)
          ? { ...operation, savedTerms: null }
          : {
              ...ledger,
              items: [operation],
              pagination: { ...ledger.pagination, total: 1, totalPages: 1 },
            },
    ),
  );
  render(<EmployeeWalletScreen />, { wrapper: h.wrapper });
  fireEvent.click(await screen.findByRole("button", { name: /حجز رصيد/u }));
  await screen.findByRole("dialog");
  expect(screen.getByRole("dialog")).toHaveTextContent("1.000001");
  expect(screen.getByRole("dialog")).toHaveTextContent("المحجوز");
  fireEvent.click(screen.getByRole("button", { name: "الإيداعات" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("denial never becomes zero balances or empty history", async () => {
  const h = queryHarness("USER", (config) => reject(config, "FORBIDDEN", 403));
  render(<EmployeeWalletScreen />, { wrapper: h.wrapper });
  await screen.findAllByRole("alert");
  expect(screen.queryByText("0.00")).toBeNull();
  expect(
    screen.queryByText("لا توجد عمليات مسجلة تحت هذا التصنيف."),
  ).toBeNull();
});
