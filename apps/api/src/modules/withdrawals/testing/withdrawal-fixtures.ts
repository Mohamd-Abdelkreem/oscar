import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@template/database";
import { vi } from "vitest";
import { setTimeout as delay } from "node:timers/promises";
import {
  createFinancialAccount,
  financialRaceBarrier,
  fixedFinancialClock,
  withAdmittedFinancialDatabase,
  withAdmittedIndependentFinancialClients,
} from "../../ledger/testing/financial-fixtures.js";

export {
  financialRaceBarrier as withdrawalRaceBarrier,
  fixedFinancialClock as fixedWithdrawalClock,
  withAdmittedFinancialDatabase as withWithdrawalDatabase,
  withAdmittedIndependentFinancialClients as withWithdrawalRaceClients,
};

// The catalog change is confined to one disposable database; migrated guards stay intact.
export async function withClockedWithdrawalDatabase<T>(
  now: Date,
  work: (database: DatabaseClient, databaseUrl: string) => Promise<T>,
  options: { advancing?: boolean } = {},
): Promise<T> {
  return withAdmittedFinancialDatabase(async (database, databaseUrl) => {
    const name = new URL(databaseUrl).pathname.slice(1);
    if (!/^p02_identity_[0-9a-f]{32}$/u.test(name))
      throw new Error(
        "Clock control requires an isolated withdrawal database.",
      );
    const [original] = await database.$queryRaw<{ definition: string }[]>`
      SELECT pg_get_functiondef('pg_catalog.clock_timestamp()'::regprocedure) AS definition`;
    if (original === undefined) throw new Error("Missing PostgreSQL clock.");
    const instant = now.toISOString();
    const [host] = await database.$queryRaw<
      { now: Date }[]
    >`SELECT timeofday()::timestamptz AS now`;
    if (host === undefined) throw new Error("Missing host clock.");
    const previousTime = vi.isFakeTimers() ? new Date() : null;
    const started = performance.now();
    await database.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION pg_catalog.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '${instant}'::timestamptz${options.advancing === true ? ` + (timeofday()::timestamptz - '${host.now.toISOString()}'::timestamptz)` : ""} $$`,
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const ticker =
      options.advancing === true
        ? setInterval(() => {
            vi.setSystemTime(
              new Date(now.getTime() + performance.now() - started),
            );
          }, 10)
        : undefined;
    try {
      return await work(database, databaseUrl);
    } finally {
      if (ticker !== undefined) clearInterval(ticker);
      vi.useRealTimers();
      if (previousTime !== null) {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(previousTime);
      }
      await database.$executeRawUnsafe(original.definition);
    }
  });
}

// A trigger parks the first writer with its real row locks, then proves the rival is blocked.
export async function controlledWithdrawalRace(
  database: DatabaseClient,
  requestId: string,
  commands: readonly [() => Promise<unknown>, () => Promise<unknown>],
  winner: 0 | 1,
): Promise<[PromiseSettledResult<unknown>, PromiseSettledResult<unknown>]> {
  if (!/^[0-9a-f-]{36}$/u.test(requestId))
    throw new Error("Invalid fixture ID.");
  const gate = 74078;
  const pending: Promise<unknown>[] = [];
  const waitForBlocked = async (count: number) => {
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) {
      const [row] = await database.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()
        AND cardinality(pg_blocking_pids(pid)) > 0`;
      if (row !== undefined && Number(row.count) >= count) return;
      await delay(10);
    }
    throw new Error("Competing withdrawal writers did not overlap.");
  };
  await database.$executeRawUnsafe(
    `CREATE FUNCTION p08_test_race_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${requestId}'::uuid THEN PERFORM pg_advisory_xact_lock(${String(gate)}); END IF; RETURN NEW; END $$`,
  );
  await database.$executeRawUnsafe(
    "CREATE TRIGGER p08_test_race_gate BEFORE UPDATE ON withdrawal_requests FOR EACH ROW EXECUTE FUNCTION p08_test_race_gate()",
  );
  try {
    await database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(${gate}::bigint)::text`;
        pending[winner] = commands[winner]();
        // Attach rejection handlers while the lock owner is still coordinating.
        void pending[winner].catch(() => {});
        await waitForBlocked(1);
        const loser = winner === 0 ? 1 : 0;
        pending[loser] = commands[loser]();
        void pending[loser].catch(() => {});
        await waitForBlocked(2);
      },
      { timeout: 10000 },
    );
    const [first, second] = await Promise.allSettled(pending);
    if (first === undefined || second === undefined)
      throw new Error("Missing race outcome.");
    return [first, second];
  } finally {
    await Promise.allSettled(pending);
    await database.$executeRawUnsafe(
      "DROP TRIGGER p08_test_race_gate ON withdrawal_requests",
    );
    await database.$executeRawUnsafe("DROP FUNCTION p08_test_race_gate()");
  }
}

export async function createWithdrawalEmployee(database: DatabaseClient) {
  const owner = await createFinancialAccount(database);
  const session = await database.authSession.create({
    data: {
      userId: owner.ownerUserId,
      rememberMe: false,
      createdAt: new Date("2026-10-08T08:00:00Z"),
      expiresAt: new Date("2026-10-09T08:00:00Z"),
    },
  });
  return { ...owner, session };
}

export async function createPendingWithdrawalDestination(
  database: DatabaseClient,
  employeeId: string,
) {
  const issuedAt = new Date("2026-10-08T09:00:00Z");
  const proofId = randomUUID();
  const address = `T${"1".repeat(33)}`;
  return database.$transaction(async (transaction) => {
    const destination = await transaction.withdrawalDestination.create({
      data: {
        employeeId,
        network: "TRON_NILE",
        proofId,
        proofHash: randomUUID().replaceAll("-", "").repeat(2),
        pendingAddress: address,
        proofGeneration: 1,
        issuedAt,
        expiresAt: new Date(issuedAt.getTime() + 1800000),
        nextIssuanceAt: new Date(issuedAt.getTime() + 60000),
      },
    });
    await transaction.withdrawalDestinationAudit.create({
      data: {
        destinationId: destination.id,
        actorUserId: employeeId,
        kind: "PROOF_ISSUED",
        proofId,
        proofGeneration: 1,
        network: "TRON_NILE",
        address,
        occurredAt: issuedAt,
        committedDestinationVersion: 1,
      },
    });
    return destination;
  });
}
