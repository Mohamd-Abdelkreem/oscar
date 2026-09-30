import argon2 from "argon2";
import { describe, expect, it } from "vitest";

import {
  buildSeedUpsert,
  parseSeedGroup,
  SeedConfigurationError,
} from "../src/seed-config.js";

const complete = {
  SEED_ADMIN_EMAIL: "  Admin@Example.COM ",
  SEED_ADMIN_NAME: " Seed Administrator ",
  SEED_ADMIN_PASSWORD: "CorrectHorseBatteryStaple!42",
};

describe("optional seed groups", () => {
  it("skips when all three values are absent", async () => {
    await expect(parseSeedGroup("ADMIN", {}, "development")).resolves.toEqual({
      kind: "disabled",
      group: "ADMIN",
    });
  });

  it("fails clearly when any group is partial", async () => {
    await expect(
      parseSeedGroup(
        "USER",
        { SEED_USER_EMAIL: "user@example.com" },
        "development",
      ),
    ).rejects.toBeInstanceOf(SeedConfigurationError);
  });

  it("refuses configured credentials in production", async () => {
    await expect(
      parseSeedGroup("ADMIN", complete, "production"),
    ).rejects.toThrow(/production/iu);
  });

  it("normalizes email/name, enforces policy, and hashes with Argon2id", async () => {
    const decision = await parseSeedGroup("ADMIN", complete, "development");
    expect(decision.kind).toBe("enabled");
    if (decision.kind !== "enabled") return;
    expect(decision.email).toBe("admin@example.com");
    expect(decision.fullName).toBe("Seed Administrator");
    expect(decision.role).toBe("ADMIN");
    expect(decision.passwordHash).toMatch(/^\$argon2id\$/u);
    await expect(
      argon2.verify(decision.passwordHash, "CorrectHorseBatteryStaple!42"),
    ).resolves.toBe(true);
    expect(JSON.stringify(decision)).not.toContain(
      "CorrectHorseBatteryStaple!42",
    );
  });

  it("rejects passwords outside the configured policy", async () => {
    await expect(
      parseSeedGroup(
        "ADMIN",
        { ...complete, SEED_ADMIN_PASSWORD: "too-short" },
        "development",
      ),
    ).rejects.toThrow(/between 15 and 128/iu);
  });

  it("upserts both roles into active verified state and clears stale tokens", async () => {
    const decision = await parseSeedGroup("ADMIN", complete, "development");
    if (decision.kind !== "enabled") throw new Error("Expected enabled seed.");
    const now = new Date("2026-08-18T00:00:00.000Z");
    const args = buildSeedUpsert(decision, now);
    expect(args.update).toMatchObject({
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: now,
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    });
    expect(args.create).toMatchObject({
      email: "admin@example.com",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: now,
    });
  });

  it("supports the generic USER group without defaults", async () => {
    const decision = await parseSeedGroup(
      "USER",
      {
        SEED_USER_EMAIL: "user@example.com",
        SEED_USER_NAME: "Seed User",
        SEED_USER_PASSWORD: "AnotherSecurePassword!42",
      },
      "test",
    );
    expect(decision).toMatchObject({
      kind: "enabled",
      group: "USER",
      email: "user@example.com",
      role: "USER",
    });
  });
});
