import { createDatabaseClient, UserStatus } from "@template/database";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";
import { UnauthorizedException } from "../../core/errors/unauthorized.error.js";
import type { EmailDelivery } from "../../infrastructure/email/email-delivery.js";
import { EmailService } from "../../infrastructure/email/email.service.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { AuthService } from "./auth.service.js";
import {
  createIdentityFixture,
  withIdentityDatabase,
} from "./testing/identity-fixtures.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined) {
  throw new Error("The Testcontainers DATABASE_URL was not provided.");
}

const database = createDatabaseClient(databaseUrl);
const deliveredHtml: string[] = [];
const delivery: EmailDelivery = {
  provider: "smtp",
  send: (message) => {
    deliveredHtml.push(message.html);
    return Promise.resolve({ providerMessageId: "test-message" });
  },
};
const emailService = new EmailService(
  delivery,
  "no-reply@example.com",
  "Template",
  "",
  "http://localhost:3000",
);
const service = new AuthService(database, emailService);
const ownedUsers = {
  email: {
    in: [
      "user@example.com",
      "retry@example.com",
      "concurrent@example.com",
      "resend@example.com",
      "suspended@example.com",
    ],
  },
};
const ownedRefreshTokens = { user: ownedUsers };

const tokenFromLastEmail = (): string => {
  const html = deliveredHtml.at(-1);
  const match = html?.match(/token=([^"&<]+)/u);
  if (match?.[1] === undefined) {
    throw new Error("Expected a token in the captured email.");
  }
  return decodeURIComponent(match[1]);
};

describe("P02 foundations isolated identity fixtures", () => {
  it("owns separate fresh singleton histories without resetting protected state", async () => {
    await withIdentityDatabase(async (isolated) => {
      const employee = await createIdentityFixture(isolated);
      const admin = await createIdentityFixture(isolated, { role: "ADMIN" });
      expect(employee.wallet).toMatchObject({
        availableNonReferralUnits: 0n,
        availableReferralUnits: 0n,
      });
      expect(admin.wallet).toBeNull();
      expect(employee.session.userId).toBe(employee.user.id);
      await isolated.adminSetupState.update({
        where: { id: 1 },
        data: {
          firstAdminUserId: admin.user.id,
          completedAt: new Date(),
          completionSource: "BOOTSTRAP",
        },
      });
    });
    await withIdentityDatabase(async (isolated) => {
      expect(
        await isolated.adminSetupState.findUnique({ where: { id: 1 } }),
      ).toMatchObject({ completedAt: null, firstAdminUserId: null });
      expect(await isolated.user.count()).toBe(0);
    });
  });
  it("exposes the migrated P01 frontier for historical fixtures", async () => {
    await withIdentityDatabase(async (isolated) => {
      const rows = await isolated.$queryRaw<
        { present: boolean }[]
      >`SELECT to_regclass('wallets') IS NOT NULL AND to_regclass('auth_sessions') IS NULL AS present`;
      expect(rows).toEqual([{ present: true }]);
    }, "P01");
  });
});

describe("AuthService with PostgreSQL", () => {
  beforeEach(async () => {
    deliveredHtml.length = 0;
    await database.refreshToken.deleteMany({ where: ownedRefreshTokens });
    await database.authSession.deleteMany({ where: { user: ownedUsers } });
    await database.wallet.deleteMany({
      where: {
        owner: ownedUsers,
        availableNonReferralUnits: 0n,
        reservedNonReferralUnits: 0n,
        availableReferralUnits: 0n,
        reservedReferralUnits: 0n,
        operations: { none: {} },
        allocations: { none: {} },
      },
    });
    await database.user.deleteMany({ where: ownedUsers });
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("registers, verifies, logs in, and atomically rotates one-time refresh tokens", async () => {
    const registered = await service.register({
      fullName: "Template User",
      email: "USER@example.com",
      phone: null,
      password: "initial-secure-password",
    });
    expect(registered.user).not.toHaveProperty("passwordHash");
    expect(registered.user.status).toBe("PENDING_VERIFICATION");

    const verificationToken = tokenFromLastEmail();
    const storedPending = await database.user.findUniqueOrThrow({
      where: { email: "user@example.com" },
    });
    expect(storedPending.verificationTokenHash).toBe(sha256(verificationToken));
    expect(storedPending.verificationTokenHash).not.toBe(verificationToken);

    const verified = await service.verifyEmail(verificationToken);
    expect(verified.user.status).toBe("ACTIVE");
    expect(verified.user.emailVerifiedAt).not.toBeNull();
    await expect(service.verifyEmail(verificationToken)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const login = await service.login({
      email: "user@example.com",
      password: "initial-secure-password",
      rememberMe: false,
    });
    const beforeRotation = await database.refreshToken.findMany({
      where: ownedRefreshTokens,
    });
    expect(beforeRotation).toHaveLength(1);
    expect(beforeRotation[0]?.tokenHash).toBe(
      sha256(login.tokens.refreshToken),
    );
    expect(beforeRotation[0]?.tokenHash).not.toBe(login.tokens.refreshToken);

    const rotated = await service.refresh(login.tokens.refreshToken);
    const afterRotation = await database.refreshToken.findMany({
      where: ownedRefreshTokens,
    });
    expect(afterRotation).toHaveLength(1);
    expect(afterRotation[0]?.tokenHash).toBe(
      sha256(rotated.tokens.refreshToken),
    );
    await expect(
      service.refresh(login.tokens.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("P02 US1 retains the complete pending registration after delivery failure", async () => {
    const send = vi
      .fn<EmailDelivery["send"]>()
      .mockRejectedValueOnce(new Error("delivery unavailable"))
      .mockResolvedValueOnce({ providerMessageId: "retry-message" });
    const retryService = new AuthService(
      database,
      new EmailService(
        { provider: "smtp", send },
        "no-reply@example.com",
        "Template",
        "",
        "http://localhost:3000",
      ),
    );
    const registration = {
      fullName: "Retry User",
      email: "retry@example.com",
      phone: null,
      password: "initial-secure-password",
    };

    await expect(retryService.register(registration)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(
      database.user.findUnique({ where: { email: registration.email } }),
    ).resolves.toMatchObject({ status: "PENDING_VERIFICATION" });
    expect(
      await database.wallet.count({
        where: { owner: { email: registration.email } },
      }),
    ).toBe(1);
    await expect(retryService.register(registration)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("P02 US1 atomically consumes one verification token under concurrent requests", async () => {
    await service.register({
      fullName: "Concurrent Verification User",
      email: "concurrent@example.com",
      phone: null,
      password: "initial-secure-password",
    });
    const token = tokenFromLastEmail();

    const outcomes = await Promise.allSettled([
      service.verifyEmail(token),
      service.verifyEmail(token),
    ]);

    expect(outcomes.map(({ status }) => status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = outcomes.find(({ status }) => status === "rejected");
    if (rejected?.status !== "rejected") {
      throw new Error("Expected one rejected verification attempt.");
    }
    expect(rejected.reason).toBeInstanceOf(BadRequestException);
    const concurrentUser = await database.user.findUniqueOrThrow({
      where: { email: "concurrent@example.com" },
    });
    expect(concurrentUser).toMatchObject({
      status: "ACTIVE",
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
    });
    expect(concurrentUser.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("P02 US1 replaces an expired verification token when verification is resent", async () => {
    await service.register({
      fullName: "Resend Verification User",
      email: "resend@example.com",
      phone: null,
      password: "initial-secure-password",
    });
    const oldToken = tokenFromLastEmail();
    await database.user.update({
      where: { email: "resend@example.com" },
      data: { verificationTokenExpiresAt: new Date(0) },
    });

    await service.resendVerification({ email: "resend@example.com" });
    await vi.waitFor(() => {
      expect(deliveredHtml).toHaveLength(2);
    });
    const newToken = tokenFromLastEmail();

    expect(newToken).not.toBe(oldToken);
    await expect(service.verifyEmail(oldToken)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.verifyEmail(newToken)).resolves.toMatchObject({
      user: { status: UserStatus.ACTIVE },
    });
  });

  it("P02 US1 does not activate a suspended user that still has verification credentials", async () => {
    await service.register({
      fullName: "Suspended Verification User",
      email: "suspended@example.com",
      phone: null,
      password: "initial-secure-password",
    });
    const token = tokenFromLastEmail();
    await database.user.update({
      where: { email: "suspended@example.com" },
      data: {
        status: UserStatus.SUSPENDED,
        emailVerifiedAt: new Date(),
      },
    });

    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const suspendedUser = await database.user.findUniqueOrThrow({
      where: { email: "suspended@example.com" },
    });
    expect(suspendedUser).toMatchObject({
      status: UserStatus.SUSPENDED,
    });
    expect(suspendedUser.verificationTokenHash).toEqual(expect.any(String));
    expect(suspendedUser.verificationTokenExpiresAt).toBeInstanceOf(Date);
  });

  it("uses neutral recovery, consumes reset tokens once, and revokes sessions", async () => {
    await service.register({
      fullName: "Template User",
      email: "user@example.com",
      phone: null,
      password: "initial-secure-password",
    });
    await service.verifyEmail(tokenFromLastEmail());
    const login = await service.login({
      email: "user@example.com",
      password: "initial-secure-password",
      rememberMe: true,
    });

    const unknown = await service.forgotPassword({
      email: "unknown@example.com",
    });
    const known = await service.forgotPassword({ email: "user@example.com" });
    expect(unknown).toEqual(known);
    const resetToken = tokenFromLastEmail();
    await expect(service.validateResetToken(resetToken)).resolves.toEqual({
      valid: true,
    });
    await service.resetPassword(
      {
        newPassword: "replacement-secure-password",
        passwordConfirmation: "replacement-secure-password",
      },
      resetToken,
    );
    expect(
      await database.authSession.count({
        where: { userId: login.user.id, revokedAt: null },
      }),
    ).toBe(0);
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: login.user.id } }))
        .resetTokenExpiresAt,
    ).toBeNull();

    await expect(service.validateResetToken(resetToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      service.refresh(login.tokens.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({
        email: "user@example.com",
        password: "initial-secure-password",
        rememberMe: false,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({
        email: "user@example.com",
        password: "replacement-secure-password",
        rememberMe: false,
      }),
    ).resolves.toMatchObject({ user: { status: "ACTIVE" } });
  });
});
