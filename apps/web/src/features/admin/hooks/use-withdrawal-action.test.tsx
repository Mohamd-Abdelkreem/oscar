import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { cleanupQueries, queryHarness, deferred } from "@/test/p04-query";
import { actorId, otherId, reply } from "@/test/p04-network";
import { withdrawal } from "@/test/p09-withdrawals";
import { createAdminWithdrawalRuntime } from "../utils/withdrawal-command-runtime";
import { useWithdrawalAction } from "./use-withdrawal-action";
import { useAdminWithdrawalDetail } from "./withdrawals.hooks";

cleanupQueries();
afterEach(() => {
  vi.unstubAllGlobals();
});
const row = {
  ...withdrawal,
  employee: {
    id: actorId,
    fullName: "Employee",
    email: "employee@example.test",
  },
  canExtend: true,
  canReject: true,
};
const intent = {
  target: otherId,
  kind: "EXTEND" as const,
  body: {
    expectedVersion: 1,
    countedHours: "1.5",
    reason: "Private reviewed reason",
    confirmed: true as const,
  },
};
function setup() {
  vi.stubGlobal("crypto", webcrypto);
  const h = queryHarness("ADMIN", (config) => reply(config, row));
  const environment = {
    session: h.runtime,
    storage: localStorage,
    online: () => true,
    key: () => actorId,
    locks: {
      request: async <T,>(
        _name: string,
        callback: (available: boolean) => Promise<T>,
      ) => callback(true),
    },
  };
  return {
    ...h,
    environment,
    runtime: createAdminWithdrawalRuntime(environment),
  };
}
describe("immutable scheduled command recovery", () => {
  it.each(["EXTEND", "REJECT"] as const)(
    "refreshes stale %s detail before dispatch without changing the reviewed intent",
    async (kind) => {
      vi.stubGlobal("crypto", webcrypto);
      let current = row,
        sends = 0;
      const h = queryHarness("ADMIN", (config) => {
        if (config.method === "post") sends++;
        return reply(config, current);
      });
      const hook = renderHook(
        () => ({
          action: useWithdrawalAction(),
          detail: useAdminWithdrawalDetail(otherId),
        }),
        { wrapper: h.wrapper },
      );
      await waitFor(() => {
        expect(hook.result.current.detail.data?.version).toBe(1);
      });
      const reviewed =
        kind === "EXTEND"
          ? intent
          : {
              target: otherId,
              kind,
              body: {
                expectedVersion: 1,
                reason: intent.body.reason,
                confirmed: true as const,
              },
            };
      current = { ...row, version: 2 };
      await act(async () => {
        await expect(
          hook.result.current.action.execute(reviewed),
        ).rejects.toMatchObject({ code: "WITHDRAWAL_VERSION_CONFLICT" });
      });
      await waitFor(() => {
        expect(hook.result.current.detail.data?.version).toBe(2);
      });
      expect(reviewed.body.expectedVersion).toBe(1);
      expect(reviewed.body.reason).toBe(intent.body.reason);
      expect(hook.result.current.action.retained).toBeNull();
      expect(hook.result.current.action.state.state).toBe("idle");
      expect(sends).toBe(0);
    },
  );
  it("retains exact key/body through loss and remount, rejects edits, and manually retries only original intent", async () => {
    const h = setup();
    const dispatch = vi.fn().mockRejectedValue(new Error("lost reply"));
    await expect(
      h.runtime.execute(h.environment.session.scope(), intent, {
        review: async () => {},
        dispatch,
      }),
    ).rejects.toBeDefined();
    expect(
      localStorage.getItem(`oscar.admin-withdrawal.v1.${actorId}`),
    ).not.toContain(intent.body.reason);
    expect(h.runtime.snapshot().state).toBe("uncertain");
    await expect(
      h.runtime.execute(
        h.environment.session.scope(),
        { ...intent, body: { ...intent.body, reason: "Edited" } },
        { review: async () => {}, dispatch },
      ),
    ).rejects.toMatchObject({ code: "WITHDRAWAL_UNRESOLVED" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    await expect(
      h.runtime.retry(
        h.environment.session.scope(),
        { ...intent, body: { ...intent.body, countedHours: "2" } },
        dispatch,
      ),
    ).rejects.toMatchObject({ code: "WITHDRAWAL_UNRESOLVED" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    dispatch.mockResolvedValue({
      withdrawal: {
        ...withdrawal,
        version: 2,
        scheduleVersion: 2,
        dueAt: "2026-10-08T10:30:00.000Z",
        dispatchAt: "2026-10-08T10:30:00.000Z",
      },
      replayed: true,
    });
    await h.runtime.retry(h.environment.session.scope(), intent, dispatch);
    expect(dispatch.mock.calls[1]?.[0]).toBe(actorId);
    expect(h.runtime.snapshot().state).toBe("idle");
    h.runtime.dispose();
  });
  it("reload observes only, NOT_OBSERVED stays blocked and SUPERSEDED clears without claiming success", async () => {
    const h = setup();
    await h.runtime
      .execute(h.environment.session.scope(), intent, {
        review: async () => {},
        dispatch: () => Promise.reject(new Error("lost")),
      })
      .catch(() => {});
    h.runtime.dispose();
    const restored = createAdminWithdrawalRuntime(h.environment);
    await expect(
      restored.retry(h.environment.session.scope(), intent, () =>
        Promise.resolve({}),
      ),
    ).rejects.toMatchObject({ code: "WITHDRAWAL_UNRESOLVED" });
    const outcome = {
      kind: "EXTEND",
      requestKey: actorId,
      withdrawalId: otherId,
      expectedVersion: 1,
      serverNow: row.serverNow,
      withdrawal: row,
    };
    await restored.observe(h.environment.session.scope(), () =>
      Promise.resolve({
        ...outcome,
        status: "NOT_OBSERVED",
      }),
    );
    expect(restored.handle(actorId)).not.toBeNull();
    await restored.observe(h.environment.session.scope(), () =>
      Promise.resolve({
        ...outcome,
        status: "SUPERSEDED",
        withdrawal: { ...row, version: 2 },
      }),
    );
    expect(restored.handle(actorId)).toBeNull();
    restored.dispose();
  });
  it("keeps one pending dispatch across hook remount and guards fresh-detail conflicts", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const pending = deferred<undefined>();
    let sends = 0;
    const h = queryHarness("ADMIN", (config) => {
      if (config.method === "post") {
        sends++;
        return pending.promise.then(() =>
          reply(config, {
            withdrawal: { ...withdrawal, version: 2 },
            replayed: true,
          }),
        );
      }
      return reply(config, row);
    });
    const hook = renderHook(() => useWithdrawalAction(), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    let first: Promise<unknown> = Promise.resolve();
    act(() => {
      first = hook.result.current
        .execute(intent)
        .catch((error: unknown) => error);
    });
    await waitFor(() => {
      expect(sends).toBe(1);
    });
    hook.unmount();
    const second = renderHook(() => useWithdrawalAction(), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(second.result.current.state.state).toBe("pending");
    });
    await act(async () => {
      await expect(second.result.current.execute(intent)).rejects.toBeDefined();
    });
    expect(sends).toBe(1);
    act(() => {
      h.runtime.retire();
    });
    expect(second.result.current.allowed).toBe(false);
    await act(async () => {
      pending.resolve(undefined);
      await first;
    });
  });
  it("binds COMMITTED to exact actor/key beyond visible history, preserves uncertainty on mismatches and retains saved audit feedback", async () => {
    const h = setup();
    await h.runtime
      .execute(h.environment.session.scope(), intent, {
        review: () => Promise.resolve(),
        dispatch: () => Promise.reject(new Error("lost")),
      })
      .catch(() => {});
    const extended = {
      ...row,
      version: 102,
      scheduleVersion: 102,
      dueAt: "2026-10-09T09:00:00.000Z",
      dispatchAt: "2026-10-09T09:00:00.000Z",
      actions: [],
    };
    const committed = {
      status: "COMMITTED",
      kind: "EXTEND",
      requestKey: actorId,
      withdrawalId: otherId,
      expectedVersion: 1,
      serverNow: row.serverNow,
      withdrawal: extended,
      action: {
        id: actorId,
        kind: "EXTEND",
        actorUserId: actorId,
        occurredAt: row.serverNow,
        reason: intent.body.reason,
        expectedVersion: 1,
        committedVersion: 2,
        beforeDueAt: row.dueAt,
        afterDueAt: "2026-10-08T10:30:00.000Z",
        beforeScheduleVersion: 1,
        afterScheduleVersion: 2,
      },
    };
    await expect(
      h.runtime.observe(h.environment.session.scope(), () =>
        Promise.resolve({ ...committed, requestKey: "different-key-0000001" }),
      ),
    ).rejects.toMatchObject({ category: "contract" });
    await expect(
      h.runtime.observe(h.environment.session.scope(), () =>
        Promise.resolve({
          ...committed,
          action: { ...committed.action, actorUserId: otherId },
        }),
      ),
    ).rejects.toMatchObject({ category: "contract" });
    expect(h.runtime.handle(actorId)).not.toBeNull();
    const observed = await h.runtime.observe(
      h.environment.session.scope(),
      () => Promise.resolve(committed),
    );
    expect(observed?.status).toBe("COMMITTED");
    expect(h.runtime.snapshot().outcome).toEqual(committed);
    expect(h.runtime.handle(actorId)).toBeNull();
    h.runtime.dispose();
  });
  it.each(["storage", "offline"] as const)(
    "fails closed before dispatch when %s is unavailable",
    async (failure) => {
      const h = setup();
      h.runtime.dispose();
      const runtime = createAdminWithdrawalRuntime({
        ...h.environment,
        storage: failure === "storage" ? undefined : localStorage,
        online: () => failure !== "offline",
      });
      const dispatch = vi.fn();
      await expect(
        runtime.execute(h.environment.session.scope(), intent, {
          review: () => Promise.resolve(),
          dispatch,
        }),
      ).rejects.toBeDefined();
      expect(dispatch).not.toHaveBeenCalled();
      runtime.dispose();
    },
  );
  it("refuses a stale current version before creating a recovery identity or sending", async () => {
    vi.stubGlobal("crypto", webcrypto);
    let sends = 0;
    const h = queryHarness("ADMIN", (config) => {
      if (config.method === "post") sends++;
      return reply(config, {
        ...row,
        version: 2,
        canExtend: false,
        canReject: false,
      });
    });
    const hook = renderHook(() => useWithdrawalAction(), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    await act(async () => {
      await expect(hook.result.current.execute(intent)).rejects.toMatchObject({
        code: "WITHDRAWAL_VERSION_CONFLICT",
      });
    });
    expect(sends).toBe(0);
    expect(
      localStorage.getItem(`oscar.admin-withdrawal.v1.${actorId}`),
    ).toBeNull();
  });
});
