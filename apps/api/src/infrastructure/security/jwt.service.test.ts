import { randomUUID } from "node:crypto";

import { UserRole } from "@template/database";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { authConfig, jwtConfig } from "../../core/config/auth.config.js";

import {
  generateResetToken,
  generateTokenPair,
  generateVerificationToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  verifyVerificationToken,
  generateAdminInvitationToken,
  verifyAdminInvitationToken,
} from "./jwt.service.js";

describe("purpose-bound JWT utilities", () => {
  it("P02 US5 binds invitation purpose, recipient, generation and exclusive expiry", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2030-10-05T18:00:00.321Z"));
      const invitationId = randomUUID();
      const expiresAt = new Date(Date.now() + 60000);
      const token = generateAdminInvitationToken({
        invitationId,
        tokenVersion: 2,
        email: "recipient@example.com",
        expiresAt,
      });
      expect(verifyAdminInvitationToken(token)).toMatchObject({
        valid: true,
        payload: {
          invitationId,
          tokenVersion: 2,
          email: "recipient@example.com",
          type: "ADMIN_INVITATION",
        },
      });
      expect(verifyVerificationToken(token).valid).toBe(false);
      expect(verifyResetToken(token).valid).toBe(false);
      expect(
        verifyAdminInvitationToken(
          generateVerificationToken(
            "recipient@example.com",
            invitationId,
            expiresAt,
          ),
        ).valid,
      ).toBe(false);
      for (const tokenVersion of [0, -1, 1.5, 2147483648, "1"]) {
        const malformed = jwt.sign(
          {
            sub: invitationId,
            invitationId,
            tokenVersion,
            email: "recipient@example.com",
            jti: randomUUID(),
            type: "ADMIN_INVITATION",
            exp: expiresAt.getTime() / 1000,
          },
          jwtConfig.verificationSecret,
          {
            algorithm: "HS256",
            issuer: authConfig.issuer,
            audience: authConfig.audience,
          },
        );
        expect(verifyAdminInvitationToken(malformed).valid).toBe(false);
      }
      vi.setSystemTime(expiresAt.getTime() - 1);
      expect(verifyAdminInvitationToken(token).valid).toBe(true);
      vi.setSystemTime(expiresAt);
      expect(verifyAdminInvitationToken(token).valid).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([-1, 0, 1])(
    "P02 US3 reset expires exclusively at offset %i milliseconds",
    (offset) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        vi.setSystemTime(new Date("2030-10-05T18:00:00.321Z"));
        const userId = randomUUID();
        const expiresAt = new Date(Date.now() + 60_000);
        const token = generateResetToken(
          "person@example.com",
          userId,
          expiresAt,
        );
        vi.setSystemTime(expiresAt.getTime() + offset);
        const verified = verifyResetToken(token);
        expect(verified.valid).toBe(offset < 0);
        if (verified.valid) expect(verified.payload.userId).toBe(userId);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it.each([-1, 0, 1])(
    "P02 US1 preserves exact verification expiry at offset %i milliseconds",
    (offset) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        const issued = new Date("2030-10-05T18:00:00.321Z");
        vi.setSystemTime(issued);
        const expiresAt = new Date(issued.getTime() + 60_000);
        const userId = randomUUID();
        const token = generateVerificationToken(
          "person@example.com",
          userId,
          expiresAt,
        );
        vi.setSystemTime(expiresAt.getTime() + offset);
        const verified = verifyVerificationToken(token);
        expect(verified.valid).toBe(offset < 0);
        if (verified.valid) expect(verified.payload.userId).toBe(userId);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it("round-trips access and refresh claims without accepting the wrong purpose", () => {
    const userId = randomUUID();
    const tokenId = randomUUID();
    const pair = generateTokenPair({
      userId,
      tokenId,
      sessionId: randomUUID(),
      email: "person@example.com",
      role: UserRole.USER,
      rememberMe: false,
      absoluteExpiresAt: new Date(Date.now() + 3_600_000),
    });

    const access = verifyAccessToken(pair.accessToken);
    const refresh = verifyRefreshToken(pair.refreshToken);
    expect(access.valid && access.payload.userId).toBe(userId);
    expect(refresh.valid && refresh.payload.tokenId).toBe(tokenId);
    expect(verifyRefreshToken(pair.accessToken).valid).toBe(false);
    expect(verifyAccessToken(pair.refreshToken).valid).toBe(false);
  });

  it("keeps verification and reset tokens non-interchangeable", () => {
    const verification = generateVerificationToken(
      "person@example.com",
      randomUUID(),
      new Date(Date.now() + 60_000),
    );
    const reset = generateResetToken(
      "person@example.com",
      randomUUID(),
      new Date(Date.now() + 60_000),
    );

    expect(verifyVerificationToken(verification).valid).toBe(true);
    expect(verifyResetToken(reset).valid).toBe(true);
    expect(verifyResetToken(verification).valid).toBe(false);
    expect(verifyVerificationToken(reset).valid).toBe(false);
  });
});

describe("P02 US2 session-bound JWTs", () => {
  it("P02 US3 preserves exact refresh expiry when signing crosses a second boundary", () => {
    const issuedAt = Math.floor(Date.now() / 1000) * 1000;
    const expiresAt = new Date(issuedAt + 60_000);
    let calls = 0;
    const clock = vi
      .spyOn(Date, "now")
      .mockImplementation(() => issuedAt + calls++ * 1000);
    try {
      const pair = generateTokenPair({
        userId: randomUUID(),
        tokenId: randomUUID(),
        sessionId: randomUUID(),
        email: "person@example.com",
        role: "USER",
        rememberMe: false,
        absoluteExpiresAt: expiresAt,
      });
      const refresh = verifyRefreshToken(pair.refreshToken);
      expect(refresh.valid).toBe(true);
      if (refresh.valid)
        expect(refresh.payload.expiresAt * 1000).toBe(expiresAt.getTime());
    } finally {
      clock.mockRestore();
    }
  });
  const claims = {
    userId: randomUUID(),
    tokenId: randomUUID(),
    sessionId: randomUUID(),
    email: "person@example.com",
    role: UserRole.ADMIN,
    rememberMe: true,
    absoluteExpiresAt: new Date(Date.now() + 3_600_000),
  };

  it("retains stable session and user binding while credential IDs change", () => {
    const first = generateTokenPair(claims);
    const second = generateTokenPair({ ...claims, tokenId: randomUUID() });
    const access = verifyAccessToken(first.accessToken);
    const refresh = verifyRefreshToken(first.refreshToken);
    const rotated = verifyRefreshToken(second.refreshToken);
    expect(access.valid && access.payload.sessionId).toBe(claims.sessionId);
    expect(refresh.valid && refresh.payload.sessionId).toBe(claims.sessionId);
    expect(rotated.valid && rotated.payload.sessionId).toBe(claims.sessionId);
    expect(rotated.valid && rotated.payload.tokenId).not.toBe(claims.tokenId);
    expect(refresh.valid && refresh.payload.expiresAt).toBe(
      Math.floor(claims.absoluteExpiresAt.getTime() / 1000),
    );
    expect(rotated.valid && rotated.payload.expiresAt).toBe(
      refresh.valid && refresh.payload.expiresAt,
    );
  });

  it.each(["ACCESS", "REFRESH"] as const)(
    "rejects legacy or malformed %s session/user binding",
    (type) => {
      const base = {
        ...claims,
        sub: claims.userId,
        jti: claims.tokenId,
        type,
        expiresAt: Math.floor(claims.absoluteExpiresAt.getTime() / 1000),
      };
      const verify = type === "ACCESS" ? verifyAccessToken : verifyRefreshToken;
      const secret =
        type === "ACCESS" ? jwtConfig.accessSecret : jwtConfig.refreshSecret;
      for (const mutation of [
        { sessionId: undefined },
        { sessionId: "" },
        { sessionId: "invalid" },
        { userId: "invalid" },
        { sub: randomUUID() },
        { jti: randomUUID() },
        { type: "VERIFICATION" },
      ]) {
        const token = jwt.sign({ ...base, ...mutation }, secret, {
          algorithm: "HS256",
          issuer: authConfig.issuer,
          audience: authConfig.audience,
          expiresIn: 60,
        });
        expect(verify(token).valid).toBe(false);
      }
    },
  );

  it.each(["algorithm", "issuer", "audience", "expiry", "missing-expiry"])(
    "rejects invalid %s on both credential purposes",
    (failure) => {
      for (const type of ["ACCESS", "REFRESH"] as const) {
        const token = jwt.sign(
          {
            ...claims,
            sub: claims.userId,
            jti: claims.tokenId,
            type,
            expiresAt: Math.floor(claims.absoluteExpiresAt.getTime() / 1000),
          },
          type === "ACCESS" ? jwtConfig.accessSecret : jwtConfig.refreshSecret,
          {
            algorithm: failure === "algorithm" ? "HS384" : "HS256",
            issuer: failure === "issuer" ? "wrong" : authConfig.issuer,
            audience: failure === "audience" ? "wrong" : authConfig.audience,
            ...(failure === "missing-expiry"
              ? {}
              : { expiresIn: failure === "expiry" ? -60 : 60 }),
          },
        );
        expect(
          (type === "ACCESS" ? verifyAccessToken : verifyRefreshToken)(token)
            .valid,
        ).toBe(false);
      }
    },
  );
});
