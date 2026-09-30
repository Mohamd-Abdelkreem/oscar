import type { NextFunction, Request, Response } from "express";

import type { UserRole } from "@template/database";

import { ForbiddenException } from "../core/errors/forbidden.error.js";
import { UnauthorizedException } from "../core/errors/unauthorized.error.js";

export const authorizeRoles = (...roles: readonly UserRole[]) => {
  const allowed = new Set(roles);
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (request.user === undefined) {
      throw new UnauthorizedException("Authentication is required.");
    }
    if (!allowed.has(request.user.role)) {
      throw new ForbiddenException(
        "This action is not allowed for the current user.",
      );
    }
    next();
  };
};
