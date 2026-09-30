import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

const mocks = vi.hoisted(() => ({
  getApiError: vi.fn(),
  mutateAsync: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  useLogin: () => ({ mutateAsync: mocks.mutateAsync }),
}));

vi.mock("@/services/api/api-client", () => ({
  getApiError: mocks.getApiError,
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies safe server field errors to the corresponding input", async () => {
    mocks.mutateAsync.mockRejectedValue(new Error("rejected"));
    mocks.getApiError.mockReturnValue({
      message: "Review the fields.",
      statusCode: 422,
      code: "VALIDATION_ERROR",
      requestId: "request-test",
      fieldErrors: { email: ["Email not recognized."] },
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "CorrectHorseBatteryStaple!1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in securely" }));

    await waitFor(() => {
      expect(screen.getByText("Email not recognized.")).toBeInTheDocument();
    });
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
});
