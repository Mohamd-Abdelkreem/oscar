import { z } from "zod";
import { matchesEditedFields } from "./configuration-intent";
import {
  packageCodeSchema,
  packageEditSchema,
  configurationResultSchema,
  configurationOutcomeSchema,
  type PackageCode,
  type PackageEdit,
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
    commandId: z.uuid(),
    packageCode: packageCodeSchema,
  })
  .strict();
type Handle = z.infer<typeof handleSchema>;
type Intent = Readonly<{ packageCode: PackageCode; body: PackageEdit }>;
type State = Readonly<{
  state: "idle" | "pending" | "uncertain";
  intent: Intent | null;
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
const key = (actor: string) => `oscar.configuration.v1.${actor}`;

export function createConfigurationCommandRuntime(env: Environment) {
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
  const clear = (actor: string, commandId: string) => {
    if (handle(actor)?.commandId !== commandId)
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    try {
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
          throw safeApiError("coordination", "CONFIGURATION_PENDING");
        authority(scope);
        return work(actor);
      });
    } catch (failure: unknown) {
      throw getApiError(failure);
    }
  };
  const execute = (
    scope: SessionScope,
    code: PackageCode,
    raw: PackageEdit,
    dispatch: (code: PackageCode, body: PackageEdit) => Promise<unknown>,
  ) =>
    locked(scope, async (actor) => {
      const body = packageEditSchema.parse(raw);
      const packageCode = packageCodeSchema.parse(code);
      const previous = handle(actor);
      if (
        previous !== null &&
        (previous.commandId !== body.commandId ||
          previous.packageCode !== packageCode ||
          state.intent === null ||
          JSON.stringify(state.intent.body) !== JSON.stringify(body))
      )
        throw safeApiError("coordination", "CONFIGURATION_UNRESOLVED");
      if (!env.online()) throw safeApiError("request", "OFFLINE");
      if (previous === null) {
        try {
          env.storage?.setItem(
            key(actor),
            JSON.stringify({
              version: 1,
              commandId: body.commandId,
              packageCode,
            }),
          );
          if (handle(actor)?.commandId !== body.commandId)
            throw new Error("Failed readback");
        } catch {
          throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
        }
      }
      const intent = Object.freeze({ packageCode, body: Object.freeze(body) });
      publish({ state: "pending", intent });
      let dispatched = false;
      try {
        authority(scope);
        dispatched = true;
        const result = configurationResultSchema.parse(
          await dispatch(packageCode, body),
        );
        authority(scope);
        if (
          result.commandId !== body.commandId ||
          result.target.kind !== "PACKAGE" ||
          result.target.packageCode !== packageCode ||
          result.expectedVersion !== body.expectedVersion ||
          result.reason !== body.reason ||
          !matchesEditedFields(body, result)
        )
          throw safeApiError("uncertain", "CONTRACT_ERROR");
        clear(actor, body.commandId);
        return result;
      } catch (failure: unknown) {
        const error = getApiError(failure);
        if (env.session.isCurrentCheck(scope)) {
          if (dispatched && error.code === "CONFIGURATION_SUPERSEDED")
            clear(actor, body.commandId);
          else if (!dispatched && previous === null)
            clear(actor, body.commandId);
          else publish({ state: "uncertain", intent });
        } else if (env.session.isCurrent(scope)) {
          publish({ state: "uncertain", intent });
        }
        throw error;
      }
    });
  const observe = (
    scope: SessionScope,
    read: (id: string) => Promise<unknown>,
  ) =>
    locked(scope, async (actor) => {
      const retained = handle(actor);
      if (retained === null) return null;
      try {
        const outcome = configurationOutcomeSchema.parse(
          await read(retained.commandId),
        );
        authority(scope);
        if (outcome.commandId !== retained.commandId)
          throw safeApiError("uncertain", "CONTRACT_ERROR");
        if (outcome.status === "COMMITTED") {
          if (
            outcome.change.target.kind !== "PACKAGE" ||
            outcome.change.target.packageCode !== retained.packageCode ||
            (state.intent !== null &&
              (outcome.change.expectedVersion !==
                state.intent.body.expectedVersion ||
                outcome.change.reason !== state.intent.body.reason ||
                !matchesEditedFields(state.intent.body, outcome.change)))
          )
            throw safeApiError("uncertain", "CONTRACT_ERROR");
          clear(actor, retained.commandId);
        } else publish({ state: "uncertain", intent: state.intent });
        return outcome;
      } catch (failure: unknown) {
        if (env.session.isCurrentCheck(scope))
          publish({ state: "uncertain", intent: state.intent });
        throw getApiError(failure);
      }
    });
  const retire = env.session.onRetire(() => {
    publish({ state: "idle", intent: null });
  });
  return {
    snapshot: () => state,
    notifyRecoveryChanged: () => {
      publish({ ...state });
    },
    handle,
    execute,
    observe,
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

let singleton: ReturnType<typeof createConfigurationCommandRuntime> | undefined;
let owner: SessionRuntime | undefined;
export function getConfigurationCommandRuntime() {
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
    singleton = createConfigurationCommandRuntime({
      session,
      storage,
      locks:
        lockSupport !== undefined
          ? {
              request: async (name, work) =>
                await navigator.locks.request(
                  name,
                  { ifAvailable: true },
                  (lock) => work(lock !== null),
                ),
            }
          : undefined,
      online: () => typeof navigator !== "undefined" && navigator.onLine,
    });
    const currentOwner = singleton;
    const storageChanged = (event: StorageEvent) => {
      if (
        event.key?.startsWith("oscar.configuration.v1.") ||
        event.key === null
      )
        currentOwner.notifyRecoveryChanged();
    };
    window.addEventListener("storage", storageChanged);
    const dispose = currentOwner.dispose;
    currentOwner.dispose = () => {
      window.removeEventListener("storage", storageChanged);
      dispose();
    };
  }
  return singleton;
}
