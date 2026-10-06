import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { code } from "@/test/p05-network";
import { adminRead } from "@/test/p05-admin-ui";
import { CodeDetailScreen } from "./code-detail-screen";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
cleanupQueries();
it("reads authorized usage and domain audit separately from the code detail", async () => {
  const reads: string[] = [];
  const h = queryHarness("ADMIN", (config) => {
    reads.push(config.url ?? "");
    return adminRead(config);
  });
  render(<CodeDetailScreen codeId={code.id} />, { wrapper: h.wrapper });
  await screen.findByRole("heading", {
    name: "تفاصيل رمز فتح المهمة: " + code.normalizedText,
  });
  await waitFor(() => {
    expect(reads).toContain("/admin/task-codes/" + code.id + "/changes");
  });
  expect(reads).toContain("/admin/task-codes/" + code.id + "/usages");
});
