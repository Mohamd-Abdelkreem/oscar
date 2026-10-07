import {
  commandObservationSchema,
  taskCommandCancellationSchema,
} from "@template/contracts";
import { apiClient } from "@/services/api/api-client";
import {
  financialRead,
  financialInput,
} from "@/services/api/financial-response";
import {
  getSessionRuntime,
  type SessionRuntime,
} from "@/services/api/session-runtime";
import { proofsApi } from "./api/proofs.api";
import { taskIllustrationsApi } from "./api/task-illustrations.api";
import {
  createTaskCommandRuntime,
  type TaskHandle,
} from "./task-command-runtime";

function observe(handle: TaskHandle) {
  const operation = handle.operation;
  if (operation.kind === "UPLOAD")
    return (
      operation.purpose === "PROOF" ? proofsApi : taskIllustrationsApi
    ).observe(handle.commandId);
  return financialRead(
    () =>
      apiClient.get<unknown>(`/task-commands/${handle.commandId}`, {
        params: { kind: operation.kind },
      }),
    commandObservationSchema,
  );
}
function cancel(handle: TaskHandle) {
  const operation = handle.operation;
  if (operation.kind === "UPLOAD")
    return (
      operation.purpose === "PROOF" ? proofsApi : taskIllustrationsApi
    ).cancel(handle.commandId, { confirmed: true });
  const body = financialInput(taskCommandCancellationSchema, {
    kind: operation.kind,
    confirmed: true,
  });
  return financialRead(
    () =>
      apiClient.post<unknown>(
        `/task-commands/${handle.commandId}/cancel`,
        body,
      ),
    commandObservationSchema,
  );
}
const owners = new Map<
  "USER" | "ADMIN",
  {
    session: SessionRuntime;
    runtime: ReturnType<typeof createTaskCommandRuntime>;
  }
>();
export function getBrowserTaskCommandRuntime(role: "USER" | "ADMIN") {
  const session = getSessionRuntime();
  const existing = owners.get(role);
  if (existing?.session === session) return existing.runtime;
  existing?.runtime.dispose();
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    /* Unavailable coordination stays closed. */
  }
  const lockSupport: unknown = Reflect.get(navigator, "locks");
  const runtime = createTaskCommandRuntime(role, {
    session,
    storage,
    observe,
    cancel,
    online: () => navigator.onLine,
    locks:
      lockSupport === undefined
        ? undefined
        : {
            request: async (name, work) =>
              await navigator.locks.request(
                name,
                { ifAvailable: true },
                (lock) => work(lock !== null),
              ),
          },
  });
  const changed = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith("oscar.p05.commands.v1."))
      runtime.notifyRecoveryChanged();
  };
  window.addEventListener("storage", changed);
  const dispose = runtime.dispose;
  runtime.dispose = () => {
    window.removeEventListener("storage", changed);
    dispose();
  };
  owners.set(role, { session, runtime });
  return runtime;
}
