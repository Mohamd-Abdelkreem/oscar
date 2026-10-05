import { z } from "zod";
import {
  purchaseCommandResultSchema,
  quoteOutcomeSchema,
  type QuoteOutcome,
} from "@template/contracts";
import { getApiError, safeApiError } from "@/services/api/safe-error";
import {
  getSessionRuntime,
  type SessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";

const handleSchema = z
  .object({ version: z.literal(1), quoteId: z.uuid() })
  .strict();
const storageKey = (actorId: string) => `oscar.purchase.v1.${actorId}`;
type Environment = {
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined;
  locks?:
    | {
        request: <T>(
          name: string,
          callback: (available: boolean) => Promise<T>,
        ) => Promise<T>;
      }
    | undefined;
  session: SessionRuntime;
  online: () => boolean;
};
type PurchaseState = Readonly<{
  state: "idle" | "pending" | "uncertain";
  quoteId: string | null;
}>;

export function createPurchaseCommandRuntime(environment: Environment) {
  let snapshot: PurchaseState = Object.freeze({ state: "idle", quoteId: null });
  const listeners = new Set<() => void>();
  const publish = (state: PurchaseState) => {
    snapshot = Object.freeze(state);
    listeners.forEach((listener) => {
      listener();
    });
  };
  const assertAuthority = (scope: SessionScope): string => {
    if (!environment.session.isCurrentCheck(scope))
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    if (scope.accountId === null || scope.role !== "USER")
      throw safeApiError("denied", "FORBIDDEN", 403);
    return scope.accountId;
  };
  const handle = (actorId: string): string | null => {
    try {
      if (environment.storage === undefined) throw new Error("Missing storage");
      const raw = environment.storage.getItem(storageKey(actorId));
      if (raw === null) return null;
      return handleSchema.parse(JSON.parse(raw) as unknown).quoteId;
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
  };
  const clear = (actorId: string, quoteId: string) => {
    try {
      if (handle(actorId) !== quoteId) throw new Error("Changed handle");
      environment.storage?.removeItem(storageKey(actorId));
      if (handle(actorId) !== null) throw new Error("Retained handle");
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
  };
  const withLock = async <T>(
    scope: SessionScope,
    work: (actorId: string) => Promise<T>,
  ) => {
    const actorId = assertAuthority(scope);
    if (environment.locks === undefined)
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    try {
      return await environment.locks.request(
        storageKey(actorId),
        async (available) => {
          if (!available)
            throw safeApiError("coordination", "PURCHASE_PENDING");
          assertAuthority(scope);
          return work(actorId);
        },
      );
    } catch (failure: unknown) {
      throw getApiError(failure);
    }
  };
  const execute = async (
    scope: SessionScope,
    quoteId: string,
    dispatch: () => Promise<unknown>,
  ) =>
    withLock(scope, async (actorId) => {
      const parsedId = z.uuid().safeParse(quoteId);
      if (!parsedId.success)
        throw safeApiError("request", "VALIDATION_ERROR", 400);
      const existing = handle(actorId);
      if (existing !== null && existing !== quoteId)
        throw safeApiError("coordination", "PURCHASE_UNRESOLVED");
      if (!environment.online()) throw safeApiError("request", "OFFLINE");
      if (existing === null) {
        try {
          environment.storage?.setItem(
            storageKey(actorId),
            JSON.stringify({ version: 1, quoteId }),
          );
          if (handle(actorId) !== quoteId) throw new Error("Failed readback");
        } catch {
          throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
        }
      }
      publish({ state: "pending", quoteId });
      let dispatched = false;
      try {
        // Publishing can synchronously retire authority; check again immediately before dispatch.
        assertAuthority(scope);
        dispatched = true;
        const raw = await dispatch();
        assertAuthority(scope);
        const command = purchaseCommandResultSchema.safeParse(raw);
        if (!command.success || command.data.purchase.quoteId !== quoteId)
          throw safeApiError("uncertain", "CONTRACT_ERROR");
        clear(actorId, quoteId);
        publish({ state: "idle", quoteId: null });
        return command.data;
      } catch (failure: unknown) {
        if (!dispatched && existing === null) clear(actorId, quoteId);
        if (environment.session.isCurrent(scope))
          publish({ state: "uncertain", quoteId });
        throw getApiError(failure);
      }
    });
  const observe = async (
    scope: SessionScope,
    read: (quoteId: string) => Promise<unknown>,
  ): Promise<QuoteOutcome | null> =>
    withLock(scope, async (actorId) => {
      const quoteId = handle(actorId);
      if (quoteId === null) return null;
      publish({ state: "uncertain", quoteId });
      const raw = await read(quoteId);
      assertAuthority(scope);
      const outcome = quoteOutcomeSchema.safeParse(raw);
      if (!outcome.success || outcome.data.quoteId !== quoteId)
        throw safeApiError("contract", "CONTRACT_ERROR");
      if (outcome.data.status !== "NOT_OBSERVED") {
        clear(actorId, quoteId);
        publish({ state: "idle", quoteId: null });
      }
      return outcome.data;
    });
  const retire = environment.session.onRetire(() => {
    publish({ state: "idle", quoteId: null });
  });
  return {
    execute,
    observe,
    handle,
    snapshot: () => snapshot,
    notifyRecoveryChanged: () => {
      publish({ ...snapshot });
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      retire();
      listeners.clear();
    },
  };
}

export type PurchaseCommandRuntime = ReturnType<
  typeof createPurchaseCommandRuntime
>;
let browserOwner: PurchaseCommandRuntime | undefined;
let ownerSession: SessionRuntime | undefined;
export function getPurchaseCommandRuntime(): PurchaseCommandRuntime {
  const session = getSessionRuntime();
  if (browserOwner !== undefined && ownerSession === session)
    return browserOwner;
  browserOwner?.dispose();
  ownerSession = session;
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    /* Coordination remains unavailable. */
  }
  const lockSupport: unknown = Reflect.get(navigator, "locks");
  browserOwner = createPurchaseCommandRuntime({
    session,
    online: () => navigator.onLine,
    storage,
    locks:
      lockSupport === undefined
        ? undefined
        : {
            request: async (name, callback) =>
              await navigator.locks.request(
                name,
                { ifAvailable: true },
                (lock) => callback(lock !== null),
              ),
          },
  });
  const currentOwner = browserOwner;
  const storageChanged = (event: StorageEvent) => {
    if (event.key?.startsWith("oscar.purchase.v1.") || event.key === null)
      currentOwner.notifyRecoveryChanged();
  };
  window.addEventListener("storage", storageChanged);
  const dispose = currentOwner.dispose;
  currentOwner.dispose = () => {
    window.removeEventListener("storage", storageChanged);
    dispose();
  };
  return browserOwner;
}
