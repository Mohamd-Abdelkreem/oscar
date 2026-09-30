import type { NextFunction, Request, Response } from "express";

import { UserStatus, type DatabaseClient } from "@template/database";

import { UnauthorizedException } from "../core/errors/unauthorized.error.js";
import { mapSafeUser } from "../modules/users/users.mapper.js";
import { verifyAccessToken } from "../infrastructure/security/jwt.service.js";

type UserLookupClient = Pick<DatabaseClient, "user">;

export const createAuthenticationMiddleware =
  (database: UserLookupClient) =>
  async (
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> => {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || token === undefined || token.length === 0) {
      throw new UnauthorizedException(
        "Authentication required. Provide a valid bearer token.",
      );
    }

    const verified = verifyAccessToken(token);
    if (!verified.valid) {
      throw new UnauthorizedException(verified.error);
    }

    const user = await database.user.findUnique({
      where: { id: verified.payload.userId },
    });
    if (
      user === null ||
      user.status !== UserStatus.ACTIVE ||
      user.emailVerifiedAt === null
    ) {
      throw new UnauthorizedException(
        "The account is unavailable. Sign in again.",
      );
    }

    request.user = mapSafeUser(user);
    next();
  };
