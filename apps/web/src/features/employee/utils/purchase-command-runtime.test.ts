import { beforeEach, describe, expect, it } from "vitest";
import { createSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { actorId, otherId, now, purchase, quote } from "@/test/p04-network";
import { createPurchaseCommandRuntime } from "./purchase-command-runtime";

function harness() {
  const storage = new Map<string, string>();
  let locked = false;
  const locks = {
    async request<T>(
      _name: string,
      callback: (available: boolean) => Promise<T>,
    ) {
      if (locked) return callback(false);
      locked = true;
      try {
        return await callback(true);
      } finally {
        locked = false;
      }
    },
  };
  const session = createSessionRuntime({});
  session.admitIdentity(session.scope(), { id: actorId, role: "USER" });
  const environment = {
    storage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
    locks,
    session,
    online: () => true,
  };
  return {
    storage,
    session,
    environment,
    runtime: createPurchaseCommandRuntime(environment),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

describe("durable actor purchase ownership", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("blocks competing callers and tabs while retaining uncertainty across remount/reload", async () => {
    const h = harness();
    const response = deferred<{
      purchase: typeof purchase;
      replayed: boolean;
    }>();
    const first = h.runtime.execute(
      h.session.scope(),
      actorId,
      () => response.promise,
    );
    await expect(
      h.runtime.execute(h.session.scope(), otherId, () =>
        Promise.resolve().then(() => ({
          purchase,
          replayed: false,
        })),
      ),
    ).rejects.toMatchObject({ category: "coordination" });
    const tab = createPurchaseCommandRuntime(h.environment);
    await expect(
      tab.execute(h.session.scope(), otherId, () =>
        Promise.resolve().then(() => ({
          purchase,
          replayed: false,
        })),
      ),
    ).rejects.toMatchObject({ category: "coordination" });
    response.resolve({
      purchase: { ...purchase, quoteId: otherId },
      replayed: false,
    });
    await expect(first).rejects.toMatchObject({ category: "uncertain" });
    const reload = createPurchaseCommandRuntime(h.environment);
    expect(reload.handle(actorId)).toBe(actorId);
    expect([...h.storage.values()].join()).not.toContain("fullDebit");
    await expect(
      reload.execute(h.session.scope(), otherId, () =>
        Promise.resolve().then(() => ({
          purchase,
          replayed: false,
        })),
      ),
    ).rejects.toMatchObject({ category: "coordination" });
  });
  it("failed retry and read cannot clear earlier dispatch; live absence is nonterminal", async () => {
    const h = harness();
    await expect(
      h.runtime.execute(h.session.scope(), actorId, () =>
        Promise.resolve().then(() => {
          throw safeApiError("uncertain", "NETWORK_ERROR");
        }),
      ),
    ).rejects.toMatchObject({ category: "uncertain" });
    await expect(
      h.runtime.execute(h.session.scope(), actorId, () =>
        Promise.resolve().then(() => {
          throw safeApiError("request", "PURCHASE_QUOTE_STALE");
        }),
      ),
    ).rejects.toMatchObject({ code: "PURCHASE_QUOTE_STALE" });
    await expect(
      h.runtime.observe(h.session.scope(), () =>
        Promise.resolve().then(() => {
          throw safeApiError("transient", "NETWORK_ERROR");
        }),
      ),
    ).rejects.toMatchObject({ category: "transient" });
    expect(
      await h.runtime.observe(h.session.scope(), () =>
        Promise.resolve().then(() => ({
          status: "NOT_OBSERVED",
          quoteId: actorId,
          quote,
          serverNow: now,
        })),
      ),
    ).toMatchObject({ status: "NOT_OBSERVED" });
    expect(h.runtime.handle(actorId)).toBe(actorId);
    await h.runtime.observe(h.session.scope(), () =>
      Promise.resolve().then(() => ({
        status: "COMMITTED",
        quoteId: actorId,
        purchase,
        serverNow: now,
      })),
    );
    expect(h.runtime.handle(actorId)).toBeNull();
  });
  it("same-check authority changes and account retirement detach late success but keep recovery", async () => {
    const h = harness();
    const response = deferred<{
      purchase: typeof purchase;
      replayed: boolean;
    }>();
    const scope = h.session.scope();
    const command = h.runtime.execute(scope, actorId, () => response.promise);
    h.session.beginCheck();
    response.resolve({ purchase, replayed: false });
    await expect(command).rejects.toMatchObject({ category: "obsolete" });
    expect(h.runtime.handle(actorId)).toBe(actorId);
    h.session.retire();
    h.session.admitIdentity(h.session.scope(), { id: otherId, role: "USER" });
    expect(h.runtime.handle(otherId)).toBeNull();
    expect(h.runtime.snapshot()).toMatchObject({
      state: "idle",
      quoteId: null,
    });
    expect(h.runtime.handle(actorId)).toBe(actorId);
  });
  it.each(["locks", "storage", "readback", "offline"])(
    "fails closed before dispatch when %s unavailable",
    async (fault) => {
      const h = harness();
      let sends = 0;
      const runtime = createPurchaseCommandRuntime({
        ...h.environment,
        ...(fault === "locks" ? { locks: undefined } : {}),
        ...(fault === "storage" ? { storage: undefined } : {}),
        ...(fault === "readback"
          ? { storage: { ...h.environment.storage, setItem: () => {} } }
          : {}),
        online: () => fault !== "offline",
      });
      await expect(
        runtime.execute(h.session.scope(), actorId, () =>
          Promise.resolve().then(() => {
            sends++;
            return { purchase, replayed: false };
          }),
        ),
      ).rejects.toBeDefined();
      expect(sends).toBe(0);
      if (fault === "storage") expect(() => runtime.handle(actorId)).toThrow();
      else expect(runtime.handle(actorId)).not.toBe(actorId);
    },
  );
  it("only matching buyer-locked expired evidence releases unresolved identity", async () => {
    const h = harness();
    await h.runtime
      .execute(h.session.scope(), actorId, () =>
        Promise.resolve().then(() => {
          throw safeApiError("uncertain", "NETWORK_ERROR");
        }),
      )
      .catch(() => {});
    await expect(
      h.runtime.observe(h.session.scope(), () =>
        Promise.resolve().then(() => ({
          status: "EXPIRED_UNCOMMITTED",
          quoteId: otherId,
          quote,
          serverNow: quote.quoteExpiresAt,
        })),
      ),
    ).rejects.toMatchObject({ category: "contract" });
    expect(h.runtime.handle(actorId)).toBe(actorId);
    await h.runtime.observe(h.session.scope(), () =>
      Promise.resolve().then(() => ({
        status: "EXPIRED_UNCOMMITTED",
        quoteId: actorId,
        quote,
        serverNow: quote.quoteExpiresAt,
      })),
    );
    expect(h.runtime.handle(actorId)).toBeNull();
  });
  it("releases a newly claimed handle on synchronous pre-dispatch retirement only", async () => {
    const h = harness();
    let sends = 0;
    const unsubscribe = h.runtime.subscribe(() => {
      if (h.runtime.snapshot().state === "pending") h.session.retire();
    });
    await expect(
      h.runtime.execute(h.session.scope(), actorId, () => {
        sends++;
        return Promise.resolve({ purchase, replayed: false });
      }),
    ).rejects.toMatchObject({ category: "obsolete" });
    expect(sends).toBe(0);
    expect(h.runtime.handle(actorId)).toBeNull();
    unsubscribe();
  });
  it("offline retry retains earlier dispatch and lock failures do not leak diagnostics", async () => {
    const h = harness();
    await h.runtime
      .execute(h.session.scope(), actorId, () =>
        Promise.reject(safeApiError("uncertain", "NETWORK_ERROR")),
      )
      .catch(() => {});
    const offline = createPurchaseCommandRuntime({
      ...h.environment,
      online: () => false,
    });
    await expect(
      offline.execute(h.session.scope(), actorId, () =>
        Promise.resolve({ purchase, replayed: true }),
      ),
    ).rejects.toMatchObject({ code: "OFFLINE" });
    expect(offline.handle(actorId)).toBe(actorId);
    const broken = createPurchaseCommandRuntime({
      ...h.environment,
      locks: { request: () => Promise.reject(new Error("PRIVATE SENTINEL")) },
    });
    const failure = await broken
      .observe(h.session.scope(), () => Promise.resolve(null))
      .catch((error: unknown) => error);
    expect(JSON.stringify(failure)).not.toContain("SENTINEL");
    expect(broken.handle(actorId)).toBe(actorId);
  });
  it("malformed retained handle and failed terminal removal keep coordination closed", async () => {
    const h = harness();
    h.storage.set(
      `oscar.purchase.v1.${actorId}`,
      JSON.stringify({ version: 1, quoteId: actorId, amount: "60" }),
    );
    await expect(
      h.runtime.observe(h.session.scope(), () => Promise.resolve(null)),
    ).rejects.toMatchObject({ category: "coordination" });
    h.storage.clear();
    await h.runtime
      .execute(h.session.scope(), actorId, () =>
        Promise.reject(safeApiError("uncertain", "NETWORK_ERROR")),
      )
      .catch(() => {});
    const failedRemoval = createPurchaseCommandRuntime({
      ...h.environment,
      storage: { ...h.environment.storage, removeItem: () => {} },
    });
    await expect(
      failedRemoval.observe(h.session.scope(), () =>
        Promise.resolve({
          status: "COMMITTED",
          quoteId: actorId,
          purchase,
          serverNow: now,
        }),
      ),
    ).rejects.toMatchObject({ category: "coordination" });
    expect(failedRemoval.handle(actorId)).toBe(actorId);
  });
});
