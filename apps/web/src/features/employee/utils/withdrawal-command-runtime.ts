import { z } from "zod";
import {
  withdrawalCommandResultSchema,
  withdrawalQuoteOutcomeSchema,
  withdrawalRequestKeySchema,
} from "@template/contracts";
import { getApiError, safeApiError } from "@/services/api/safe-error";
import {
  getSessionRuntime,
  type SessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";

const handleSchema = z
  .object({
    version: z.literal(1),
    actorId: z.uuid(),
    quoteId: z.uuid(),
    requestKey: withdrawalRequestKeySchema,
  })
  .strict();
const storageKey = (actorId: string) => `oscar.withdrawal.v1.${actorId}`;
type Environment = {
  session: SessionRuntime;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined;
  locks?:
    | {
        request: <T>(
          name: string,
          callback: (available: boolean) => Promise<T>,
        ) => Promise<T>;
      }
    | undefined;
  online: () => boolean;
  key: () => string;
};
type CommandState = Readonly<{
  state: "idle" | "pending" | "uncertain";
  quoteId: string | null;
}>;
export function createWithdrawalCommandRuntime(environment: Environment) {
  let snapshot: CommandState = Object.freeze({ state: "idle", quoteId: null });
  const listeners = new Set<() => void>();
  const publish = (state: CommandState) => {
    snapshot = Object.freeze(state);
    listeners.forEach((listener) => {
      listener();
    });
  };
  const authority = (scope: SessionScope) => {
    if (!environment.session.isCurrentCheck(scope))
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    if (scope.accountId === null || scope.role !== "USER")
      throw safeApiError("denied", "FORBIDDEN", 403);
    return scope.accountId;
  };
  const handle = (actorId: string) => {
    try {
      if (!environment.storage) throw new Error("Missing storage");
      const raw = environment.storage.getItem(storageKey(actorId));
      if (raw === null) return null;
      const parsed = handleSchema.parse(JSON.parse(raw) as unknown);
      if (parsed.actorId !== actorId) throw new Error("Wrong actor");
      return parsed;
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
  };
  const clear = (actorId: string, quoteId: string) => {
    try {
      if (handle(actorId)?.quoteId !== quoteId)
        throw new Error("Changed handle");
      environment.storage?.removeItem(storageKey(actorId));
      if (handle(actorId) !== null) throw new Error("Retained handle");
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
  };
  const locked = async <T>(
    scope: SessionScope,
    work: (actorId: string) => Promise<T>,
  ) => {
    const actorId = authority(scope);
    if (!environment.locks)
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    return environment.locks.request(storageKey(actorId), async (available) => {
      if (!available) throw safeApiError("coordination", "WITHDRAWAL_PENDING");
      authority(scope);
      return work(actorId);
    });
  };
  const execute = (
    scope: SessionScope,
    quoteId: string,
    dispatch: (requestKey: string) => Promise<unknown>,
  ) =>
    locked(scope, async (actorId) => {
      if (!z.uuid().safeParse(quoteId).success)
        throw safeApiError("request", "VALIDATION_ERROR", 400);
      // Even the same quote cannot be redispatched after an opaque restoration or uncertain reply.
      if (handle(actorId) !== null)
        throw safeApiError("coordination", "WITHDRAWAL_UNRESOLVED");
      if (!environment.online()) throw safeApiError("request", "OFFLINE");
      const retained = handleSchema.safeParse({
        version: 1,
        actorId,
        quoteId,
        requestKey: environment.key(),
      });
      if (!retained.success)
        throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      try {
        environment.storage?.setItem(
          storageKey(actorId),
          JSON.stringify(retained.data),
        );
        if (JSON.stringify(handle(actorId)) !== JSON.stringify(retained.data))
          throw new Error("Failed readback");
      } catch {
        throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      }
      let sent = false;
      publish({ state: "pending", quoteId });
      try {
        authority(scope);
        if (!environment.online()) throw safeApiError("request", "OFFLINE");
        sent = true;
        const raw = await dispatch(retained.data.requestKey);
        authority(scope);
        const command = withdrawalCommandResultSchema.safeParse(raw);
        if (!command.success || command.data.withdrawal.quoteId !== quoteId)
          throw safeApiError("uncertain", "CONTRACT_ERROR");
        clear(actorId, quoteId);
        publish({ state: "idle", quoteId: null });
        return command.data;
      } catch (failure: unknown) {
        const error = getApiError(failure);
        const current = environment.session.isCurrentCheck(scope);
        const sameActor = environment.session.isCurrent(scope);
        const definite =
          current &&
          ((error.statusCode === 409 &&
            ["WITHDRAWAL_QUOTE_STALE", "WITHDRAWAL_ACTIVE"].includes(
              error.code,
            )) ||
            (error.statusCode === 403 && error.code === "WITHDRAWAL_BLOCKED"));
        if (!sent || definite) {
          try {
            clear(actorId, quoteId);
            if (sameActor) publish({ state: "idle", quoteId: null });
          } catch (retirement: unknown) {
            if (sameActor) publish({ state: "uncertain", quoteId });
            throw getApiError(retirement);
          }
        } else if (sameActor) publish({ state: "uncertain", quoteId });
        throw error;
      }
    });
  const observe = (
    scope: SessionScope,
    read: (quoteId: string, signal?: AbortSignal) => Promise<unknown>,
    signal?: AbortSignal,
  ) =>
    locked(scope, async (actorId) => {
      const retained = handle(actorId);
      if (retained === null) return null;
      publish({ state: "uncertain", quoteId: retained.quoteId });
      const raw = await read(retained.quoteId, signal);
      authority(scope);
      if (signal?.aborted) throw safeApiError("cancelled", "CANCELLED");
      const result = withdrawalQuoteOutcomeSchema.safeParse(raw);
      if (!result.success || result.data.quoteId !== retained.quoteId)
        throw safeApiError("contract", "CONTRACT_ERROR");
      if (result.data.status !== "NOT_OBSERVED") {
        clear(actorId, retained.quoteId);
        publish({ state: "idle", quoteId: null });
      }
      return result.data;
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
type WithdrawalCommandRuntime = ReturnType<
  typeof createWithdrawalCommandRuntime
>;
let browserOwner: WithdrawalCommandRuntime | undefined;
let ownerSession: SessionRuntime | undefined;
export function getWithdrawalCommandRuntime() {
  const session = getSessionRuntime();
  if (browserOwner && ownerSession === session) return browserOwner;
  browserOwner?.dispose();
  ownerSession = session;
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    /* Fail closed when recovery storage is unavailable. */
  }
  const lockSupport: unknown = Reflect.get(navigator, "locks");
  browserOwner = createWithdrawalCommandRuntime({
    session,
    storage,
    online: () => navigator.onLine,
    key: () => crypto.randomUUID(),
    locks:
      lockSupport !== undefined
        ? {
            request: async (name, callback) =>
              await navigator.locks.request(
                name,
                { ifAvailable: true },
                (lock) => callback(lock !== null),
              ),
          }
        : undefined,
  });
  const owner = browserOwner;
  const changed = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith("oscar.withdrawal.v1."))
      owner.notifyRecoveryChanged();
  };
  window.addEventListener("storage", changed);
  const dispose = owner.dispose;
  owner.dispose = () => {
    window.removeEventListener("storage", changed);
    dispose();
  };
  return owner;
}
