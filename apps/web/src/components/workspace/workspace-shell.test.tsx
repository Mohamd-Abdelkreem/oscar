import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "./workspace-shell";

const mocks = vi.hoisted(() => ({
  getApiError: vi.fn(),
  isPending: false,
  mutate: vi.fn(),
  replaceWithLogin: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));
vi.mock("@/components/auth/session-loader", () => ({
  SessionLoader: () => <div>Loading session</div>,
}));
vi.mock("@/components/brand/brand-mark", () => ({
  BrandMark: () => <div>Template</div>,
}));
vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  useLogout: () => ({
    isPending: mocks.isPending,
    mutate: mocks.mutate,
  }),
  useSession: () => ({
    data: {
      user: { fullName: "Template User", role: "USER" },
    },
  }),
}));
vi.mock("@/features/auth/utils/session-navigation", () => ({
  replaceWithLogin: mocks.replaceWithLogin,
}));
vi.mock("@/services/api/api-client", () => ({
  getApiError: mocks.getApiError,
}));

describe("WorkspaceShell session control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiError.mockReturnValue({ message: "Logout failed." });
    mocks.isPending = false;
  });

  it("replaces the page with login only after server logout succeeds", () => {
    render(
      <WorkspaceShell>
        <main>Workspace</main>
      </WorkspaceShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const options = mocks.mutate.mock.calls[0]?.[1] as
      | { onError?: (error: unknown) => void; onSuccess?: () => void }
      | undefined;
    act(() => {
      options?.onSuccess?.();
    });
    expect(mocks.replaceWithLogin).toHaveBeenCalledOnce();
  });

  it("shows an actionable failure without navigating and permits retry", () => {
    render(
      <WorkspaceShell>
        <main>Workspace</main>
      </WorkspaceShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const options = mocks.mutate.mock.calls[0]?.[1] as
      | { onError?: (error: unknown) => void; onSuccess?: () => void }
      | undefined;
    act(() => {
      options?.onError?.(new Error("network"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Server sign-out could not be confirmed",
    );
    expect(mocks.replaceWithLogin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
  });

  it("derives the disabled loading state from the mutation", () => {
    mocks.isPending = true;
    render(
      <WorkspaceShell>
        <main>Workspace</main>
      </WorkspaceShell>,
    );

    expect(screen.getByRole("button", { name: "Ending…" })).toBeDisabled();
  });
});
