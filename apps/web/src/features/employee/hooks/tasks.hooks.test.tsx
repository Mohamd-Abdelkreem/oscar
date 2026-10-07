import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { actorId, reply } from "@/test/p04-network";
import { day, emptyPage } from "@/test/p05-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import {
  useTaskToday,
  useTaskHistory,
  useEmployeeTaskCommand,
} from "./tasks.hooks";

cleanupQueries();
describe("scoped employee task hooks", () => {
  it("reads server availability and resets bounded history when filters change", async () => {
    const requests: unknown[] = [];
    const h = queryHarness("USER", (config) => {
      requests.push(config.params);
      return reply(config, config.url === "/tasks/today" ? day : emptyPage());
    });
    const today = renderHook(useTaskToday, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(today.result.current.data?.canUnlock).toBe(true);
    });
    const history = renderHook(
      ({ status }: { status: "PENDING" | "APPROVED" }) =>
        useTaskHistory({ status }),
      { wrapper: h.wrapper, initialProps: { status: "PENDING" } },
    );
    await waitFor(() => {
      expect(history.result.current.isSuccess).toBe(true);
    });
    history.rerender({ status: "APPROVED" });
    await waitFor(() => {
      expect(requests).toContainEqual({
        page: 1,
        limit: 25,
        status: "APPROVED",
      });
    });
    expect(today.result.current.data?.currentEntitlement.dailyReward).toBe("2");
  });
  it("keeps an uncertain dispatched unlock guard after hook unmount without resending", async () => {
    let dispatches = 0;
    const h = queryHarness("USER", (config) =>
      reply(config, {
        state: "NOT_OBSERVED",
        commandId: config.url?.split("/").at(-1),
        kind: "TASK_UNLOCK",
      }),
    );
    const mount = () =>
      renderHook(
        () =>
          useEmployeeTaskCommand({ kind: "TASK_UNLOCK", targetId: actorId }),
        { wrapper: h.wrapper },
      );
    const first = mount();
    await waitFor(() => {
      expect(first.result.current.allowed).toBe(true);
    });
    await act(async () => {
      expect(
        (
          await first.result.current.execute(() => {
            dispatches++;
            return Promise.resolve();
          })
        )?.state,
      ).toBe("NOT_OBSERVED");
    });
    first.unmount();
    const next = mount();
    await waitFor(() => {
      expect(next.result.current.retained).not.toBeNull();
    });
    await act(async () => {
      await expect(
        next.result.current.execute(() => {
          dispatches++;
          return Promise.resolve();
        }),
      ).rejects.toMatchObject({ category: "coordination" });
    });
    expect(dispatches).toBe(1);
  });
});
