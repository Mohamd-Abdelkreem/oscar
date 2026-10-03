import { randomUUID } from "node:crypto";

import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { UserRole } from "@template/database";

import { authConfig, jwtConfig } from "../../core/config/auth.config.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  ResetTokenPayload,
  TokenPair,
  VerifiedToken,
  VerificationTokenPayload,
  AdminInvitationTokenPayload,
} from "../../modules/auth/types/auth.types.js";

const { JsonWebTokenError, TokenExpiredError } = jwt;

// Token claims are validated explicitly after signature verification.

const signOptions = (expiresIn: number): SignOptions => ({
  algorithm: "HS256",
  expiresIn,
  issuer: authConfig.issuer,
  audience: authConfig.audience,
});

const verifyPayload = (
  token: string,
  secret: string,
  label: string,
): VerifiedToken<JwtPayload> => {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: authConfig.issuer,
      audience: authConfig.audience,
      clockTolerance: authConfig.clockToleranceSeconds,
    });
    if (typeof decoded === "string") {
      return { valid: false, error: `Invalid ${label.toLowerCase()} token` };
    }
    return { valid: true, payload: decoded };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return { valid: false, error: `${label} token has expired` };
    }
    if (error instanceof JsonWebTokenError) {
      return { valid: false, error: `Invalid ${label.toLowerCase()} token` };
    }
    return { valid: false, error: "Token verification failed" };
  }
};

const readString = (payload: JwtPayload, key: string): string | undefined => {
  const value: unknown = payload[key];
  return typeof value === "string" ? value : undefined;
};

const isUserRole = (value: unknown): value is UserRole =>
  value === UserRole.USER || value === UserRole.ADMIN;

const isUuid = (value: string | undefined): value is string =>
  value !== undefined &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
    value,
  );
const hasLiveExpiry = (payload: JwtPayload): boolean =>
  typeof payload.exp === "number" &&
  Number.isFinite(payload.exp) &&
  Date.now() < payload.exp * 1000;

export const generateAdminInvitationToken = (
  input: Readonly<{
    invitationId: string;
    tokenVersion: number;
    email: string;
    expiresAt: Date;
  }>,
): string =>
  jwt.sign(
    {
      sub: input.invitationId,
      jti: randomUUID(),
      invitationId: input.invitationId,
      tokenVersion: input.tokenVersion,
      email: input.email,
      type: "ADMIN_INVITATION",
      exp: input.expiresAt.getTime() / 1000,
    },
    jwtConfig.verificationSecret,
    {
      algorithm: "HS256",
      issuer: authConfig.issuer,
      audience: authConfig.audience,
    },
  );

export const verifyAdminInvitationToken = (
  token: string,
): VerifiedToken<AdminInvitationTokenPayload> => {
  const verified = verifyPayload(
    token,
    jwtConfig.verificationSecret,
    "Invitation",
  );
  if (!verified.valid) return verified;
  const invitationId = readString(verified.payload, "invitationId");
  const email = readString(verified.payload, "email");
  const tokenVersion: unknown = verified.payload["tokenVersion"];
  if (
    !isUuid(invitationId) ||
    !isUuid(verified.payload.jti) ||
    email === undefined ||
    email !== email.trim().toLowerCase() ||
    typeof tokenVersion !== "number" ||
    !Number.isInteger(tokenVersion) ||
    tokenVersion < 1 ||
    tokenVersion > 2147483647 ||
    verified.payload.sub !== invitationId ||
    verified.payload["type"] !== "ADMIN_INVITATION" ||
    !hasLiveExpiry(verified.payload)
  )
    return { valid: false, error: "Invalid invitation token claims" };
  return {
    valid: true,
    payload: { invitationId, tokenVersion, email, type: "ADMIN_INVITATION" },
  };
};

export const generateTokenPair = (input: {
  userId: string;
  tokenId: string;
  sessionId: string;
  role: UserRole;
  email: string;
  rememberMe: boolean;
  absoluteExpiresAt: Date;
}): TokenPair => {
  const accessToken = jwt.sign(
    {
      sub: input.userId,
      jti: input.tokenId,
      userId: input.userId,
      tokenId: input.tokenId,
      sessionId: input.sessionId,
      role: input.role,
      email: input.email,
      type: "ACCESS",
    },
    jwtConfig.accessSecret,
    signOptions(authConfig.accessTokenTtlSeconds),
  );
  const refreshExpiresAt = Math.floor(
    input.absoluteExpiresAt.getTime() / 1_000,
  );
  const refreshToken = jwt.sign(
    {
      sub: input.userId,
      jti: input.tokenId,
      userId: input.userId,
      tokenId: input.tokenId,
      sessionId: input.sessionId,
      rememberMe: input.rememberMe,
      expiresAt: refreshExpiresAt,
      exp: refreshExpiresAt,
      type: "REFRESH",
    },
    jwtConfig.refreshSecret,
    {
      algorithm: "HS256",
      issuer: authConfig.issuer,
      audience: authConfig.audience,
    },
  );
  return { accessToken, refreshToken };
};

export const generateVerificationToken = (
  email: string,
  userId: string,
  expiresAt: Date,
): string =>
  jwt.sign(
    {
      sub: userId,
      jti: randomUUID(),
      userId,
      email,
      type: "VERIFICATION",
      exp: expiresAt.getTime() / 1000,
    },
    jwtConfig.verificationSecret,
    {
      algorithm: "HS256",
      issuer: authConfig.issuer,
      audience: authConfig.audience,
    },
  );

export const generateResetToken = (
  email: string,
  userId: string,
  expiresAt: Date,
): string =>
  jwt.sign(
    {
      sub: userId,
      userId,
      jti: randomUUID(),
      email,
      type: "PASSWORD_RESET",
      exp: expiresAt.getTime() / 1000,
    },
    jwtConfig.resetSecret,
    {
      algorithm: "HS256",
      issuer: authConfig.issuer,
      audience: authConfig.audience,
    },
  );

export const verifyAccessToken = (
  token: string,
): VerifiedToken<AccessTokenPayload> => {
  const result = verifyPayload(token, jwtConfig.accessSecret, "Access");
  if (!result.valid) return result;
  const userId = readString(result.payload, "userId");
  const tokenId = readString(result.payload, "tokenId");
  const sessionId = readString(result.payload, "sessionId");
  const email = readString(result.payload, "email");
  const type = readString(result.payload, "type");
  const role: unknown = result.payload["role"];
  if (
    !isUuid(userId) ||
    !isUuid(tokenId) ||
    !isUuid(sessionId) ||
    !hasLiveExpiry(result.payload) ||
    email === undefined ||
    type !== "ACCESS" ||
    result.payload.sub !== userId ||
    result.payload.jti !== tokenId ||
    !isUserRole(role)
  ) {
    return { valid: false, error: "Invalid access token claims" };
  }
  return {
    valid: true,
    payload: {
      sub: userId,
      jti: tokenId,
      userId,
      tokenId,
      sessionId,
      email,
      role,
      type: "ACCESS",
    },
  };
};

export const verifyRefreshToken = (
  token: string,
): VerifiedToken<RefreshTokenPayload> => {
  const result = verifyPayload(token, jwtConfig.refreshSecret, "Refresh");
  if (!result.valid) return result;
  const userId = readString(result.payload, "userId");
  const tokenId = readString(result.payload, "tokenId");
  const sessionId = readString(result.payload, "sessionId");
  const type = readString(result.payload, "type");
  const rememberMe: unknown = result.payload["rememberMe"];
  const expiresAt: unknown = result.payload["expiresAt"];
  if (
    !isUuid(userId) ||
    !isUuid(tokenId) ||
    !isUuid(sessionId) ||
    !hasLiveExpiry(result.payload) ||
    type !== "REFRESH" ||
    result.payload.sub !== userId ||
    result.payload.jti !== tokenId ||
    typeof rememberMe !== "boolean" ||
    typeof expiresAt !== "number" ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= 0 ||
    expiresAt !== result.payload.exp
  ) {
    return { valid: false, error: "Invalid refresh token claims" };
  }
  return {
    valid: true,
    payload: {
      sub: userId,
      jti: tokenId,
      userId,
      tokenId,
      sessionId,
      rememberMe,
      expiresAt,
      type: "REFRESH",
    },
  };
};

export const verifyResetToken = (
  token: string,
): VerifiedToken<ResetTokenPayload> => {
  const result = verifyPayload(token, jwtConfig.resetSecret, "Reset");
  if (!result.valid) return result;
  const email = readString(result.payload, "email");
  const type = readString(result.payload, "type");
  const userId = readString(result.payload, "userId");
  if (
    !isUuid(userId) ||
    email === undefined ||
    email !== email.trim().toLowerCase() ||
    type !== "PASSWORD_RESET" ||
    result.payload.sub !== userId ||
    !isUuid(result.payload.jti) ||
    !hasLiveExpiry(result.payload)
  ) {
    return {
      valid: false,
      error: "Invalid reset token claims",
    };
  }
  return {
    valid: true,
    payload: {
      sub: userId,
      userId,
      jti: result.payload.jti,
      email,
      type: "PASSWORD_RESET",
    },
  };
};

export const verifyVerificationToken = (
  token: string,
): VerifiedToken<VerificationTokenPayload> => {
  const verified = verifyPayload(
    token,
    jwtConfig.verificationSecret,
    "Verification",
  );
  if (!verified.valid) return verified;
  const userId = readString(verified.payload, "userId");
  const email = readString(verified.payload, "email");
  const jti = readString(verified.payload, "jti");
  if (
    userId === undefined ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      userId,
    ) ||
    email === undefined ||
    email !== email.trim().toLowerCase() ||
    jti === undefined ||
    jti.length === 0 ||
    verified.payload.sub !== userId ||
    verified.payload["type"] !== "VERIFICATION" ||
    typeof verified.payload.exp !== "number" ||
    Date.now() >= verified.payload.exp * 1000
  )
    return { valid: false, error: "Invalid verification token claims" };
  return {
    valid: true,
    payload: { sub: userId, jti, userId, email, type: "VERIFICATION" },
  };
};
