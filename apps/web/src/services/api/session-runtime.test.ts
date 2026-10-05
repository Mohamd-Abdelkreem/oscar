import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COOKIE_WRITE_BARRIER_KEY,
  createSessionRuntime,
} from "./session-runtime";

const browserRuntime = () =>
  createSessionRuntime({
    storage: localStorage,
    locks: { request: (_name, callback) => Promise.resolve(callback()) },
    operationId: () => crypto.randomUUID(),
  });

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("session completion and cookie ordering", () => {
  it("US4 external tab hints block automatic refresh until an explicit authority check, without granting authority", () => {
    const runtime = browserRuntime();
    runtime.admitIdentity(runtime.scope(), { id: "account-a", role: "USER" });
    runtime.retireFromExternalHint();
    expect(runtime.coordinationAvailable()).toBe(false);
    expect(runtime.scope().accountId).toBeNull();
    runtime.beginCheck();
    expect(runtime.coordinationAvailable()).toBe(true);
    expect(runtime.scope().accountId).toBeNull();
  });
  it("US4 a surviving runtime cannot release another tab's cookie owner even after a current identity check", async () => {
    const owner = browserRuntime();
    const survivor = browserRuntime();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const pending = owner.cookieWrite(async (terminal) => {
      await gate;
      terminal();
    });
    await vi.waitFor(() => {
      expect(localStorage.getItem(COOKIE_WRITE_BARRIER_KEY)).not.toBeNull();
    });
    survivor.retire();
    const barrier = localStorage.getItem(COOKIE_WRITE_BARRIER_KEY);
    expect(survivor.coordinationAvailable()).toBe(false);
    await expect(survivor.cookieWrite(vi.fn())).rejects.toMatchObject({
      category: "coordination",
    });
    expect(localStorage.getItem(COOKIE_WRITE_BARRIER_KEY)).toBe(barrier);
    finish();
    await pending;
    expect(survivor.coordinationAvailable()).toBe(true);
  });
  it("retires authority when a fresh identity changes account or role", () => {
    const runtime = browserRuntime();
    runtime.admitIdentity(runtime.scope(), { id: "account-a", role: "USER" });
    const authority = runtime.scope();
    expect(authority).toMatchObject({ accountId: "account-a", role: "USER" });
    expect(() => {
      runtime.admitIdentity(authority, { id: "account-a", role: "ADMIN" });
    }).toThrow();
    expect(runtime.isCurrent(authority)).toBe(false);
    expect(runtime.scope()).toMatchObject({ accountId: null, role: null });
    runtime.admitIdentity(runtime.scope(), { id: "account-b", role: "USER" });
    expect(() => {
      runtime.admitIdentity(runtime.scope(), { id: "account-a", role: "USER" });
    }).toThrow();
  });
  it("discards retired reads and old authority checks", () => {
    const runtime = browserRuntime();
    const read = runtime.scope();
    const check = runtime.beginCheck();
    runtime.beginCheck();
    expect(runtime.isCurrent(read)).toBe(true);
    expect(runtime.isCurrentCheck(check)).toBe(false);
    runtime.retire();
    expect(runtime.isCurrent(read)).toBe(false);
  });

  it("persists a nonsecret barrier before dispatch and releases on terminal denial", async () => {
    const runtime = browserRuntime();
    await runtime
      .cookieWrite((observeTerminal) => {
        const record = JSON.parse(
          localStorage.getItem(COOKIE_WRITE_BARRIER_KEY) ?? "null",
        ) as unknown;
        expect(record).toMatchObject({
          version: 1,
          state: "pending",
        });
        expect(Object.keys(record ?? {})).toEqual([
          "version",
          "operationId",
          "state",
        ]);
        expect(runtime.coordinationAvailable()).toBe(false);
        observeTerminal();
        throw new Error("HTTP denial");
      })
      .catch(() => undefined);
    expect(runtime.coordinationAvailable()).toBe(true);
  });

  it.each(["pending", "uncertain", "malformed"])(
    "blocks inherited %s records without dispatch or deletion",
    async (state) => {
      localStorage.setItem(
        COOKIE_WRITE_BARRIER_KEY,
        state === "malformed"
          ? "invalid"
          : JSON.stringify({
              version: 1,
              operationId: crypto.randomUUID(),
              state,
            }),
      );
      const inherited = localStorage.getItem(COOKIE_WRITE_BARRIER_KEY);
      const request = vi.fn();
      const runtime = browserRuntime();
      expect(runtime.coordinationAvailable()).toBe(false);
      await expect(runtime.cookieWrite(request)).rejects.toMatchObject({
        code: "COORDINATION_UNAVAILABLE",
      });
      expect(request).not.toHaveBeenCalled();
      expect(localStorage.getItem(COOKIE_WRITE_BARRIER_KEY)).toBe(inherited);
    },
  );

  it("retains uncertain writes through failure, remount, teardown and reacquisition", async () => {
    const runtime = browserRuntime();
    await expect(
      runtime.cookieWrite(() => {
        throw new TypeError("network");
      }),
    ).rejects.toBeDefined();
    runtime.retire();
    runtime.dispose();
    const replacement = browserRuntime();
    expect(replacement.coordinationAvailable()).toBe(false);
    await expect(replacement.cookieWrite(vi.fn())).rejects.toMatchObject({
      code: "COORDINATION_UNAVAILABLE",
    });
  });

  it("keeps the original observer beyond dismissal and releases only its matching record", async () => {
    const runtime = browserRuntime();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const command = runtime.cookieWrite(async (observe) => {
      await gate;
      observe();
      return Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(localStorage.getItem(COOKIE_WRITE_BARRIER_KEY)).not.toBeNull();
    });
    runtime.retire();
    expect(runtime.coordinationAvailable()).toBe(false);
    finish();
    await command;
    expect(runtime.coordinationAvailable()).toBe(true);
  });

  it("cannot delete another owner's record after receiving a response", async () => {
    const runtime = browserRuntime();
    const other = JSON.stringify({
      version: 1,
      operationId: crypto.randomUUID(),
      state: "pending",
    });
    await runtime.cookieWrite((observe) => {
      localStorage.setItem(COOKIE_WRITE_BARRIER_KEY, other);
      observe();
      return Promise.resolve();
    });
    expect(localStorage.getItem(COOKIE_WRITE_BARRIER_KEY)).toBe(other);
  });

  it("fails closed before dispatch when storage read-back fails or locks are absent", async () => {
    const request = vi.fn();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
    await expect(browserRuntime().cookieWrite(request)).rejects.toMatchObject({
      code: "COORDINATION_UNAVAILABLE",
    });
    await expect(
      createSessionRuntime({}).cookieWrite(request),
    ).rejects.toMatchObject({ code: "COORDINATION_UNAVAILABLE" });
    expect(request).not.toHaveBeenCalled();
  });
});
