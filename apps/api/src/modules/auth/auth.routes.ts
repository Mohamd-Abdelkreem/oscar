import { Router, type RequestHandler } from "express";

import {
  createCsrfMiddlewareWhenCookiePresent,
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { AUTH_CONSTANTS } from "./auth.constants.js";
import type { AuthController } from "./auth.controller.js";
import { authRateLimiters } from "./auth.rate-limiters.js";
import {
  changePasswordBodyDtoSchema,
  emailRequestBodyDtoSchema,
  loginBodyDtoSchema,
  registerBodyDtoSchema,
  resetPasswordBodyDtoSchema,
  tokenQueryDtoSchema,
} from "./dto/index.js";

export const authRoutes = (
  controller: AuthController,
  authenticationMiddleware: RequestHandler,
): Router => {
  const router = Router();
  const refreshCsrf = createCsrfMiddlewareWhenCookiePresent(
    AUTH_CONSTANTS.refreshTokenCookieName,
  );

  router.post(
    "/register",
    authRateLimiters.registerSource,
    validationMiddleware({ body: registerBodyDtoSchema }),
    controller.register,
  );
  router.post(
    "/verify-email",
    authRateLimiters.verifySource,
    validationMiddleware({ query: tokenQueryDtoSchema }),
    authRateLimiters.verifyToken,
    controller.verifyEmail,
  );
  router.post(
    "/resend-verification",
    authRateLimiters.resendSource,
    validationMiddleware({ body: emailRequestBodyDtoSchema }),
    authRateLimiters.resendAccount,
    controller.resendVerification,
  );
  router.post(
    "/login",
    authRateLimiters.loginSource,
    validationMiddleware({ body: loginBodyDtoSchema }),
    authRateLimiters.loginAccountSource,
    controller.login,
  );
  router.post(
    "/refresh",
    authRateLimiters.refreshFamilySource,
    refreshCsrf,
    controller.refresh,
  );
  router.post(
    "/logout",
    authenticationMiddleware,
    authRateLimiters.logoutSession,
    csrfMiddleware,
    controller.logout,
  );
  router.post(
    "/logout-all",
    authenticationMiddleware,
    authRateLimiters.logoutAllUser,
    csrfMiddleware,
    controller.logoutAll,
  );
  router.post(
    "/forgot-password",
    authRateLimiters.forgotSource,
    validationMiddleware({ body: emailRequestBodyDtoSchema }),
    authRateLimiters.forgotAccount,
    controller.forgotPassword,
  );
  router.post(
    "/reset-password",
    authRateLimiters.resetSource,
    validationMiddleware({
      body: resetPasswordBodyDtoSchema,
      query: tokenQueryDtoSchema,
    }),
    authRateLimiters.resetToken,
    controller.resetPassword,
  );
  router.get(
    "/validate-reset-token",
    authRateLimiters.resetSource,
    validationMiddleware({ query: tokenQueryDtoSchema }),
    authRateLimiters.resetToken,
    controller.validateResetToken,
  );
  router.patch(
    "/change-password",
    authenticationMiddleware,
    authRateLimiters.passwordChangeUser,
    csrfMiddleware,
    validationMiddleware({ body: changePasswordBodyDtoSchema }),
    controller.changePassword,
  );

  return router;
};
