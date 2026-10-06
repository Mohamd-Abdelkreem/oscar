import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { actorId, reply } from "@/test/p04-network";
import { emptyPage } from "@/test/p05-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { useAdminTaskCodes } from "./task-codes.hooks";

cleanupQueries();
describe("bounded code list", () => {
  it("keeps the accepted limit ten and query-selected task attribution", async () => {
    const queries: unknown[] = [];
    const h = queryHarness("ADMIN", (config) => {
      queries.push(config.params);
      return reply(config, emptyPage(10));
    });
    const hook = renderHook(() => useAdminTaskCodes({ taskId: actorId }), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.isSuccess).toBe(true);
    });
    expect(queries).toEqual([{ taskId: actorId, page: 1, limit: 10 }]);
    expect(hook.result.current.data?.items).toEqual([]);
  });
});
