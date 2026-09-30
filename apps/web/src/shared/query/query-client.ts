import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

import { getApiError } from "@/services/api/api-client";

const DEFAULT_STALE_TIME_MS = 30_000;
const MAX_RETRY_COUNT = 2;

export const shouldRetryRequest = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (failureCount >= MAX_RETRY_COUNT) return false;
  if (!axios.isAxiosError(error)) return false;
  const statusCode = getApiError(error).statusCode;
  return statusCode === 0 || (statusCode >= 500 && statusCode <= 504);
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
