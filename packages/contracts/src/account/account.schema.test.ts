import { describe, expect, it } from "vitest";

import {
  ACCOUNT_RESPONSE_FIELD_ALLOWLIST,
  safeUserSchema,
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
