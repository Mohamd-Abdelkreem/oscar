import { z } from "zod";

import { nonEmptyBoundedString } from "../http/http.schema.ts";

export const userRoleSchema = z.enum(["USER", "ADMIN"]);
export const userStatusSchema = z.enum([
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
]);

export const safeUserSchema = z
  .object({
    id: z.uuid(),
    fullName: nonEmptyBoundedString(150),
    email: z.email().max(320),
    phone: z.string().min(1).max(30).nullable(),
    role: userRoleSchema,
    status: userStatusSchema,
    emailVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const authUserDataSchema = z.object({ user: safeUserSchema }).strict();

export const authSessionDataSchema = z
  .object({
    user: safeUserSchema,
    tokens: z.object({ accessToken: z.string().min(1) }).strict(),
  })
  .strict();

export const accountResponseSchemas = Object.freeze({
  safeUser: safeUserSchema,
  authUserData: authUserDataSchema,
  authSessionData: authSessionDataSchema,
});

export const ACCOUNT_RESPONSE_FIELD_ALLOWLIST = [
  "id",
  "fullName",
  "email",
  "phone",
  "role",
  "status",
  "emailVerifiedAt",
  "createdAt",
  "updatedAt",
] as const;

export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type SafeUser = z.infer<typeof safeUserSchema>;
export type AuthUserData = z.infer<typeof authUserDataSchema>;
export type AuthSessionData = z.infer<typeof authSessionDataSchema>;
