import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { createDatabaseClient } from "@template/database";
import { afterAll, describe, expect, it } from "vitest";

import { authConfig, jwtConfig } from "../../core/config/auth.config.js";
import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { UnauthorizedException } from "../../core/errors/unauthorized.error.js";
import { EmailService } from "../../infrastructure/email/email.service.js";
import { generateResetToken } from "../../infrastructure/security/index.js";
import { AuthService } from "./auth.service.js";

const database = createDatabaseClient(
  process.env["DATABASE_URL"] ?? "postgresql://test:test@127.0.0.1:1/unused",
);
const service = new AuthService(
  database,
  new EmailService({
    provider: "console",
    send: () => Promise.reject(new Error("Unexpected mail boundary.")),
  }),
);
afterAll(async () => {
  await database.$disconnect();
});

describe("P02 US3 reset credential boundary", () => {
  it.each([
    "malformed",
    "legacy email-only",
    "wrong purpose",
    "mismatched subject",
    "expired despite tolerance",
  ])("rejects %s before database access", async (scenario) => {
    const userId = randomUUID();
    const email = "person@example.com";
    const claims = {
      sub: userId,
      userId,
      email,
      jti: randomUUID(),
      type: "PASSWORD_RESET",
    };
    const token =
      scenario === "malformed"
        ? "malformed"
        : jwt.sign(
            {
              ...claims,
              sub:
                scenario === "legacy email-only"
                  ? email
                  : scenario === "mismatched subject"
                    ? randomUUID()
                    : userId,
              userId: scenario === "legacy email-only" ? undefined : userId,
              type: scenario === "wrong purpose" ? "VERIFICATION" : claims.type,
            },
            jwtConfig.resetSecret,
            {
              algorithm: "HS256",
              issuer: authConfig.issuer,
              audience: authConfig.audience,
              expiresIn: scenario === "expired despite tolerance" ? -1 : 60,
            },
          );
    await expect(service.validateResetToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      service.resetPassword(
        {
          newPassword: "test-only-replacement-password",
          passwordConfirmation: "test-only-replacement-password",
        },
        token,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe("P02 US1 credential boundary", () => {
  it.each([
    "malformed",
    "wrong purpose",
    "legacy email-only",
    "mismatched subject",
    "expired despite tolerance",
  ])("rejects %s before database access", async (scenario) => {
    const userId = randomUUID();
    const claims = {
      sub: userId,
      userId,
      email: "user@example.com",
      jti: randomUUID(),
      type: "VERIFICATION",
    };
    let token: string;
    if (scenario === "malformed") token = "malformed";
    else if (scenario === "wrong purpose")
      token = generateResetToken(
        claims.email,
        userId,
        new Date(Date.now() + 60_000),
      );
    else
      token = jwt.sign(
        scenario === "legacy email-only"
          ? {
              sub: claims.email,
              email: claims.email,
              jti: claims.jti,
              type: claims.type,
            }
          : {
              ...claims,
              sub: scenario === "mismatched subject" ? randomUUID() : userId,
            },
        jwtConfig.verificationSecret,
        {
          algorithm: "HS256",
          issuer: authConfig.issuer,
          audience: authConfig.audience,
          expiresIn: scenario === "expired despite tolerance" ? -1 : 60,
        },
      );
    await expect(
      service.validateVerificationToken(token),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
