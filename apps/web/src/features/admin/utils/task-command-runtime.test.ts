import { describe, expect, it } from "vitest";
import { commandHarness } from "@/test/p05-command";
import { actorId, otherId } from "@/test/p04-network";
import { deferred } from "@/test/p04-query";
import { createAdminTaskCommandRuntime } from "./task-command-runtime";

describe("admin task command isolation", () => {
  it("does not retire a review handle from wrong identity, lost cancellation or a retired completion", async () => {
    const h = commandHarness("ADMIN");
    const runtime = createAdminTaskCommandRuntime(h.environment);
    const operation = { kind: "FINAL_REVIEW", targetId: actorId } as const;
    expect(
      (
        await runtime.execute(h.session.scope(), operation, () =>
          Promise.resolve(),
        )
      ).state,
    ).toBe("NOT_OBSERVED");
    const original = runtime.outstanding(h.session.scope(), operation);
    h.environment.observe = () =>
      Promise.resolve({
        state: "NOT_OBSERVED",
        commandId: otherId,
        kind: "FINAL_REVIEW",
      });
    await expect(
      runtime.observe(h.session.scope(), operation),
    ).rejects.toMatchObject({ category: "contract" });
    h.environment.cancel = () => Promise.reject(new Error("lost response"));
    await expect(
      runtime.cancel(h.session.scope(), operation),
    ).rejects.toThrow();
    expect(runtime.outstanding(h.session.scope(), operation)).toEqual(original);
    const gate = deferred<unknown>();
    h.environment.observe = () => gate.promise;
    const scope = h.session.scope();
    const pending = runtime.observe(scope, operation);
    h.session.retire();
    gate.resolve({
      state: "CANCELLED",
      commandId: original?.commandId,
      kind: "FINAL_REVIEW",
      cancelledAt: "2026-10-05T09:00:00.000Z",
    });
    await expect(pending).rejects.toMatchObject({ category: "obsolete" });
    h.session.admitIdentity(h.session.scope(), { id: actorId, role: "ADMIN" });
    expect(runtime.outstanding(h.session.scope(), operation)).toEqual(original);
    runtime.dispose();
    h.session.dispose();
  });
  it("fails closed for missing coordination and employee/proof operations", async () => {
    const h = commandHarness("ADMIN");
    h.environment.locks = undefined;
    const unavailable = createAdminTaskCommandRuntime(h.environment);
    expect(() =>
      unavailable.execute(
        h.session.scope(),
        { kind: "TASK_CREATE", targetId: null },
        () => Promise.resolve(),
      ),
    ).toThrow();
    unavailable.dispose();
    h.environment.locks = { request: (_name, callback) => callback(true) };
    const runtime = createAdminTaskCommandRuntime(h.environment);
    await expect(
      runtime.execute(
        h.session.scope(),
        { kind: "UPLOAD", purpose: "PROOF", targetId: null },
        () => Promise.resolve(),
      ),
    ).rejects.toMatchObject({ category: "denied" });
    expect(h.saved.size).toBe(0);
    runtime.dispose();
    h.session.dispose();
  });
});
