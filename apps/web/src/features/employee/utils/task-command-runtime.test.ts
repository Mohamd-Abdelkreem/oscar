import { describe, expect, it } from "vitest";
import { commandHarness } from "@/test/p05-command";
import { actorId, now } from "@/test/p04-network";
import { deferred } from "@/test/p04-query";
import { safeApiError } from "@/services/api/safe-error";
import { createEmployeeTaskCommandRuntime } from "./task-command-runtime";

describe("employee task command lifetime", () => {
  it("blocks duplicate dispatch across callers and remount, and keeps NOT_OBSERVED until a durable fence", async () => {
    const h = commandHarness("USER");
    const runtime = createEmployeeTaskCommandRuntime(h.environment);
    const operation = { kind: "TASK_UNLOCK", targetId: actorId } as const;
    const gate = deferred<undefined>();
    const first = runtime.execute(
      h.session.scope(),
      operation,
      () => gate.promise,
    );
    await expect(
      runtime.execute(h.session.scope(), operation, () => Promise.resolve()),
    ).rejects.toMatchObject({ category: "coordination" });
    gate.resolve(undefined);
    expect((await first).state).toBe("NOT_OBSERVED");
    const next = createEmployeeTaskCommandRuntime(h.environment);
    const original = next.outstanding(h.session.scope(), operation);
    expect(original).not.toBeNull();
    await expect(
      next.execute(h.session.scope(), operation, () => Promise.resolve()),
    ).rejects.toMatchObject({ code: "COMMAND_UNRESOLVED" });
    expect((await next.observe(h.session.scope(), operation))?.state).toBe(
      "NOT_OBSERVED",
    );
    expect(next.outstanding(h.session.scope(), operation)).toEqual(original);
    expect((await next.cancel(h.session.scope(), operation))?.state).toBe(
      "CANCELLED",
    );
    expect(next.outstanding(h.session.scope(), operation)).toBeNull();
    expect([...h.saved.values()].join()).not.toMatch(/code|reason|payload/u);
    runtime.dispose();
    next.dispose();
    h.session.dispose();
  });
  it("retains upload uncertainty through raw errors and validates purpose-bound FAILED cancellation", async () => {
    const h = commandHarness("USER");
    h.environment.cancel = (handle) =>
      Promise.resolve({
        commandId: handle.commandId,
        purpose: "PROOF",
        state: "FAILED",
        failureCode: "UPLOAD_CANCELLED",
        failedAt: now,
      });
    const runtime = createEmployeeTaskCommandRuntime(h.environment);
    const operation = {
      kind: "UPLOAD",
      purpose: "PROOF",
      targetId: actorId,
    } as const;
    await expect(
      runtime.execute(h.session.scope(), operation, () =>
        Promise.reject(safeApiError("request", "INVALID_IMAGE", 400)),
      ),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    expect(runtime.outstanding(h.session.scope(), operation)).not.toBeNull();
    expect((await runtime.cancel(h.session.scope(), operation))?.state).toBe(
      "FAILED",
    );
    expect(runtime.outstanding(h.session.scope(), operation)).toBeNull();
    runtime.dispose();
    h.session.dispose();
  });
});
