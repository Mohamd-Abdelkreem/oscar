import {
  Prisma,
  type AuthSession,
  type DatabaseClient,
  type User,
  type UserRole,
} from "@template/database";
import { z } from "zod";

import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "../../core/errors/index.js";
import { lockAdminAuthority } from "../admins/admin-authority.js";

const adapterConflictSchema = z.object({
  driverAdapterError: z.object({
    cause: z.object({ originalCode: z.enum(["40001", "40P01"]) }),
  }),
});
export const isRetryableIdentityConflict = (failure: unknown): boolean =>
  failure instanceof Prisma.PrismaClientKnownRequestError &&
  (failure.code === "P2034" ||
    (failure.code === "P2010" &&
      adapterConflictSchema.safeParse(failure.meta).success));

export type IdentityLockParticipants = Readonly<{
  userIds: readonly string[];
  adminPopulation: boolean;
}>;
export async function lockIdentityUsers(
  transaction: Prisma.TransactionClient,
  participants: IdentityLockParticipants,
): Promise<void> {
  if (participants.adminPopulation) await lockAdminAuthority(transaction);
  const ids = [...new Set(participants.userIds)].sort();
  if (ids.length === 0) return;
  const locked = await transaction.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM users WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  if (locked.length !== ids.length) throw new UnauthorizedException();
}

export function assertSessionAuthority(
  user: User | null,
  session: AuthSession | null,
  now: Date,
  requiredRole?: UserRole,
): User {
  if (
    user === null ||
    session === null ||
    user.status !== "ACTIVE" ||
    user.emailVerifiedAt === null ||
    session.userId !== user.id ||
    session.revokedAt !== null ||
    now.getTime() >= session.expiresAt.getTime()
  )
    throw new UnauthorizedException();
  if (requiredRole !== undefined && user.role !== requiredRole)
    throw new ForbiddenException();
  return user;
}

export async function readSessionAuthority(
  transaction: Prisma.TransactionClient,
  identity: Readonly<{ userId: string; sessionId: string }>,
  now: Date,
  requiredRole?: UserRole,
): Promise<User> {
  const user = await transaction.user.findUnique({
    where: { id: identity.userId },
  });
  const session = await transaction.authSession.findUnique({
    where: { id: identity.sessionId },
  });
  return assertSessionAuthority(user, session, now, requiredRole);
}

export function assertCurrentPasswordHash(
  user: User,
  comparedHash: string,
): void {
  if (user.passwordHash !== comparedHash) throw new UnauthorizedException();
}

export async function runIdentityTransaction<T>(
  database: DatabaseClient,
  participants: IdentityLockParticipants &
    Readonly<{ isolationLevel?: Prisma.TransactionIsolationLevel }>,
  work: (transaction: Prisma.TransactionClient, now: Date) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          await lockIdentityUsers(transaction, participants);
          return work(transaction, new Date());
        },
        {
          maxWait: 5000,
          timeout: 10000,
          ...(participants.isolationLevel === undefined
            ? {}
            : { isolationLevel: participants.isolationLevel }),
        },
      );
    } catch (failure) {
      if (!isRetryableIdentityConflict(failure)) throw failure;
      if (attempt === 3)
        throw new ConflictException("Identity transaction conflicted.");
    }
  }
  throw new ConflictException("Identity transaction conflicted.");
}
