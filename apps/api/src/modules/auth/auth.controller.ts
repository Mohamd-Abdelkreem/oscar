import { randomBytes } from "node:crypto";

import type { Request, Response } from "express";

import { cookieConfig } from "../../core/config/cookie.config.js";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { AUTH_CONSTANTS } from "./auth.constants.js";
import type { AuthService } from "./auth.service.js";
import type {
  ChangePasswordBodyDto,
  EmailRequestBodyDto,
  LoginBodyDto,
  RegisterBodyDto,
  ResetPasswordBodyDto,
  TokenQueryDto,
} from "./dto/index.js";
import type {
  AuthResponseWithTokens,
  CookieAttributes,
} from "./types/auth.types.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.register(
      request.validated?.body as RegisterBodyDto,
    );
    return ResponseHelper.created(
      response,
      result,
      AUTH_CONSTANTS.messages.register,
      request.path,
      request.requestId,
    );
  };

  verifyEmail = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = request.validated?.query as TokenQueryDto;
    const result = await this.authService.verifyEmail(query.token);
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.verify,
      request.path,
      request.requestId,
    );
  };

  resendVerification = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.resendVerification(
      request.validated?.body as EmailRequestBodyDto,
    );
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.resend,
      request.path,
      request.requestId,
    );
  };

  login = async (request: Request, response: Response): Promise<Response> => {
    const result = await this.authService.login(
      request.validated?.body as LoginBodyDto,
    );
    return this.sendSession(
      request,
      response,
      result,
      AUTH_CONSTANTS.messages.login,
    );
  };

  refresh = async (request: Request, response: Response): Promise<Response> => {
    const result = await this.authService.refresh(
      this.extractRefreshToken(request),
    );
    return this.sendSession(
      request,
      response,
      result,
      AUTH_CONSTANTS.messages.refresh,
    );
  };

  logout = async (request: Request, response: Response): Promise<Response> => {
    await this.authService.logout(
      request.user?.id ?? "",
      this.extractRefreshToken(request),
    );
    this.clearSessionCookies(response);
    return ResponseHelper.ok(
      response,
      {},
      AUTH_CONSTANTS.messages.logout,
      request.path,
      request.requestId,
    );
  };

  logoutAll = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    await this.authService.logoutAll(request.user?.id ?? "");
    this.clearSessionCookies(response);
    return ResponseHelper.ok(
      response,
      {},
      AUTH_CONSTANTS.messages.logoutAll,
      request.path,
      request.requestId,
    );
  };

  forgotPassword = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.forgotPassword(
      request.validated?.body as EmailRequestBodyDto,
    );
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.forgot,
      request.path,
      request.requestId,
    );
  };

  resetPassword = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.resetPassword(
      request.validated?.body as ResetPasswordBodyDto,
      (request.validated?.query as TokenQueryDto).token,
    );
    this.clearSessionCookies(response);
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.reset,
      request.path,
      request.requestId,
    );
  };

  validateResetToken = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.validateResetToken(
      (request.validated?.query as TokenQueryDto).token,
    );
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.validateReset,
      request.path,
      request.requestId,
    );
  };

  changePassword = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.changePassword(
      request.user?.id ?? "",
      request.validated?.body as ChangePasswordBodyDto,
    );
    this.clearSessionCookies(response);
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.changePassword,
      request.path,
      request.requestId,
    );
  };

  private sendSession(
    request: Request,
    response: Response,
    result: AuthResponseWithTokens,
    message: string,
  ): Response {
    this.setSessionCookies(
      response,
      result.tokens.refreshToken,
      result.rememberMe,
    );
    return ResponseHelper.ok(
      response,
      {
        user: result.user,
        tokens: { accessToken: result.tokens.accessToken },
      },
      message,
      request.path,
      request.requestId,
    );
  }

  private setSessionCookies(
    response: Response,
    refreshToken: string,
    rememberMe: boolean,
  ): void {
    response.cookie(
      AUTH_CONSTANTS.refreshTokenCookieName,
      refreshToken,
      this.refreshCookieOptions(rememberMe),
    );
    response.cookie(
      AUTH_CONSTANTS.csrfTokenCookieName,
      randomBytes(32).toString("hex"),
      this.csrfCookieOptions(rememberMe),
    );
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(AUTH_CONSTANTS.refreshTokenCookieName, {
      path: cookieConfig.refreshPath,
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
    });
    response.clearCookie(AUTH_CONSTANTS.csrfTokenCookieName, {
      path: cookieConfig.csrfPath,
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
    });
  }

  private extractRefreshToken(request: Request): string {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[AUTH_CONSTANTS.refreshTokenCookieName] ?? "";
  }

  private refreshCookieOptions(rememberMe: boolean): CookieAttributes {
    return {
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.refreshPath,
      ...(rememberMe
        ? { maxAge: cookieConfig.refreshMaxAgeSeconds * 1_000 }
        : {}),
    };
  }

  private csrfCookieOptions(rememberMe: boolean): CookieAttributes {
    return {
      httpOnly: false,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.csrfPath,
      ...(rememberMe
        ? { maxAge: cookieConfig.refreshMaxAgeSeconds * 1_000 }
        : {}),
    };
  }
}
