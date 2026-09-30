import { randomUUID } from "node:crypto";

import { UserRole } from "@template/database";
import { describe, expect, it } from "vitest";

import {
  generateResetToken,
  generateTokenPair,
  generateVerificationToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  verifyVerificationToken,
} from "./jwt.service.js";

describe("purpose-bound JWT utilities", () => {
  it("round-trips access and refresh claims without accepting the wrong purpose", () => {
    const userId = randomUUID();
    const tokenId = randomUUID();
    const pair = generateTokenPair({
      userId,
      tokenId,
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
    const verification = generateVerificationToken("person@example.com");
    const reset = generateResetToken("person@example.com");

    expect(verifyVerificationToken(verification).valid).toBe(true);
    expect(verifyResetToken(reset).valid).toBe(true);
    expect(verifyResetToken(verification).valid).toBe(false);
    expect(verifyVerificationToken(reset).valid).toBe(false);
  });
});
