import { describe, expect, it } from "vitest";

import {
  changePasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from "./auth.schema.ts";

describe("authentication request contracts", () => {
  it("normalizes email, whitespace, and optional phone input", () => {
    const result = registerBodySchema.parse({
      fullName: "Template User",
      email: "  USER@Example.COM ",
      phone: " ",
      password: "a-secure-password",
    });
    expect(result.email).toBe("user@example.com");
    expect(result.phone).toBeNull();
  });

  it("requires explicit remember-me and rejects unknown login fields", () => {
    expect(
      loginBodySchema.safeParse({
        email: "user@example.com",
        password: "password",
      }).success,
    ).toBe(false);
    expect(
      loginBodySchema.safeParse({
        email: "user@example.com",
        password: "password",
        rememberMe: false,
        organizationId: "not-supported",
      }).success,
    ).toBe(false);
  });

  it("enforces password confirmation and credential rotation", () => {
    expect(
      resetPasswordBodySchema.safeParse({
        newPassword: "a-new-secure-password",
        passwordConfirmation: "different-password",
      }).success,
    ).toBe(false);
    expect(
      changePasswordBodySchema.safeParse({
        currentPassword: "same-secure-password",
        newPassword: "same-secure-password",
        passwordConfirmation: "same-secure-password",
      }).success,
    ).toBe(false);
  });
});
