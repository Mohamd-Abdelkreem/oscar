import { randomUUID } from "node:crypto";

import {
  createDatabaseClient,
  type DatabaseClient,
  type Wallet,
  UserStatus,
  UserRole,
} from "@template/database";
import { withIdentityDatabase } from "../../auth/testing/identity-fixtures.js";
import {
  acknowledgeFinancialBoot,
  FinancialRuntimeAdmission,
} from "../../custody/runtime-control.js";

const fixtureAdmissions = new WeakMap<
  DatabaseClient,
  FinancialRuntimeAdmission
>();
const approvedFixtures = new WeakSet<FinancialRuntimeAdmission>();

export function financialFixtureAdmission(
  database: DatabaseClient,
): FinancialRuntimeAdmission {
  let admission = fixtureAdmissions.get(database);
  if (admission === undefined) {
    admission = new FinancialRuntimeAdmission(database, "API");
    fixtureAdmissions.set(database, admission);
  }
  return admission;
}

export async function admitCleanDisposableFinancialBoot(
  database: DatabaseClient,
): Promise<FinancialRuntimeAdmission> {
  const admission = financialFixtureAdmission(database);
  if (approvedFixtures.has(admission)) return admission;
  const baseUrl = process.env["DATABASE_URL"];
  if (
    baseUrl === undefined ||
    new URL(baseUrl).pathname !== "/template_api_integration"
  ) {
    throw new Error(
      "Financial fixture admission requires the disposable API Testcontainers runtime.",
    );
  }
  const rows = await database.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`;
  if (
    !rows.some(
      ({ name }) =>
        name === "template_api_integration" ||
        /^p02_identity_[0-9a-f]{32}$/u.test(name),
    )
  ) {
    throw new Error(
      "Financial fixture admission refuses non-disposable databases.",
    );
  }
  if (
    (await database.depositAddressAssignment.count()) !== 0 ||
    (await database.transferAttempt.count()) !== 0
  ) {
    throw new Error(
      "Fixture admission cannot bypass custody/attempt recovery.",
    );
  }
  await admission.register();
  const reference = `clean-disposable:${admission.bootId}`;
  const cutoff = new Date();
  await acknowledgeFinancialBoot(database, {
    bootId: admission.bootId,
    operatorIdentity: "disposable-test-recovery",
    reason: "Explicit known-clean disposable fixture admission",
    evidence: {
      financialHistoryReference: reference,
      assignmentInventoryReference: reference,
      attemptInventoryReference: reference,
      reconciliationReference: reference,
      reconciliationCutoff: cutoff,
      financialHistoryRecoveredThrough: cutoff,
    },
  });
  approvedFixtures.add(admission);
  return admission;
}

export function withAdmittedFinancialDatabase<T>(
  work: (database: DatabaseClient, databaseUrl: string) => Promise<T>,
): Promise<T> {
  return withIdentityDatabase(async (database, databaseUrl) => {
    await admitCleanDisposableFinancialBoot(database);
    return work(database, databaseUrl);
  });
}

export function withAdmittedIndependentFinancialClients<T>(
  databaseUrl: string,
  work: (first: DatabaseClient, second: DatabaseClient) => Promise<T>,
): Promise<T> {
  return withIndependentFinancialClients(databaseUrl, async (first, second) => {
    await admitCleanDisposableFinancialBoot(first);
    await admitCleanDisposableFinancialBoot(second);
    return work(first, second);
  });
}

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
  role: UserRole = UserRole.USER,
): Promise<{ ownerUserId: string; wallet: Wallet }> => {
  const owner = await database.user.create({
    data: {
      email: `financial-${randomUUID()}@example.com`,
      fullName: "Financial Fixture Owner",
      passwordHash: "test-only-unused-password-hash",
      role,
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
