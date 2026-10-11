import { z } from "zod";
import {
  withdrawalRequestKeySchema,
  withdrawalCommandResultSchema,
  adminWithdrawalActionOutcomeSchema,
  withdrawalExtensionBodySchema,
  withdrawalRejectionBodySchema,
} from "@template/contracts";
import { safeApiError, getApiError } from "@/services/api/safe-error";
import {
  getSessionRuntime,
  type SessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";
import type {
  WithdrawalExtension,
  WithdrawalRejection,
  WithdrawalActionOutcome,
} from "../api/withdrawals.api";

export type AdminWithdrawalIntent = { target: string } & (
  | { kind: "EXTEND"; body: WithdrawalExtension }
  | { kind: "REJECT"; body: WithdrawalRejection }
);
const recoverySchema = z
  .object({
    version: z.literal(1),
    actorId: z.uuid(),
    target: z.uuid(),
    kind: z.enum(["EXTEND", "REJECT"]),
    expectedVersion: z.number().int().positive().max(2147483646),
    requestKey: withdrawalRequestKeySchema,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
type Recovery = z.infer<typeof recoverySchema>;
type State = Readonly<{
  state: "idle" | "pending" | "uncertain";
  target: string | null;
  outcome: WithdrawalActionOutcome | null;
}>;
const storageKey = (actor: string) => `oscar.admin-withdrawal.v1.${actor}`;
type Environment = {
  session: SessionRuntime;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined;
  locks:
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
function parsedIntent(intent: AdminWithdrawalIntent): AdminWithdrawalIntent {
  const target = z.uuid().safeParse(intent.target);
  if (!target.success) throw safeApiError("request", "VALIDATION_ERROR", 400);
  if (intent.kind === "EXTEND") {
    const body = withdrawalExtensionBodySchema.safeParse(intent.body);
    if (body.success)
      return { target: target.data, kind: "EXTEND", body: body.data };
  } else {
    const body = withdrawalRejectionBodySchema.safeParse(intent.body);
    if (body.success)
      return { target: target.data, kind: "REJECT", body: body.data };
  }
  throw safeApiError("request", "VALIDATION_ERROR", 400);
}
async function fingerprint(actor: string, intent: AdminWithdrawalIntent) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify([actor, intent.target, intent.kind, intent.body]),
    ),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function createAdminWithdrawalRuntime(environment: Environment) {
  let snapshot: State = Object.freeze({
    state: "idle",
    target: null,
    outcome: null,
  });
  let original: { actor: string; fingerprint: string } | null = null;
  const listeners = new Set<() => void>();
  const publish = (
    next: Omit<State, "outcome"> & { outcome?: WithdrawalActionOutcome | null },
  ) => {
    snapshot = Object.freeze({ ...next, outcome: next.outcome ?? null });
    listeners.forEach((listener) => {
      listener();
    });
  };
  const authority = (scope: SessionScope) => {
    if (!environment.session.isCurrentCheck(scope))
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    if (scope.role !== "ADMIN" || scope.accountId === null)
      throw safeApiError("denied", "FORBIDDEN", 403);
    return scope.accountId;
  };
  const handle = (actor: string) => {
    try {
      if (!environment.storage) throw new Error("Missing recovery storage");
      const raw = environment.storage.getItem(storageKey(actor));
      if (raw === null) return null;
      const saved = recoverySchema.parse(JSON.parse(raw) as unknown);
      if (saved.actorId !== actor) throw new Error("Wrong actor");
      return saved;
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
  };
  const clear = (
    saved: Recovery,
    outcome: WithdrawalActionOutcome | null = null,
  ) => {
    try {
      if (handle(saved.actorId)?.requestKey !== saved.requestKey)
        throw new Error("Changed recovery identity");
      environment.storage?.removeItem(storageKey(saved.actorId));
      if (handle(saved.actorId) !== null) throw new Error("Recovery retained");
      original = null;
      publish({ state: "idle", target: null, outcome });
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
  };
  const locked = <T>(
    scope: SessionScope,
    work: (actor: string) => Promise<T>,
  ) => {
    const actor = authority(scope);
    if (!environment.locks)
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    return environment.locks.request(storageKey(actor), async (available) => {
      if (!available || snapshot.state === "pending")
        throw safeApiError("uncertain", "COMMAND_PENDING");
      authority(scope);
      return work(actor);
    });
  };
  const dispatchSaved = async (
    scope: SessionScope,
    saved: Recovery,
    dispatch: (key: string) => Promise<unknown>,
  ) => {
    authority(scope);
    if (!environment.online()) throw safeApiError("request", "OFFLINE");
    publish({ state: "pending", target: saved.target });
    try {
      const raw = await dispatch(saved.requestKey);
      authority(scope);
      const result = withdrawalCommandResultSchema.safeParse(raw);
      if (
        !result.success ||
        result.data.withdrawal.id !== saved.target ||
        result.data.withdrawal.version < saved.expectedVersion + 1
      )
        throw safeApiError("uncertain", "CONTRACT_ERROR");
      clear(saved);
      return result.data;
    } catch (failure: unknown) {
      if (environment.session.isCurrent(scope))
        publish({ state: "uncertain", target: saved.target });
      throw getApiError(failure);
    }
  };
  const execute = (
    scope: SessionScope,
    raw: AdminWithdrawalIntent,
    callbacks: {
      review: () => Promise<void>;
      dispatch: (key: string) => Promise<unknown>;
    },
  ) =>
    locked(scope, async (actor) => {
      if (handle(actor) !== null)
        throw safeApiError("uncertain", "WITHDRAWAL_UNRESOLVED");
      const intent = parsedIntent(raw);
      if (!environment.online()) throw safeApiError("request", "OFFLINE");
      await callbacks.review();
      authority(scope);
      const saved = recoverySchema.parse({
        version: 1,
        actorId: actor,
        target: intent.target,
        kind: intent.kind,
        expectedVersion: intent.body.expectedVersion,
        requestKey: environment.key(),
        fingerprint: await fingerprint(actor, intent),
      });
      authority(scope);
      try {
        environment.storage?.setItem(storageKey(actor), JSON.stringify(saved));
        if (JSON.stringify(handle(actor)) !== JSON.stringify(saved))
          throw new Error("Recovery readback failed");
      } catch {
        throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      }
      original = { actor, fingerprint: saved.fingerprint };
      publish({ state: "uncertain", target: saved.target });
      // Once durable intent exists, failure remains observable even if transport never starts.
      return dispatchSaved(scope, saved, callbacks.dispatch);
    });
  const retry = (
    scope: SessionScope,
    raw: AdminWithdrawalIntent,
    dispatch: (key: string) => Promise<unknown>,
  ) =>
    locked(scope, async (actor) => {
      const saved = handle(actor),
        intent = parsedIntent(raw);
      const same = await fingerprint(actor, intent);
      authority(scope);
      if (
        !saved ||
        original?.actor !== actor ||
        original.fingerprint !== same ||
        saved.fingerprint !== same
      )
        throw safeApiError("uncertain", "WITHDRAWAL_UNRESOLVED");
      return dispatchSaved(scope, saved, dispatch);
    });
  const observe = (
    scope: SessionScope,
    read: (saved: Recovery, signal?: AbortSignal) => Promise<unknown>,
    signal?: AbortSignal,
  ) =>
    locked(scope, async (actor) => {
      const saved = handle(actor);
      if (!saved) return null;
      publish({ state: "uncertain", target: saved.target });
      const raw = await read(saved, signal);
      authority(scope);
      if (signal?.aborted) throw safeApiError("cancelled", "CANCELLED");
      const parsed = adminWithdrawalActionOutcomeSchema.safeParse(raw);
      if (!parsed.success) throw safeApiError("contract", "CONTRACT_ERROR");
      const outcome = parsed.data;
      if (
        outcome.withdrawalId !== saved.target ||
        outcome.kind !== saved.kind ||
        outcome.requestKey !== saved.requestKey ||
        outcome.expectedVersion !== saved.expectedVersion ||
        (outcome.status === "COMMITTED" && outcome.action.actorUserId !== actor)
      )
        throw safeApiError("contract", "CONTRACT_ERROR");
      if (outcome.status !== "NOT_OBSERVED") clear(saved, outcome);
      return outcome;
    });
  const retire = environment.session.onRetire(() => {
    original = null;
    publish({ state: "idle", target: null });
  });
  return {
    execute,
    retry,
    observe,
    handle,
    canRetry: (actor: string) =>
      original?.actor === actor &&
      original.fingerprint === handle(actor)?.fingerprint,
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
      original = null;
      retire();
      listeners.clear();
    },
  };
}
let browserOwner: ReturnType<typeof createAdminWithdrawalRuntime> | undefined;
let ownerSession: SessionRuntime | undefined;
export function getAdminWithdrawalRuntime() {
  const session = getSessionRuntime();
  if (browserOwner && session === ownerSession) return browserOwner;
  browserOwner?.dispose();
  ownerSession = session;
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    /* Storage denial keeps commands closed. */
  }
  const lockSupport: unknown = Reflect.get(navigator, "locks");
  browserOwner = createAdminWithdrawalRuntime({
    session,
    storage,
    online: () => navigator.onLine,
    key: () => crypto.randomUUID(),
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
  const owner = browserOwner;
  const changed = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key.startsWith("oscar.admin-withdrawal.v1.")
    )
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
