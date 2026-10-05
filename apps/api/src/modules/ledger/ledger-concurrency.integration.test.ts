import { randomUUID } from "node:crypto";

import {
  createDatabaseClient,
  Prisma,
  UserStatus,
  type DatabaseClient,
} from "@template/database";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { LedgerService } from "./ledger.service.js";
import { LedgerError } from "./ledger.errors.js";
import { isIdentityUniqueConflict } from "./ledger.transaction.js";
import { acceptedTermsSchema } from "./ledger.types.js";
import { financialOperationResultSchema } from "@template/contracts";
import type {
  CreditIntent,
  LedgerContext,
  LedgerIntent,
} from "./ledger.types.js";
import {
  createFinancialAccount,
  financialIdentity,
  financialRaceBarrier,
  fixedFinancialClock,
  withIndependentFinancialClients,
} from "./testing/financial-fixtures.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined)
  throw new Error("Missing isolated PostgreSQL URL.");
const database = createDatabaseClient(databaseUrl);
const POLICY = { businessNamespaces: ["financial-test"], processIds: [] };
const CLOCK = fixedFinancialClock(new Date("2026-10-02T09:00:00.000Z"));
const serviceFor = (client: DatabaseClient) =>
  new LedgerService(client, POLICY);
const contextFor = (walletId: string, ownerUserId: string): LedgerContext => ({
  actor: { type: "USER", userId: ownerUserId },
  walletIds: [walletId],
  clock: CLOCK,
  observe: ({ wallet, actor }) => {
    if (actor.type !== "USER" || actor.userId !== wallet.ownerUserId)
      return Promise.reject(new LedgerError("LEDGER_FORBIDDEN"));
    return Promise.resolve();
  },
  mutate: async () => {},
  eligibleSources: () => Promise.resolve(["NON_REFERRAL", "REFERRAL"]),
  releaseSafety: async () => {},
});
const credit = (walletId: string, amount: string): CreditIntent => ({
  ...financialIdentity(),
  kind: "CREDIT",
  walletId,
  amount,
  source: "NON_REFERRAL",
  origin: "DEPOSIT",
});
const snapshot = async (walletId: string) => ({
  wallet: await database.wallet.findUniqueOrThrow({ where: { id: walletId } }),
  operations: await database.financialOperation.count({ where: { walletId } }),
  postings: await database.ledgerPosting.count({ where: { walletId } }),
  audits: await database.auditRecord.count({
    where: { operation: { walletId } },
  }),
});
const race = async (
  intents: readonly [LedgerIntent, LedgerIntent],
  context: LedgerContext,
) =>
  withIndependentFinancialClients(databaseUrl, async (first, second) => {
    const start = financialRaceBarrier(2);
    return Promise.allSettled(
      [first, second].map(async (client, index) => {
        const intent = intents[index];
        if (intent === undefined) throw new Error("Missing race intent.");
        await start();
        return serviceFor(client).execute(intent, context);
      }),
    );
  });

afterAll(async () => {
  await database.$disconnect();
});
describe("ledger competing PostgreSQL connections", () => {
  it.each(["PURCHASE_DEBIT", "RESERVE"] as const)(
    "serializes an 80 debit against a competing 80 %s without overspending 100",
    async (secondKind) => {
      const { wallet, ownerUserId } = await createFinancialAccount(database);
      const context = contextFor(wallet.id, ownerUserId);
      await serviceFor(database).execute(credit(wallet.id, "100"), context);
      const first: LedgerIntent = {
        ...financialIdentity(),
        kind: "PURCHASE_DEBIT",
        walletId: wallet.id,
        amount: "80",
      };
      const second: LedgerIntent =
        secondKind === "RESERVE"
          ? {
              ...financialIdentity(),
              kind: secondKind,
              walletId: wallet.id,
              amount: "80",
              reservationId: randomUUID(),
            }
          : {
              ...financialIdentity(),
              kind: secondKind,
              walletId: wallet.id,
              amount: "80",
            };
      const replies = await race([first, second], context);
      expect(
        replies.filter((reply) => reply.status === "fulfilled"),
      ).toHaveLength(1);
      const loser = replies.find((reply) => reply.status === "rejected");
      expect(loser).toMatchObject({
        reason: { code: "LEDGER_INSUFFICIENT_FUNDS" },
      });
      const final = await snapshot(wallet.id);
      expect(final.wallet.availableNonReferralUnits).toBe(20000000n);
      expect(final.wallet.availableReferralUnits).toBe(0n);
      expect(final.wallet.reservedReferralUnits).toBe(0n);
      expect(final.operations).toBe(2);
      expect(final.postings).toBe(2);
      expect(final.audits).toBe(2);
    },
  );

  it("recovers duplicate credits and binds both replay aliases exactly once", async () => {
    const { wallet, ownerUserId } = await createFinancialAccount(database);
    const context = contextFor(wallet.id, ownerUserId);
    const event = credit(wallet.id, "10");
    const replies = await race(
      [event, { ...event, requestKey: randomUUID() }],
      context,
    );
    expect(replies.every((reply) => reply.status === "fulfilled")).toBe(true);
    const outcomes = replies.flatMap((reply) =>
      reply.status === "fulfilled" ? [reply.value] : [],
    );
    const original = outcomes[0];
    if (original === undefined) throw new Error("Expected committed outcome.");
    expect(outcomes[0]?.result).toEqual(outcomes[1]?.result);
    expect(outcomes.filter((reply) => reply.replayed)).toHaveLength(1);
    expect((await snapshot(wallet.id)).wallet.availableNonReferralUnits).toBe(
      10000000n,
    );
    expect(
      await database.requestIdentity.count({
        where: { operationId: original.result.operationId },
      }),
    ).toBe(2);
    const alias = { ...event, requestKey: randomUUID() };
    expect(
      (await race([alias, alias], context)).every(
        (reply) => reply.status === "fulfilled",
      ),
    ).toBe(true);
    expect(
      await database.requestIdentity.count({
        where: { operationId: original.result.operationId },
      }),
    ).toBe(3);
    expect(await snapshot(wallet.id)).toMatchObject({
      operations: 1,
      postings: 1,
      audits: 1,
    });
  });

  it("conflicts on a raced request alias across different wallets without returning the other result", async () => {
    const firstAccount = await createFinancialAccount(database);
    const secondAccount = await createFinancialAccount(database);
    const context: LedgerContext = {
      ...contextFor(firstAccount.wallet.id, firstAccount.ownerUserId),
      walletIds: [firstAccount.wallet.id, secondAccount.wallet.id],
      observe: async () => {},
    };
    const firstIntent = credit(firstAccount.wallet.id, "10");
    const secondIntent = {
      ...credit(secondAccount.wallet.id, "15"),
      requestKey: firstIntent.requestKey,
    };
    const replies = await race([firstIntent, secondIntent], context);
    expect(
      replies.filter((reply) => reply.status === "fulfilled"),
    ).toHaveLength(1);
    expect(replies.find((reply) => reply.status === "rejected")).toMatchObject({
      reason: { code: "LEDGER_IDENTITY_CONFLICT" },
    });
    const first = await snapshot(firstAccount.wallet.id);
    const second = await snapshot(secondAccount.wallet.id);
    expect(first.operations + second.operations).toBe(1);
    expect(first.postings + second.postings).toBe(1);
  });

  it.each(["SAME", "DIFFERENT"])(
    "releases one original allocation under concurrent %s identities",
    async (identity) => {
      const { wallet, ownerUserId } = await createFinancialAccount(database);
      const context = contextFor(wallet.id, ownerUserId);
      await serviceFor(database).execute(credit(wallet.id, "100"), context);
      const reserved = await serviceFor(database).execute(
        {
          ...financialIdentity(),
          kind: "RESERVE",
          walletId: wallet.id,
          amount: "80",
          reservationId: randomUUID(),
        },
        context,
      );
      if (reserved.result.kind !== "RESERVE")
        throw new Error("Expected reservation.");
      const release: LedgerIntent = {
        ...financialIdentity(),
        kind: "RELEASE",
        walletId: wallet.id,
        reservationId: reserved.result.reservation.id,
      };
      const replies = await race(
        [
          release,
          identity === "SAME"
            ? release
            : { ...release, ...financialIdentity() },
        ],
        context,
      );
      expect(
        replies.filter((reply) => reply.status === "fulfilled"),
      ).toHaveLength(identity === "SAME" ? 2 : 1);
      if (identity === "DIFFERENT")
        expect(
          replies.find((reply) => reply.status === "rejected"),
        ).toMatchObject({ reason: { code: "LEDGER_RESERVATION_CLOSED" } });
      else {
        const successful = replies.flatMap((reply) =>
          reply.status === "fulfilled" ? [reply.value] : [],
        );
        expect(successful[0]?.result).toEqual(successful[1]?.result);
        expect(successful.filter((reply) => reply.replayed)).toHaveLength(1);
      }
      expect(await snapshot(wallet.id)).toMatchObject({
        wallet: {
          availableNonReferralUnits: 100000000n,
          reservedNonReferralUnits: 0n,
        },
        operations: 3,
        postings: 3,
        audits: 3,
      });
    },
  );

  it("rechecks authority after a real account lock and denies a concurrent suspension", async () => {
    const { wallet, ownerUserId } = await createFinancialAccount(database);
    const context = contextFor(wallet.id, ownerUserId);
    await withIndependentFinancialClients(
      databaseUrl,
      async (blocker, contender) => {
        let unlock: () => void = () => {};
        let signalLocked: () => void = () => {};
        const held = new Promise<void>((resolve) => {
          signalLocked = resolve;
        });
        const release = new Promise<void>((resolve) => {
          unlock = resolve;
        });
        const suspension = blocker.$transaction(async (transaction) => {
          await transaction.user.update({
            where: { id: ownerUserId },
            data: { status: UserStatus.SUSPENDED },
          });
          signalLocked();
          await release;
        });
        await held;
        const pending = serviceFor(contender).execute(
          credit(wallet.id, "1"),
          context,
        );
        unlock();
        await suspension;
        await expect(pending).rejects.toMatchObject({
          code: "LEDGER_FORBIDDEN",
        });
      },
    );
    expect((await snapshot(wallet.id)).operations).toBe(0);
  });

  it("recognizes only real business/request unique constraints and recovers cross-wallet conflicts safely", async () => {
    const first = await createFinancialAccount(database);
    const second = await createFinancialAccount(database);
    const event = credit(first.wallet.id, "10");
    const original = await serviceFor(database).execute(
      event,
      contextFor(first.wallet.id, first.ownerUserId),
    );
    const saved = await database.financialOperation.findUniqueOrThrow({
      where: { id: original.result.operationId },
    });
    const failure: unknown = await database.financialOperation
      .create({
        data: {
          ...saved,
          id: randomUUID(),
          acceptedTerms: acceptedTermsSchema.parse(saved.acceptedTerms),
          outcome: financialOperationResultSchema.parse(saved.outcome),
        },
      })
      .catch((error: unknown) => error);
    if (!(failure instanceof Prisma.PrismaClientKnownRequestError))
      throw new Error("Expected real unique constraint error.");
    expect(failure.meta).toMatchObject({
      driverAdapterError: {
        cause: {
          originalCode: "23505",
          kind: "UniqueConstraintViolation",
          constraint: {
            fields: ["kind", "business_namespace", "business_key"],
          },
        },
      },
    });
    expect(isIdentityUniqueConflict(failure)).toBe(true);
    await expect(
      serviceFor(database).execute(
        { ...event, walletId: second.wallet.id },
        contextFor(second.wallet.id, second.ownerUserId),
      ),
    ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
  });

  it.each(["40001", "40P01"])(
    "bounds retries for real structured SQLSTATE %s failures and strips nested driver secrets",
    async (sqlState) => {
      const { wallet, ownerUserId } = await createFinancialAccount(database);
      const context = contextFor(wallet.id, ownerUserId);
      let attempts = 0;
      let authorityChecks = 0;
      const guardedContext = {
        ...context,
        mutate: () => {
          authorityChecks += 1;
          return Promise.resolve();
        },
      };
      let driverFailure: unknown;
      const failureStatement =
        sqlState === "40001"
          ? Prisma.sql`DO $$ BEGIN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'sentinel-driver-secret'; END $$`
          : Prisma.sql`DO $$ BEGIN RAISE EXCEPTION USING ERRCODE = '40P01', MESSAGE = 'sentinel-driver-secret'; END $$`;
      try {
        await database.$executeRaw(failureStatement);
      } catch (error) {
        driverFailure = error;
      }
      expect(driverFailure).toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
      if (!(driverFailure instanceof Prisma.PrismaClientKnownRequestError))
        throw new Error("Expected adapter error.");
      expect(driverFailure.code).toBe("P2010");
      const adapter = z
        .object({
          driverAdapterError: z.object({
            cause: z.object({ originalCode: z.string() }),
          }),
        })
        .parse(driverFailure.meta);
      expect(adapter.driverAdapterError.cause.originalCode).toBe(sqlState);
      const failure = await serviceFor(database)
        .execute(
          credit(wallet.id, "1"),
          guardedContext,
          async (transaction) => {
            attempts += 1;
            await transaction.$executeRaw(failureStatement);
          },
        )
        .catch((error: unknown) => error);
      expect(attempts).toBe(3);
      expect(authorityChecks).toBe(3);
      expect(failure).toMatchObject({ code: "LEDGER_UNRESOLVED" });
      expect(JSON.stringify(failure)).not.toContain("sentinel-driver-secret");
      expect(await snapshot(wallet.id)).toMatchObject({
        operations: 0,
        postings: 0,
        audits: 0,
      });
    },
  );

  it("resets rollback-only state after a caught real serialization failure", async () => {
    const { wallet, ownerUserId } = await createFinancialAccount(database);
    const context = contextFor(wallet.id, ownerUserId);
    const event = credit(wallet.id, "1");
    let attempts = 0;
    const result = await serviceFor(database).runInTransaction(
      context,
      async (_transaction, ledger) => {
        attempts += 1;
        try {
          await ledger.credit(event, async (transaction) => {
            if (attempts === 1) {
              await transaction.$executeRaw`DO $$ BEGIN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'sentinel-caught-retry-secret'; END $$`;
            }
          });
        } catch {
          // A later outer error must not hide the retryable child failure.
          throw new Error("sentinel-secondary-outer-failure");
        }
        return "completed";
      },
    );
    expect(result).toBe("completed");
    expect(attempts).toBe(2);
    expect(await snapshot(wallet.id)).toMatchObject({
      operations: 1,
      postings: 1,
      audits: 1,
    });
    const replay = await serviceFor(database).execute(event, context);
    expect(replay.replayed).toBe(true);
  });

  it("does not retry real integrity errors or authority denials and never exposes their payloads", async () => {
    const { wallet, ownerUserId } = await createFinancialAccount(database);
    const context = contextFor(wallet.id, ownerUserId);
    let domainAttempts = 0;
    const failure: unknown = await serviceFor(database)
      .execute(credit(wallet.id, "1"), context, async (transaction) => {
        domainAttempts += 1;
        await transaction.$executeRaw`DO $$ BEGIN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'sentinel-integrity-secret'; END $$`;
      })
      .catch((error: unknown) => error);
    expect(domainAttempts).toBe(1);
    expect(failure).toMatchObject({ code: "LEDGER_INTERNAL" });
    expect(JSON.stringify(failure)).not.toContain("sentinel-integrity-secret");
    let guardAttempts = 0;
    await expect(
      serviceFor(database).execute(credit(wallet.id, "1"), {
        ...context,
        mutate: () => {
          guardAttempts += 1;
          return Promise.reject(new LedgerError("LEDGER_FORBIDDEN"));
        },
      }),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    expect(guardAttempts).toBe(1);
    expect(await snapshot(wallet.id)).toMatchObject({
      operations: 0,
      postings: 0,
      audits: 0,
    });
  });
});
