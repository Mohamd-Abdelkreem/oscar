import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  change,
  actorId,
  otherId,
  reply,
  reject,
  now,
} from "@/test/p04-network";
import { cleanupQueries, queryHarness, deferred } from "@/test/p04-query";
import { useConfigurationCommand } from "./packages.hooks";
import { createConfigurationCommandRuntime } from "../utils/configuration-command-runtime";

cleanupQueries();
const body = {
  commandId: actorId,
  expectedVersion: 1,
  price: "61.000001",
  reason: change.reason,
  confirmed: true as const,
};

it.each(["locks", "storage", "readback", "offline"])(
  "configuration fails closed before dispatch when %s is unavailable",
  async (fault) => {
    const h = queryHarness("ADMIN", (config) => reply(config, change));
    const runtime = createConfigurationCommandRuntime({
      session: h.runtime,
      storage:
        fault === "storage"
          ? undefined
          : {
              getItem: (key) => localStorage.getItem(key),
              removeItem: (key) => {
                localStorage.removeItem(key);
              },
              setItem: (key, value) => {
                if (fault !== "readback") localStorage.setItem(key, value);
              },
            },
      locks:
        fault === "locks" ? undefined : { request: (_key, work) => work(true) },
      online: () => fault !== "offline",
    });
    let writes = 0;
    await expect(
      runtime.execute(h.runtime.scope(), "S1", body, () => {
        writes++;
        return Promise.resolve(change);
      }),
    ).rejects.toBeDefined();
    expect(writes).toBe(0);
    runtime.dispose();
  },
);

it("a competing configuration caller cannot queue while an obsolete check completes", async () => {
  const gate = deferred<undefined>();
  let patches = 0;
  const h = queryHarness("ADMIN", async (config) => {
    patches++;
    await gate.promise;
    return reply(config, change);
  });
  const hook = renderHook(useConfigurationCommand, { wrapper: h.wrapper });
  await waitFor(() => {
    expect(hook.result.current.allowed).toBe(true);
  });
  let first: Promise<unknown>;
  act(() => {
    first = hook.result.current.save
      .mutateAsync({ code: "S1", body })
      .catch((failure: unknown) => failure);
  });
  await waitFor(() => {
    expect(patches).toBe(1);
  });
  await act(async () => {
    await expect(
      hook.result.current.save.mutateAsync({ code: "S1", body }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_PENDING" });
  });
  act(() => {
    h.runtime.beginCheck();
  });
  await act(async () => {
    gate.resolve(undefined);
    await first;
  });
  expect(patches).toBe(1);
  expect(hook.result.current.state.state).toBe("uncertain");
  expect(
    localStorage.getItem(`oscar.configuration.v1.${actorId}`),
  ).not.toBeNull();
});

it("a mismatched committed observation cannot clear the known reviewed payload", async () => {
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") throw new Error("lost acknowledgement");
    return reply(config, {
      status: "COMMITTED",
      commandId: actorId,
      serverNow: now,
      change: { ...change, after: { ...change.after, price: "62" } },
    });
  });
  const hook = renderHook(useConfigurationCommand, { wrapper: h.wrapper });
  await waitFor(() => {
    expect(hook.result.current.allowed).toBe(true);
  });
  await act(async () => {
    await expect(
      hook.result.current.save.mutateAsync({ code: "S1", body }),
    ).rejects.toBeDefined();
  });
  await act(async () => {
    await expect(
      hook.result.current.observation.mutateAsync(),
    ).rejects.toMatchObject({ code: "CONTRACT_ERROR" });
  });
  expect(hook.result.current.retained?.commandId).toBe(actorId);
});
it("retains the exact lost command across remount and explicitly retries its original PATCH", async () => {
  let lost = true;
  const sent: unknown[] = [];
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") {
      sent.push(JSON.parse(String(config.data)) as unknown);
      if (lost) return Promise.reject(new Error("lost"));
      return reply(config, change);
    }
    return reply(config, {
      status: "NOT_OBSERVED",
      commandId: actorId,
      serverNow: now,
    });
  });
  const first = renderHook(useConfigurationCommand, { wrapper: h.wrapper });
  await waitFor(() => {
    expect(first.result.current.allowed).toBe(true);
  });
  await act(async () => {
    await expect(
      first.result.current.save.mutateAsync({ code: "S1", body }),
    ).rejects.toBeDefined();
  });
  first.unmount();
  const second = renderHook(useConfigurationCommand, { wrapper: h.wrapper });
  await waitFor(() => {
    expect(second.result.current.allowed).toBe(true);
  });
  expect(second.result.current.state.intent?.body).toEqual(body);
  await act(async () => {
    await second.result.current.observation.mutateAsync();
  });
  expect(second.result.current.retained?.commandId).toBe(actorId);
  await act(async () => {
    await expect(
      second.result.current.save.mutateAsync({
        code: "S1",
        body: { ...body, commandId: otherId },
      }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_UNRESOLVED" });
  });
  lost = false;
  await act(async () => {
    await second.result.current.save.mutateAsync({ code: "S1", body });
  });
  expect(sent).toEqual([body, body]);
  expect(second.result.current.retained).toBeNull();
});
it("only original PATCH supersession releases uncertainty; generic stale and failed reads retain it", async () => {
  let code = "CONFIGURATION_STALE";
  const h = queryHarness("ADMIN", (config) => reject(config, code));
  const hook = renderHook(useConfigurationCommand, { wrapper: h.wrapper });
  await waitFor(() => {
    expect(hook.result.current.allowed).toBe(true);
  });
  await act(async () => {
    await expect(
      hook.result.current.save.mutateAsync({ code: "S1", body }),
    ).rejects.toBeDefined();
  });
  await act(async () => {
    await expect(
      hook.result.current.observation.mutateAsync(),
    ).rejects.toBeDefined();
  });
  expect(hook.result.current.retained?.commandId).toBe(actorId);
  code = "CONFIGURATION_SUPERSEDED";
  await act(async () => {
    await expect(
      hook.result.current.save.mutateAsync({ code: "S1", body }),
    ).rejects.toMatchObject({ code });
  });
  expect(hook.result.current.retained).toBeNull();
});
it("a late retired completion cannot restore a private draft or erase its handle", async () => {
  const gate = deferred<undefined>();
  const h = queryHarness("ADMIN", async (config) => {
    await gate.promise;
    return reply(config, change);
  });
  const hook = renderHook(useConfigurationCommand, { wrapper: h.wrapper });
  await waitFor(() => {
    expect(hook.result.current.allowed).toBe(true);
  });
  let result: Promise<unknown>;
  act(() => {
    result = hook.result.current.save
      .mutateAsync({ code: "S1", body })
      .catch((error: unknown) => error);
  });
  await waitFor(() => {
    expect(hook.result.current.state.state).toBe("pending");
  });
  act(() => {
    h.runtime.retire();
  });
  await act(async () => {
    gate.resolve(undefined);
    await result;
  });
  expect(hook.result.current.state.intent).toBeNull();
  expect(hook.result.current.save.data).toBeUndefined();
  expect(
    JSON.parse(
      localStorage.getItem(`oscar.configuration.v1.${actorId}`) ?? "null",
    ),
  ).toEqual({ version: 1, commandId: actorId, packageCode: "S1" });
});
it("reload never reconstructs a write, but matching committed observation clears the opaque handle", async () => {
  localStorage.setItem(
    `oscar.configuration.v1.${actorId}`,
    JSON.stringify({ version: 1, commandId: actorId, packageCode: "S1" }),
  );
  let patches = 0;
  const h = queryHarness("ADMIN", (config) => {
    if (config.method === "patch") patches++;
    return reply(config, {
      status: "COMMITTED",
      commandId: actorId,
      change,
      serverNow: now,
    });
  });
  const hook = renderHook(useConfigurationCommand, { wrapper: h.wrapper });
  await waitFor(() => {
    expect(hook.result.current.allowed).toBe(true);
  });
  expect(hook.result.current.state.intent).toBeNull();
  await act(async () => {
    await expect(
      hook.result.current.save.mutateAsync({ code: "S1", body }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_UNRESOLVED" });
  });
  await act(async () => {
    await hook.result.current.observation.mutateAsync();
  });
  expect(hook.result.current.retained).toBeNull();
  expect(patches).toBe(0);
});
