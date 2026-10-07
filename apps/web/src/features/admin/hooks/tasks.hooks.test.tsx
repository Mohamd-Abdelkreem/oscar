import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { actorId, otherId, reply } from "@/test/p04-network";
import { task } from "@/test/p05-network";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import { useAdminTask, useAdminTaskCommand } from "./tasks.hooks";

cleanupQueries();
describe("admin task selection authority", () => {
  it("discards earlier detail on selection change and never enables edits from a mismatched record", async () => {
    const gate = deferred<undefined>();
    let reading = false;
    const h = queryHarness("ADMIN", async (config) => {
      reading = true;
      await gate.promise;
      return reply(config, task);
    });
    const hook = renderHook(({ id }) => useAdminTask(id), {
      wrapper: h.wrapper,
      initialProps: { id: actorId },
    });
    await waitFor(() => {
      expect(reading).toBe(true);
    });
    hook.rerender({ id: otherId });
    await act(async () => {
      gate.resolve(undefined);
      await gate.promise;
    });
    await waitFor(() => {
      expect(hook.result.current.isError).toBe(true);
    });
    expect(hook.result.current.data).toBeUndefined();
  });
  it("rejects old-resource command completion without promoting it into the selected draft", async () => {
    const gate = deferred<undefined>();
    const h = queryHarness("ADMIN", (config) =>
      reply(config, {
        state: "NOT_OBSERVED",
        commandId: config.url?.split("/").at(-1),
        kind: "TASK_EDIT",
      }),
    );
    const hook = renderHook(
      ({ id }) => useAdminTaskCommand({ kind: "TASK_EDIT", targetId: id }),
      { wrapper: h.wrapper, initialProps: { id: actorId } },
    );
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    let pending: ReturnType<typeof hook.result.current.execute> | undefined;
    act(() => {
      pending = hook.result.current.execute(() => gate.promise);
    });
    hook.rerender({ id: otherId });
    await act(async () => {
      gate.resolve(undefined);
      await expect(pending).rejects.toMatchObject({ category: "obsolete" });
    });
    expect(hook.result.current.retained).toBeNull();
    expect(hook.result.current.error).toBeNull();
  });
});
