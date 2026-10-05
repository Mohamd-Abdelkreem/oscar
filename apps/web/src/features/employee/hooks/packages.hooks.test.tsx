import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  actorId,
  otherId,
  membership,
  reply,
  reject,
  quote,
} from "@/test/p04-network";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import { useMembership, usePurchaseQuote } from "./packages.hooks";

cleanupQueries();
describe("admitted package queries", () => {
  it("requires current server identity and does not invent Free on malformed membership", async () => {
    const h = queryHarness("USER", (config) =>
      reply(config, { ...membership, employeeId: otherId }),
    );
    const hook = renderHook(useMembership, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.isError).toBe(true);
    });
    expect(hook.result.current.data).toBeUndefined();
    expect(
      h.client
        .getQueryCache()
        .getAll()
        .some((query) => query.queryKey.includes(actorId)),
    ).toBe(true);
  });
  it("quotes once with exact selection and retires its private payload after logout", async () => {
    let quotes = 0;
    const h = queryHarness("USER", (config) => {
      quotes++;
      return reply(config, quote, 201);
    });
    const hook = renderHook(usePurchaseQuote, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    await act(async () => {
      expect(await hook.result.current.mutateAsync("S1")).toEqual(quote);
    });
    expect(quotes).toBe(1);
    act(() => {
      h.runtime.retire();
    });
    expect(hook.result.current.data).toBeUndefined();
  });
  it("a same-epoch check change prevents a late quote from restoring action authority", async () => {
    const pending = deferred<undefined>();
    let started = false;
    const h = queryHarness("USER", (config) => {
      started = true;
      return pending.promise.then(() => reply(config, quote, 201));
    });
    const hook = renderHook(usePurchaseQuote, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    let completion: Promise<unknown> | undefined;
    act(() => {
      completion = hook.result.current
        .mutateAsync("S1")
        .catch((failure: unknown) => failure);
    });
    await waitFor(() => {
      expect(started).toBe(true);
    });
    act(() => {
      h.runtime.beginCheck();
      pending.resolve(undefined);
    });
    await act(async () => {
      expect(await completion).toMatchObject({ category: "obsolete" });
    });
    expect(hook.result.current.data).toBeUndefined();
  });
  it("401 quote denial has no automatic refresh or replay", async () => {
    let writes = 0;
    const h = queryHarness("USER", (config) => {
      writes++;
      return Promise.resolve().then(() => reject(config, "UNAUTHORIZED", 401));
    });
    const hook = renderHook(usePurchaseQuote, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    await act(async () => {
      await expect(hook.result.current.mutateAsync("S1")).rejects.toMatchObject(
        { category: "denied" },
      );
    });
    expect(writes).toBe(1);
  });
});
