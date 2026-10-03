import { identityUserSchema, type IdentityUser } from "@template/contracts";
import type { Prisma } from "@template/database";

export const SAFE_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  referralCode: true,
  tasksBlocked: true,
  withdrawalsBlocked: true,
  accountVersion: true,
} as const satisfies Prisma.UserSelect;

export type SafeUserRecord = Prisma.UserGetPayload<{
  select: typeof SAFE_USER_SELECT;
}>;

export const mapSafeUser = (user: SafeUserRecord): IdentityUser =>
  identityUserSchema.parse({
    referralCode: user.role === "USER" ? user.referralCode : null,
    tasksBlocked: user.tasksBlocked,
    withdrawalsBlocked: user.withdrawalsBlocked,
    accountVersion: user.accountVersion,
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  });
