import { StrictMode, useEffect, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupQueries, queryHarness, deferred } from "@/test/p04-query";
import { reply } from "@/test/p04-network";
import { destination, pendingDestination } from "@/test/p09-withdrawals";
import { safeApiError } from "@/services/api/safe-error";
import { withdrawalDestinationSchema } from "@template/contracts";
import { apiClient } from "@/services/api/api-client";
import { useWithdrawalDestinationLink } from "./use-withdrawal-destination-link";

cleanupQueries();
const proof = "a".repeat(43);
afterEach(() => {
  vi.useRealTimers();
  history.replaceState(null, "", "/");
});
function openLink() {
  history.replaceState(
    { preserved: true },
    "",
    `/employee/account#withdrawal-confirmation=${proof}`,
  );
}
describe("private destination email proof", () => {
  it.each(["expired", "superseded"] as const)(
    "resolves a lost reply after later server-proven %s without replay or further observation",
    async (disposition) => {
      openLink();
      let saved = withdrawalDestinationSchema.parse(pendingDestination);
      let writes = 0,
        reads = 0;
      let failedRead = false;
      const h = queryHarness("USER", (config) => {
        if (config.method === "post") {
          writes++;
          throw safeApiError("transient", "NETWORK_ERROR");
        }
        reads++;
        if (failedRead) {
          if (disposition === "expired")
            throw safeApiError("transient", "NETWORK_ERROR");
          return reply(config, { ...pendingDestination, version: "invalid" });
        }
        return reply(config, saved);
      });
      const hook = renderHook(
        () => useWithdrawalDestinationLink("/employee/account"),
        { wrapper: h.wrapper },
      );
      await waitFor(() => {
        expect(hook.result.current.canConfirm).toBe(true);
      });
      vi.useFakeTimers();
      await act(async () => {
        await hook.result.current.confirm(pendingDestination);
        await vi.advanceTimersByTimeAsync(2);
      });
      expect(hook.result.current.state).toBe("uncertain");
      failedRead = true;
      const initialReads = reads;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_001);
      });
      expect(reads).toBeGreaterThan(initialReads);
      expect(hook.result.current.state).toBe("uncertain");
      failedRead = false;
      saved = withdrawalDestinationSchema.parse({
        ...pendingDestination,
        ...(disposition === "expired"
          ? { proofStatus: "EXPIRED", serverNow: pendingDestination.expiresAt }
          : { version: pendingDestination.version + 1 }),
      });
      await act(async () => {
        // Contract failures pause the shared observer until an explicit safe read.
        if (disposition === "superseded")
          await hook.result.current.observation.refetch();
        await vi.advanceTimersByTimeAsync(60_001);
      });
      expect(hook.result.current.state).toBe("reopen");
      expect(hook.result.current.canConfirm).toBe(false);
      const finalReads = reads;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300_000);
        await hook.result.current.confirm(pendingDestination);
      });
      expect(reads).toBe(finalReads);
      expect(writes).toBe(1);
      expect(saved.state).toBe("PENDING");
      expect(location.hash).toBe("");
      expect(JSON.stringify(localStorage)).not.toContain(proof);
      expect(JSON.stringify(sessionStorage)).not.toContain(proof);
      expect(
        JSON.stringify(
          h.client
            .getQueryCache()
            .getAll()
            .map((q) => q.state),
        ),
      ).not.toContain(proof);
      expect(h.client.getMutationCache().getAll()).toHaveLength(0);
    },
  );
  it("keeps a lost precommit reply uncertain through pending reads and observes delayed confirmation once", async () => {
    openLink();
    let committed = false,
      writes = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        writes++;
        throw safeApiError("transient", "NETWORK_ERROR");
      }
      return reply(config, committed ? destination : pendingDestination);
    });
    const hook = renderHook(
      () => useWithdrawalDestinationLink("/employee/account"),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.canConfirm).toBe(true);
    });
    vi.useFakeTimers();
    await act(async () => {
      await hook.result.current.confirm(pendingDestination);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(hook.result.current.state).toBe("uncertain");
    expect(location.hash).toBe("");
    expect(
      JSON.stringify(
        h.client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain(proof);
    committed = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_001);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(hook.result.current.state).toBe("confirmed");
    await act(async () => {
      await hook.result.current.confirm(pendingDestination);
    });
    expect(writes).toBe(1);
  });

  it("keeps definitive invalid-proof guidance without consuming again", async () => {
    openLink();
    let writes = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        writes++;
        throw safeApiError("request", "WITHDRAWAL_PROOF_INVALID", 400);
      }
      return reply(config, pendingDestination);
    });
    const hook = renderHook(
      () => useWithdrawalDestinationLink("/employee/account"),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.canConfirm).toBe(true);
    });
    await act(async () => {
      await hook.result.current.confirm(pendingDestination);
    });
    expect(hook.result.current.state).toBe("reopen");
    expect(hook.result.current.observation.observationCount).toBe(0);
    expect(writes).toBe(1);
  });
  it("discards a signed-out proof and does not recover it after matching login", async () => {
    openLink();
    const h = queryHarness("USER", (config) =>
      reply(config, pendingDestination),
    );
    const signedInAdapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = () =>
      Promise.reject(safeApiError("denied", "UNAUTHORIZED", 401));
    const hook = renderHook(
      () => useWithdrawalDestinationLink("/employee/account"),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.state).toBe("reopen");
    });
    expect(location.hash).toBe("");
    if (signedInAdapter === undefined) delete apiClient.defaults.adapter;
    else apiClient.defaults.adapter = signedInAdapter;
    act(() => {
      h.runtime.beginCheck();
    });
    await waitFor(() => {
      expect(hook.result.current.canConfirm).toBe(false);
    });
    expect(h.client.getMutationCache().getAll()).toHaveLength(0);
  });
  it.each(["short", "a".repeat(44), "<script>bad</script>"])(
    "scrubs malformed recognized proof without consuming: %s",
    async (token) => {
      history.replaceState(
        null,
        "",
        `/employee/account#withdrawal-confirmation=${token}`,
      );
      let writes = 0;
      const h = queryHarness("USER", (config) => {
        if (config.method === "post") writes++;
        return reply(config, pendingDestination);
      });
      const hook = renderHook(
        () => useWithdrawalDestinationLink("/employee/account"),
        { wrapper: h.wrapper },
      );
      await waitFor(() => {
        expect(hook.result.current.state).toBe("reopen");
      });
      expect(location.hash).toBe("");
      expect(writes).toBe(0);
      expect(hook.result.current.canConfirm).toBe(false);
    },
  );
  it("scrubs before passive navigation, preserves native history, and requires explicit consume even in Strict Mode", async () => {
    openLink();
    let writes = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        writes++;
        return reply(config, destination);
      }
      return reply(config, pendingDestination);
    });
    const hook = renderHook(
      () => {
        const link = useWithdrawalDestinationLink("/employee/account");
        useEffect(() => {
          expect(location.hash).toBe("");
        }, []);
        return link;
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <StrictMode>
            <h.wrapper>{children}</h.wrapper>
          </StrictMode>
        ),
      },
    );
    await waitFor(() => {
      expect(hook.result.current.canConfirm).toBe(true);
    });
    expect(history.state).toEqual({ preserved: true });
    expect(writes).toBe(0);
    expect(
      JSON.stringify(
        h.client
          .getQueryCache()
          .getAll()
          .map((q) => [q.queryKey, q.state]),
      ),
    ).not.toContain(proof);
    await act(async () => {
      await hook.result.current.confirm(pendingDestination);
    });
    expect(writes).toBe(1);
    expect(hook.result.current.state).toBe("confirmed");
    expect(hook.result.current.canConfirm).toBe(false);
    expect(h.client.getMutationCache().getAll()).toHaveLength(0);
    expect(JSON.stringify(localStorage)).not.toContain(proof);
  });
  it("handles a new same-route fragment and disposes on pagehide and departure", async () => {
    const h = queryHarness("USER", (config) =>
      reply(config, pendingDestination),
    );
    history.replaceState(null, "", "/employee/account");
    const hook = renderHook(({ path }) => useWithdrawalDestinationLink(path), {
      wrapper: h.wrapper,
      initialProps: { path: "/employee/account" },
    });
    await waitFor(() => {
      expect(h.runtime.scope().accountId).not.toBeNull();
    });
    act(() => {
      openLink();
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => {
      expect(hook.result.current.canConfirm).toBe(true);
    });
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(hook.result.current.canConfirm).toBe(false);
    act(() => {
      openLink();
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    hook.rerender({ path: "/employee/withdraw" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.canConfirm).toBe(false);
  });
  it("clears on session retirement and teardown, requiring the latest email to be reopened", async () => {
    openLink();
    const h = queryHarness("USER", (config) =>
      reply(config, pendingDestination),
    );
    const hook = renderHook(
      () => useWithdrawalDestinationLink("/employee/account"),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.canConfirm).toBe(true);
    });
    act(() => {
      h.runtime.retire();
    });
    expect(hook.result.current.canConfirm).toBe(false);
    hook.unmount();
    const reopened = renderHook(
      () => useWithdrawalDestinationLink("/employee/account"),
      { wrapper: h.wrapper },
    );
    expect(reopened.result.current.canConfirm).toBe(false);
  });
  it("consumes once and observes destination after a lost reply without caching the proof or replaying", async () => {
    openLink();
    let consumed = false,
      writes = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        consumed = true;
        writes++;
        throw safeApiError("transient", "NETWORK_ERROR");
      }
      return reply(config, consumed ? destination : pendingDestination);
    });
    const hook = renderHook(
      () => useWithdrawalDestinationLink("/employee/account"),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.canConfirm).toBe(true);
    });
    await act(async () => {
      await hook.result.current.confirm(pendingDestination);
    });
    expect(hook.result.current.state).toBe("confirmed");
    await act(async () => {
      await hook.result.current.confirm(pendingDestination);
    });
    expect(writes).toBe(1);
  });
  it.each(["session", "pagehide"] as const)(
    "rejects changed review and retires an obsolete completion after %s",
    async (retirement) => {
      openLink();
      const gate = deferred<undefined>();
      let writes = 0;
      const h = queryHarness("USER", async (config) => {
        if (config.method === "post") {
          writes++;
          await gate.promise;
          return reply(config, destination);
        }
        return reply(config, pendingDestination);
      });
      const hook = renderHook(
        () => useWithdrawalDestinationLink("/employee/account"),
        { wrapper: h.wrapper },
      );
      await waitFor(() => {
        expect(hook.result.current.canConfirm).toBe(true);
      });
      await act(async () => {
        await hook.result.current.confirm({
          ...pendingDestination,
          version: 0,
        });
      });
      expect(writes).toBe(0);
      // Changed review retires this proof; reopening is explicit.
      act(() => {
        openLink();
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      let completion: Promise<void>;
      act(() => {
        completion = hook.result.current.confirm(pendingDestination);
      });
      await waitFor(() => {
        expect(writes).toBe(1);
      });
      act(() => {
        if (retirement === "session") h.runtime.retire();
        else window.dispatchEvent(new Event("pagehide"));
      });
      await act(async () => {
        gate.resolve(undefined);
        await completion;
      });
      expect(hook.result.current.state).not.toBe("confirmed");
      expect(hook.result.current.canConfirm).toBe(false);
    },
  );
  it("observes an outstanding confirmation after an ordinary authority recheck without replay", async () => {
    openLink();
    let saved = false,
      writes = 0;
    const gate = deferred<undefined>();
    const h = queryHarness("USER", async (config) => {
      if (config.method === "post") {
        writes++;
        await gate.promise;
        saved = true;
      }
      return reply(config, saved ? destination : pendingDestination);
    });
    const hook = renderHook(
      () => useWithdrawalDestinationLink("/employee/account"),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.canConfirm).toBe(true);
    });
    let send: Promise<void>;
    act(() => {
      send = hook.result.current.confirm(pendingDestination);
    });
    await waitFor(() => {
      expect(writes).toBe(1);
    });
    act(() => {
      h.runtime.beginCheck();
    });
    await act(async () => {
      gate.resolve(undefined);
      await send;
    });
    await waitFor(() => {
      expect(hook.result.current.state).toBe("uncertain");
    });
    await act(async () => {
      await hook.result.current.observation.refetch();
    });
    await waitFor(() => {
      expect(hook.result.current.state).toBe("confirmed");
    });
    expect(writes).toBe(1);
  });
});
