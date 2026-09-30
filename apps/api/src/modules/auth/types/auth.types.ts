import type { SafeUser } from "@template/contracts";
import type { UserRole } from "@template/database";

export type CookieAttributes = Readonly<{
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "none";
  path: string;
  maxAge?: number;
}>;

export interface AccessTokenPayload {
  sub: string;
  jti: string;
  userId: string;
  tokenId: string;
  email: string;
  role: UserRole;
  type: "ACCESS";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  userId: string;
  tokenId: string;
  rememberMe: boolean;
  expiresAt: number;
  type: "REFRESH";
}

export interface TemporaryTokenPayload {
  sub: string;
  jti: string;
  email: string;
  type: "VERIFICATION" | "PASSWORD_RESET";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type VerifiedToken<T> =
  | Readonly<{ valid: true; payload: T }>
  | Readonly<{ valid: false; error: string }>;

export interface AuthResponseWithTokens {
  user: SafeUser;
  tokens: TokenPair;
  rememberMe: boolean;
}

export interface AuthResponseWithoutTokens {
  user: SafeUser;
}
