import { randomUUID } from "node:crypto";

import {
  Prisma,
  type AuthSession,
  type RefreshToken,
  type User,
} from "@template/database";

import { authConfig } from "../../core/config/auth.config.js";
import {
  generateTokenPair,
  sha256,
} from "../../infrastructure/security/index.js";
import type { TokenPair, RefreshTokenPayload } from "./types/auth.types.js";
import { UnauthorizedException } from "../../core/errors/unauthorized.error.js";

type SessionCredentials = Readonly<{
  tokens: TokenPair;
  record: Prisma.RefreshTokenUncheckedCreateInput;
}>;
type RefreshCredential = Readonly<{
  claims: RefreshTokenPayload;
  tokenHash: string;
}>;

function assertRefreshCredential(
  token: RefreshToken | null,
  session: AuthSession,
  credential: RefreshCredential,
  now: Date,
): asserts token is RefreshToken {
  const { claims, tokenHash } = credential;
  if (
    token === null ||
    token.userId !== claims.userId ||
    token.sessionId !== session.id ||
    token.tokenHash !== tokenHash ||
    token.expiresAt.getTime() !== session.expiresAt.getTime() ||
    claims.expiresAt * 1000 !== session.expiresAt.getTime() ||
    claims.rememberMe !== session.rememberMe ||
    now.getTime() >= session.expiresAt.getTime()
  )
    throw new UnauthorizedException("Invalid or expired refresh token.");
}

export class AuthSessionService {
  async rotate(
    transaction: Prisma.TransactionClient,
    user: Pick<User, "id" | "role" | "email">,
    credential: RefreshCredential,
  ): Promise<TokenPair> {
    const session = await transaction.authSession.findUniqueOrThrow({
      where: { id: credential.claims.sessionId },
    });
    await transaction.$queryRaw(
      Prisma.sql`SELECT id FROM refresh_tokens WHERE session_id=${session.id}::uuid ORDER BY id FOR UPDATE`,
    );
    const token = await transaction.refreshToken.findUnique({
      where: { id: credential.claims.tokenId },
    });
    assertRefreshCredential(token, session, credential, new Date());
    const consumed = await transaction.refreshToken.deleteMany({
      where: { id: token.id, tokenHash: credential.tokenHash },
    });
    if (consumed.count !== 1)
      throw new UnauthorizedException("Refresh token has already been used.");
    const replacement = this.createCredentials(user, session);
    await transaction.refreshToken.create({ data: replacement.record });
    return replacement.tokens;
  }
  async lockSessions(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    await transaction.$queryRaw(
      Prisma.sql`SELECT id FROM auth_sessions WHERE user_id=${userId}::uuid ORDER BY id FOR UPDATE`,
    );
  }

  async revokeSession(
    transaction: Prisma.TransactionClient,
    identity: Readonly<{ userId: string; sessionId: string }>,
    now: Date,
  ): Promise<void> {
    await transaction.authSession.updateMany({
      where: {
        id: identity.sessionId,
        userId: identity.userId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    await transaction.refreshToken.deleteMany({
      where: { userId: identity.userId, sessionId: identity.sessionId },
    });
  }

  async revokeAll(
    transaction: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ): Promise<void> {
    await transaction.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await transaction.$queryRaw(
      Prisma.sql`SELECT id FROM refresh_tokens WHERE user_id=${userId}::uuid ORDER BY id FOR UPDATE`,
    );
    await transaction.refreshToken.deleteMany({ where: { userId } });
  }

  async createSession(
    transaction: Prisma.TransactionClient,
    user: Pick<User, "id" | "role" | "email">,
    rememberMe: boolean,
    now: Date,
  ): Promise<TokenPair> {
    const ttlSeconds = rememberMe
      ? authConfig.refreshRememberedTtlSeconds
      : authConfig.refreshFamilyTtlSeconds;
    const session = await transaction.authSession.create({
      data: {
        userId: user.id,
        rememberMe,
        createdAt: now,
        expiresAt: new Date(
          (Math.floor(now.getTime() / 1000) + ttlSeconds) * 1000,
        ),
      },
    });
    const credentials = this.createCredentials(user, session);
    await transaction.refreshToken.create({ data: credentials.record });
    return credentials.tokens;
  }

  createCredentials(
    user: Pick<User, "id" | "role" | "email">,
    session: Pick<AuthSession, "id" | "userId" | "rememberMe" | "expiresAt">,
  ): SessionCredentials {
    const tokenId = randomUUID();
    const tokens = generateTokenPair({
      userId: user.id,
      tokenId,
      sessionId: session.id,
      role: user.role,
      email: user.email,
      rememberMe: session.rememberMe,
      absoluteExpiresAt: session.expiresAt,
    });
    return {
      tokens,
      record: {
        id: tokenId,
        userId: user.id,
        sessionId: session.id,
        tokenHash: sha256(tokens.refreshToken),
        expiresAt: session.expiresAt,
      },
    };
  }
}
