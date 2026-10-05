import { z } from "zod";
import type { UserRole } from "@template/contracts";

import { safeApiError } from "./safe-error";
import { createBrowserSessionNotifications } from "./browser-location";

export const COOKIE_WRITE_BARRIER_KEY = "oscar.cookie-write.v1";
const COOKIE_WRITE_LOCK = "oscar.cookie-write";
export type SessionScope = Readonly<{
  epoch: number;
  check: number;
  accountId: string | null;
  role: UserRole | null;
}>;
const barrierSchema = z
  .object({
    version: z.literal(1),
    operationId: z
      .string()
      .min(16)
      .max(80)
      .regex(/^[a-zA-Z0-9-]+$/u),
    state: z.enum(["pending", "uncertain"]),
  })
  .strict();
type Barrier = z.infer<typeof barrierSchema>;
type RuntimeEnvironment = Readonly<{
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  locks?: {
    request: <T>(name: string, callback: () => Promise<T>) => Promise<T>;
  };
  operationId?: () => string;
  hint?: () => void;
}>;

const readBarrier = (
  storage: RuntimeEnvironment["storage"],
): Barrier | null => {
  if (storage === undefined)
    throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
  const serialized = storage.getItem(COOKIE_WRITE_BARRIER_KEY);
  if (serialized === null) return null;
  const parsed = barrierSchema.safeParse(JSON.parse(serialized) as unknown);
  if (!parsed.success)
    throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
  return parsed.data;
};

export const createSessionRuntime = (environment: RuntimeEnvironment) => {
  let externalRevalidationRequired = false;
  let snapshot: SessionScope = Object.freeze({
    epoch: 0,
    check: 0,
    accountId: null,
    role: null,
  });
  const listeners = new Set<() => void>();
  const retireListeners = new Set<() => void>();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  const retire = () => {
    snapshot = Object.freeze({
      epoch: snapshot.epoch + 1,
      check: snapshot.check + 1,
      accountId: null,
      role: null,
    });
    for (const listener of retireListeners) listener();
    publish();
  };
  const coordinationAvailable = () => {
    try {
      return (
        !externalRevalidationRequired &&
        environment.locks !== undefined &&
        readBarrier(environment.storage) === null
      );
    } catch {
      return false;
    }
  };
  const isCurrent = (scope: SessionScope) =>
    scope.epoch === snapshot.epoch &&
    (scope.accountId === null ||
      (scope.accountId === snapshot.accountId && scope.role === snapshot.role));
  const admitIdentity = (
    scope: SessionScope,
    identity: { id: string; role: UserRole },
  ) => {
    if (!isCurrent(scope) || scope.check !== snapshot.check)
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    if (
      snapshot.accountId !== null &&
      (snapshot.accountId !== identity.id || snapshot.role !== identity.role)
    ) {
      retire();
      throw safeApiError("denied", "UNAUTHORIZED", 401);
    }
    if (snapshot.accountId === identity.id && snapshot.role === identity.role)
      return;
    snapshot = Object.freeze({
      ...snapshot,
      accountId: identity.id,
      role: identity.role,
    });
    publish();
  };
  const cookieWrite = async <T>(
    dispatch: (observeTerminal: () => void) => Promise<T>,
    scope?: SessionScope,
  ): Promise<T> => {
    const locks = environment.locks;
    const storage = environment.storage;
    if (locks === undefined || storage === undefined)
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    return locks.request(COOKIE_WRITE_LOCK, async () => {
      if (scope !== undefined && scope.epoch !== snapshot.epoch)
        throw safeApiError("obsolete", "OBSOLETE_SCOPE");
      if (!coordinationAvailable())
        throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      const operationId = environment.operationId?.() ?? crypto.randomUUID();
      try {
        storage.setItem(
          COOKIE_WRITE_BARRIER_KEY,
          JSON.stringify({ version: 1, operationId, state: "pending" }),
        );
        const written = readBarrier(storage);
        if (written?.operationId !== operationId || written.state !== "pending")
          throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      } catch {
        throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      }
      environment.hint?.();
      const observation = { terminal: false };
      try {
        return await dispatch(() => {
          observation.terminal = true;
        });
      } finally {
        // Only this live lock holder's complete response can settle browser cookie ordering.
        try {
          if (readBarrier(storage)?.operationId === operationId) {
            if (observation.terminal)
              storage.removeItem(COOKIE_WRITE_BARRIER_KEY);
            else {
              storage.setItem(
                COOKIE_WRITE_BARRIER_KEY,
                JSON.stringify({ version: 1, operationId, state: "uncertain" }),
              );
              retire();
            }
          }
        } catch {
          retire();
        }
      }
    });
  };
  return {
    scope: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onRetire: (listener: () => void) => {
      retireListeners.add(listener);
      return () => {
        retireListeners.delete(listener);
      };
    },
    beginCheck: () => {
      externalRevalidationRequired = false;
      snapshot = Object.freeze({ ...snapshot, check: snapshot.check + 1 });
      publish();
      return snapshot;
    },
    isCurrent,
    admitIdentity,
    isCurrentCheck: (scope: SessionScope) =>
      isCurrent(scope) && scope.check === snapshot.check,
    assertCurrent: (scope: SessionScope) => {
      if (!isCurrent(scope)) throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    },
    coordinationAvailable,
    cookieWrite,
    retire,
    retireFromExternalHint: () => {
      // Automatic refresh on every tab hint would make tabs invalidate one another forever.
      externalRevalidationRequired = true;
      retire();
    },
    dispose: () => {
      retire();
      listeners.clear();
      retireListeners.clear();
    },
  };
};

export type SessionRuntime = ReturnType<typeof createSessionRuntime>;
let browserRuntime: SessionRuntime | undefined;
export const peekSessionRuntime = (): SessionRuntime | undefined =>
  browserRuntime;
export const getSessionRuntime = (): SessionRuntime => {
  if (typeof window === "undefined")
    throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
  if (browserRuntime !== undefined) return browserRuntime;
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    /* Unavailable storage keeps coordination closed. */
  }
  const lockSupport: unknown = Reflect.get(navigator, "locks");
  const runtime = createSessionRuntime({
    ...(storage === undefined ? {} : { storage }),
    ...(lockSupport === undefined
      ? {}
      : {
          locks: {
            request: async (name, callback) =>
              await navigator.locks.request(name, callback),
          },
        }),
    hint: () => {
      notifications.notifyRetirement();
    },
  });
  const notifications = createBrowserSessionNotifications(
    COOKIE_WRITE_BARRIER_KEY,
    runtime.retireFromExternalHint,
  );
  const dispose = runtime.dispose;
  runtime.dispose = () => {
    notifications.dispose();
    dispose();
    browserRuntime = undefined;
  };
  browserRuntime = runtime;
  return runtime;
};
