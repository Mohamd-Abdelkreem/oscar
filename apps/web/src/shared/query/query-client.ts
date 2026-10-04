import { QueryClient } from "@tanstack/react-query";

import { getApiError } from "@/services/api/api-client";

const DEFAULT_STALE_TIME_MS = 30_000;
const MAX_RETRY_COUNT = 2;

export const shouldRetryRequest = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (failureCount >= MAX_RETRY_COUNT) return false;
  return getApiError(error).category === "transient";
};

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: shouldRetryRequest,
      },
      mutations: { retry: false },
    },
  });
