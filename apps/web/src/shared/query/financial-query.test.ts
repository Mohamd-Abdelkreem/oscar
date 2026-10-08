import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import { safeApiError } from "@/services/api/safe-error";
import { focusManager, onlineManager } from "@tanstack/react-query";
import {
  financialQueryKey,
  taskQueryKey,
  useTaskRead,
  depositQueryKey,
  useDepositRead,
  useDepositList,
} from "./financial-query";

cleanupQueries();
afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});
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

describe("P07 private observation", () => {
  const tick = async (milliseconds: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(milliseconds);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
  };
  const noNetwork = () => {
    throw new Error("Unexpected network request");
  };

  it("keeps scoped accepted rows on a transient error and removes P07 data on retirement", async () => {
    const h = queryHarness("USER", noNetwork);
    let fail = false;
    const hook = renderHook(
      () =>
        useDepositRead({
          domain: "history",
          role: "USER",
          selection: [1],
          read: () =>
            fail
              ? Promise.reject(
                  safeApiError("transient", "DEPOSIT_UNAVAILABLE", 503),
                )
              : Promise.resolve("saved"),
        }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.data).toBe("saved");
    });
    const scope = h.runtime.scope();
    fail = true;
    await act(async () => {
      await hook.result.current.refetch();
    });
    await waitFor(() => {
      expect(hook.result.current.isError).toBe(true);
    });
    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.acceptedData).toBe("saved");
    act(() => {
      h.runtime.retire();
    });
    expect(hook.result.current.acceptedData).toBeUndefined();
    expect(
      h.client.getQueryData([...depositQueryKey(scope), "history", 1]),
    ).toBeUndefined();
  });

  it("caps successful and failed automatic reads at 20 without secondary retries", async () => {
    const h = queryHarness("USER", noNetwork);
    h.client.setDefaultOptions({ queries: { retry: 2, retryDelay: 0 } });
    let reads = 0;
    const hook = renderHook(
      () =>
        useDepositRead({
          domain: "address",
          role: "USER",
          selection: [],
          pending: () => true,
          read: () =>
            ++reads % 2 === 0
              ? Promise.reject(
                  safeApiError("transient", "DEPOSIT_UNAVAILABLE", 503),
                )
              : Promise.resolve("PROVISIONING"),
        }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.observationCount).toBe(1);
    });
    vi.useFakeTimers();
    reads = 0;
    await act(async () => {
      await hook.result.current.refetch();
    });
    await tick(1);
    for (const delay of [
      5_000,
      10_000,
      20_000,
      30_000,
      ...Array<number>(15).fill(60_000),
    ]) {
      const before = reads;
      await tick(delay - 100);
      expect(reads).toBe(before);
      await tick(100);
      expect(reads).toBe(before + 1);
    }
    expect(reads).toBe(20);
    expect(hook.result.current.observationExhausted).toBe(true);
    await tick(600_000);
    expect(reads).toBe(20);
    await act(async () => {
      await hook.result.current.refetch();
    });
    expect(reads).toBe(21);
    await tick(5_001);
    expect(reads).toBe(22);
  });

  it("preserves partial backoff and exhausted budget across checks, remount and query recreation", async () => {
    const h = queryHarness("USER", noNetwork);
    let reads = 0;
    const mount = () =>
      renderHook(
        () =>
          useDepositRead({
            domain: "address",
            role: "USER",
            selection: [],
            pending: () => true,
            read: () => Promise.resolve(++reads),
          }),
        { wrapper: h.wrapper },
      );
    let hook = mount();
    await waitFor(() => {
      expect(hook.result.current.observationCount).toBe(1);
    });
    vi.useFakeTimers();
    reads = 0;
    await act(async () => {
      await hook.result.current.refetch();
    });
    await tick(1);
    await tick(5_001);
    expect(reads).toBe(2);
    await tick(4_000);
    act(() => {
      h.runtime.beginCheck();
    });
    await tick(1);
    expect(reads).toBe(2);
    hook.unmount();
    await tick(1);
    h.client.removeQueries({ queryKey: ["p07"] });
    hook = mount();
    await tick(1);
    expect(hook.result.current.observationCount).toBe(2);
    expect(reads).toBe(2);
    await tick(6_001);
    expect(reads).toBe(3);
    for (let i = 3; i < 20; i++) await tick(60_001);
    expect(reads).toBe(20);
    hook.unmount();
    await tick(1);
    h.client.removeQueries({ queryKey: ["p07"] });
    act(() => {
      focusManager.setFocused(false);
      onlineManager.setOnline(false);
      h.runtime.beginCheck();
    });
    hook = mount();
    await tick(1);
    act(() => {
      focusManager.setFocused(true);
      onlineManager.setOnline(true);
      h.runtime.beginCheck();
    });
    await tick(600_001);
    expect(hook.result.current.observationExhausted).toBe(true);
    expect(reads).toBe(20);
    expect(hook.result.current.scope.check).toBe(h.runtime.scope().check);
    await act(async () => {
      await hook.result.current.refetch();
    });
    expect(reads).toBe(21);
  });

  it("pauses hidden, inactive and offline reads and resumes the same window", async () => {
    const h = queryHarness("USER", noNetwork);
    let reads = 0;
    const hook = renderHook(
      () =>
        useDepositRead({
          domain: "address",
          role: "USER",
          selection: [],
          pending: () => true,
          read: () => Promise.resolve(++reads),
        }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.observationCount).toBe(1);
    });
    vi.useFakeTimers();
    for (const pause of ["hidden", "inactive", "offline"]) {
      act(() => {
        if (pause === "hidden") {
          vi.spyOn(document, "visibilityState", "get").mockReturnValue(
            "hidden",
          );
          document.dispatchEvent(new Event("visibilitychange"));
        } else if (pause === "inactive") focusManager.setFocused(false);
        else onlineManager.setOnline(false);
      });
      const before = reads;
      await tick(120_001);
      expect(reads).toBe(before);
      act(() => {
        vi.restoreAllMocks();
        document.dispatchEvent(new Event("visibilitychange"));
        focusManager.setFocused(true);
        onlineManager.setOnline(true);
      });
      await tick(2);
      expect(reads).toBe(before + 1);
    }
  });

  it.each(["contract", "denied"] as const)(
    "stops %s reads until explicit current-authority refresh",
    async (category) => {
      const h = queryHarness("USER", noNetwork);
      let reads = 0;
      let fail = true;
      const hook = renderHook(
        () =>
          useDepositRead({
            domain: "address",
            role: "USER",
            selection: [],
            pending: () => true,
            read: () => {
              reads++;
              return fail
                ? Promise.reject(
                    safeApiError(
                      category,
                      category === "denied" ? "FORBIDDEN" : "CONTRACT_ERROR",
                      category === "denied" ? 403 : 0,
                    ),
                  )
                : Promise.resolve("READY");
            },
          }),
        { wrapper: h.wrapper },
      );
      await waitFor(() => {
        expect(hook.result.current.isError).toBe(true);
      });
      vi.useFakeTimers();
      await tick(600_001);
      expect(reads).toBe(1);
      expect(hook.result.current.acceptedData).toBeUndefined();
      fail = false;
      await act(async () => {
        await hook.result.current.refetch();
      });
      await tick(1);
      expect(hook.result.current.data).toBe("READY");
    },
  );

  it("joins repeated refreshes without cancelling a pending read and ignores retired completion", async () => {
    const h = queryHarness("USER", noNetwork);
    const pending = deferred<string>();
    let reads = 0;
    let cancelled = false;
    const hook = renderHook(
      () =>
        useDepositRead({
          domain: "address",
          role: "USER",
          selection: [],
          pending: () => true,
          read: (_scope, signal) => {
            reads++;
            signal.addEventListener("abort", () => {
              cancelled = true;
            });
            return pending.promise;
          },
        }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(reads).toBe(1);
    });
    const first = hook.result.current.refetch();
    expect(hook.result.current.refetch()).toBe(first);
    expect(cancelled).toBe(false);
    act(() => {
      h.runtime.retire();
    });
    await act(async () => {
      pending.resolve("old-address");
      await first;
    });
    expect(hook.result.current.data).toBeUndefined();
    expect(reads).toBe(1);
    expect(cancelled).toBe(true);
  });

  it("admits a new normalized selection with a new budget but never polls targets", async () => {
    const h = queryHarness("ADMIN", noNetwork);
    let reads = 0;
    const hook = renderHook(
      ({ q }) =>
        useDepositRead({
          domain: "targets",
          role: "ADMIN",
          selection: [{ q }],
          read: () => Promise.resolve(++reads),
        }),
      { wrapper: h.wrapper, initialProps: { q: " employee " } },
    );
    await waitFor(() => {
      expect(hook.result.current.data).toBe(1);
    });
    vi.useFakeTimers();
    hook.rerender({ q: "employee" });
    await tick(600_001);
    expect(reads).toBe(1);
    hook.rerender({ q: "other" });
    await tick(2);
    expect(reads).toBe(2);
    expect(hook.result.current.observationCount).toBe(1);
  });

  it("stops final receiving states and suppresses observation of navigated history pages even on error", async () => {
    const h = queryHarness("USER", noNetwork);
    let addressReads = 0;
    let historyReads = 0;
    const hook = renderHook(
      () => ({
        address: useDepositRead({
          domain: "address",
          role: "USER",
          selection: [],
          pending: (saved: string) => saved === "PROVISIONING",
          read: () =>
            Promise.resolve(++addressReads === 1 ? "PROVISIONING" : "READY"),
        }),
        history: useDepositList({
          domain: "history",
          role: "USER",
          filters: {},
          pending: () => true,
          read: (_scope, selection) => {
            historyReads++;
            return selection.page === 1
              ? Promise.resolve({ pagination: { totalPages: 2 } })
              : Promise.reject(
                  safeApiError("transient", "SERVICE_UNAVAILABLE", 503),
                );
          },
        }),
      }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.address.data).toBe("PROVISIONING");
      expect(hook.result.current.history.data).toBeDefined();
    });
    vi.useFakeTimers();
    await act(async () => {
      await hook.result.current.address.refetch();
    });
    await tick(1);
    expect(hook.result.current.address.data).toBe("READY");
    act(() => {
      hook.result.current.history.setPage(2);
    });
    await tick(2);
    expect(hook.result.current.history.isError).toBe(true);
    const observed = historyReads;
    await tick(600_001);
    expect(addressReads).toBe(2);
    expect(historyReads).toBe(observed);
  });

  it.each([10, 25] as const)(
    "bounds lists to %s rows, resets selection, clamps settled pages and recovers missing pagination",
    async (limit) => {
      const h = queryHarness("ADMIN", noNetwork);
      let fail = false;
      const requests: { page: number; limit: number; q: string }[] = [];
      const hook = renderHook(
        ({ q, enabled }) =>
          useDepositList({
            domain: "history",
            role: "ADMIN",
            filters: { q },
            limit,
            enabled,
            read: (_scope, selection) => {
              requests.push(selection);
              return fail
                ? Promise.reject(
                    safeApiError("transient", "SERVICE_UNAVAILABLE", 503),
                  )
                : Promise.resolve({ pagination: { totalPages: 2 } });
            },
          }),
        { wrapper: h.wrapper, initialProps: { q: " a ", enabled: false } },
      );
      await waitFor(() => {
        expect(hook.result.current.canRefresh).toBe(false);
      });
      await act(async () => {
        await hook.result.current.refetch();
      });
      expect(requests).toEqual([]);
      hook.rerender({ q: " a ", enabled: true });
      await waitFor(() => {
        expect(hook.result.current.data).toBeDefined();
      });
      expect(requests[0]).toEqual({ page: 1, limit, q: "a" });
      act(() => {
        hook.result.current.setPage(9);
      });
      await waitFor(() => {
        expect(hook.result.current.page).toBe(2);
      });
      await waitFor(() => {
        expect(hook.result.current.data).toBeDefined();
      });
      fail = true;
      act(() => {
        hook.result.current.setPage(3);
      });
      await waitFor(() => {
        expect(hook.result.current.isError).toBe(true);
      });
      expect(hook.result.current.acceptedData).toBeUndefined();
      fail = false;
      act(() => {
        hook.result.current.recoverFirstPage();
      });
      await waitFor(() => {
        expect(hook.result.current.page).toBe(1);
        expect(hook.result.current.data).toBeDefined();
      });
      act(() => {
        hook.result.current.setPage(2);
      });
      hook.rerender({ q: "b", enabled: true });
      expect(hook.result.current.page).toBe(1);
      await waitFor(() => {
        expect(requests.at(-1)).toEqual({ page: 1, limit, q: "b" });
      });
    },
  );
});
