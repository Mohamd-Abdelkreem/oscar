import { createSessionRuntime } from "@/services/api/session-runtime";
import type { TaskRuntimeEnvironment } from "@/features/proofs/task-command-runtime";
import { actorId } from "./p04-network";

export function commandHarness(role: "USER" | "ADMIN") {
  const saved = new Map<string, string>();
  const session = createSessionRuntime({});
  session.admitIdentity(session.scope(), { id: actorId, role });
  let locked = false;
  const environment: TaskRuntimeEnvironment = {
    session,
    online: () => true,
    storage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, raw) => {
        saved.set(key, raw);
      },
      removeItem: (key) => {
        saved.delete(key);
      },
    },
    locks: {
      request: async (_name, work) => {
        if (locked) return work(false);
        locked = true;
        try {
          return await work(true);
        } finally {
          locked = false;
        }
      },
    },
    observe: (handle) =>
      Promise.resolve({
        state: "NOT_OBSERVED",
        commandId: handle.commandId,
        kind: handle.operation.kind,
      }),
    cancel: (handle) =>
      Promise.resolve({
        state: "CANCELLED",
        commandId: handle.commandId,
        kind: handle.operation.kind,
        cancelledAt: "2026-10-05T09:00:00.000Z",
      }),
  };
  return { environment, saved, session };
}
