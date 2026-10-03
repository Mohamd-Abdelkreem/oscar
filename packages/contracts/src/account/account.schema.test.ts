import { describe, expect, it } from "vitest";

import {
  ACCOUNT_RESPONSE_FIELD_ALLOWLIST,
  safeUserSchema,
  authUserDataSchema,
  authSessionDataSchema,
  type SafeUser,
  type AuthUserData,
  type AuthSessionData,
} from "./account.schema.ts";

const safeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Template User",
  email: "user@example.com",
  phone: null,
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: "2026-08-18T00:00:00.000Z",
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
};

describe("safe account contracts", () => {
  it("preserves frozen legacy fixture assignments and response allowlists", () => {
    const legacy: SafeUser = { ...safeUser, role: "USER", status: "ACTIVE" };
    const account: AuthUserData = { user: legacy };
    const session: AuthSessionData = {
      user: legacy,
      tokens: { accessToken: "intended-session" },
    };
    expect(authUserDataSchema.parse(account)).toEqual(account);
    expect(authSessionDataSchema.parse(session)).toEqual(session);
    expect(
      safeUserSchema.safeParse({ ...legacy, tasksBlocked: false }).success,
    ).toBe(false);
  });
  it("accepts exactly the approved browser-visible user fields", () => {
    expect(Object.keys(safeUser).sort()).toEqual(
      [...ACCOUNT_RESPONSE_FIELD_ALLOWLIST].sort(),
    );
    expect(safeUserSchema.parse(safeUser)).toEqual(safeUser);
  });

  it("rejects password and token storage fields", () => {
    expect(
      safeUserSchema.safeParse({ ...safeUser, passwordHash: "secret" }).success,
    ).toBe(false);
    expect(
      safeUserSchema.safeParse({ ...safeUser, resetTokenHash: "secret" })
        .success,
    ).toBe(false);
  });
});
