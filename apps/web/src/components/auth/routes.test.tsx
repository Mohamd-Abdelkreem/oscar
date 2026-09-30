import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AuthUserData } from "@template/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GuestOnlyRoute } from "./guest-only-route";
import { ProtectedRoute } from "./protected-route";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  replace: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  useSession: mocks.useSession,
}));

vi.mock("@/services/api/api-client", () => ({
  getApiError: () => ({
    message: "Session lookup failed.",
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    requestId: "request-test",
    fieldErrors: {},
  }),
}));

const account: AuthUserData = {
  user: {
    id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
    fullName: "Template User",
    email: "user@example.com",
    phone: null,
    role: "USER",
    status: "ACTIVE",
    emailVerifiedAt: "2026-08-18T00:00:00.000Z",
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
  },
};

const session = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  data: null,
  error: null,
  isPending: false,
  isFetched: true,
  isError: false,
  refetch: mocks.refetch,
  ...overrides,
});

describe("GuestOnlyRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the session loader while pending", () => {
    mocks.useSession.mockReturnValue(
      session({ isPending: true, isFetched: false }),
    );
    render(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    expect(screen.getByText("Restoring your workspace.")).toBeInTheDocument();
  });

  it("shows unexpected errors with a retry action", () => {
    mocks.useSession.mockReturnValue(
      session({ isError: true, error: new Error("offline") }),
    );
    render(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Session lookup failed.",
    );
    expect(screen.getByText("Request ID: request-test")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("renders anonymous-only content for an anonymous session", () => {
    mocks.useSession.mockReturnValue(session());
    render(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    expect(screen.getByText("Guest content")).toBeInTheDocument();
  });

  it("redirects an authenticated account", async () => {
    mocks.useSession.mockReturnValue(session({ data: account }));
    render(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    });
    expect(screen.queryByText("Guest content")).not.toBeInTheDocument();
  });
});

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the session loader while pending", () => {
    mocks.useSession.mockReturnValue(
      session({ isPending: true, isFetched: false }),
    );
    render(<ProtectedRoute>Private content</ProtectedRoute>);
    expect(screen.getByText("Restoring your workspace.")).toBeInTheDocument();
  });

  it("shows unexpected errors with a retry action", () => {
    mocks.useSession.mockReturnValue(
      session({ isError: true, error: new Error("offline") }),
    );
    render(<ProtectedRoute>Private content</ProtectedRoute>);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Session lookup failed.",
    );
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("redirects anonymous users with a safe return path", async () => {
    mocks.useSession.mockReturnValue(session());
    render(<ProtectedRoute>Private content</ProtectedRoute>);
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fsettings",
      );
    });
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("renders protected content for an active verified account", () => {
    mocks.useSession.mockReturnValue(session({ data: account }));
    render(<ProtectedRoute>Private content</ProtectedRoute>);
    expect(screen.getByText("Private content")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
