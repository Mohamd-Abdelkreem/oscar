import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import { safeApiError } from "@/services/api/safe-error";
import {
  financialQueryKey,
  taskQueryKey,
  useTaskRead,
} from "./financial-query";

cleanupQueries();
afterEach(() => vi.useRealTimers());
describe("P05 private read lifetime", () => {
  it("polls pending work and stops as soon as the saved state becomes final", async () => {
    let reads = 0;
    const h = queryHarness("USER", () => {
      throw new Error("Unexpected request");
    });
    const hook = renderHook(
      () =>
        useTaskRead({
          domain: "polling",
          role: "USER",
          selection: [],
          pending: (saved: { status: string }) => saved.status === "PENDING",
          read: () =>
            Promise.resolve({ status: ++reads === 1 ? "PENDING" : "APPROVED" }),
        }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.data?.status).toBe("PENDING");
    });
    vi.useFakeTimers();
    // Refetch re-arms the interval under the controlled browser clock.
    reads = 0;
    await act(async () => {
      await hook.result.current.refetch();
      await vi.advanceTimersByTimeAsync(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_001);
    });
    expect(hook.result.current.data?.status).toBe("APPROVED");
    const finalReads = reads;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(reads).toBe(finalReads);
  });
  it("keeps task denial across remount without retiring unrelated data", async () => {
    let reads = 0;
    let denied = true;
    const h = queryHarness("USER", () => {
      throw new Error("Unexpected domain request");
    });
    h.client.setQueryData(["public"], "retained");
    const read = () => {
      reads++;
      if (denied) throw safeApiError("denied", "FORBIDDEN", 403);
      return Promise.resolve("saved");
    };
    const mount = () =>
      renderHook(
        () =>
          useTaskRead({
            domain: "today",
            role: "USER",
            selection: ["task-a"],
            read,
          }),
        { wrapper: h.wrapper },
      );
    const first = mount();
    await waitFor(() => {
      expect(first.result.current.isError).toBe(true);
    });
    first.unmount();
    const second = mount();
    await waitFor(() => {
      expect(second.result.current.isError).toBe(true);
    });
    expect(reads).toBe(1);
    expect(second.result.current.data).toBeUndefined();
    denied = false;
    await act(async () => {
      await second.result.current.refetch();
    });
    await waitFor(() => {
      expect(second.result.current.data).toBe("saved");
    });
    expect(h.client.getQueryData(["public"])).toBe("retained");
  });
  it("retires both private namespaces and rejects delayed task completion", async () => {
    const h = queryHarness("USER", () => {
      throw new Error("Unexpected domain request");
    });
    const scope = h.runtime.scope();
    h.client.setQueryData([...financialQueryKey(scope), "wallet"], "private");
    h.client.setQueryData([...taskQueryKey(scope), "history"], "private");
    h.client.setQueryData(["public"], "retained");
    const pending = deferred<string>();
    const hook = renderHook(
      () =>
        useTaskRead({
          domain: "today",
          role: "USER",
          selection: [],
          read: () => pending.promise,
        }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.isFetching).toBe(true);
    });
    act(() => {
      h.runtime.retire();
    });
    await act(async () => {
      pending.resolve("old proof");
      await pending.promise;
    });
    expect(hook.result.current.data).toBeUndefined();
    expect(
      h.client.getQueryData([...financialQueryKey(scope), "wallet"]),
    ).toBeUndefined();
    expect(
      h.client.getQueryData([...taskQueryKey(scope), "history"]),
    ).toBeUndefined();
    // The shared authentication owner clears the client during full retirement.
    expect(h.client.getQueryData(["public"])).toBeUndefined();
  });
});
