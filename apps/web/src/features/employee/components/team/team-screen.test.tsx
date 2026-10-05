import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import {
  summary,
  reply,
  pagination,
  now,
  actorId,
  otherId,
} from "@/test/p04-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { EmployeeTeamScreen } from "./team-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn() }) }));
cleanupQueries();
it("uses fixed invite identity and only viewer-attributable member earnings", async () => {
  const h = queryHarness("USER", (config) =>
    reply(
      config,
      config.url === "/referrals/me"
        ? summary
        : {
            rootId: actorId,
            serverNow: now,
            memberCountScope: "FILTERED_MEMBERS",
            pagination: { ...pagination, total: 1, totalPages: 1 },
            items: [
              {
                id: otherId,
                fullName: "Persisted descendant",
                joinedAt: now,
                level: 1,
                packageCode: null,
                viewerEarnedFromMember: "0.000001",
              },
            ],
          },
    ),
  );
  render(<EmployeeTeamScreen />, { wrapper: h.wrapper });
  await screen.findByText(summary.root.referralCode);
  fireEvent.click(
    screen.getByRole("button", { name: "أعضاء الفريق (L1 - L5)" }),
  );
  await screen.findByText("Persisted descendant");
  expect(screen.getByText("عمولاتك من هذا العضو")).toBeVisible();
  expect(screen.getByText("+0.000001")).toBeVisible();
  expect(document.body).not.toHaveTextContent("@example");
});
