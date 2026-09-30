import { rateLimit } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";

import type { AuthRouteLimit } from "../core/config/auth-rate-limit.config.js";
import { rateLimitConfig } from "../core/config/rate-limit.config.js";
import { TooManyRequestsException } from "../core/errors/too-many-requests.error.js";

const rateLimitHandler = (
  _request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  next(new TooManyRequestsException());
};

export const apiRateLimitMiddleware = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  limit: rateLimitConfig.maxRequests,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const createSourceRateLimiter = (config: AuthRouteLimit) =>
  rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimitHandler,
  });

export const createKeyedAuthRateLimiter = (
  config: AuthRouteLimit,
  keyBuilder: (request: Request) => string,
) =>
  rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) => `auth:${config.name}:${keyBuilder(request)}`,
    handler: rateLimitHandler,
  });
