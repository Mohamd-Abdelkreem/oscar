import { describe, expect, it, vi } from "vitest";

import { applyApiFormError } from "./form";

describe("applyApiFormError", () => {
  it("maps only known fields and strips the body prefix", () => {
    const setError = vi.fn();
    const message = applyApiFormError(
      {
        isAxiosError: true,
        response: {
          status: 422,
          headers: {},
          data: {
            success: false,
            statusCode: 422,
            code: "VALIDATION_ERROR",
            message: "Review the fields.",
            requestId: "request",
            errors: [
              { field: "body.email", message: "Invalid email." },
              { field: "__proto__", message: "Unsafe." },
            ],
          },
        },
      },
      { getValues: () => ({ email: "" }), setError },
    );
    expect(message).toBe("Review the fields.");
    expect(setError).toHaveBeenCalledOnce();
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "Invalid email.",
    });
  });
});
