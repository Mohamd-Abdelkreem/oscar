import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

import { authRouteLimits } from "../../core/config/auth-rate-limit.config.js";
import {
  createKeyedAuthRateLimiter,
  createSourceRateLimiter,
} from "../../middlewares/rate-limit.middleware.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { AUTH_CONSTANTS } from "./auth.constants.js";

const validatedString = (
  request: Request,
  target: "body" | "query",
  field: string,
): string => {
  const value = request.validated?.[target];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" ? fieldValue : "";
};

const sourceKey = (request: Request): string =>
  ipKeyGenerator(request.ip ?? "unknown");
const emailKey = (request: Request): string =>
  sha256(validatedString(request, "body", "email").trim().toLowerCase());
const tokenKey = (request: Request): string =>
  sha256(validatedString(request, "query", "token"));
const refreshToken = (request: Request): string => {
  const cookies = request.cookies as Record<string, string> | undefined;
  return cookies?.[AUTH_CONSTANTS.refreshTokenCookieName] ?? "";
};
const refreshKey = (request: Request): string => {
  const token = refreshToken(request);
  return token.length === 0
    ? sourceKey(request)
    : sha256(`${sourceKey(request)}:${sha256(token)}`);
};
const loginKey = (request: Request): string =>
  sha256(
    `${sourceKey(request)}:${validatedString(request, "body", "email").trim().toLowerCase()}`,
  );
const userKey = (request: Request): string => sha256(request.user?.id ?? "");
const logoutKey = (request: Request): string =>
  sha256(`${request.user?.id ?? ""}:${sha256(refreshToken(request))}`);

export const authRateLimiters = Object.freeze({
  registerSource: createSourceRateLimiter(authRouteLimits.registerSource),
  verifySource: createSourceRateLimiter(authRouteLimits.verifySource),
  verifyToken: createKeyedAuthRateLimiter(
    authRouteLimits.verifyToken,
    tokenKey,
  ),
  resendSource: createSourceRateLimiter(authRouteLimits.resendSource),
  resendAccount: createKeyedAuthRateLimiter(
    authRouteLimits.resendAccount,
    emailKey,
  ),
  loginSource: createSourceRateLimiter(authRouteLimits.loginSource),
  loginAccountSource: createKeyedAuthRateLimiter(
    authRouteLimits.loginAccountSource,
    loginKey,
  ),
  refreshFamilySource: createKeyedAuthRateLimiter(
    authRouteLimits.refreshFamilySource,
    refreshKey,
  ),
  forgotSource: createSourceRateLimiter(authRouteLimits.forgotSource),
  forgotAccount: createKeyedAuthRateLimiter(
    authRouteLimits.forgotAccount,
    emailKey,
  ),
  resetSource: createSourceRateLimiter(authRouteLimits.resetSource),
  resetToken: createKeyedAuthRateLimiter(authRouteLimits.resetToken, tokenKey),
  passwordChangeUser: createKeyedAuthRateLimiter(
    authRouteLimits.passwordChangeUser,
    userKey,
  ),
  logoutSession: createKeyedAuthRateLimiter(
    authRouteLimits.logoutSession,
    logoutKey,
  ),
  logoutAllUser: createKeyedAuthRateLimiter(
    authRouteLimits.logoutAllUser,
    userKey,
  ),
});
