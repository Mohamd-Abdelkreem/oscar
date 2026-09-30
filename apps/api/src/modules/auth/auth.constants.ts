import { authConfig } from "../../core/config/auth.config.js";
import { cookieConfig } from "../../core/config/cookie.config.js";

export const AUTH_CONSTANTS = Object.freeze({
  refreshTokenCookieName: cookieConfig.refreshName,
  csrfTokenCookieName: cookieConfig.csrfName,
  messages: Object.freeze({
    register: "Account created. Check your email to verify it.",
    verify: "Email verified successfully.",
    resend: "Verification request processed.",
    login: "Signed in successfully.",
    refresh: "Session refreshed successfully.",
    logout: "Signed out successfully.",
    logoutAll: "Signed out from all devices successfully.",
    forgot: "Password reset request processed.",
    reset: "Password reset successfully.",
    validateReset: "Reset link is valid.",
    changePassword: "Password changed successfully.",
  }),
});

export const RESEND_NEUTRAL_RESPONSE = Object.freeze({
  message:
    "If the account exists and is eligible, a verification link will be sent.",
});

export const FORGOT_PASSWORD_NEUTRAL_RESPONSE = Object.freeze({
  message:
    "If the account exists and is eligible, a password reset link will be sent.",
});

export const VERIFICATION_TOKEN_TTL_MS =
  authConfig.verifyTokenTtlSeconds * 1_000;
export const RESET_TOKEN_TTL_MS = authConfig.resetTokenTtlSeconds * 1_000;
export const RESEND_COOLDOWN_MS =
  authConfig.verifyResendCooldownSeconds * 1_000;
