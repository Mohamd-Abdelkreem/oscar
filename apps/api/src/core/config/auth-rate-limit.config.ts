import { getEnvVarAsInteger } from "./env.js";

export type AuthRouteLimit = Readonly<{
  name: string;
  max: number;
  windowMs: number;
}>;

const oneHourMs = 60 * 60 * 1_000;
const fifteenMinutesMs = 15 * 60 * 1_000;

const limit = (
  name: string,
  environmentKey: string,
  fallback: number,
  windowMs: number,
  maximum = 1_000,
): AuthRouteLimit => ({
  name,
  max: getEnvVarAsInteger(environmentKey, fallback, 1, maximum),
  windowMs,
});

export const authRouteLimits = Object.freeze({
  registerSource: limit(
    "REGISTER_SOURCE",
    "AUTH_LIMIT_REGISTER_PER_HOUR",
    5,
    oneHourMs,
  ),
  verifySource: limit(
    "VERIFY_SOURCE",
    "AUTH_LIMIT_VERIFY_PER_15_MIN",
    20,
    fifteenMinutesMs,
  ),
  verifyToken: limit(
    "VERIFY_TOKEN",
    "AUTH_LIMIT_VERIFY_TOKEN_MAX_ATTEMPTS",
    5,
    fifteenMinutesMs,
    10,
  ),
  resendSource: limit(
    "RESEND_SOURCE",
    "AUTH_LIMIT_RESEND_PER_HOUR_SOURCE",
    20,
    oneHourMs,
  ),
  resendAccount: limit(
    "RESEND_ACCOUNT",
    "AUTH_LIMIT_RESEND_PER_HOUR_ACCOUNT",
    5,
    oneHourMs,
  ),
  loginSource: limit(
    "LOGIN_SOURCE",
    "AUTH_LIMIT_LOGIN_PER_15_MIN",
    20,
    fifteenMinutesMs,
  ),
  loginAccountSource: limit(
    "LOGIN_ACCOUNT_SOURCE",
    "AUTH_LIMIT_LOGIN_PER_15_MIN_ACCOUNT",
    5,
    fifteenMinutesMs,
    100,
  ),
  refreshFamilySource: limit(
    "REFRESH_FAMILY_SOURCE",
    "AUTH_LIMIT_REFRESH_PER_15_MIN",
    60,
    fifteenMinutesMs,
  ),
  forgotSource: limit(
    "FORGOT_SOURCE",
    "AUTH_LIMIT_FORGOT_PER_HOUR_SOURCE",
    20,
    oneHourMs,
  ),
  forgotAccount: limit(
    "FORGOT_ACCOUNT",
    "AUTH_LIMIT_FORGOT_PER_HOUR_ACCOUNT",
    5,
    oneHourMs,
  ),
  resetSource: limit(
    "RESET_SOURCE",
    "AUTH_LIMIT_RESET_PER_15_MIN",
    20,
    fifteenMinutesMs,
  ),
  resetToken: limit(
    "RESET_TOKEN",
    "AUTH_LIMIT_RESET_TOKEN_MAX_ATTEMPTS",
    5,
    fifteenMinutesMs,
    10,
  ),
  passwordChangeUser: limit(
    "PASSWORD_CHANGE_USER",
    "AUTH_LIMIT_PASSWORD_CHANGE_PER_15_MIN",
    5,
    fifteenMinutesMs,
  ),
  logoutSession: limit(
    "LOGOUT_SESSION",
    "AUTH_LIMIT_LOGOUT_PER_15_MIN",
    30,
    fifteenMinutesMs,
  ),
  logoutAllUser: limit(
    "LOGOUT_ALL_USER",
    "AUTH_LIMIT_LOGOUT_ALL_PER_15_MIN",
    5,
    fifteenMinutesMs,
  ),
});
