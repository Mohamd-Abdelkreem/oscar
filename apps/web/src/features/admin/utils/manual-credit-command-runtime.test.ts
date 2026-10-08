import { describe, expect, it, vi } from "vitest";
import { createSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { actorId, otherId } from "@/test/p04-network";
import {
  manualCreditBody as body,
  manualCreditOutcome as result,
} from "@/test/p07-deposits";
import { createManualCreditCommandRuntime } from "./manual-credit-command-runtime";

function harness() {
  const data = new Map<string, string>();
  let busy = false;
  const session = createSessionRuntime({});
  session.admitIdentity(session.scope(), { id: actorId, role: "ADMIN" });
  const env = {
    session,
    online: () => true,
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    },
    locks: {
      async request<T>(_key: string, work: (available: boolean) => Promise<T>) {
        if (busy) return work(false);
        busy = true;
        try {
          return await work(true);
        } finally {
          busy = false;
        }
      },
    },
  };
  return { env, data, session, runtime: createManualCreditCommandRuntime(env) };
}
describe("manual credit original action ownership", () => {
  it("retains a recovered original through malformed and mismatched observations", async () => {
    const h = harness();
    await expect(
      h.runtime.execute(h.session.scope(), body, () =>
        Promise.reject(safeApiError("transient", "NETWORK_ERROR")),
      ),
    ).rejects.toBeDefined();
    const reload = createManualCreditCommandRuntime(h.env);
    for (const wrong of [
      { ...result, actionId: otherId },
      { ...result, employeeId: actorId },
      { ...result, actor: { ...result.actor, id: otherId } },
      { ...result, secret: "SENTINEL" },
    ]) {
      await expect(
        reload.observe(h.session.scope(), () => Promise.resolve(wrong)),
      ).rejects.toMatchObject({ category: "uncertain" });
      expect(h.data.size).toBe(1);
    }
    h.env.storage.removeItem = () => undefined;
    await expect(
      reload.observe(h.session.scope(), () => Promise.resolve(result)),
    ).rejects.toMatchObject({ category: "coordination" });
    expect(h.data.size).toBe(1);
  });
  it("isolates another actor and lets the returning original actor settle with changed labels and notify the other owner", async () => {
    const h = harness();
    await expect(
      h.runtime.execute(h.session.scope(), body, () =>
        Promise.reject(safeApiError("uncertain", "MANUAL_CREDIT_CONFLICT")),
      ),
    ).rejects.toBeDefined();
    const otherOwner = createManualCreditCommandRuntime(h.env);
    await expect(
      otherOwner.observe(h.session.scope(), () =>
        Promise.reject(safeApiError("transient", "NETWORK_ERROR")),
      ),
    ).rejects.toBeDefined();
    h.session.retire();
    h.session.admitIdentity(h.session.scope(), { id: otherId, role: "ADMIN" });
    const read = vi.fn(() => Promise.resolve(result));
    expect(await h.runtime.observe(h.session.scope(), read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(h.data.size).toBe(1);
    h.session.retire();
    h.session.admitIdentity(h.session.scope(), { id: actorId, role: "ADMIN" });
    expect(await h.runtime.observe(h.session.scope(), read)).toEqual(result);
    otherOwner.notifyRecoveryChanged();
    expect(otherOwner.snapshot()).toEqual({ state: "idle", intent: null });
    expect(h.data.size).toBe(0);
  });
  it("ignores a late original observation after retirement and never clears its handle", async () => {
    const h = harness();
    await expect(
      h.runtime.execute(h.session.scope(), body, () =>
        Promise.reject(safeApiError("transient", "NETWORK_ERROR")),
      ),
    ).rejects.toBeDefined();
    const scope = h.session.scope();
    const observing = h.runtime.observe(scope, () => {
      h.session.retire();
      return Promise.resolve(result);
    });
    await expect(observing).rejects.toMatchObject({ category: "obsolete" });
    expect(h.data.size).toBe(1);
    expect(h.runtime.snapshot().intent).toBeNull();
  });
  it("dispatches once, blocks another instance and reload observes only the minimal original handle", async () => {
    const h = harness();
    let reject!: (failure: unknown) => void;
    const dispatch = vi.fn(
      () =>
        new Promise<unknown>((_resolve, no) => {
          reject = no;
        }),
    );
    const pending = h.runtime.execute(h.session.scope(), body, dispatch);
    const tab = createManualCreditCommandRuntime(h.env);
    await expect(
      tab.execute(h.session.scope(), body, dispatch),
    ).rejects.toMatchObject({ category: "coordination" });
    reject(safeApiError("transient", "NETWORK_ERROR"));
    await expect(pending).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(JSON.parse([...h.data.values()][0] ?? "null")).toEqual({
      version: 1,
      actionId: actorId,
      employeeId: otherId,
    });
    const reload = createManualCreditCommandRuntime(h.env);
    await expect(
      reload.execute(h.session.scope(), body, dispatch),
    ).rejects.toMatchObject({ category: "coordination" });
    await expect(
      reload.observe(h.session.scope(), () =>
        Promise.reject(safeApiError("request", "DEPOSIT_NOT_FOUND", 404)),
      ),
    ).rejects.toMatchObject({ code: "DEPOSIT_NOT_FOUND" });
    expect(h.data.size).toBe(1);
    expect(
      await reload.observe(h.session.scope(), () => Promise.resolve(result)),
    ).toEqual(result);
    expect(h.data.size).toBe(0);
  });
  it.each(["missing-lock", "busy", "read", "write", "readback"])(
    "fails closed before dispatch when %s coordination fails",
    async (fault) => {
      const h = harness();
      if (fault === "read")
        h.env.storage.getItem = () => {
          throw new Error("sentinel");
        };
      if (fault === "write")
        h.env.storage.setItem = () => {
          throw new Error("sentinel");
        };
      if (fault === "readback") h.env.storage.setItem = () => undefined;
      const runtime = createManualCreditCommandRuntime({
        ...h.env,
        locks:
          fault === "missing-lock"
            ? undefined
            : fault === "busy"
              ? { request: async (_key, work) => work(false) }
              : h.env.locks,
      });
      const dispatch = vi.fn(() => Promise.resolve(result));
      await expect(
        runtime.execute(h.session.scope(), body, dispatch),
      ).rejects.toMatchObject({ category: "coordination" });
      expect(dispatch).not.toHaveBeenCalled();
    },
  );
  it("retains the pre-dispatch crash identity when publication retires authority synchronously", async () => {
    const h = harness();
    const dispatch = vi.fn(() => Promise.resolve(result));
    h.runtime.subscribe(() => {
      if (h.runtime.snapshot().state === "pending") h.session.retire();
    });
    await expect(
      h.runtime.execute(h.session.scope(), body, dispatch),
    ).rejects.toMatchObject({ category: "obsolete" });
    expect(dispatch).not.toHaveBeenCalled();
    expect(h.data.size).toBe(1);
    expect(h.runtime.snapshot().intent).toBeNull();
  });
  it.each([
    "actor",
    "employee",
    "action",
    "amount",
    "reason",
    "reference",
    "malformed",
    "removal",
  ])("retains identity on %s mismatch or settlement failure", async (fault) => {
    const h = harness();
    const changed =
      fault === "actor"
        ? { ...result, actor: { ...result.actor, id: otherId } }
        : fault === "employee"
          ? { ...result, employeeId: actorId }
          : fault === "action"
            ? { ...result, actionId: otherId }
            : fault === "amount"
              ? { ...result, amount: "2" }
              : fault === "reason"
                ? { ...result, reason: "Other reason" }
                : fault === "reference"
                  ? {
                      ...result,
                      reference: { kind: "EXTERNAL", value: "other-reference" },
                    }
                  : fault === "malformed"
                    ? { ...result, secret: "sentinel" }
                    : result;
    if (fault === "removal")
      h.env.storage.removeItem = () => {
        throw new Error("sentinel");
      };
    await expect(
      h.runtime.execute(h.session.scope(), body, () =>
        Promise.resolve(changed),
      ),
    ).rejects.toBeDefined();
    expect(h.data.size).toBe(1);
    expect(h.runtime.snapshot().state).toBe("uncertain");
  });
});
