import { z } from "zod";
import {
  manualCreditBodySchema,
  manualCreditOutcomeSchema,
  type ManualCreditBody,
  type ManualCreditOutcome,
} from "@template/contracts";
import { getApiError, safeApiError } from "@/services/api/safe-error";
import {
  getSessionRuntime,
  type SessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";

const handleSchema = z
  .object({ version: z.literal(1), actionId: z.uuid(), employeeId: z.uuid() })
  .strict();
type Handle = z.infer<typeof handleSchema>;
type State = Readonly<{
  state: "idle" | "pending" | "uncertain";
  intent: Readonly<ManualCreditBody> | null;
}>;
type Environment = {
  session: SessionRuntime;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined;
  locks:
    | {
        request: <T>(
          name: string,
          work: (available: boolean) => Promise<T>,
        ) => Promise<T>;
      }
    | undefined;
  online: () => boolean;
};
const key = (actor: string) => `oscar.manual-credit.v1.${actor}`;

export function matchesManualCreditIntent(
  body: ManualCreditBody,
  result: ManualCreditOutcome,
) {
  return (
    result.actionId === body.actionId &&
    result.employeeId === body.employeeId &&
    result.amount === body.amount &&
    result.reason === body.reason &&
    JSON.stringify(result.reference) === JSON.stringify(body.reference)
  );
}

export function createManualCreditCommandRuntime(env: Environment) {
  let state: State = Object.freeze({ state: "idle", intent: null });
  const listeners = new Set<() => void>();
  const publish = (next: State) => {
    state = Object.freeze(next);
    listeners.forEach((listener) => {
      listener();
    });
  };
  const authority = (scope: SessionScope) => {
    if (!env.session.isCurrentCheck(scope))
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    if (scope.role !== "ADMIN" || scope.accountId === null)
      throw safeApiError("denied", "FORBIDDEN", 403);
    return scope.accountId;
  };
  const handle = (actor: string): Handle | null => {
    try {
      if (!env.storage) throw new Error("Storage unavailable");
      const raw = env.storage.getItem(key(actor));
      return raw === null
        ? null
        : handleSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
  };
  const clear = (actor: string, retained: Handle) => {
    try {
      const current = handle(actor);
      if (
        current?.actionId !== retained.actionId ||
        current.employeeId !== retained.employeeId
      )
        throw new Error("Changed handle");
      env.storage?.removeItem(key(actor));
      if (handle(actor) !== null) throw new Error("Failed removal");
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
    publish({ state: "idle", intent: null });
  };
  const locked = async <T>(
    scope: SessionScope,
    work: (actor: string) => Promise<T>,
  ) => {
    const actor = authority(scope);
    if (!env.locks)
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    try {
      return await env.locks.request(key(actor), async (available) => {
        if (!available)
          throw safeApiError("coordination", "MANUAL_CREDIT_PENDING");
        authority(scope);
        return work(actor);
      });
    } catch (failure: unknown) {
      throw getApiError(failure);
    }
  };
  const validate = (
    raw: unknown,
    actor: string,
    retained: Handle,
    intent: ManualCreditBody | null,
  ) => {
    const result = manualCreditOutcomeSchema.safeParse(raw);
    if (
      !result.success ||
      result.data.actor.id !== actor ||
      result.data.actionId !== retained.actionId ||
      result.data.employeeId !== retained.employeeId ||
      (intent !== null && !matchesManualCreditIntent(intent, result.data))
    )
      throw safeApiError("uncertain", "CONTRACT_ERROR");
    return result.data;
  };
  const execute = (
    scope: SessionScope,
    raw: ManualCreditBody,
    dispatch: (body: ManualCreditBody) => Promise<unknown>,
  ) =>
    locked(scope, async (actor) => {
      const parsed = manualCreditBodySchema.safeParse(raw);
      if (!parsed.success)
        throw safeApiError("request", "VALIDATION_ERROR", 400);
      if (handle(actor) !== null)
        throw safeApiError("coordination", "MANUAL_CREDIT_UNRESOLVED");
      if (!env.online()) throw safeApiError("request", "OFFLINE");
      const intent = Object.freeze({
        ...parsed.data,
        reference: Object.freeze({ ...parsed.data.reference }),
      });
      const retained: Handle = {
        version: 1,
        actionId: intent.actionId,
        employeeId: intent.employeeId,
      };
      try {
        env.storage?.setItem(key(actor), JSON.stringify(retained));
        const saved = handle(actor);
        if (
          saved?.actionId !== retained.actionId ||
          saved.employeeId !== retained.employeeId
        )
          throw new Error("Failed readback");
      } catch {
        publish({ state: "idle", intent: null });
        throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      }
      publish({ state: "pending", intent });
      try {
        // Publication can synchronously retire authority. Retain the crash identity.
        authority(scope);
        const result = validate(
          await dispatch(intent),
          actor,
          retained,
          intent,
        );
        authority(scope);
        clear(actor, retained);
        return result;
      } catch (failure: unknown) {
        if (env.session.isCurrent(scope))
          publish({ state: "uncertain", intent });
        throw getApiError(failure);
      }
    });
  const observe = (
    scope: SessionScope,
    read: (actionId: string) => Promise<unknown>,
  ) =>
    locked(scope, async (actor) => {
      const retained = handle(actor);
      if (retained === null) return null;
      const intent = state.intent;
      publish({ state: "uncertain", intent });
      try {
        authority(scope);
        const result = validate(
          await read(retained.actionId),
          actor,
          retained,
          intent,
        );
        authority(scope);
        clear(actor, retained);
        return result;
      } catch (failure: unknown) {
        if (env.session.isCurrent(scope))
          publish({ state: "uncertain", intent });
        throw getApiError(failure);
      }
    });
  const retire = env.session.onRetire(() => {
    publish({ state: "idle", intent: null });
  });
  return {
    execute,
    observe,
    handle,
    snapshot: () => state,
    notifyRecoveryChanged: () => {
      const actor = env.session.scope().accountId;
      if (actor !== null && state.state !== "pending") {
        try {
          if (handle(actor) === null) {
            publish({ state: "idle", intent: null });
            return;
          }
        } catch {
          // The subscriber projects unavailable storage as a coordination error.
        }
      }
      publish({ ...state });
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

let singleton: ReturnType<typeof createManualCreditCommandRuntime> | undefined;
let owner: SessionRuntime | undefined;
export function getManualCreditCommandRuntime() {
  const session = getSessionRuntime();
  if (!singleton || owner !== session) {
    singleton?.dispose();
    owner = session;
    let storage: Storage | undefined;
    try {
      storage = typeof window === "undefined" ? undefined : window.localStorage;
    } catch {
      storage = undefined;
    }
    const lockSupport: unknown =
      typeof navigator === "undefined"
        ? undefined
        : Reflect.get(navigator, "locks");
    singleton = createManualCreditCommandRuntime({
      session,
      storage,
      online: () => typeof navigator !== "undefined" && navigator.onLine,
      locks:
        lockSupport !== undefined
          ? {
              request: async (name, work) =>
                navigator.locks.request(name, { ifAvailable: true }, (lock) =>
                  work(lock !== null),
                ),
            }
          : undefined,
    });
    const current = singleton;
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("oscar.manual-credit.v1."))
        current.notifyRecoveryChanged();
    };
    if (typeof window !== "undefined")
      window.addEventListener("storage", changed);
    const dispose = current.dispose;
    current.dispose = () => {
      if (typeof window !== "undefined")
        window.removeEventListener("storage", changed);
      dispose();
    };
  }
  return singleton;
}
