"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { AdminStateProvider } from "@/features/admin/context/admin-state.context";
import { createQueryClient } from "@/shared/query/query-client";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AdminStateProvider>{children}</AdminStateProvider>
    </QueryClientProvider>
  );
}
