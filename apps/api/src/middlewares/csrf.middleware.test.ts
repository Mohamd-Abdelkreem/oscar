import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { ForbiddenException } from "../core/errors/forbidden.error.js";
import {
  createCsrfMiddlewareWhenCookiePresent,
  csrfMiddleware,
} from "./csrf.middleware.js";

const request = (
  method: string,
  cookieToken?: string,
  headerToken?: string,
): Request =>
  ({
    method,
    cookies: cookieToken === undefined ? {} : { csrfToken: cookieToken },
    get: vi.fn(() => headerToken),
  }) as unknown as Request;

describe("CSRF middleware", () => {
  const response = {} as Response;

  it("allows safe methods and matching double-submit tokens", () => {
    const next = vi.fn() as NextFunction;
    csrfMiddleware(request("GET"), response, next);
    csrfMiddleware(
      request("PATCH", "same-token", "same-token"),
      response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("rejects missing, unequal, and unequal-length tokens", () => {
    const next = vi.fn() as NextFunction;
    expect(() => {
      csrfMiddleware(request("POST"), response, next);
    }).toThrow(ForbiddenException);
    expect(() => {
      csrfMiddleware(request("POST", "cookie", "header"), response, next);
    }).toThrow(ForbiddenException);
    expect(() => {
      csrfMiddleware(request("POST", "short", "much-longer"), response, next);
    }).toThrow(ForbiddenException);
  });

  it("requires CSRF on refresh only when the protected cookie exists", () => {
    const middleware = createCsrfMiddlewareWhenCookiePresent("refreshToken");
    const next = vi.fn() as NextFunction;
    middleware(request("POST"), response, next);
    expect(next).toHaveBeenCalledOnce();

    const protectedRequest = request("POST", "csrf", "csrf");
    protectedRequest.cookies = {
      refreshToken: "refresh",
      csrfToken: "csrf",
    };
    middleware(protectedRequest, response, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
