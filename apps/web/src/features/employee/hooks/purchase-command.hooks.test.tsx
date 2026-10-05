import { act, renderHook, waitFor } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import {
  actorId,
  otherId,
  now,
  purchase,
  quote,
  reply,
} from "@/test/p04-network";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import { usePurchaseCommand } from "./purchase-command.hooks";

cleanupQueries();
afterEach(() => {
  onlineManager.setOnline(true);
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

describe("remount-safe financial command hooks", () => {
  it("unmount cannot unlock another caller and saved acknowledgement never patches live money", async () => {
    const pending = deferred<undefined>();
    let sends = 0;
    const h = queryHarness("USER", (config) => {
      sends++;
      return pending.promise.then(() =>
        reply(config, { purchase, replayed: false }, 201),
      );
    });
    const first = renderHook(usePurchaseCommand, { wrapper: h.wrapper });
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
    const second = renderHook(usePurchaseCommand, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(second.result.current.allowed).toBe(true);
    });
    await act(async () => {
      await expect(
        second.result.current.mutateAsync(otherId),
      ).rejects.toMatchObject({ category: "coordination" });
    });
    await act(async () => {
      await expect(
        second.result.current.mutateAsync(actorId),
      ).rejects.toMatchObject({ category: "coordination" });
    });
    await act(async () => {
      pending.resolve(undefined);
      await completion;
    });
    expect(sends).toBe(1);
    expect(second.result.current.retained).toBeNull();
    expect(h.client.getQueryData(["p04", "wallet"])).toBeUndefined();
    expect(
      JSON.stringify(
        h.client
          .getQueryCache()
          .getAll()
          .map((entry) => entry.state.data),
      ),
    ).not.toContain("walletAfter");
  });
  it("malformed command response retains handle through observation and live absence", async () => {
    const h = queryHarness("USER", (config) =>
      reply(
        config,
        config.method === "post"
          ? {}
          : { status: "NOT_OBSERVED", quoteId: actorId, quote, serverNow: now },
        config.method === "post" ? 201 : 200,
      ),
    );
    const hook = renderHook(usePurchaseCommand, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync(actorId),
      ).rejects.toMatchObject({ category: "uncertain" });
    });
    expect(hook.result.current.retained).toBe(actorId);
    await act(async () => {
      expect(await hook.result.current.observation.mutateAsync()).toMatchObject(
        { status: "NOT_OBSERVED" },
      );
    });
    expect(hook.result.current.retained).toBe(actorId);
  });
  it("offline click rejects immediately and reconnect cannot dispatch queued payment", async () => {
    let sends = 0;
    const h = queryHarness("USER", (config) => {
      sends++;
      return reply(config, { purchase, replayed: false }, 201);
    });
    const hook = renderHook(usePurchaseCommand, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    onlineManager.setOnline(false);
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync(actorId),
      ).rejects.toMatchObject({ code: "OFFLINE" });
    });
    act(() => {
      onlineManager.setOnline(true);
    });
    expect(sends).toBe(0);
    expect(hook.result.current.isPaused).toBe(false);
  });
  it("invalid persisted recovery state exposes coordination failure instead of claiming no pending intent", async () => {
    let sends = 0;
    const h = queryHarness("USER", (config) => {
      sends++;
      return reply(config, {}, 201);
    });
    localStorage.setItem(
      `oscar.purchase.v1.${actorId}`,
      "invalid retained handle",
    );
    const hook = renderHook(usePurchaseCommand, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.coordinationError).toMatchObject({
        category: "coordination",
      });
    });
    expect(hook.result.current.allowed).toBe(false);
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync(actorId),
      ).rejects.toMatchObject({ category: "coordination" });
    });
    expect(sends).toBe(0);
  });
});
