import { describe, expect, it } from "vitest";

import {
  identityUserSchema,
  employeeRestrictionsBodySchema,
  identityListQuerySchema,
} from "./identity.schema.ts";

const employee = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Employee",
  email: "employee@example.com",
  phone: null,
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: "2026-10-03T00:00:00Z",
  createdAt: "2026-10-03T00:00:00Z",
  updatedAt: "2026-10-03T00:00:00Z",
  referralCode: "a".repeat(32),
  tasksBlocked: false,
  withdrawalsBlocked: false,
  accountVersion: 0,
};

describe("P02 identity wire authority", () => {
  it.each([
    "referralCode",
    "tasksBlocked",
    "withdrawalsBlocked",
    "accountVersion",
  ])("requires %s in enriched responses", (field) => {
    const incomplete = Object.fromEntries(
      Object.entries(employee).filter(([key]) => key !== field),
    );
    expect(identityUserSchema.safeParse(incomplete).success).toBe(false);
  });
  it("enforces role-specific statuses, referral visibility and private-field exclusion", () => {
    expect(identityUserSchema.parse(employee)).toEqual(employee);
    expect(
      identityUserSchema.safeParse({ ...employee, status: "BANNED" }).success,
    ).toBe(true);
    expect(
      identityUserSchema.safeParse({ ...employee, status: "DEACTIVATED" })
        .success,
    ).toBe(false);
    expect(
      identityUserSchema.safeParse({
        ...employee,
        role: "ADMIN",
        referralCode: null,
        status: "DEACTIVATED",
      }).success,
    ).toBe(true);
    for (const invalid of [
      { role: "ADMIN", status: "BANNED", referralCode: null },
      { role: "ADMIN" },
      { passwordHash: "private" },
      { sessionId: employee.id },
    ]) {
      expect(
        identityUserSchema.safeParse({ ...employee, ...invalid }).success,
      ).toBe(false);
    }
  });
  it("requires confirmed versioned intent and an actual supported control", () => {
    const command = {
      confirmed: true,
      reason: "Authorized control",
      expectedVersion: 0,
      tasksBlocked: true,
    };
    expect(employeeRestrictionsBodySchema.parse(command)).toEqual(command);
    for (const invalid of [
      { confirmed: false },
      { reason: " " },
      { expectedVersion: -1 },
      { actorUserId: employee.id },
      { reason: "x".repeat(501) },
    ]) {
      expect(
        employeeRestrictionsBodySchema.safeParse({ ...command, ...invalid })
          .success,
      ).toBe(false);
    }
    expect(
      employeeRestrictionsBodySchema.safeParse({
        confirmed: true,
        reason: "Reason",
        expectedVersion: 0,
      }).success,
    ).toBe(false);
  });
  it.each(["0", "101", "1e2", "1.5", "9007199254740992", ["1", "2"]])(
    "rejects invalid bounded list limit %s",
    (limit) => {
      expect(identityListQuerySchema.safeParse({ limit }).success).toBe(false);
    },
  );
  it("parses safe decimal pages with bounded offset", () => {
    expect(identityListQuerySchema.parse({})).toEqual({ page: 1, limit: 25 });
    expect(identityListQuerySchema.parse({ page: "2", limit: "100" })).toEqual({
      page: 2,
      limit: 100,
    });
    expect(
      identityListQuerySchema.safeParse({
        page: "9007199254740991",
        limit: "100",
      }).success,
    ).toBe(false);
  });
});
