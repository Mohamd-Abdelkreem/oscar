import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateProfile } from "./users.hooks";

const mocks = vi.hoisted(() => ({ updateMe: vi.fn() }));

vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  AUTH_SESSION_QUERY_KEY: ["auth", "session"] as const,
}));

vi.mock("../api/users.api", () => ({
  usersApi: { updateMe: mocks.updateMe },
}));

describe("useUpdateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the authoritative session cache with the returned profile", async () => {
    const sessionKey = ["auth", "session"] as const;
    const updatedAccount = {
      user: {
        id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
        fullName: "Updated User",
      },
    };
    mocks.updateMe.mockResolvedValue(updatedAccount);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        fullName: "Updated User",
        phone: null,
      });
    });

    expect(mocks.updateMe).toHaveBeenCalledWith({
      fullName: "Updated User",
      phone: null,
    });
    expect(queryClient.getQueryData(sessionKey)).toEqual(updatedAccount);
  });
});
