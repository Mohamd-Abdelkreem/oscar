import type { NextFunction, Request, Response } from "express";

import { UserStatus, type DatabaseClient } from "@template/database";

import { UnauthorizedException } from "../core/errors/unauthorized.error.js";
import {
  mapSafeUser,
  SAFE_USER_SELECT,
} from "../modules/users/users.mapper.js";
import { verifyAccessToken } from "../infrastructure/security/jwt.service.js";

type SessionLookupClient = Pick<DatabaseClient, "authSession">;

export const createAuthenticationMiddleware =
  (database: SessionLookupClient) =>
  async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    response.setHeader("Cache-Control", "no-store");
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

    const session = await database.authSession.findUnique({
      where: { id: verified.payload.sessionId },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: SAFE_USER_SELECT },
      },
    });
    if (
      session === null ||
      session.userId !== verified.payload.userId ||
      session.revokedAt !== null ||
      Date.now() >= session.expiresAt.getTime() ||
      session.user.status !== UserStatus.ACTIVE ||
      session.user.emailVerifiedAt === null
    ) {
      throw new UnauthorizedException(
        "The account is unavailable. Sign in again.",
      );
    }

    request.user = mapSafeUser(session.user);
    request.authSession = {
      userId: session.userId,
      sessionId: verified.payload.sessionId,
    };
    next();
  };
