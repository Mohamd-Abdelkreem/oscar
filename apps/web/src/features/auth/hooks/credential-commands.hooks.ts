"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { getApiError, type ApiError } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import {
  getSessionRuntime,
  peekSessionRuntime,
  type SessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";

type CommandState = Readonly<{
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: ApiError | null;
  uncertain: boolean;
}>;
const idle: CommandState = Object.freeze({
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
  uncertain: false,
});
export const CREDENTIAL_COMMAND_UI_DEADLINE_MS = 30_000;
type CommandStore = { state: CommandState; listeners: Set<() => void> };
const registries = new WeakMap<SessionRuntime, Map<string, CommandStore>>();
const storeFor = (key: string): CommandStore => {
  const runtime = getSessionRuntime();
  let registry = registries.get(runtime);
  if (registry === undefined) {
    registry = new Map();
    registries.set(runtime, registry);
    runtime.onRetire(() => {
      for (const command of registries.get(runtime)?.values() ?? []) {
        if (!command.state.isPending && !command.state.uncertain)
          publish(command, idle);
      }
    });
  }
  let store = registry.get(key);
  if (store === undefined) {
    store = { state: idle, listeners: new Set() };
    registry.set(key, store);
  }
  return store;
};
const publish = (store: CommandStore, state: CommandState) => {
  store.state = Object.freeze(state);
  for (const listener of store.listeners) listener();
};
const commandFailure = (store: CommandStore, failure: unknown) => {
  const error = getApiError(failure);
  publish(
    store,
    error.category === "obsolete"
      ? idle
      : {
          ...idle,
          isError: true,
          error,
          uncertain: ["coordination", "transient", "uncertain"].includes(
            error.category,
          ),
        },
  );
  return error;
};
const observeCommand = <TOutput>(
  pending: Promise<TOutput>,
  context: {
    runtime: SessionRuntime;
    scope: SessionScope;
    store: CommandStore;
    isMounted: () => boolean;
    committed: (output: TOutput) => void;
  },
) =>
  pending
    .then((output) => {
      context.runtime.assertCurrent(context.scope);
      context.committed(output);
      if (!context.isMounted())
        throw safeApiError("obsolete", "OBSOLETE_SCOPE");
      publish(context.store, { ...idle, isSuccess: true });
      return output;
    })
    .catch((failure: unknown) => {
      throw commandFailure(context.store, failure);
    });
const commandDeadline = (store: CommandStore) => {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = safeApiError("uncertain", "REQUEST_UNCERTAIN");
      publish(store, {
        ...idle,
        isPending: true,
        uncertain: true,
        isError: true,
        error,
      });
      reject(error);
    }, CREDENTIAL_COMMAND_UI_DEADLINE_MS);
  });
  return {
    promise,
    cancel: () => {
      clearTimeout(timer);
    },
  };
};

export const useCredentialCommand = <TInput, TOutput>(
  key: string,
  execute: (input: TInput) => Promise<TOutput>,
  committed?: (output: TOutput) => void,
) => {
  const state = useSyncExternalStore(
    (listener) => {
      const store = storeFor(key);
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    () => {
      const runtime = peekSessionRuntime();
      return runtime === undefined
        ? idle
        : (registries.get(runtime)?.get(key)?.state ?? idle);
    },
    () => idle,
  );
  const mounted = useRef(false);
  const flowScope = useRef<SessionScope | undefined>(undefined);
  const isCurrentFlow = useCallback(() => {
    const scope = flowScope.current;
    return scope !== undefined && getSessionRuntime().isCurrent(scope);
  }, []);
  const executeRef = useRef(execute);
  const committedRef = useRef(committed);
  useEffect(() => {
    executeRef.current = execute;
    committedRef.current = committed;
  }, [execute, committed]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const mutateAsync = useCallback(
    async (input: TInput): Promise<TOutput> => {
      const store = storeFor(key);
      if (store.state.isPending || store.state.uncertain)
        throw safeApiError("request", "COMMAND_PENDING");
      publish(store, { ...idle, isPending: true });
      const runtime = getSessionRuntime();
      let pending: Promise<TOutput>;
      try {
        pending = executeRef.current(input);
      } catch (failure: unknown) {
        throw commandFailure(store, failure);
      }
      const scope = runtime.scope();
      flowScope.current = scope;
      const observation = observeCommand(pending, {
        runtime,
        scope,
        store,
        isMounted: () => mounted.current,
        committed: (output) => {
          committedRef.current?.(output);
          flowScope.current = runtime.scope();
        },
      });
      const deadline = commandDeadline(store);
      try {
        return await Promise.race([observation, deadline.promise]);
      } finally {
        deadline.cancel();
      }
    },
    [key],
  );
  const mutate = (
    input: TInput,
    callbacks?: {
      onSuccess?: (output: TOutput) => void;
      onError?: (error: ApiError) => void;
    },
  ) => {
    void mutateAsync(input)
      .then((output) => {
        if (mounted.current && isCurrentFlow()) callbacks?.onSuccess?.(output);
      })
      .catch((failure: unknown) => {
        if (mounted.current && isCurrentFlow())
          callbacks?.onError?.(getApiError(failure));
      });
  };
  return {
    ...state,
    isCurrentFlow,
    mutateAsync,
    mutate,
    reset: () => {
      const store = storeFor(key);
      if (!store.state.isPending && !store.state.uncertain)
        publish(store, idle);
    },
  };
};

export const useCredentialFieldCleanup = (
  clear: () => void,
  isCurrentFlow: () => boolean,
) => {
  const clearRef = useRef(clear);
  useEffect(() => {
    clearRef.current = clear;
  }, [clear]);
  useEffect(() => {
    const release = getSessionRuntime().onRetire(() => {
      // Commands may retire authority synchronously before capturing their own scope.
      queueMicrotask(() => {
        if (!isCurrentFlow()) clearRef.current();
      });
    });
    return () => {
      release();
      clearRef.current();
    };
  }, [isCurrentFlow]);
};

export const useLinkCredential = () => {
  const credential = useRef<string | null>(null);
  const captured = useRef(false);
  const revision = useRef({ value: 0 });
  useEffect(() => {
    const lifetime = revision.current;
    lifetime.value++;
    const currentRevision = lifetime.value;
    if (!captured.current) {
      captured.current = true;
      const url = new URL(window.location.href);
      const tokens = url.searchParams.getAll("token");
      credential.current =
        tokens.length === 1 &&
        tokens[0] !== undefined &&
        tokens[0].length > 0 &&
        tokens[0].length <= 4096
          ? tokens[0]
          : null;
      url.searchParams.delete("token");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    const release = getSessionRuntime().onRetire(() => {
      credential.current = null;
    });
    return () => {
      release();
      // Strict Mode's same-turn effect replay must not destroy the captured flow.
      queueMicrotask(() => {
        if (lifetime.value === currentRevision) credential.current = null;
      });
    };
  }, []);
  const read = useCallback(() => credential.current, []);
  const dismiss = useCallback(() => {
    credential.current = null;
  }, []);
  return { read, dismiss };
};
