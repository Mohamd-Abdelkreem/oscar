import { Prisma, type DatabaseClient, type UserRole } from "@template/database";
import {
  readSessionAuthority,
  runIdentityTransaction,
} from "../auth/session-authority.js";

export type TaskActorIdentity = Readonly<{ userId: string; sessionId: string }>;
export type TaskClock = () => Date;

export async function lockTaskSession(
  transaction: Prisma.TransactionClient,
  identity: TaskActorIdentity,
) {
  await transaction.$queryRaw`SELECT id FROM auth_sessions WHERE id=${identity.sessionId}::uuid AND user_id=${identity.userId}::uuid FOR UPDATE`;
}

export async function authorizeTaskActor(
  transaction: Prisma.TransactionClient,
  identity: TaskActorIdentity,
  authority: { role: UserRole; clock: TaskClock },
) {
  const now = authority.clock();
  if (!Number.isFinite(now.getTime()))
    throw new RangeError("Invalid task clock.");
  const actor = await readSessionAuthority(
    transaction,
    identity,
    now,
    authority.role,
  );
  return { actor, now };
}

export function runTaskTransaction<T>(
  database: DatabaseClient,
  participants: {
    identity: TaskActorIdentity;
    otherUserIds?: readonly string[];
  },
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return runIdentityTransaction(
    database,
    {
      userIds: [
        participants.identity.userId,
        ...(participants.otherUserIds ?? []),
      ],
      adminPopulation: false,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
    async (transaction) => {
      await lockTaskSession(transaction, participants.identity);
      return work(transaction);
    },
  );
}
