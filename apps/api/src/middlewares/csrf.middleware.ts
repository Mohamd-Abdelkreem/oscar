import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { csrfConfig } from "../core/config/csrf.config.js";
import { ForbiddenException } from "../core/errors/forbidden.error.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const tokensMatch = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export const csrfMiddleware = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  if (!unsafeMethods.has(request.method)) {
    next();
    return;
  }

  const cookies = request.cookies as Record<string, string> | undefined;
  const cookieToken = cookies?.[csrfConfig.cookieName];
  const headerToken = request.get(csrfConfig.headerName);
  if (
    cookieToken === undefined ||
    headerToken === undefined ||
    !tokensMatch(cookieToken, headerToken)
  ) {
    throw new ForbiddenException("CSRF validation failed.");
  }
  next();
};

export const createCsrfMiddlewareWhenCookiePresent =
  (protectedCookieName: string) =>
  (request: Request, response: Response, next: NextFunction): void => {
    const cookies = request.cookies as Record<string, string> | undefined;
    const protectedCookie = cookies?.[protectedCookieName];
    if (protectedCookie === undefined || protectedCookie.length === 0) {
      next();
      return;
    }
    csrfMiddleware(request, response, next);
  };
