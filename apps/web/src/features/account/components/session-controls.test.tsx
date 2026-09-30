import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionControls } from "./session-controls";

const mocks = vi.hoisted(() => ({
  getApiError: vi.fn(),
  isPending: false,
  mutate: vi.fn(),
  replaceWithLogin: vi.fn(),
}));

vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  useLogoutAll: () => ({
    isPending: mocks.isPending,
    mutate: mocks.mutate,
  }),
}));
vi.mock("@/features/auth/utils/session-navigation", () => ({
  replaceWithLogin: mocks.replaceWithLogin,
}));
vi.mock("@/services/api/api-client", () => ({
  getApiError: mocks.getApiError,
}));

describe("SessionControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiError.mockReturnValue({ message: "Logout failed." });
    mocks.isPending = false;
  });

  it("replaces the page with login only after server logout-all succeeds", () => {
    render(<SessionControls />);

    fireEvent.click(
      screen.getByRole("button", { name: "Sign out all devices" }),
    );
    const options = mocks.mutate.mock.calls[0]?.[1] as
      | { onError?: (error: unknown) => void; onSuccess?: () => void }
      | undefined;
    act(() => {
      options?.onSuccess?.();
    });
    expect(mocks.replaceWithLogin).toHaveBeenCalledOnce();
  });

  it("shows an actionable failure without navigating and permits retry", () => {
    render(<SessionControls />);

    fireEvent.click(
      screen.getByRole("button", { name: "Sign out all devices" }),
    );
    const options = mocks.mutate.mock.calls[0]?.[1] as
      | { onError?: (error: unknown) => void; onSuccess?: () => void }
      | undefined;
    act(() => {
      options?.onError?.(new Error("network"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Revocation of sessions on your other devices could not be confirmed",
    );
    expect(mocks.replaceWithLogin).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Sign out all devices" }),
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.mutate).toHaveBeenCalledTimes(2);
  });

  it("derives the disabled loading state from the mutation", () => {
    mocks.isPending = true;
    render(<SessionControls />);

    expect(screen.getByRole("button", { name: "Revoking…" })).toBeDisabled();
  });
});
