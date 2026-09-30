export const AUTH_PATHS = Object.freeze({
  login: "/auth/login",
  register: "/auth/register",
  verifyEmail: "/auth/verify-email",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  dashboard: "/dashboard",
  settings: "/settings",
});

export const DEFAULT_RETURN_PATH = AUTH_PATHS.dashboard;
