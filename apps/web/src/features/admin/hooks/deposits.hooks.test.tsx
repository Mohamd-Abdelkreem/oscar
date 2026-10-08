import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { adminDepositHistoryQuerySchema } from "@template/contracts";
import { safeApiError } from "@/services/api/safe-error";
import { setAccessToken } from "@/services/api/api-client";
import { actorId, finance, reply } from "@/test/p04-network";
import { cleanupQueries, deferred, queryHarness } from "@/test/p04-query";
import {
  emptyAdminDepositHistory,
  recordedAdminDepositHistory,
} from "@/test/p07-deposits";
import { useFinanceLedger } from "./finance.hooks";
import { useAdminDeposits, useManualCredit } from "./deposits.hooks";
import { manualCreditTargets, manualCreditOutcome } from "@/test/p07-deposits";

const locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks");
afterEach(() => {
  localStorage.clear();
  if (locksDescriptor)
    Object.defineProperty(navigator, "locks", locksDescriptor);
  else Reflect.deleteProperty(navigator, "locks");
});
function grantLocks() {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _options: unknown,
        work: (lock: object) => Promise<unknown>,
      ) => work({}),
    },
  });
}
it("recovers a retained absent original handle on mount without enabling another grant", async () => {
  grantLocks();
  localStorage.setItem(
    `oscar.manual-credit.v1.${actorId}`,
    JSON.stringify({
      version: 1,
      actionId: actorId,
      employeeId: manualCreditOutcome.employeeId,
    }),
  );
  let reads = 0;
  const h = queryHarness("ADMIN", (config) => {
    if (config.url === "/admin/employees/manual-credit-targets")
      return reply(config, manualCreditTargets);
    reads++;
    throw safeApiError("request", "DEPOSIT_NOT_FOUND", 404);
  });
  const hook = renderHook(() => useManualCredit(true), { wrapper: h.wrapper });
  await waitFor(() => {
    expect(reads).toBe(1);
  });
  expect(hook.result.current.uncertain).toBe(true);
  expect(hook.result.current.blocked).toBe(true);
  expect(hook.result.current.retained?.actionId).toBe(actorId);
});
it("ignores a late target lookup after retirement and reports an actual empty target page", async () => {
  const late = deferred<undefined>();
  let empty = false;
  const h = queryHarness("ADMIN", (config) =>
    empty
      ? reply(config, {
          ...manualCreditTargets,
          items: [],
          pagination: {
            ...manualCreditTargets.pagination,
            total: 0,
            totalPages: 0,
          },
        })
      : late.promise.then(() => reply(config, manualCreditTargets)),
  );
  const hook = renderHook(() => useManualCredit(true), { wrapper: h.wrapper });
  await waitFor(() => {
    expect(hook.result.current.targets.isFetching).toBe(true);
  });
  act(() => {
    h.runtime.retire();
  });
  late.resolve(undefined);
  await act(async () => {
    await late.promise;
  });
  expect(hook.result.current.options).toEqual([]);
  expect(hook.result.current.canReview).toBe(false);
  empty = true;
  setAccessToken("test-only-token");
  act(() => {
    h.runtime.admitIdentity(h.runtime.scope(), { id: actorId, role: "ADMIN" });
  });
  await waitFor(() => {
    expect(hook.result.current.targets.data?.items).toEqual([]);
  });
  expect(hook.result.current.canReview).toBe(false);
});
it("keeps a valid selected label and dirty draft across target paging/failure, blocks review on failure and scrubs retirement", async () => {
  grantLocks();
  let failed = false;
  const h = queryHarness("ADMIN", (config) => {
    if (failed) throw safeApiError("transient", "NETWORK_ERROR");
    const page = adminDepositHistoryQuerySchema.parse(config.params).page;
    const rows =
      page === 1
        ? [
            manualCreditTargets.items[0],
            ...Array.from({ length: 24 }, (_, index) => ({
              id: `00000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`,
              name: "First Credit Employee",
              email: `target-${String(index)}@example.test`,
            })),
          ]
        : [
            {
              id: actorId,
              name: "First Credit Employee",
              email: "later@example.test",
            },
          ];
    return reply(config, {
      items: rows,
      pagination: {
        ...manualCreditTargets.pagination,
        page,
        total: 26,
        totalPages: 2,
        hasNextPage: page === 1,
        hasPreviousPage: page === 2,
      },
    });
  });
  const hook = renderHook(() => useManualCredit(true), { wrapper: h.wrapper });
  await waitFor(() => {
    expect(hook.result.current.targets.data?.items).toHaveLength(25);
  });
  act(() => {
    hook.result.current.select(manualCreditOutcome.employeeId);
    hook.result.current.edit("amount", "1.000001");
    hook.result.current.edit("reason", "Reviewed adjustment");
    hook.result.current.edit("reference", "same-reference");
  });
  expect(hook.result.current.canReview).toBe(true);
  for (const amount of ["0", "-1", "1.0000001", "9223372036854.775808"]) {
    act(() => {
      hook.result.current.edit("amount", amount);
    });
    expect(hook.result.current.canReview).toBe(false);
  }
  act(() => {
    hook.result.current.edit("amount", "1.000001");
  });
  act(() => {
    hook.result.current.targets.setPage(2);
  });
  await waitFor(() => {
    expect(hook.result.current.targets.data?.items).toHaveLength(1);
  });
  expect(hook.result.current.options).toEqual(
    expect.arrayContaining([
      {
        value: manualCreditOutcome.employeeId,
        label: "First Credit Employee (first@example.test)",
      },
      { value: actorId, label: "First Credit Employee (later@example.test)" },
    ]),
  );
  expect(hook.result.current.canReview).toBe(true);
  failed = true;
  await act(async () => {
    await hook.result.current.targets.refetch();
  });
  expect(hook.result.current.canReview).toBe(false);
  expect(hook.result.current.draft.amount).toBe("1.000001");
  expect(hook.result.current.selected?.email).toBe("first@example.test");
  failed = false;
  await act(async () => {
    await hook.result.current.targets.refetch();
  });
  expect(hook.result.current.canReview).toBe(true);
  expect(hook.result.current.draft.amount).toBe("1.000001");
  act(() => {
    h.runtime.retire();
  });
  expect(hook.result.current.selected).toBeNull();
  expect(hook.result.current.draft.amount).toBe("");
});
it("reconciles only the lost original reply and invalidates live finance without historical wallet patches", async () => {
  grantLocks();
  let writes = 0;
  let recorded = false;
  let financeReads = 0;
  const h = queryHarness("ADMIN", (config) => {
    if (config.url === "/admin/finance") {
      financeReads++;
      return reply(config, finance);
    }
    if (config.url === "/admin/employees/manual-credit-targets")
      return reply(config, manualCreditTargets);
    if (config.method === "post") {
      writes++;
      recorded = true;
      throw safeApiError("transient", "NETWORK_ERROR");
    }
    const actionId = config.url?.split("/").pop();
    if (!recorded) throw safeApiError("request", "DEPOSIT_NOT_FOUND", 404);
    return reply(config, {
      ...manualCreditOutcome,
      actionId,
      walletAfter: {
        availableReferral: "0",
        availableNonReferral: "1.000001",
        reservedReferral: "0",
        reservedNonReferral: "0",
        total: "1.000001",
      },
    });
  });
  const hook = renderHook(() => useManualCredit(true), { wrapper: h.wrapper });
  const live = renderHook(() => useFinanceLedger(), { wrapper: h.wrapper });
  await waitFor(() => {
    expect(hook.result.current.targets.data?.items).toHaveLength(1);
  });
  act(() => {
    hook.result.current.select(manualCreditOutcome.employeeId);
    hook.result.current.edit("amount", "1.000001");
    hook.result.current.edit("reason", "Reviewed adjustment");
    hook.result.current.edit("reference", "same-reference");
  });
  act(() => {
    hook.result.current.review();
  });
  expect(hook.result.current.reviewed?.body.amount).toBe("1.000001");
  await act(async () => {
    expect(await hook.result.current.confirm()).toBe(false);
  });
  expect(writes).toBe(1);
  await waitFor(() => {
    expect(financeReads).toBeGreaterThanOrEqual(2);
  });
  expect(live.result.current.data).toEqual(finance);
  await waitFor(() => {
    expect(hook.result.current.retained).toBeNull();
  });
  expect(writes).toBe(1);
});

cleanupQueries();
it("uses ten-row server pages, clamps valid out-of-range results and resets changed filters", async () => {
  const chain = recordedAdminDepositHistory.items.find(
    (row) => row.kind === "CHAIN_DEPOSIT",
  );
  if (chain === undefined) throw new Error("P07_CHAIN_REQUIRED");
  const rows = Array.from({ length: 12 }, (_, index) => ({
    ...chain,
    operationId: `00000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`,
    logIndex: index,
  }));
  const h = queryHarness("ADMIN", (config) => {
    const query = adminDepositHistoryQuerySchema.parse(config.params);
    expect(query.limit).toBe(10);
    if (query.q) return reply(config, emptyAdminDepositHistory);
    return reply(config, {
      ...emptyAdminDepositHistory,
      items: rows.slice((query.page - 1) * 10, query.page * 10),
      pagination: {
        page: query.page,
        limit: 10,
        total: 12,
        totalPages: 2,
        hasNextPage: query.page < 2,
        hasPreviousPage: query.page > 1,
      },
    });
  });
  const hook = renderHook(({ q }) => useAdminDeposits(q ? { q } : {}), {
    wrapper: h.wrapper,
    initialProps: { q: "" },
  });
  await waitFor(() => {
    expect(hook.result.current.data?.items).toHaveLength(10);
  });
  act(() => {
    hook.result.current.setPage(3);
  });
  await waitFor(() => {
    expect(hook.result.current.page).toBe(2);
    expect(hook.result.current.data?.items).toHaveLength(2);
  });
  hook.rerender({ q: "no matches" });
  expect(hook.result.current.page).toBe(1);
  await waitFor(() => {
    expect(hook.result.current.data?.items).toEqual([]);
  });
});
it("refreshes live finance for observed credits but never for repeated history or failed observation", async () => {
  let credited = false;
  let failed = false;
  let financeReads = 0;
  const h = queryHarness("ADMIN", (config) => {
    if (config.url === "/admin/finance") {
      financeReads++;
      return reply(config, finance);
    }
    if (failed) throw safeApiError("transient", "NETWORK_ERROR");
    return reply(
      config,
      credited ? recordedAdminDepositHistory : emptyAdminDepositHistory,
    );
  });
  const hook = renderHook(
    () => ({ finance: useFinanceLedger(), history: useAdminDeposits() }),
    { wrapper: h.wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.history.data?.items).toEqual([]);
    expect(hook.result.current.finance.data).toBeDefined();
  });
  const before = financeReads;
  credited = true;
  await act(async () => {
    await hook.result.current.history.refetch();
  });
  await waitFor(() => {
    expect(financeReads).toBe(before + 1);
  });
  await act(async () => {
    await hook.result.current.history.refetch();
  });
  expect(financeReads).toBe(before + 1);
  failed = true;
  await act(async () => {
    await hook.result.current.history.refetch();
  });
  expect(hook.result.current.history.visibleHistory?.items).toHaveLength(2);
  expect(financeReads).toBe(before + 1);
});
it("ignores obsolete search replies and hides accepted rows after current denial", async () => {
  const pending = deferred<undefined>();
  let denied = false;
  const h = queryHarness("ADMIN", (config) => {
    if (denied) throw safeApiError("denied", "FORBIDDEN", 403);
    return adminDepositHistoryQuerySchema.parse(config.params).q === "old"
      ? pending.promise.then(() => reply(config, recordedAdminDepositHistory))
      : reply(config, emptyAdminDepositHistory);
  });
  const hook = renderHook(({ q }) => useAdminDeposits({ q }), {
    wrapper: h.wrapper,
    initialProps: { q: "old" },
  });
  await waitFor(() => {
    expect(hook.result.current.isFetching).toBe(true);
  });
  hook.rerender({ q: "new" });
  await waitFor(() => {
    expect(hook.result.current.data?.items).toEqual([]);
  });
  pending.resolve(undefined);
  await act(async () => {
    await pending.promise;
  });
  expect(hook.result.current.visibleHistory?.items).toEqual([]);
  denied = true;
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => {
    expect(hook.result.current.error?.category).toBe("denied");
  });
  expect(hook.result.current.visibleHistory).toBeUndefined();
});
