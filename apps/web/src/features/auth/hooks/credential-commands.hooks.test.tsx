import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { getSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";

import {
  CREDENTIAL_COMMAND_UI_DEADLINE_MS,
  useCredentialCommand,
  useCredentialFieldCleanup,
  useLinkCredential,
} from "./credential-commands.hooks";

it("keeps correctable live input through an owned retirement and clears it on external retirement or dismissal", async () => {
  const clear = vi.fn();
  const hook = renderHook(() => {
    const command = useCredentialCommand("input-cleanup", () => {
      getSessionRuntime().retire();
      return Promise.reject(new Error("denial"));
    });
    useCredentialFieldCleanup(clear, command.isCurrentFlow);
    return command;
  });
  await act(async () => {
    await hook.result.current.mutateAsync(undefined).catch(() => undefined);
  });
  expect(clear).not.toHaveBeenCalled();
  await act(async () => {
    getSessionRuntime().retire();
    await Promise.resolve();
  });
  expect(clear).toHaveBeenCalledOnce();
  hook.unmount();
  expect(clear).toHaveBeenCalledTimes(2);
});

it("US4 late account-A command cannot publish success or navigate after B begins", async () => {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const navigate = vi.fn();
  const hook = renderHook(() =>
    useCredentialCommand("us4-late-navigation", async () => {
      await gate;
      return {};
    }),
  );
  act(() => {
    hook.result.current.mutate(undefined, { onSuccess: navigate });
  });
  await act(async () => {
    getSessionRuntime().retire();
    finish();
    await gate;
  });
  expect(navigate).not.toHaveBeenCalled();
  expect(hook.result.current.isSuccess).toBe(false);
});

it("US4 token denial after response loss cannot release an uncertain command or establish success", async () => {
  const hook = renderHook(() =>
    useCredentialCommand("us4-token-denial", () =>
      Promise.reject(safeApiError("uncertain", "REQUEST_UNCERTAIN")),
    ),
  );
  await act(async () => {
    await hook.result.current.mutateAsync("SENTINEL").catch(() => undefined);
  });
  act(() => {
    getSessionRuntime().retire();
  });
  hook.result.current.reset();
  expect(hook.result.current.uncertain).toBe(true);
  expect(hook.result.current.isSuccess).toBe(false);
  await expect(
    hook.result.current.mutateAsync("replacement"),
  ).rejects.toMatchObject({ code: "COMMAND_PENDING" });
});

afterEach(() => {
  vi.useRealTimers();
  getSessionRuntime().dispose();
  localStorage.clear();
});

it("captures a link once, cleans history without consumption, and releases on dismissal/reload", async () => {
  window.history.replaceState(
    null,
    "",
    "/auth/reset-password?token=SENTINEL&section=reset",
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>{children}</StrictMode>
  );
  const first = renderHook(() => useLinkCredential(), { wrapper });
  expect(first.result.current.read()).toBe("SENTINEL");
  expect(window.location.search).toBe("?section=reset");
  expect(JSON.stringify(localStorage)).not.toContain("SENTINEL");
  first.unmount();
  await Promise.resolve();
  expect(first.result.current.read()).toBeNull();
  const reloaded = renderHook(() => useLinkCredential(), { wrapper });
  expect(reloaded.result.current.read()).toBeNull();
});

it("a UI deadline keeps the original observer and remount guard until terminal settlement", async () => {
  vi.useFakeTimers();
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const hook = renderHook(
    () =>
      useCredentialCommand("deadline-test", async (_secret: string) => {
        await gate;
        return {};
      }),
    { wrapper },
  );
  let pending!: Promise<unknown>;
  act(() => {
    pending = hook.result.current.mutateAsync("SENTINEL");
  });
  const rejected = expect(pending).rejects.toMatchObject({
    code: "REQUEST_UNCERTAIN",
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(CREDENTIAL_COMMAND_UI_DEADLINE_MS);
  });
  await rejected;
  expect(hook.result.current.uncertain).toBe(true);
  await expect(
    hook.result.current.mutateAsync("replacement"),
  ).rejects.toMatchObject({ code: "COMMAND_PENDING" });
  await act(async () => {
    finish();
    await gate;
  });
  expect(hook.result.current.isSuccess).toBe(true);
  expect(hook.result.current.uncertain).toBe(false);
  expect(client.getMutationCache().getAll()).toEqual([]);
  client.clear();
});

it("releases settled input and retains only safe outcome across remount", async () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () =>
      useCredentialCommand("privacy-test", (_secret: string) =>
        Promise.resolve({
          success: true,
        }),
      ),
    { wrapper },
  );
  await act(async () => {
    await result.current.mutateAsync("SENTINEL");
  });
  expect(JSON.stringify(result.current)).not.toContain("SENTINEL");
  expect(client.getMutationCache().getAll()).toEqual([]);
  client.clear();
});

it("dismissal cannot release an unresolved command guard", async () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const first = renderHook(
    () =>
      useCredentialCommand("pending-test", async (_secret: string) => {
        await gate;
        return {};
      }),
    { wrapper },
  );
  let pending!: Promise<unknown>;
  act(() => {
    pending = first.result.current.mutateAsync("SENTINEL");
    first.result.current.reset();
  });
  first.unmount();
  const second = renderHook(
    () =>
      useCredentialCommand("pending-test", (_secret: string) =>
        Promise.resolve({}),
      ),
    { wrapper },
  );
  await expect(
    second.result.current.mutateAsync("replacement"),
  ).rejects.toMatchObject({ code: "COMMAND_PENDING" });
  await act(async () => {
    finish();
    await expect(pending).rejects.toMatchObject({ code: "OBSOLETE_SCOPE" });
  });
  client.clear();
});
