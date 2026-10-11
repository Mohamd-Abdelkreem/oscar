import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onlineManager } from "@tanstack/react-query";
import { cleanupQueries, queryHarness, deferred } from "@/test/p04-query";
import { actorId, otherId, reply, pagination } from "@/test/p04-network";
import { withdrawal } from "@/test/p09-withdrawals";
import type { AdminWithdrawalRequest } from "../api/withdrawals.api";
import {
  useAdminWithdrawalHistory,
  useAdminWithdrawalDetail,
} from "./withdrawals.hooks";

cleanupQueries();
afterEach(() => {
  vi.useRealTimers();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});
const row = {
  ...withdrawal,
  employee: {
    id: actorId,
    fullName: "Current Employee",
    email: "current@example.test",
  },
  canExtend: true,
  canReject: true,
};
describe("admin scoped withdrawal reads", () => {
  it("observes page two changes through pause, terminal stop and finite exhaustion", async () => {
    let saved: AdminWithdrawalRequest = row,
      reads = 0;
    const h = queryHarness("ADMIN", (config) => {
      const page = Reflect.get(config.params as object, "page") as number;
      if (page === 2) reads++;
      return reply(config, {
        items: Array.from({ length: page === 1 ? 10 : 1 }, () => saved),
        pagination: {
          page,
          limit: 10,
          total: 11,
          totalPages: 2,
          hasNextPage: page === 1,
          hasPreviousPage: page === 2,
        },
      });
    });
    const mount = () =>
      renderHook(() => useAdminWithdrawalHistory(), {
        wrapper: h.wrapper,
      });
    let hook = mount();
    await waitFor(() => {
      expect(hook.result.current.data).toBeDefined();
    });
    act(() => {
      hook.result.current.setPage(2);
    });
    await waitFor(() => {
      expect(reads).toBe(1);
    });
    vi.useFakeTimers();
    const tick = async () => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_001);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
    };
    act(() => {
      onlineManager.setOnline(false);
    });
    await tick();
    expect(reads).toBe(1);
    act(() => {
      onlineManager.setOnline(true);
    });
    saved = {
      ...row,
      version: 2,
      dueAt: "2026-10-20T12:00:00.000Z",
      dispatchAt: "2026-10-20T12:00:00.000Z",
    };
    await tick();
    expect(hook.result.current.data?.items[0]).toMatchObject({
      version: 2,
      dueAt: saved.dueAt,
    });
    saved = { ...saved, state: "UNKNOWN", canExtend: false, canReject: false };
    await tick();
    expect(hook.result.current.data?.items[0]?.state).toBe("UNKNOWN");
    for (let i = reads; i < 20; i++) {
      hook.rerender();
      await tick();
    }
    expect(reads).toBe(20);
    const exhausted = reads;
    await tick();
    expect(reads).toBe(exhausted);
    act(() => {
      h.runtime.beginCheck();
    });
    await tick();
    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.displayData?.items[0]).toMatchObject(saved);
    expect(hook.result.current.isDisplayStale).toBe(true);
    expect(reads).toBe(exhausted);
    // Page two retains its own display facts across source-query GC.
    hook.unmount();
    h.client.removeQueries({ queryKey: ["p09", h.runtime.scope().accountId] });
    hook = mount();
    act(() => {
      hook.result.current.setPage(2);
    });
    await tick();
    expect(hook.result.current.displayData?.items[0]).toMatchObject(saved);
    expect(hook.result.current.data).toBeUndefined();
    expect(reads).toBe(exhausted);
    saved = {
      ...saved,
      state: "FAILED",
      finalizedAt: row.serverNow,
      release: {
        gross: row.gross,
        sourceAllocation: row.sourceAllocation,
        chargedFee: "0",
        releasedAt: row.serverNow,
      },
    };
    await act(async () => {
      await hook.result.current.refetch();
    });
    expect(hook.result.current.data?.items[0]?.state).toBe("FAILED");
    const terminal = reads;
    await tick();
    expect(reads).toBe(terminal);
  });
  it("recovers a settled out-of-range admin10 page after matching results shrink", async () => {
    let shrinking = false;
    const h = queryHarness("ADMIN", (config) => {
      const page: unknown = Reflect.get(config.params as object, "page");
      const selected = page === 2 ? 2 : 1;
      const count = shrinking ? (selected === 2 ? 0 : 1) : 10;
      return reply(config, {
        items: Array.from({ length: count }, () => row),
        pagination: {
          page: selected,
          limit: 10,
          total: shrinking ? 1 : 11,
          totalPages: shrinking ? 1 : 2,
          hasPreviousPage: selected > 1,
          hasNextPage: !shrinking && selected === 1,
        },
      });
    });
    const hook = renderHook(() => useAdminWithdrawalHistory(), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.data?.items).toHaveLength(10);
    });
    shrinking = true;
    act(() => {
      hook.result.current.setPage(2);
    });
    await waitFor(
      () => {
        expect(hook.result.current.page).toBe(1);
        expect(hook.result.current.data?.items).toHaveLength(1);
      },
      { timeout: 12_000 },
    );
  }, 15_000);
  it("uses server admin10 filters, resets pages and retires late details", async () => {
    const pending = deferred<typeof row>();
    const queries: unknown[] = [];
    const h = queryHarness("ADMIN", (config) => {
      if (config.url === "/admin/withdrawals") {
        queries.push(config.params);
        return reply(config, {
          items: Array.from({ length: 10 }, () => row),
          pagination: {
            ...pagination,
            limit: 10,
            total: 20,
            totalPages: 2,
            hasNextPage: Reflect.get(config.params as object, "page") === 1,
            hasPreviousPage: Reflect.get(config.params as object, "page") === 2,
            page: Reflect.get(config.params as object, "page") as unknown,
          },
        });
      }
      return pending.promise.then((saved) => reply(config, saved));
    });
    const hook = renderHook<
      {
        list: ReturnType<typeof useAdminWithdrawalHistory>;
        detail: ReturnType<typeof useAdminWithdrawalDetail>;
      },
      { q: string; target: string | null }
    >(
      ({ q, target }: { q: string; target: string | null }) => ({
        list: useAdminWithdrawalHistory({ q }),
        detail: useAdminWithdrawalDetail(target),
      }),
      {
        initialProps: { q: " Employee ", target: otherId },
        wrapper: h.wrapper,
      },
    );
    await waitFor(() => {
      expect(hook.result.current.list.data?.items[0]?.employee.fullName).toBe(
        "Current Employee",
      );
    });
    expect(queries[0]).toMatchObject({ q: "Employee", page: 1, limit: 10 });
    act(() => {
      hook.result.current.list.setPage(2);
    });
    await waitFor(() => {
      expect(hook.result.current.list.page).toBe(2);
    });
    hook.rerender({ q: "changed", target: null });
    expect(hook.result.current.list.page).toBe(1);
    await act(async () => {
      pending.resolve(row);
      await pending.promise;
    });
    expect(hook.result.current.detail.data).toBeUndefined();
    expect(hook.result.current.detail.displayData).toBeUndefined();
  });
  it("retires private rows and handlers when authority changes", async () => {
    const h = queryHarness("ADMIN", (config) => reply(config, row));
    const hook = renderHook(() => useAdminWithdrawalDetail(otherId), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.data?.canExtend).toBe(true);
    });
    act(() => {
      h.runtime.retire();
    });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(false);
    });
    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.displayData).toBeUndefined();
  });
});
