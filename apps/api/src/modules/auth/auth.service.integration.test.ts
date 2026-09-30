import { createDatabaseClient, UserStatus } from "@template/database";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { ForbiddenException } from "../../core/errors/forbidden.error.js";
import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";
import { UnauthorizedException } from "../../core/errors/unauthorized.error.js";
import type { EmailDelivery } from "../../infrastructure/email/email-delivery.js";
import { EmailService } from "../../infrastructure/email/email.service.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { AuthService } from "./auth.service.js";

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

const tokenFromLastEmail = (): string => {
  const html = deliveredHtml.at(-1);
  const match = html?.match(/token=([^"&<]+)/u);
  if (match?.[1] === undefined) {
    throw new Error("Expected a token in the captured email.");
  }
  return decodeURIComponent(match[1]);
};

describe("AuthService with PostgreSQL", () => {
  beforeEach(async () => {
    deliveredHtml.length = 0;
    await database.refreshToken.deleteMany();
    await database.user.deleteMany();
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
    const beforeRotation = await database.refreshToken.findMany();
    expect(beforeRotation).toHaveLength(1);
    expect(beforeRotation[0]?.tokenHash).toBe(
      sha256(login.tokens.refreshToken),
    );
    expect(beforeRotation[0]?.tokenHash).not.toBe(login.tokens.refreshToken);

    const rotated = await service.refresh(login.tokens.refreshToken);
    const afterRotation = await database.refreshToken.findMany();
    expect(afterRotation).toHaveLength(1);
    expect(afterRotation[0]?.tokenHash).toBe(
      sha256(rotated.tokens.refreshToken),
    );
    await expect(
      service.refresh(login.tokens.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("removes a pending user after delivery failure so registration can be retried", async () => {
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
    ).resolves.toBeNull();
    await expect(retryService.register(registration)).resolves.toMatchObject({
      user: { email: registration.email, status: "PENDING_VERIFICATION" },
    });
  });

  it("atomically consumes one verification token under concurrent requests", async () => {
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

  it("replaces an expired verification token when verification is resent", async () => {
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

  it("does not activate a suspended user that still has verification credentials", async () => {
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
      ForbiddenException,
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
