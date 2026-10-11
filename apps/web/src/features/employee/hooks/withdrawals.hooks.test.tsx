import type { WithdrawalDestination } from "@template/contracts";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { withdrawalRequestSchema } from "@template/contracts";
import { safeApiError } from "@/services/api/safe-error";
import { actorId, otherId, reply, wallet, ledger } from "@/test/p04-network";
import { cleanupQueries, queryHarness, deferred } from "@/test/p04-query";
import {
  destination,
  withdrawal,
  withdrawalStatus,
  pendingDestination,
} from "@/test/p09-withdrawals";
import {
  useEmployeeWithdrawalStatus,
  useEmployeeWithdrawalDestination,
  useEmployeeWithdrawalHistory,
  useEmployeeWithdrawalDetail,
  useWithdrawalDestinationCommand,
} from "./withdrawals.hooks";
import { useWallet } from "./wallet.hooks";

cleanupQueries();
afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});
async function tick(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}
describe("US3 persisted lifecycle observation", () => {
  it("keeps parsed status facts after exhaustion and a same-actor check without making them current", async () => {
    let reads = 0;
    const h = queryHarness("USER", (config) => {
      reads++;
      return reply(config, {
        ...withdrawalStatus,
        activeWithdrawal: withdrawal,
      });
    });
    const hook = renderHook(() => useEmployeeWithdrawalStatus(), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.data?.activeWithdrawal?.id).toBe(
        withdrawal.id,
      );
    });
    // A persisted outcome starts the observation window once; explicitly settle it first.
    await act(async () => {
      await hook.result.current.refetch();
    });
    vi.useFakeTimers();
    for (let cycle = 1; cycle < 20; cycle++) {
      hook.rerender();
      await tick(60_001);
      await tick(1);
    }
    expect(hook.result.current.observationExhausted).toBe(true);
    const exhausted = reads;
    act(() => {
      h.runtime.beginCheck();
    });
    await tick(60_001);
    await tick(1);
    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.displayData?.activeWithdrawal).toEqual(
      withdrawal,
    );
    expect(hook.result.current.isDisplayStale).toBe(true);
    expect(reads).toBe(exhausted);
    await act(async () => {
      await hook.result.current.refetch();
    });
    expect(hook.result.current.data?.activeWithdrawal?.id).toBe(withdrawal.id);
    expect(hook.result.current.isDisplayStale).toBe(false);
    act(() => {
      h.runtime.retire();
    });
    expect(hook.result.current.displayData).toBeUndefined();
  });
  it.each([false, true])(
    "resolves completion with a mounted wallet and page-two history=%s",
    async (pageTwo) => {
      let complete = false,
        walletReads = 0,
        detailReads = 0;
      const saved = withdrawalRequestSchema.parse({
        ...withdrawal,
        version: 2,
        state: "COMPLETED",
        finalizedAt: withdrawal.serverNow,
        transactionId: "a".repeat(64),
        settlement: {
          withdrawalId: withdrawal.id,
          attemptId: withdrawal.quoteId,
          network: withdrawal.network,
          tokenContract: withdrawal.recipient,
          source: withdrawal.recipient,
          recipient: withdrawal.recipient,
          addressVersion: 1,
          gross: "100",
          feeBps: 2100,
          fee: "21",
          net: "79",
          sourceAllocation: withdrawal.sourceAllocation,
          transactionId: "a".repeat(64),
          blockId: "b".repeat(64),
          blockNumber: "123",
        },
      });
      const h = queryHarness("USER", (config) => {
        if (config.url === "/wallet/me") {
          walletReads++;
          return reply(config, {
            ...wallet,
            walletComponents: {
              availableReferral: "0",
              availableNonReferral: "30",
              reservedReferral: "0",
              reservedNonReferral: complete ? "0" : "100",
              total: complete ? "30" : "130",
            },
            purchaseEligibleAmount: "30",
            withdrawalFunds: {
              eligibleReferral: "0",
              eligibleNonReferral: "30",
              total: "30",
              lockedReferral: "0",
            },
          });
        }
        if (config.url === "/withdrawals") {
          const page = Number(Reflect.get(config.params as object, "page"));
          return reply(config, {
            items: Array.from({ length: page === 1 ? 25 : 1 }, () =>
              complete ? saved : withdrawal,
            ),
            pagination: {
              page,
              limit: 25,
              total: 26,
              totalPages: 2,
              hasPreviousPage: page === 2,
              hasNextPage: page === 1,
            },
          });
        }
        if (config.url === "/withdrawals/me")
          return reply(config, {
            ...withdrawalStatus,
            activeWithdrawal: complete ? null : withdrawal,
          });
        detailReads++;
        return reply(config, saved);
      });
      const hook = renderHook(
        () => ({ status: useEmployeeWithdrawalStatus(), wallet: useWallet() }),
        { wrapper: h.wrapper },
      );
      await waitFor(() => {
        expect(hook.result.current.status.data?.activeWithdrawal?.id).toBe(
          otherId,
        );
        expect(hook.result.current.wallet.data).toBeDefined();
      });
      const history = pageTwo
        ? renderHook(useEmployeeWithdrawalHistory, { wrapper: h.wrapper })
        : null;
      if (history) {
        await waitFor(() => {
          expect(history.result.current.data).toBeDefined();
        });
        act(() => {
          history.result.current.setPage(2);
        });
        await waitFor(() => {
          expect(history.result.current.data?.pagination.page).toBe(2);
        });
      }
      const before = walletReads;
      complete = true;
      await act(async () => {
        await hook.result.current.status.refetch();
      });
      await waitFor(() => {
        expect(walletReads).toBeGreaterThan(before);
        expect(hook.result.current.wallet.data?.walletComponents.total).toBe(
          "30",
        );
        expect(
          hook.result.current.wallet.data?.walletComponents.reservedNonReferral,
        ).toBe("0");
        expect(hook.result.current.wallet.data?.purchaseEligibleAmount).toBe(
          "30",
        );
        if (history) {
          expect(history.result.current.data?.pagination.page).toBe(2);
          expect(history.result.current.data?.items[0]?.state).toBe(
            "COMPLETED",
          );
        }
      });
      expect(detailReads).toBe(1);
      await act(async () => {
        await hook.result.current.status.refetch();
      });
      expect(detailReads).toBe(1);
    },
  );
  it("resolves external release with only account status and wallet mounted, refreshes page two and stops", async () => {
    let saved = withdrawal,
      detailReads = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/wallet/me")
        return reply(config, {
          ...wallet,
          walletComponents: {
            availableReferral: "0",
            availableNonReferral: saved.release ? "100" : "0",
            reservedReferral: "0",
            reservedNonReferral: saved.release ? "0" : "100",
            total: "100",
          },
          purchaseEligibleAmount: saved.release ? "100" : "0",
          withdrawalFunds: {
            eligibleNonReferral: saved.release ? "100" : "0",
            eligibleReferral: "0",
            total: saved.release ? "100" : "0",
            lockedReferral: "0",
          },
        });
      if (config.url === "/withdrawals/me")
        return reply(config, {
          ...withdrawalStatus,
          activeWithdrawal: saved.release ? null : saved,
        });
      if (config.url === "/withdrawals") {
        const page = Number(Reflect.get(config.params as object, "page"));
        return reply(config, {
          items: Array.from({ length: page === 1 ? 25 : 1 }, () => saved),
          pagination: {
            page,
            limit: 25,
            total: 26,
            totalPages: 2,
            hasPreviousPage: page === 2,
            hasNextPage: page === 1,
          },
        });
      }
      detailReads++;
      return reply(config, saved);
    });
    const account = renderHook(
      () => ({ status: useEmployeeWithdrawalStatus(), wallet: useWallet() }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(account.result.current.status.data?.activeWithdrawal?.id).toBe(
        otherId,
      );
    });
    expect(detailReads).toBe(0);
    saved = withdrawalRequestSchema.parse({
      ...saved,
      version: 2,
      state: "REJECTED",
      finalizedAt: saved.serverNow,
      release: {
        gross: saved.gross,
        sourceAllocation: saved.sourceAllocation,
        chargedFee: "0",
        releasedAt: saved.serverNow,
      },
    });
    await act(async () => {
      await account.result.current.status.refetch();
    });
    await waitFor(() => {
      expect(
        account.result.current.wallet.data?.walletComponents
          .availableNonReferral,
      ).toBe("100");
    });
    expect(detailReads).toBe(1);
    const history = renderHook(useEmployeeWithdrawalHistory, {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(history.result.current.data).toBeDefined();
    });
    act(() => {
      history.result.current.setPage(2);
    });
    await waitFor(() => {
      expect(history.result.current.data?.items[0]?.state).toBe("REJECTED");
    });
    await act(async () => {
      await account.result.current.status.refetch();
    });
    expect(detailReads).toBe(1);
    vi.useFakeTimers();
    const count = account.result.current.status.observationCount;
    await tick(120_000);
    expect(account.result.current.status.observationCount).toBe(count);
  });
  it("observes external extension and safe release, refreshes eligibility, and stops terminal polling", async () => {
    let saved = withdrawal;
    let reads = 0;
    const h = queryHarness("USER", (config) => {
      reads++;
      return reply(
        config,
        config.url === "/withdrawals/me"
          ? {
              ...withdrawalStatus,
              activeWithdrawal: saved.release === null ? saved : null,
            }
          : saved,
      );
    });
    const hook = renderHook(
      () => ({
        status: useEmployeeWithdrawalStatus(),
        detail: useEmployeeWithdrawalDetail(otherId),
      }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.detail.data?.version).toBe(1);
    });
    await waitFor(() => {
      expect(hook.result.current.status.data?.activeWithdrawal?.id).toBe(
        otherId,
      );
    });
    vi.useFakeTimers();
    await act(async () => {
      await hook.result.current.status.refetch();
      await hook.result.current.detail.refetch();
    });
    await tick(1);
    saved = withdrawalRequestSchema.parse({
      ...withdrawal,
      version: 2,
      scheduleVersion: 2,
      dueAt: "2026-10-09T09:30:00.000Z",
      dispatchAt: "2026-10-09T09:30:00.000Z",
      remainingCountedHours: "96.5",
      remainingCountedMilliseconds: "347400000",
    });
    await tick(10_001);
    await tick(1);
    expect(hook.result.current.detail.data?.dueAt).toBe(saved.dueAt);
    expect(hook.result.current.status.data?.activeWithdrawal?.version).toBe(2);
    saved = withdrawalRequestSchema.parse({
      ...saved,
      version: 3,
      state: "REJECTED",
      finalizedAt: saved.serverNow,
      release: {
        gross: saved.gross,
        sourceAllocation: saved.sourceAllocation,
        chargedFee: "0",
        releasedAt: saved.serverNow,
      },
    });
    await tick(20_001);
    await tick(1);
    expect(hook.result.current.status.data?.activeWithdrawal).toBeNull();
    expect(hook.result.current.detail.data?.release?.sourceAllocation).toEqual(
      withdrawal.sourceAllocation,
    );
    const settled = reads;
    await tick(120_000);
    expect(reads).toBe(settled);
  });
  it("retains accepted paid/referral terms after expiry and UNKNOWN through background, budget exhaustion and explicit restart", async () => {
    const saved = withdrawalRequestSchema.parse({
      ...withdrawal,
      state: "UNKNOWN",
      effectiveMembership: "PAID",
      subscriptionId: actorId,
      subscriptionVersion: 1,
      subscriptionExpiresAt: "2026-10-06T09:00:00.000Z",
      feeBasis: "SUBSCRIPTION",
      sourceAllocation: { nonReferral: "70", referral: "30", gross: "100" },
      serverNow: "2026-10-07T09:00:00.000Z",
    });
    let reads = 0;
    const h = queryHarness("USER", (config) => {
      reads++;
      return reply(config, saved);
    });
    const hook = renderHook(() => useEmployeeWithdrawalDetail(otherId), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.data?.state).toBe("UNKNOWN");
    });
    vi.useFakeTimers();
    await act(async () => {
      await hook.result.current.refetch();
    });
    await tick(1);
    const baseline = reads;
    act(() => {
      focusManager.setFocused(false);
    });
    await tick(120_000);
    expect(reads).toBe(baseline);
    act(() => {
      focusManager.setFocused(true);
    });
    await tick(1);
    expect(reads).toBe(baseline + 1);
    for (let cycle = 0; cycle < 22; cycle++) await tick(60_001);
    expect(hook.result.current.observationExhausted).toBe(true);
    const exhausted = reads;
    await tick(600_000);
    expect(reads).toBe(exhausted);
    expect(hook.result.current.data).toEqual(saved);
    expect(hook.result.current.data?.release).toBeNull();
    await act(async () => {
      await hook.result.current.refetch();
    });
    expect(reads).toBe(exhausted + 1);
    expect(hook.result.current.observationExhausted).toBe(false);
    hook.unmount();
    await tick(120_000);
    expect(reads).toBe(exhausted + 1);
  });
  it("does not display a late history page as the newly selected page and clamps only a settled authoritative range", async () => {
    const late = deferred<undefined>();
    let shrink = false;
    const h = queryHarness("USER", async (config) => {
      const page = Number(Reflect.get(config.params as object, "page"));
      if (page === 2) await late.promise;
      const total = shrink ? 1 : 26;
      return reply(config, {
        items:
          page > 1 && shrink
            ? []
            : Array.from(
                { length: page === 1 && !shrink ? 25 : 1 },
                () => withdrawal,
              ),
        pagination: {
          page,
          limit: 25,
          total,
          totalPages: shrink ? 1 : 2,
          hasPreviousPage: page > 1,
          hasNextPage: page === 1 && !shrink,
        },
      });
    });
    const hook = renderHook(useEmployeeWithdrawalHistory, {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.data?.items).toHaveLength(25);
    });
    act(() => {
      hook.result.current.setPage(2);
    });
    expect(hook.result.current.data).toBeUndefined();
    act(() => {
      hook.result.current.setPage(1);
    });
    late.resolve(undefined);
    await waitFor(() => {
      expect(hook.result.current.data?.pagination.page).toBe(1);
    });
    shrink = true;
    act(() => {
      hook.result.current.setPage(2);
    });
    await waitFor(() => {
      expect(hook.result.current.page).toBe(1);
    });
    await waitFor(
      () => {
        expect(hook.result.current.data?.pagination.total).toBe(1);
      },
      { timeout: 12_000 },
    );
  }, 20_000);
});
describe("employee withdrawal scoped reads", () => {
  it("reads authoritative status/destination/detail and employee25 pages, preserves failed-page facts", async () => {
    let failed = false;
    const h = queryHarness("USER", (config) => {
      if (failed) throw safeApiError("transient", "NETWORK_ERROR");
      if (config.url === "/withdrawals/me")
        return reply(config, withdrawalStatus);
      if (config.url === "/withdrawals/me/destination")
        return reply(config, destination);
      if (config.url !== "/withdrawals") return reply(config, withdrawal);
      const page = Number(Reflect.get(config.params as object, "page"));
      expect(Reflect.get(config.params as object, "limit")).toBe(25);
      return reply(config, {
        items:
          page === 1
            ? Array.from({ length: 25 }, () => withdrawal)
            : [withdrawal],
        pagination: {
          page,
          limit: 25,
          total: 26,
          totalPages: 2,
          hasNextPage: page === 1,
          hasPreviousPage: page === 2,
        },
      });
    });
    const hook = renderHook(
      () => ({
        status: useEmployeeWithdrawalStatus(),
        destination: useEmployeeWithdrawalDestination(),
        history: useEmployeeWithdrawalHistory(),
        detail: useEmployeeWithdrawalDetail(otherId),
      }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.history.data?.items).toHaveLength(25);
    });
    expect(hook.result.current.status.data).toEqual(withdrawalStatus);
    expect(hook.result.current.destination.data).toEqual(destination);
    await waitFor(() => {
      expect(hook.result.current.detail.data).toEqual(withdrawal);
    });
    act(() => {
      hook.result.current.history.setPage(2);
    });
    await waitFor(() => {
      expect(hook.result.current.history.data?.pagination.page).toBe(2);
    });
    failed = true;
    await act(async () => {
      await hook.result.current.history.refetch();
    });
    expect(hook.result.current.history.data).toBeUndefined();
    expect(hook.result.current.history.acceptedData?.pagination.page).toBe(2);
  });
  it("retires protected data after denial and discards late old-resource replies", async () => {
    let denied = false;
    const late = deferred<undefined>();
    const h = queryHarness("USER", async (config) => {
      if (denied) throw safeApiError("denied", "FORBIDDEN", 403);
      if (config.url === "/withdrawals/me")
        return reply(config, withdrawalStatus);
      await late.promise;
      return reply(config, withdrawal);
    });
    const hook = renderHook(
      ({ id }: { id: string | null }) => ({
        status: useEmployeeWithdrawalStatus(),
        detail: useEmployeeWithdrawalDetail(id),
      }),
      { wrapper: h.wrapper, initialProps: { id: otherId } },
    );
    await waitFor(() => {
      expect(hook.result.current.status.data).toBeDefined();
    });
    hook.rerender({ id: actorId });
    late.resolve(undefined);
    await waitFor(() => {
      expect(hook.result.current.detail.data).toBeUndefined();
    });
    denied = true;
    await act(async () => {
      await hook.result.current.status.refetch();
    });
    await waitFor(() => {
      expect(hook.result.current.status.data).toBeUndefined();
    });
    expect(hook.result.current.status.allowed).toBe(false);
  });
  it("refreshes relevant wallet/ledger facts once per persisted request version", async () => {
    let active = false;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/wallet/me") return reply(config, wallet);
      if (config.url === "/wallet/me/ledger") return reply(config, ledger);
      return reply(config, {
        ...withdrawalStatus,
        activeWithdrawal: active ? withdrawal : null,
      });
    });
    h.client.setQueryData(
      [
        "p04",
        h.runtime.scope().accountId,
        "USER",
        h.runtime.scope().epoch,
        h.runtime.scope().check,
        "wallet",
      ],
      wallet,
    );
    const hook = renderHook(useEmployeeWithdrawalStatus, {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.data).toBeDefined();
    });
    active = true;
    await act(async () => {
      await hook.result.current.refetch();
    });
    await waitFor(() => {
      expect(
        h.client.getQueryState([
          "p04",
          h.runtime.scope().accountId,
          "USER",
          h.runtime.scope().epoch,
          h.runtime.scope().check,
          "wallet",
        ])?.isInvalidated,
      ).toBe(true);
    });
    expect(hook.result.current.data?.activeWithdrawal).toEqual(withdrawal);
  });
});

describe("destination issuance lifecycle", () => {
  it("allows a corrected review only after an explicit pre-issuance checksum rejection", async () => {
    let reject = true;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        if (reject)
          throw safeApiError("request", "WITHDRAWAL_ADDRESS_INVALID", 400);
        return reply(config, pendingDestination, 201);
      }
      return reply(
        config,
        config.url === "/withdrawals/me"
          ? withdrawalStatus
          : { state: "UNSET", serverNow: pendingDestination.serverNow },
      );
    });
    const hook = renderHook(useWithdrawalDestinationCommand, {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    await act(async () => {
      await hook.result.current
        .issue(pendingDestination.address, "TRON_NILE")
        .catch(() => undefined);
    });
    expect(hook.result.current.uncertain).toBe(false);
    reject = false;
    await act(async () => {
      await hook.result.current.issue(pendingDestination.address, "TRON_NILE");
    });
    expect(hook.result.current.observed).toBe(true);
  });
  it("retains an uncertain issuance through remount and session recheck without allowing another send", async () => {
    let writes = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        writes++;
        throw safeApiError("transient", "NETWORK_ERROR");
      }
      return reply(
        config,
        config.url === "/withdrawals/me"
          ? withdrawalStatus
          : { state: "UNSET", serverNow: pendingDestination.serverNow },
      );
    });
    const first = renderHook(useWithdrawalDestinationCommand, {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(first.result.current.allowed).toBe(true);
    });
    await act(async () => {
      await first.result.current
        .issue(pendingDestination.address, "TRON_NILE")
        .catch(() => undefined);
    });
    expect(writes).toBe(1);
    first.unmount();
    act(() => {
      h.runtime.beginCheck();
    });
    const remounted = renderHook(useWithdrawalDestinationCommand, {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(remounted.result.current.uncertain).toBe(true);
    });
    await act(async () => {
      await remounted.result.current
        .issue(pendingDestination.address, "TRON_NILE")
        .catch(() => undefined);
    });
    expect(writes).toBe(1);
  });
  it("observes an uncertain saved version, blocks duplicate issuance and refreshes authoritative eligibility", async () => {
    let saved = false,
      writes = 0;
    const gate = deferred<undefined>();
    const h = queryHarness("USER", async (config) => {
      if (config.method === "post") {
        writes++;
        await gate.promise;
        saved = true;
        throw safeApiError("transient", "NETWORK_ERROR");
      }
      return reply(
        config,
        config.url === "/withdrawals/me"
          ? {
              ...withdrawalStatus,
              destination: saved
                ? pendingDestination
                : { state: "UNSET", serverNow: pendingDestination.serverNow },
            }
          : saved
            ? pendingDestination
            : { state: "UNSET", serverNow: pendingDestination.serverNow },
      );
    });
    const hook = renderHook(
      () => ({
        read: useEmployeeWithdrawalDestination(),
        command: useWithdrawalDestinationCommand(),
      }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.read.data?.state).toBe("UNSET");
    });
    let send: Promise<unknown>;
    act(() => {
      send = hook.result.current.command.issue(
        pendingDestination.address,
        "TRON_NILE",
      );
    });
    await waitFor(() => {
      expect(writes).toBe(1);
    });
    await act(async () => {
      await hook.result.current.command
        .issue(pendingDestination.address, "TRON_NILE")
        .catch(() => undefined);
    });
    expect(writes).toBe(1);
    await act(async () => {
      gate.resolve(undefined);
      await send.catch(() => undefined);
    });
    await waitFor(() => {
      expect(hook.result.current.command.uncertain).toBe(false);
    });
    await waitFor(() => {
      expect(hook.result.current.read.data?.state).toBe("PENDING");
    });
    expect(hook.result.current.command.observed).toBe(true);
    expect(writes).toBe(1);
  });
  it("uses server cooldown/version for resend and preserves unknown delivery rather than claiming mailbox receipt", async () => {
    let saved: Extract<WithdrawalDestination, { state: "PENDING" }> = {
      ...pendingDestination,
      serverNow: pendingDestination.nextIssuanceAt,
      deliveryStatus: "UNKNOWN" as const,
    };
    let writes = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        writes++;
        saved = { ...saved, version: saved.version + 1 };
      }
      return reply(
        config,
        config.url === "/withdrawals/me"
          ? { ...withdrawalStatus, destination: saved }
          : saved,
      );
    });
    const hook = renderHook(
      () => ({
        read: useEmployeeWithdrawalDestination(),
        command: useWithdrawalDestinationCommand(),
      }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.read.data?.state).toBe("PENDING");
    });
    await act(async () => {
      await hook.result.current.command
        .resend(pendingDestination, "TRON_NILE")
        .catch(() => undefined);
    });
    expect(writes).toBe(0);
    await act(async () => {
      await hook.result.current.command.resend(saved, "TRON_NILE");
    });
    await waitFor(() => {
      expect(hook.result.current.read.data).toMatchObject({
        version: 3,
        deliveryStatus: "UNKNOWN",
      });
    });
    expect(writes).toBe(1);
  });
});
