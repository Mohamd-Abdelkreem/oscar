import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { reply } from "@/test/p04-network";
import { day } from "@/test/p05-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { EmployeeTasksScreen } from "./tasks-screen";

cleanupQueries();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn() }) }));
describe("live daily task screen", () => {
  it("uses server Free state even when a demo scenario is present in the URL", async () => {
    const h = queryHarness("USER", (config) =>
      reply(config, {
        ...day,
        workEligibility: "FREE",
        canUnlock: false,
        canSubmit: false,
        unavailableReason: "FREE",
        currentEntitlement: {
          effective: false,
          packageCode: null,
          packageLabel: null,
          dailyReward: null,
        },
      }),
    );
    history.replaceState(null, "", "/employee/tasks?scenario=open");
    render(<EmployeeTasksScreen />, { wrapper: h.wrapper });
    await screen.findByText("لا يوجد منصب نشط للمهام");
    expect(
      screen.queryByRole("button", { name: "فتح المهمة" }),
    ).not.toBeInTheDocument();
  });
});
