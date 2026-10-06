import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { reply } from "@/test/p04-network";
import { emptyPage } from "@/test/p05-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { useAdminTaskSubmissions } from "./task-submissions.hooks";

cleanupQueries();
describe("authoritative review totals", () => {
  it("retains complete filtered status totals independently of the current empty page", async () => {
    const payload = {
      ...emptyPage(),
      statusCounts: { all: 8, pending: 0, approved: 5, rejected: 3 },
    };
    const h = queryHarness("ADMIN", (config) => reply(config, payload));
    const hook = renderHook(
      () => useAdminTaskSubmissions({ status: "PENDING" }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.isSuccess).toBe(true);
    });
    expect(hook.result.current.data?.statusCounts).toEqual(
      payload.statusCounts,
    );
    expect(hook.result.current.data?.items).toEqual([]);
  });
});
