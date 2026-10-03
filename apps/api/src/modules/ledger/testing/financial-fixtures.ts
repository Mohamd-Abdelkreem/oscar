import { randomUUID } from "node:crypto";

import {
  createDatabaseClient,
  type DatabaseClient,
  type Wallet,
  UserStatus,
} from "@template/database";

export const fixedFinancialClock = (instant: Date): (() => Date) => {
  const milliseconds = instant.getTime();
  if (!Number.isFinite(milliseconds)) throw new Error("Invalid fixture clock.");
  return () => new Date(milliseconds);
};

export const financialIdentity = (): {
  businessNamespace: string;
  businessKey: string;
  requestKey: string;
} => ({
  businessNamespace: "financial-test",
  businessKey: randomUUID(),
  requestKey: randomUUID(),
});

export const createFinancialAccount = async (
  database: DatabaseClient,
): Promise<{ ownerUserId: string; wallet: Wallet }> => {
  const owner = await database.user.create({
    data: {
      email: `financial-${randomUUID()}@example.com`,
      fullName: "Financial Fixture Owner",
      passwordHash: "test-only-unused-password-hash",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date("2026-10-02T09:00:00.000Z"),
    },
  });
  const wallet = await database.wallet.create({
    data: { ownerUserId: owner.id },
  });
  return { ownerUserId: owner.id, wallet };
};

// Call before competing work, outside row locks, so both independent clients start together.
export const financialRaceBarrier = (
  participants: number,
): (() => Promise<void>) => {
  if (!Number.isSafeInteger(participants) || participants < 2) {
    throw new Error("A financial race requires at least two participants.");
  }
  let arrivals = 0;
  let release: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrivals += 1;
    if (arrivals > participants) throw new Error("Too many race participants.");
    if (arrivals === participants) release();
    await ready;
  };
};

export const withIndependentFinancialClients = async <T>(
  databaseUrl: string,
  competingWork: (first: DatabaseClient, second: DatabaseClient) => Promise<T>,
): Promise<T> => {
  const first = createDatabaseClient(databaseUrl);
  const second = createDatabaseClient(databaseUrl);
  try {
    return await competingWork(first, second);
  } finally {
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  }
};
