import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { depositHistoryQuerySchema } from "@template/contracts";
import { safeApiError } from "@/services/api/safe-error";
import { apiClient, setAccessToken } from "@/services/api/api-client";
import { otherId, reply, wallet, ledger } from "@/test/p04-network";
import {
  cleanupQueries,
  deferred,
  employee,
  queryHarness,
} from "@/test/p04-query";
import {
  depositMetadata,
  emptyDepositHistory,
  readyAssignment,
  provisioningAssignment,
  secondAddress,
  recordedDepositHistory,
  employeeDepositPage,
} from "@/test/p07-deposits";
import { useEmployeeDeposits } from "./deposits.hooks";
import { useWallet, useWalletLedger } from "./wallet.hooks";

cleanupQueries();
afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});
describe("personal receiving lifecycle", () => {
  it("refreshes scoped wallet and ledger only for persisted distinct operations, never detection or replay", async () => {
    let recorded = false;
    let distinctLog = false;
    let financeReads = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/wallet/me") {
        financeReads++;
        return reply(config, wallet);
      }
      if (config.url === "/wallet/me/ledger") {
        financeReads++;
        return reply(config, ledger);
      }
      if (config.url === "/deposits/me/address")
        return reply(config, readyAssignment);
      const chain = recordedDepositHistory.items.find(
        (row) => row.kind === "CHAIN_DEPOSIT",
      );
      if (chain === undefined) throw new Error("P07_CHAIN_REQUIRED");
      const items = recorded
        ? [
            chain,
            ...(distinctLog
              ? [
                  {
                    ...chain,
                    operationId: otherId,
                    logIndex: 1,
                    amount: "2.000001",
                  },
                ]
              : []),
          ]
        : [];
      return reply(config, {
        ...emptyDepositHistory,
        items,
        pagination: {
          ...emptyDepositHistory.pagination,
          total: items.length,
          totalPages: items.length ? 1 : 0,
        },
      });
    });
    const hook = renderHook(
      () => ({
        deposits: useEmployeeDeposits(),
        wallet: useWallet(),
        ledger: useWalletLedger(),
      }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.deposits.visibleHistory?.items).toEqual([]);
      expect(hook.result.current.wallet.data).toBeDefined();
      expect(hook.result.current.ledger.data).toBeDefined();
    });
    const before = financeReads;
    await act(async () => {
      await hook.result.current.deposits.refresh();
    });
    expect(financeReads).toBe(before);
    recorded = true;
    await act(async () => {
      await hook.result.current.deposits.refresh();
    });
    await waitFor(() => {
      expect(financeReads).toBe(before + 2);
    });
    distinctLog = true;
    await act(async () => {
      await hook.result.current.deposits.refresh();
    });
    await waitFor(() => {
      expect(financeReads).toBe(before + 4);
    });
    expect(hook.result.current.deposits.visibleHistory?.items).toHaveLength(2);
    await act(async () => {
      await hook.result.current.deposits.refresh();
    });
    expect(financeReads).toBe(before + 4);
    expect(hook.result.current.wallet.data).toEqual(wallet);
  });
  it("navigates bounded pages, retains same-page history on failure and recovers page one", async () => {
    let failed = false;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/deposits/me/address")
        return reply(config, readyAssignment);
      if (failed) throw safeApiError("transient", "NETWORK_ERROR");
      const page = depositHistoryQuerySchema.parse(config.params).page;
      return reply(config, employeeDepositPage(page));
    });
    const hook = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.visibleHistory?.items).toHaveLength(25);
    });
    act(() => {
      hook.result.current.history.setPage(2);
    });
    await waitFor(() => {
      expect(hook.result.current.visibleHistory?.pagination.page).toBe(2);
    });
    failed = true;
    await act(async () => {
      await hook.result.current.refresh();
    });
    expect(hook.result.current.visibleHistory?.pagination.page).toBe(2);
    expect(hook.result.current.history.error?.category).toBe("transient");
    failed = false;
    act(() => {
      hook.result.current.history.recoverFirstPage();
    });
    await waitFor(() => {
      expect(hook.result.current.visibleHistory?.pagination.page).toBe(1);
    });
  });
  it("GETs first and shares one guarded POST across concurrent readers and remount", async () => {
    const pending = deferred<undefined>();
    const calls: string[] = [];
    const h = queryHarness("USER", (config) => {
      calls.push(`${config.method ?? ""}:${config.url ?? ""}`);
      if (config.url === "/deposits/me/history")
        return reply(config, emptyDepositHistory);
      if (config.method === "post")
        return pending.promise.then(() =>
          reply(config, provisioningAssignment, 202),
        );
      return reply(config, { ...depositMetadata, state: "UNASSIGNED" });
    });
    const first = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    const second = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(calls.filter((call) => call.startsWith("post:"))).toHaveLength(1);
    });
    expect(calls.indexOf("get:/deposits/me/address")).toBeLessThan(
      calls.indexOf("post:/deposits/me/address"),
    );
    expect(first.result.current.provisioning).toBe(true);
    expect(second.result.current.provisioning).toBe(true);
    first.unmount();
    second.unmount();
    const remount = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    await waitFor(() => {
      expect(remount.result.current.provisioning).toBe(false);
    });
    await act(async () => {
      await remount.result.current.refresh();
    });
    expect(calls.filter((call) => call.startsWith("post:"))).toHaveLength(1);
  });

  it("observes a lost provisioning reply with GET and never repeats the write", async () => {
    let posted = false;
    let posts = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/deposits/me/history")
        return reply(config, emptyDepositHistory);
      if (config.method === "post") {
        posts++;
        posted = true;
        throw safeApiError("transient", "NETWORK_ERROR");
      }
      return reply(
        config,
        posted ? readyAssignment : { ...depositMetadata, state: "UNASSIGNED" },
      );
    });
    const hook = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.provisionError?.category).toBe("transient");
      expect(hook.result.current.address.observationCount).toBe(1);
    });
    vi.useFakeTimers();
    act(() => {
      focusManager.setFocused(false);
    });
    act(() => {
      focusManager.setFocused(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5001);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    vi.useRealTimers();
    await waitFor(() => {
      expect(hook.result.current.address.data).toEqual(readyAssignment);
    });
    await act(async () => {
      await hook.result.current.refresh();
    });
    expect(posts).toBe(1);
    expect(hook.result.current.provisionError).toBeNull();
  });

  it.each(["ADMIN", "USER"] as const)(
    "never provisions for %s without validated UNASSIGNED",
    async (role) => {
      let posts = 0;
      const h = queryHarness(role, (config) => {
        if (config.method === "post") posts++;
        return reply(
          config,
          config.url === "/deposits/me/history"
            ? emptyDepositHistory
            : provisioningAssignment,
        );
      });
      const hook = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
      await waitFor(() => {
        expect(hook.result.current.address.allowed).toBe(role === "USER");
      });
      if (role === "USER")
        await waitFor(() => {
          expect(hook.result.current.address.data?.state).toBe("PROVISIONING");
        });
      expect(posts).toBe(0);
      expect(hook.result.current.ready).toBeUndefined();
    },
  );

  it("bounds relevant GETs without timer-driven credit or repeated provisioning", async () => {
    let reads = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/deposits/me/address") reads++;
      return reply(
        config,
        config.url === "/deposits/me/history"
          ? emptyDepositHistory
          : provisioningAssignment,
      );
    });
    const hook = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.address.data?.state).toBe("PROVISIONING");
    });
    vi.useFakeTimers();
    const advance = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
    };
    reads = 0;
    await act(async () => {
      await hook.result.current.refresh();
    });
    await advance(1);
    await advance(5001);
    expect(reads).toBe(2);
    act(() => {
      focusManager.setFocused(false);
    });
    await advance(10000);
    expect(reads).toBe(2);
    act(() => {
      focusManager.setFocused(true);
    });
    await advance(1);
    expect(reads).toBe(3);
    await advance(20000);
    await advance(30000);
    for (let i = 0; i < 15; i++) await advance(60000);
    expect(hook.result.current.address.observationExhausted).toBe(true);
    expect(reads).toBe(20);
    await advance(60000);
    expect(reads).toBe(20);
    expect(hook.result.current.ready).toBeUndefined();
    expect(hook.result.current.history.acceptedData?.items).toEqual([]);
  });

  it("hides address/history after retirement even when old responses finish", async () => {
    const pending = deferred<undefined>();
    let delayed = false;
    const h = queryHarness("USER", (config) => {
      const response = () =>
        reply(
          config,
          config.url === "/deposits/me/history"
            ? emptyDepositHistory
            : readyAssignment,
        );
      return delayed ? pending.promise.then(response) : response();
    });
    const hook = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.ready).toEqual(readyAssignment);
    });
    delayed = true;
    let refreshing: Promise<unknown>;
    act(() => {
      refreshing = hook.result.current.refresh();
    });
    act(() => {
      h.runtime.retire();
    });
    pending.resolve(undefined);
    await act(async () => {
      await refreshing;
    });
    await waitFor(() => {
      expect(hook.result.current.ready).toBeUndefined();
    });
    expect(hook.result.current.visibleHistory).toBeUndefined();
  });

  it("hides accepted history on address denial even when an earlier history reply finishes", async () => {
    const pending = deferred<undefined>();
    let denied = false;
    const h = queryHarness("USER", (config) => {
      if (denied && config.url === "/deposits/me/address")
        throw safeApiError("denied", "FORBIDDEN", 403);
      const response = () =>
        reply(
          config,
          config.url === "/deposits/me/history"
            ? recordedDepositHistory
            : readyAssignment,
        );
      return denied ? pending.promise.then(response) : response();
    });
    const hook = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.ready).toEqual(readyAssignment);
      expect(hook.result.current.visibleHistory?.items).toHaveLength(2);
    });
    denied = true;
    let refreshing: Promise<unknown>;
    act(() => {
      refreshing = hook.result.current.refresh();
    });
    await waitFor(() => {
      expect(hook.result.current.address.error?.category).toBe("denied");
    });
    expect(hook.result.current.visibleHistory).toBeUndefined();
    pending.resolve(undefined);
    await act(async () => {
      await refreshing;
    });
    expect(hook.result.current.ready).toBeUndefined();
    expect(hook.result.current.visibleHistory).toBeUndefined();
  });

  it("keeps the new employee's assignment when old address and history reads complete", async () => {
    const pending = deferred<undefined>();
    let delayed = false;
    const h = queryHarness("USER", (config) => {
      const response = () =>
        reply(
          config,
          config.url === "/deposits/me/history"
            ? recordedDepositHistory
            : readyAssignment,
        );
      return delayed ? pending.promise.then(response) : response();
    });
    const hook = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.ready).toEqual(readyAssignment);
    });
    delayed = true;
    let refreshing: Promise<unknown>;
    act(() => {
      refreshing = hook.result.current.refresh();
    });
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(
        reply(
          config,
          config.url === "/users/me"
            ? { user: { ...employee, id: otherId } }
            : config.url === "/deposits/me/history"
              ? emptyDepositHistory
              : {
                  ...readyAssignment,
                  assignmentId: otherId,
                  address: secondAddress,
                },
        ),
      );
    act(() => {
      h.runtime.retire();
      setAccessToken("test-only-token");
      h.runtime.admitIdentity(h.runtime.scope(), { id: otherId, role: "USER" });
    });
    expect(hook.result.current.ready).toBeUndefined();
    expect(hook.result.current.visibleHistory).toBeUndefined();
    await waitFor(() => {
      expect(hook.result.current.ready?.address).toBe(secondAddress);
    });
    pending.resolve(undefined);
    await act(async () => {
      await refreshing;
    });
    expect(hook.result.current.ready?.address).toBe(secondAddress);
    expect(hook.result.current.visibleHistory?.items).toEqual([]);
    hook.unmount();
    const remount = renderHook(useEmployeeDeposits, { wrapper: h.wrapper });
    await act(async () => {
      await remount.result.current.refresh();
    });
    await waitFor(() => {
      expect(remount.result.current.ready?.address).toBe(secondAddress);
    });
  });
});
