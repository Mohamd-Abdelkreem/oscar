import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ledgerFilterSchema } from "@template/contracts";
import { actorId, wallet, ledger, reply } from "@/test/p04-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { deferred } from "@/test/p04-query";
import { useWallet, useWalletLedger } from "./wallet.hooks";
import { getApiError, safeApiError } from "@/services/api/safe-error";

cleanupQueries();
describe("private wallet query scope", () => {
  it("retains denial across reader remount and only retries on an explicit click", async () => {
    let reads = 0;
    let permitted = false;
    const h = queryHarness("USER", (config) => {
      reads++;
      if (!permitted) throw safeApiError("denied", "FORBIDDEN", 403);
      return reply(config, wallet);
    });
    const first = renderHook(useWallet, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(first.result.current.isError).toBe(true);
    });
    first.unmount();
    const next = renderHook(useWallet, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(getApiError(next.result.current.error).code).toBe("FORBIDDEN");
    });
    expect(next.result.current.data).toBeUndefined();
    expect(reads).toBe(1);
    permitted = true;
    await act(async () => {
      await next.result.current.refetch();
    });
    await waitFor(() => {
      expect(next.result.current.data).toEqual(wallet);
    });
  });
  it("retires all wallet data on logout without inheritance", async () => {
    const h = queryHarness("USER", (config) => reply(config, wallet));
    const hook = renderHook(useWallet, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.data?.employeeId).toBe(actorId);
    });
    act(() => {
      h.runtime.retire();
    });
    expect(hook.result.current.data).toBeUndefined();
    expect(
      h.client
        .getQueryCache()
        .getAll()
        .some(
          (query) =>
            query.queryKey[0] === "p04" && query.state.data !== undefined,
        ),
    ).toBe(false);
  });
  it("recovers same-filter out-of-range pages and resets on source changes", async () => {
    const requested: unknown[] = [];
    const h = queryHarness("USER", (config) => {
      const params: unknown = config.params;
      requested.push(params);
      const parsed = ledgerFilterSchema.parse(params);
      return reply(config, {
        ...ledger,
        pagination: {
          ...ledger.pagination,
          page: parsed.page,
          hasPreviousPage: parsed.page > 1,
        },
      });
    });
    const initialProps: { source: "REFERRAL" | "NON_REFERRAL" } = {
      source: "REFERRAL",
    };
    const hook = renderHook(
      ({ source }: { source: "REFERRAL" | "NON_REFERRAL" }) =>
        useWalletLedger({ source }),
      { wrapper: h.wrapper, initialProps },
    );
    await waitFor(() => {
      expect(hook.result.current.isSuccess).toBe(true);
    });
    act(() => {
      hook.result.current.setPage(3);
    });
    await waitFor(() => {
      expect(requested).toContainEqual({
        source: "REFERRAL",
        page: 3,
        limit: 25,
      });
      expect(hook.result.current.page).toBe(1);
    });
    hook.rerender({ source: "NON_REFERRAL" });
    expect(hook.result.current.page).toBe(1);
    await waitFor(() => {
      expect(requested).toContainEqual({
        source: "NON_REFERRAL",
        page: 1,
        limit: 25,
      });
    });
  });
  it("same-epoch revalidation rejects earlier wallet completion without losing the new observation", async () => {
    const pending = deferred<undefined>();
    let reads = 0;
    const fresh = {
      ...wallet,
      walletComponents: {
        ...wallet.walletComponents,
        availableNonReferral: "31",
        total: "46",
      },
      purchaseEligibleAmount: "41",
      withdrawalFunds: {
        ...wallet.withdrawalFunds,
        eligibleNonReferral: "31",
        total: "31",
      },
    };
    const h = queryHarness("USER", (config) => {
      reads++;
      return reads === 1
        ? pending.promise.then(() => reply(config, wallet))
        : reply(config, fresh);
    });
    const hook = renderHook(useWallet, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(reads).toBe(1);
    });
    act(() => {
      h.runtime.beginCheck();
    });
    await waitFor(() => {
      expect(hook.result.current.data).toEqual(fresh);
    });
    act(() => {
      pending.resolve(undefined);
    });
    expect(hook.result.current.data).toEqual(fresh);
  });
});
