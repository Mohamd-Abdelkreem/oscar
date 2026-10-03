import { randomUUID } from "node:crypto";
import {
  createDatabaseClient,
  Prisma,
  type AuthSession,
  type User,
} from "@template/database";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertSessionAuthority,
  isRetryableIdentityConflict,
  lockIdentityUsers,
} from "./session-authority.js";

const now = new Date("2026-10-03T12:00:00Z");
const user: User = {
  id: randomUUID(),
  email: "authority@example.com",
  passwordHash: "unused-hash",
  fullName: "Authority",
  phone: null,
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: now,
  verificationTokenHash: null,
  verificationTokenExpiresAt: null,
  resetTokenHash: null,
  resetTokenExpiresAt: null,
  createdAt: now,
  updatedAt: now,
  referralCode: "a".repeat(32),
  sponsorUserId: null,
  tasksBlocked: false,
  withdrawalsBlocked: false,
  accountVersion: 0,
};
const session: AuthSession = {
  id: randomUUID(),
  userId: user.id,
  rememberMe: false,
  createdAt: now,
  expiresAt: new Date(now.getTime() + 1000),
  revokedAt: null,
};
afterEach(() => vi.restoreAllMocks());

describe("shared identity authority", () => {
  it("uses current account/session ownership, expiry and role while preserving independent partial controls", () => {
    expect(assertSessionAuthority(user, session, now)).toBe(user);
    expect(
      assertSessionAuthority(
        { ...user, tasksBlocked: true, withdrawalsBlocked: true },
        session,
        now,
      ).id,
    ).toBe(user.id);
    for (const account of [
      null,
      { ...user, status: "BANNED" as const },
      { ...user, emailVerifiedAt: null },
    ]) {
      expect(() => assertSessionAuthority(account, session, now)).toThrow();
    }
    for (const denied of [
      null,
      { ...session, userId: randomUUID() },
      { ...session, revokedAt: now },
      { ...session, expiresAt: now },
    ]) {
      expect(() => assertSessionAuthority(user, denied, now)).toThrow();
    }
    expect(() => assertSessionAuthority(user, session, now, "ADMIN")).toThrow();
  });
  it("acquires the administrator guard before sorted deduplicated user locks", async () => {
    const database = createDatabaseClient(
      "postgresql://unused:unused@localhost:5432/unused",
    );
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";
    const queryBoundary = vi
      .spyOn(database, "$queryRaw")
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: first }, { id: second }]);
    try {
      await lockIdentityUsers(database, {
        userIds: [second, first, second],
        adminPopulation: true,
      });
      const statements = queryBoundary.mock.calls.map(([query]) =>
        "sql" in query ? query : undefined,
      );
      expect(statements[0]?.sql).toContain("admin_setup_state");
      expect(statements[1]?.sql).toContain("ORDER BY id FOR UPDATE");
      expect(statements[1]?.values).toEqual([first, second]);
    } finally {
      await database.$disconnect();
    }
  });
  it("retries only recognized Prisma transaction or exact adapter conflicts", () => {
    const known = (code: string, meta?: Record<string, unknown>) =>
      new Prisma.PrismaClientKnownRequestError("private-diagnostics", {
        code,
        clientVersion: "7.9.1",
        ...(meta === undefined ? {} : { meta }),
      });
    expect(isRetryableIdentityConflict(known("P2034"))).toBe(true);
    for (const originalCode of ["40001", "40P01"])
      expect(
        isRetryableIdentityConflict(
          known("P2010", { driverAdapterError: { cause: { originalCode } } }),
        ),
      ).toBe(true);
    for (const denied of [
      known("P2002"),
      known("P2010", { code: "40001" }),
      { code: "P2034" },
      known("P2010", {
        driverAdapterError: { cause: { originalCode: "23505" } },
      }),
    ])
      expect(isRetryableIdentityConflict(denied)).toBe(false);
  });
});
