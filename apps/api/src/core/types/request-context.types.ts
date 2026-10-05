import type { IdentityUser } from "@template/contracts";

export type AuthenticatedUser = IdentityUser;

export type AuthenticatedSession = Readonly<{
  userId: string;
  sessionId: string;
}>;

export interface ValidatedRequestData {
  body?: unknown;
  params?: unknown;
  query?: unknown;
}
