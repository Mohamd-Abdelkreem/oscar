import { z } from "zod";
import {
  taskCommandKindSchema,
  TASK_COMMAND_ROLES,
  commandObservationSchema,
  uploadObservationSchema,
  type CommandObservation,
  type UploadObservation,
} from "@template/contracts";
import { getApiError, safeApiError } from "@/services/api/safe-error";
import type {
  SessionRuntime,
  SessionScope,
} from "@/services/api/session-runtime";

const operationSchema = z.union([
  z.strictObject({
    kind: taskCommandKindSchema,
    targetId: z.uuid().nullable(),
  }),
  z.strictObject({
    kind: z.literal("UPLOAD"),
    purpose: z.enum(["PROOF", "TASK_ILLUSTRATION"]),
    targetId: z.uuid().nullable(),
  }),
]);
const handleSchema = z.strictObject({
  operation: operationSchema,
  commandId: z.uuid(),
});
const handlesSchema = z.array(handleSchema).max(32);
export type TaskOperation = z.infer<typeof operationSchema>;
export type TaskHandle = z.infer<typeof handleSchema>;
export type TaskTerminalObservation = CommandObservation | UploadObservation;
export type TaskRuntimeEnvironment = {
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
  observe: (handle: TaskHandle) => Promise<unknown>;
  cancel: (handle: TaskHandle) => Promise<unknown>;
  online: () => boolean;
};
const operationIdentity = (operation: TaskOperation) =>
  JSON.stringify(operation);
const storageKey = (actorId: string) => `oscar.p05.commands.v1.${actorId}`;

function parsedObservation(
  handle: TaskHandle,
  raw: unknown,
): TaskTerminalObservation {
  if (handle.operation.kind === "UPLOAD") {
    const result = uploadObservationSchema.safeParse(raw);
    if (
      !result.success ||
      result.data.commandId !== handle.commandId ||
      result.data.purpose !== handle.operation.purpose
    )
      throw safeApiError("contract", "CONTRACT_ERROR");
    return result.data;
  }
  const result = commandObservationSchema.safeParse(raw);
  if (!result.success) throw safeApiError("contract", "CONTRACT_ERROR");
  const identity =
    result.data.state === "OBSERVED" ? result.data.command : result.data;
  if (
    identity.commandId !== handle.commandId ||
    identity.kind !== handle.operation.kind
  )
    throw safeApiError("contract", "CONTRACT_ERROR");
  if (result.data.state === "OBSERVED" && handle.operation.targetId !== null) {
    const command = result.data.command;
    const target =
      command.kind === "CODE_CREATE"
        ? command.outcome.task.id
        : command.kind === "SUBMISSION_CREATE"
          ? command.outcome.taskId
          : command.targetId;
    if (target !== handle.operation.targetId)
      throw safeApiError("contract", "CONTRACT_ERROR");
  }
  return result.data;
}
const terminal = (observation: TaskTerminalObservation) =>
  ["OBSERVED", "CANCELLED", "READY", "FAILED"].includes(observation.state);

export function createTaskCommandRuntime(
  role: "USER" | "ADMIN",
  environment: TaskRuntimeEnvironment,
) {
  let revision = 0;
  const listeners = new Set<() => void>();
  const publish = () => {
    revision++;
    listeners.forEach((listener) => {
      listener();
    });
  };
  const actor = (scope: SessionScope) => {
    if (!environment.session.isCurrentCheck(scope))
      throw safeApiError("obsolete", "OBSOLETE_SCOPE");
    if (scope.role !== role || scope.accountId === null)
      throw safeApiError("denied", "FORBIDDEN", 403);
    return scope.accountId;
  };
  const read = (actorId: string): TaskHandle[] => {
    try {
      if (!environment.storage)
        throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      const raw = environment.storage.getItem(storageKey(actorId));
      return raw === null
        ? []
        : handlesSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
  };
  const write = (actorId: string, handles: TaskHandle[]) => {
    try {
      if (!environment.storage)
        throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      if (handles.length === 0)
        environment.storage.removeItem(storageKey(actorId));
      else
        environment.storage.setItem(
          storageKey(actorId),
          JSON.stringify(handlesSchema.parse(handles)),
        );
      if (JSON.stringify(read(actorId)) !== JSON.stringify(handles))
        throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
      publish();
    } catch {
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    }
  };
  const authorizeOperation = (operation: TaskOperation) => {
    const expectedRole =
      operation.kind === "UPLOAD"
        ? operation.purpose === "PROOF"
          ? "USER"
          : "ADMIN"
        : TASK_COMMAND_ROLES[operation.kind];
    if (expectedRole !== role) throw safeApiError("denied", "FORBIDDEN", 403);
  };
  const withLock = <T>(
    scope: SessionScope,
    work: (actorId: string) => Promise<T>,
  ) => {
    const actorId = actor(scope);
    if (!environment.locks)
      throw safeApiError("coordination", "COORDINATION_UNAVAILABLE");
    return environment.locks.request(storageKey(actorId), async (available) => {
      if (!available) throw safeApiError("coordination", "COMMAND_PENDING");
      actor(scope);
      return work(actorId);
    });
  };
  const outstanding = (scope: SessionScope, operation: TaskOperation) => {
    authorizeOperation(operation);
    return (
      read(actor(scope)).find(
        (handle) =>
          operationIdentity(handle.operation) === operationIdentity(operation),
      ) ?? null
    );
  };
  const settle = (scope: SessionScope, handle: TaskHandle, raw: unknown) => {
    const actorId = actor(scope);
    const observation = parsedObservation(handle, raw);
    if (terminal(observation))
      write(
        actorId,
        read(actorId).filter((saved) => saved.commandId !== handle.commandId),
      );
    return observation;
  };
  const execute = (
    scope: SessionScope,
    rawOperation: TaskOperation,
    dispatch: (commandId: string) => Promise<unknown>,
  ) =>
    withLock(scope, async (actorId) => {
      const parsed = operationSchema.safeParse(rawOperation);
      if (!parsed.success)
        throw safeApiError("request", "VALIDATION_ERROR", 400);
      const operation = parsed.data;
      authorizeOperation(operation);
      if (outstanding(scope, operation))
        throw safeApiError("coordination", "COMMAND_UNRESOLVED");
      if (!environment.online()) throw safeApiError("request", "OFFLINE");
      const handle = { operation, commandId: crypto.randomUUID() };
      write(actorId, [...read(actorId), handle]);
      let dispatched = false;
      try {
        actor(scope);
        dispatched = true;
        await dispatch(handle.commandId);
        actor(scope);
        return settle(scope, handle, await environment.observe(handle));
      } catch (failure: unknown) {
        if (!dispatched)
          write(
            actorId,
            read(actorId).filter(
              (saved) => saved.commandId !== handle.commandId,
            ),
          );
        throw getApiError(failure);
      }
    });
  const resolve = (
    scope: SessionScope,
    operation: TaskOperation,
    readOutcome: (handle: TaskHandle) => Promise<unknown>,
  ) =>
    withLock(scope, async () => {
      const handle = outstanding(scope, operation);
      if (!handle) return null;
      return settle(scope, handle, await readOutcome(handle));
    });
  const retire = environment.session.onRetire(publish);
  return {
    execute,
    outstanding,
    observe: (scope: SessionScope, operation: TaskOperation) =>
      resolve(scope, operation, environment.observe),
    cancel: (scope: SessionScope, operation: TaskOperation) =>
      resolve(scope, operation, environment.cancel),
    snapshot: () => revision,
    notifyRecoveryChanged: publish,
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
