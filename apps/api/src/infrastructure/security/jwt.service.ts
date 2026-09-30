import { randomUUID } from "node:crypto";

import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { UserRole } from "@template/database";

import { authConfig, jwtConfig } from "../../core/config/auth.config.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TemporaryTokenPayload,
  TokenPair,
  VerifiedToken,
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

export const generateTokenPair = (input: {
  userId: string;
  tokenId: string;
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
      rememberMe: input.rememberMe,
      expiresAt: refreshExpiresAt,
      type: "REFRESH",
    },
    jwtConfig.refreshSecret,
    signOptions(Math.max(1, refreshExpiresAt - Math.floor(Date.now() / 1_000))),
  );
  return { accessToken, refreshToken };
};

const generateTemporaryToken = (
  email: string,
  type: TemporaryTokenPayload["type"],
  secret: string,
  expiresIn: number,
): string =>
  jwt.sign(
    { sub: email, jti: randomUUID(), email, type },
    secret,
    signOptions(expiresIn),
  );

export const generateVerificationToken = (email: string): string =>
  generateTemporaryToken(
    email,
    "VERIFICATION",
    jwtConfig.verificationSecret,
    authConfig.verifyTokenTtlSeconds,
  );

export const generateResetToken = (email: string): string =>
  generateTemporaryToken(
    email,
    "PASSWORD_RESET",
    jwtConfig.resetSecret,
    authConfig.resetTokenTtlSeconds,
  );

export const verifyAccessToken = (
  token: string,
): VerifiedToken<AccessTokenPayload> => {
  const result = verifyPayload(token, jwtConfig.accessSecret, "Access");
  if (!result.valid) return result;
  const userId = readString(result.payload, "userId");
  const tokenId = readString(result.payload, "tokenId");
  const email = readString(result.payload, "email");
  const type = readString(result.payload, "type");
  const role: unknown = result.payload["role"];
  if (
    userId === undefined ||
    tokenId === undefined ||
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
  const type = readString(result.payload, "type");
  const rememberMe: unknown = result.payload["rememberMe"];
  const expiresAt: unknown = result.payload["expiresAt"];
  if (
    userId === undefined ||
    tokenId === undefined ||
    type !== "REFRESH" ||
    result.payload.sub !== userId ||
    result.payload.jti !== tokenId ||
    typeof rememberMe !== "boolean" ||
    typeof expiresAt !== "number" ||
    !Number.isInteger(expiresAt) ||
    expiresAt <= 0
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
      rememberMe,
      expiresAt,
      type: "REFRESH",
    },
  };
};

const verifyTemporaryToken = (
  token: string,
  expectedType: TemporaryTokenPayload["type"],
  secret: string,
  label: string,
): VerifiedToken<TemporaryTokenPayload> => {
  const result = verifyPayload(token, secret, label);
  if (!result.valid) return result;
  const email = readString(result.payload, "email");
  const type = readString(result.payload, "type");
  if (
    email === undefined ||
    type !== expectedType ||
    result.payload.sub !== email ||
    typeof result.payload.jti !== "string"
  ) {
    return {
      valid: false,
      error: `Invalid ${label.toLowerCase()} token claims`,
    };
  }
  return {
    valid: true,
    payload: {
      sub: email,
      jti: result.payload.jti,
      email,
      type: expectedType,
    },
  };
};

export const verifyVerificationToken = (
  token: string,
): VerifiedToken<TemporaryTokenPayload> =>
  verifyTemporaryToken(
    token,
    "VERIFICATION",
    jwtConfig.verificationSecret,
    "Verification",
  );

export const verifyResetToken = (
  token: string,
): VerifiedToken<TemporaryTokenPayload> =>
  verifyTemporaryToken(token, "PASSWORD_RESET", jwtConfig.resetSecret, "Reset");
