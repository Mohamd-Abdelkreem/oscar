import { describe, expect, it } from "vitest";

import {
  changePasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  tokenQuerySchema,
  updateProfileBodySchema,
} from "./auth.schema.ts";

describe("authentication request contracts", () => {
  it("normalizes optional referral codes without accepting authority or registration confirmation", () => {
    const registration = {
      fullName: "Employee",
      email: "employee@example.com",
      password: " a-secure-password ",
    };
    expect(
      registerBodySchema.parse({
        ...registration,
        referralCode: ` ${"A".repeat(32)} `,
      }),
    ).toMatchObject({
      referralCode: "a".repeat(32),
      password: registration.password,
    });
    expect(
      registerBodySchema.parse({ ...registration, referralCode: " " })
        .referralCode,
    ).toBeUndefined();
    for (const extra of [
      { role: "ADMIN" },
      { sponsorUserId: "arbitrary" },
      { balance: "100" },
      { passwordConfirmation: registration.password },
      { referralCode: "invalid" },
    ]) {
      expect(
        registerBodySchema.safeParse({ ...registration, ...extra }).success,
      ).toBe(false);
    }
  });
  it.each(["", "x".repeat(4097), ["token"], 1])(
    "bounds untrusted action tokens",
    (token) => {
      expect(tokenQuerySchema.safeParse({ token }).success).toBe(false);
    },
  );
  it("preserves login compatibility, supported PATCH omission and nullable phone", () => {
    expect(
      loginBodySchema.parse({
        email: "employee@example.com",
        password: "old",
        rememberMe: false,
      }).password,
    ).toBe("old");
    expect(updateProfileBodySchema.parse({ fullName: "Name" })).toEqual({
      fullName: "Name",
    });
    expect(updateProfileBodySchema.parse({ phone: " " })).toEqual({
      phone: null,
    });
    expect(updateProfileBodySchema.safeParse({}).success).toBe(false);
    expect(
      updateProfileBodySchema.safeParse({
        fullName: "Name",
        tasksBlocked: false,
      }).success,
    ).toBe(false);
  });
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
