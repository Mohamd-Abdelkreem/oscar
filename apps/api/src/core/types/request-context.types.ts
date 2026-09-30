import type { SafeUser } from "@template/contracts";

export type AuthenticatedUser = SafeUser;

export interface ValidatedRequestData {
  body?: unknown;
  params?: unknown;
  query?: unknown;
}
