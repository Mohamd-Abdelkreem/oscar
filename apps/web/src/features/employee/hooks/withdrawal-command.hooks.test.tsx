import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeApiError } from "@/services/api/safe-error";
import {
  actorId,
  otherId,
  now,
  reply,
  networkSession,
  reject,
} from "@/test/p04-network";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import { withdrawal, withdrawalQuote } from "@/test/p09-withdrawals";
import { createWithdrawalCommandRuntime } from "../utils/withdrawal-command-runtime";
import { useWithdrawalCommand } from "./withdrawal-command.hooks";

cleanupQueries();
afterEach(() => {
  vi.restoreAllMocks();
});
function isolatedOwner() {
  const session = networkSession();
  const values = new Map<string, string>();
  let held = false;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const owner = () =>
    createWithdrawalCommandRuntime({
      session,
      storage,
      online: () => true,
      key: () => otherId,
      locks: {
        request: async (_name, callback) => {
          if (held) return callback(false);
          held = true;
          try {
            return await callback(true);
          } finally {
            held = false;
          }
        },
      },
    });
  return { session, storage, owner, values };
}
describe("withdrawal command recovery", () => {
  it("retains recovery when a strict blocked first reply cannot remove durable storage", async () => {
    let sends = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        sends++;
        reject(config, "WITHDRAWAL_BLOCKED", 403);
      }
      return reply(config, {
        status: "NOT_OBSERVED",
        quoteId: actorId,
        quote: withdrawalQuote,
        serverNow: now,
      });
    });
    const hook = renderHook(useWithdrawalCommand, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync(actorId),
      ).rejects.toMatchObject({ category: "coordination" });
    });
    expect(
      localStorage.getItem(`oscar.withdrawal.v1.${actorId}`),
    ).not.toBeNull();
    expect(hook.result.current.state.state).toBe("uncertain");
    expect(sends).toBe(1);
  });
  it.each([
    [false, 403, false],
    [true, 409, false],
    [true, 403, true],
  ])(
    "retains strict transport uncertainty for valid=%s status=%s external-check=%s",
    async (valid, status, externalCheck) => {
      let sends = 0;
      const h = queryHarness("USER", (config) => {
        if (config.method === "post") {
          sends++;
          if (externalCheck) h.runtime.beginCheck();
          reject(config, "WITHDRAWAL_BLOCKED", status, valid);
        }
        return reply(config, {
          status: "NOT_OBSERVED",
          quoteId: actorId,
          quote: withdrawalQuote,
          serverNow: now,
        });
      });
      const hook = renderHook(useWithdrawalCommand, { wrapper: h.wrapper });
      await waitFor(() => {
        expect(hook.result.current.allowed).toBe(true);
      });
      await act(async () => {
        await hook.result.current.mutateAsync(actorId).catch(() => undefined);
      });
      expect(
        localStorage.getItem(`oscar.withdrawal.v1.${actorId}`),
      ).not.toBeNull();
      expect(sends).toBe(1);
    },
  );
  it("retires a strict blocked first reply through transport before session revalidation", async () => {
    let sends = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        sends++;
        reject(config, "WITHDRAWAL_BLOCKED", 403);
      }
      return reply(config, {
        status: "NOT_OBSERVED",
        quoteId: actorId,
        quote: withdrawalQuote,
        serverNow: now,
      });
    });
    const hook = renderHook(useWithdrawalCommand, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync(actorId),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_BLOCKED" });
    });
    await waitFor(() => {
      expect(hook.result.current.retained).toBeNull();
    });
    expect(localStorage.getItem(`oscar.withdrawal.v1.${actorId}`)).toBeNull();
    expect(hook.result.current.state.state).toBe("idle");
    expect(sends).toBe(1);
  });
  it("observes a malformed acceptance without replay, preserves live uncertainty and resolves original commitment", async () => {
    let committed = false,
      sends = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method === "post") {
        sends++;
        return reply(config, {}, 201);
      }
      return reply(
        config,
        committed
          ? {
              status: "COMMITTED",
              quoteId: actorId,
              withdrawal,
              serverNow: now,
            }
          : {
              status: "NOT_OBSERVED",
              quoteId: actorId,
              quote: withdrawalQuote,
              serverNow: now,
            },
      );
    });
    const hook = renderHook(useWithdrawalCommand, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync(actorId),
      ).rejects.toMatchObject({ category: "uncertain" });
    });
    await waitFor(() => {
      expect(hook.result.current.observation.data?.status).toBe("NOT_OBSERVED");
    });
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync(otherId),
      ).rejects.toMatchObject({ category: "coordination" });
    });
    committed = true;
    await act(async () => {
      await hook.result.current.observation.refetch();
    });
    expect(hook.result.current.retained).toBeNull();
    expect(sends).toBe(1);
  });
  it("retires a provisional handle when connectivity is lost before dispatch", async () => {
    const session = networkSession();
    const values = new Map<string, string>();
    let online = true,
      sends = 0;
    const owner = createWithdrawalCommandRuntime({
      session,
      online: () => online,
      key: () => otherId,
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
          values.set(key, value);
        },
        removeItem: (key) => {
          values.delete(key);
        },
      },
      locks: { request: (_name, callback) => callback(true) },
    });
    const unsubscribe = owner.subscribe(() => {
      if (owner.snapshot().state === "pending") online = false;
    });
    await expect(
      owner.execute(session.scope(), actorId, () => {
        sends++;
        return Promise.resolve(undefined);
      }),
    ).rejects.toMatchObject({ code: "OFFLINE" });
    expect(owner.handle(actorId)).toBeNull();
    expect(owner.snapshot().state).toBe("idle");
    expect(sends).toBe(0);
    unsubscribe();
    owner.dispose();
  });
  it("keeps pending guard across callers/remount and refreshes confirmed facts without optimistic money", async () => {
    const pending = deferred<undefined>();
    let sends = 0;
    const h = queryHarness("USER", (config) => {
      if (config.method !== "post")
        return reply(config, {
          status: "COMMITTED",
          quoteId: actorId,
          withdrawal,
          serverNow: now,
        });
      sends++;
      return pending.promise.then(() =>
        reply(config, { withdrawal, replayed: false }, 201),
      );
    });
    const first = renderHook(useWithdrawalCommand, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(first.result.current.allowed).toBe(true);
    });
    let completion: Promise<unknown> | undefined;
    act(() => {
      completion = first.result.current.mutateAsync(actorId);
    });
    await waitFor(() => {
      expect(sends).toBe(1);
    });
    first.unmount();
    const next = renderHook(useWithdrawalCommand, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(next.result.current.allowed).toBe(true);
    });
    await act(async () => {
      await expect(
        next.result.current.mutateAsync(actorId),
      ).rejects.toMatchObject({ category: "coordination" });
    });
    await act(async () => {
      pending.resolve(undefined);
      await completion;
    });
    expect(sends).toBe(1);
    expect(next.result.current.retained).toBeNull();
    expect(h.client.getQueryData(["p04", "wallet"])).toBeUndefined();
  });
  it("observes original opaque reload intent, blocks replacements after live absence and resolves committed", async () => {
    const h = isolatedOwner();
    const first = h.owner();
    const scope = h.session.scope();
    await expect(
      first.execute(scope, actorId, () =>
        Promise.reject(safeApiError("transient", "NETWORK_ERROR")),
      ),
    ).rejects.toMatchObject({ category: "transient" });
    first.dispose();
    const reloaded = h.owner();
    let sends = 0;
    await expect(
      reloaded.execute(scope, actorId, () => {
        sends++;
        return Promise.resolve(undefined);
      }),
    ).rejects.toMatchObject({ category: "coordination" });
    expect(
      await reloaded.observe(scope, (id) => {
        expect(id).toBe(actorId);
        return Promise.resolve({
          status: "NOT_OBSERVED",
          quoteId: actorId,
          quote: withdrawalQuote,
          serverNow: now,
        });
      }),
    ).toMatchObject({ status: "NOT_OBSERVED" });
    expect(reloaded.handle(actorId)).toMatchObject({
      quoteId: actorId,
      requestKey: otherId,
    });
    expect(
      await reloaded.observe(scope, () =>
        Promise.resolve({
          status: "COMMITTED",
          quoteId: actorId,
          withdrawal,
          serverNow: now,
        }),
      ),
    ).toMatchObject({ status: "COMMITTED" });
    expect(sends).toBe(0);
    expect(reloaded.handle(actorId)).toBeNull();
    reloaded.dispose();
  });
  it.each([
    ["WITHDRAWAL_QUOTE_STALE", 409],
    ["WITHDRAWAL_ACTIVE", 409],
    ["WITHDRAWAL_BLOCKED", 403],
  ])("retires only original definite %s rejection", async (code, status) => {
    const h = isolatedOwner();
    const owner = h.owner();
    await expect(
      owner.execute(h.session.scope(), actorId, () =>
        Promise.reject(safeApiError("request", code, status)),
      ),
    ).rejects.toMatchObject({ code });
    expect(owner.handle(actorId)).toBeNull();
    expect(owner.snapshot().state).toBe("idle");
    owner.dispose();
  });
  it.each([
    ["WITHDRAWAL_QUOTE_STALE", 500],
    ["VALIDATION_ERROR", 400],
    ["SERVICE_UNAVAILABLE", 503],
  ])(
    "retains ambiguity for %s/%s and cannot erase it with another error",
    async (code, status) => {
      const h = isolatedOwner();
      const owner = h.owner();
      await expect(
        owner.execute(h.session.scope(), actorId, () =>
          Promise.reject(safeApiError("request", code, status)),
        ),
      ).rejects.toMatchObject({ code });
      await expect(
        owner.execute(h.session.scope(), actorId, () =>
          Promise.reject(
            safeApiError("request", "WITHDRAWAL_QUOTE_STALE", 409),
          ),
        ),
      ).rejects.toMatchObject({ category: "coordination" });
      expect(owner.handle(actorId)).not.toBeNull();
      owner.dispose();
    },
  );
  it("retains failed handle retirement and rejects a mismatched outcome until proven expired", async () => {
    const h = isolatedOwner();
    const owner = h.owner();
    const scope = h.session.scope();
    const remove = vi.spyOn(h.storage, "removeItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    await expect(
      owner.execute(scope, actorId, () =>
        Promise.reject(safeApiError("request", "WITHDRAWAL_QUOTE_STALE", 409)),
      ),
    ).rejects.toMatchObject({ category: "coordination" });
    expect(owner.handle(actorId)).not.toBeNull();
    remove.mockRestore();
    await expect(
      owner.observe(scope, () =>
        Promise.resolve({
          status: "COMMITTED",
          quoteId: otherId,
          withdrawal,
          serverNow: now,
        }),
      ),
    ).rejects.toMatchObject({ category: "contract" });
    expect(owner.handle(actorId)).not.toBeNull();
    await owner.observe(scope, () =>
      Promise.resolve({
        status: "EXPIRED_UNCOMMITTED",
        quoteId: actorId,
        quote: withdrawalQuote,
        serverNow: withdrawalQuote.quoteExpiresAt,
      }),
    );
    expect(owner.handle(actorId)).toBeNull();
    owner.dispose();
  });
  it("settles an obsolete same-account reply as uncertain and reconciles after a fresh check", async () => {
    const h = isolatedOwner();
    const owner = h.owner();
    const scope = h.session.scope();
    await expect(
      owner.execute(scope, actorId, () => {
        h.session.beginCheck();
        return Promise.resolve({ withdrawal, replayed: false });
      }),
    ).rejects.toMatchObject({ category: "obsolete" });
    expect(owner.handle(actorId)).not.toBeNull();
    expect(owner.snapshot().state).toBe("uncertain");
    await owner.observe(h.session.scope(), () =>
      Promise.resolve({
        status: "COMMITTED",
        quoteId: actorId,
        withdrawal,
        serverNow: now,
      }),
    );
    expect(owner.handle(actorId)).toBeNull();
    owner.dispose();
  });
  it("never dispatches without durable handle readback or when locally offline", async () => {
    const session = networkSession();
    let sends = 0;
    for (const online of [false, true]) {
      const owner = createWithdrawalCommandRuntime({
        session,
        online: () => online,
        key: () => otherId,
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
        locks: { request: (_name, callback) => callback(true) },
      });
      await expect(
        owner.execute(session.scope(), actorId, () => {
          sends++;
          return Promise.resolve(undefined);
        }),
      ).rejects.toMatchObject({
        category: online ? "coordination" : "request",
      });
      owner.dispose();
    }
    expect(sends).toBe(0);
  });
});
