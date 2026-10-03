import { randomUUID } from "node:crypto";

import { MAX_USDT_AMOUNT } from "@template/contracts";
import {
  createDatabaseClient,
  FundSource,
  UserStatus,
  UserRole,
  type Prisma,
} from "@template/database";
import { afterAll, describe, expect, it } from "vitest";

import { LedgerService } from "./ledger.service.js";
import { LedgerError } from "./ledger.errors.js";
import { acceptedTermsSchema } from "./ledger.types.js";
import { financialOperationResultSchema } from "@template/contracts";
import { parseUsdtAmount } from "../../core/financial/money.js";
import type {
  CreditIntent,
  LedgerContext,
  LedgerIntent,
  CorrectionIntent,
  ReservationIntent,
} from "./ledger.types.js";
import {
  createFinancialAccount,
  financialIdentity,
  fixedFinancialClock,
} from "./testing/financial-fixtures.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined)
  throw new Error("Missing isolated PostgreSQL URL.");
const database = createDatabaseClient(databaseUrl);
const NAMESPACE = "financial-test";
const PROCESS = "verified-events";
const RECORDED_AT = "2026-10-02T09:00:00.000Z";
const service = new LedgerService(database, {
  businessNamespaces: [NAMESPACE],
  processIds: [PROCESS],
});

const fixture = async () => {
  const account = await createFinancialAccount(database);
  const context: LedgerContext = {
    actor: { type: "USER", userId: account.ownerUserId },
    walletIds: [account.wallet.id],
    clock: fixedFinancialClock(new Date(RECORDED_AT)),
    observe: ({ wallet, actor }) => {
      if (actor.type !== "USER" || wallet.ownerUserId !== actor.userId)
        return Promise.reject(new LedgerError("LEDGER_FORBIDDEN"));
      return Promise.resolve();
    },
    mutate: async () => {},
    eligibleSources: () =>
      Promise.resolve([FundSource.NON_REFERRAL, FundSource.REFERRAL]),
    releaseSafety: async () => {},
  };
  return { ...account, context };
};
const credit = (
  walletId: string,
  amount: string,
  source: FundSource = FundSource.NON_REFERRAL,
): CreditIntent => ({
  ...financialIdentity(),
  kind: "CREDIT",
  walletId,
  amount,
  source,
  origin: source === FundSource.REFERRAL ? "REFERRAL_COMMISSION" : "DEPOSIT",
});
const debit = (walletId: string, amount: string): LedgerIntent => ({
  ...financialIdentity(),
  kind: "PURCHASE_DEBIT",
  walletId,
  amount,
});
const reserve = (walletId: string, amount: string): ReservationIntent => ({
  ...financialIdentity(),
  kind: "RESERVE",
  walletId,
  amount,
  reservationId: randomUUID(),
});
const release = (walletId: string, reservationId: string): LedgerIntent => ({
  ...financialIdentity(),
  kind: "RELEASE",
  walletId,
  reservationId,
});
const records = async (walletId: string) => ({
  wallet: await database.wallet.findUniqueOrThrow({ where: { id: walletId } }),
  operations: await database.financialOperation.findMany({
    where: { walletId },
    orderBy: { id: "asc" },
  }),
  postings: await database.ledgerPosting.findMany({
    where: { walletId },
    orderBy: { id: "asc" },
  }),
  allocations: await database.reservationAllocation.findMany({
    where: { walletId },
    orderBy: { id: "asc" },
  }),
  audits: await database.auditRecord.findMany({
    where: { operation: { walletId } },
    orderBy: { id: "asc" },
  }),
  identities: await database.requestIdentity.findMany({
    where: { operation: { walletId } },
    orderBy: { id: "asc" },
  }),
});

afterAll(async () => {
  await database.$disconnect();
});

describe("audited available-source corrections", () => {
  const adminFixture = async () => {
    const account = await fixture();
    const admin = await createFinancialAccount(database);
    await database.user.update({
      where: { id: admin.ownerUserId },
      data: { role: UserRole.ADMIN },
    });
    const context: LedgerContext = {
      ...account.context,
      actor: { type: "USER", userId: admin.ownerUserId },
      observe: async () => {},
    };
    const original = await service.execute(
      credit(account.wallet.id, "20"),
      account.context,
    );
    const intent: CorrectionIntent = {
      ...financialIdentity(),
      kind: "CORRECTION",
      walletId: account.wallet.id,
      amount: "5",
      source: "NON_REFERRAL",
      direction: "DEBIT",
      reason: "Correct manual entry",
      referenceOperationId: original.result.operationId,
    };
    return { ...account, admin, adminContext: context, original, intent };
  };

  it("appends a correction in the same transaction and replays original evidence once", async () => {
    const f = await adminFixture();
    const before = await records(f.wallet.id);
    const corrected = await service.runInTransaction(
      f.adminContext,
      async (_transaction, ledger) => ledger.correctAvailable(f.intent),
    );
    expect(corrected.result.walletAfter.availableNonReferral).toBe("15");
    const after = await records(f.wallet.id);
    expect(after.operations).toHaveLength(2);
    expect(after.postings).toHaveLength(2);
    expect(after.audits).toHaveLength(2);
    expect(
      after.postings.find(
        ({ operationId }) => operationId === corrected.result.operationId,
      ),
    ).toMatchObject({
      source: "NON_REFERRAL",
      availableDeltaUnits: -5_000_000n,
      reservedDeltaUnits: 0n,
    });
    expect(
      after.operations.find(({ id }) => id === f.original.result.operationId),
    ).toEqual(before.operations[0]);
    expect(
      after.postings.filter(
        ({ operationId }) => operationId === f.original.result.operationId,
      ),
    ).toEqual(before.postings);
    expect(
      after.operations.find(({ id }) => id === corrected.result.operationId)
        ?.acceptedTerms,
    ).toMatchObject({
      kind: "CORRECTION",
      walletBefore: f.original.result.walletAfter,
      source: "NON_REFERRAL",
      direction: "DEBIT",
      reason: f.intent.reason,
      referenceOperationId: f.original.result.operationId,
    });
    expect(
      after.audits.find(
        ({ operationId }) => operationId === corrected.result.operationId,
      ),
    ).toMatchObject({
      actorUserId: f.admin.ownerUserId,
      action: "CORRECTION",
      reason: f.intent.reason,
      referenceOperationId: f.original.result.operationId,
    });
    expect((await service.execute(f.intent, f.adminContext)).result).toEqual(
      corrected.result,
    );
    expect(await records(f.wallet.id)).toEqual(after);
    for (const change of [
      { direction: "CREDIT" },
      { reason: "Another reason" },
      { source: "REFERRAL" },
      { referenceOperationId: corrected.result.operationId },
    ]) {
      await expect(
        service.execute({ ...f.intent, ...change }, f.adminContext),
      ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
    }
    expect(await records(f.wallet.id)).toEqual(after);
  });

  it("rejects ordinary, downgraded, suspended and process actors before new effects", async () => {
    const f = await adminFixture();
    const before = await records(f.wallet.id);
    await expect(
      service.execute(f.intent, { ...f.adminContext, actor: f.context.actor }),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    await expect(
      service.execute(f.intent, {
        ...f.adminContext,
        actor: { type: "PROCESS", processId: PROCESS },
      }),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    await database.user.update({
      where: { id: f.admin.ownerUserId },
      data: { role: UserRole.USER },
    });
    await expect(
      service.execute(f.intent, f.adminContext),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    await database.user.update({
      where: { id: f.admin.ownerUserId },
      data: { role: UserRole.ADMIN, status: UserStatus.SUSPENDED },
    });
    await expect(
      service.execute(f.intent, f.adminContext),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    expect(await records(f.wallet.id)).toEqual(before);
  });

  it("cannot debit reserved funds, reference another wallet or accept invalid reason/authority fields", async () => {
    const f = await adminFixture();
    await service.execute(reserve(f.wallet.id, "18"), f.context);
    const other = await fixture();
    const otherCredit = await service.execute(
      credit(other.wallet.id, "1"),
      other.context,
    );
    const before = await records(f.wallet.id);
    await expect(
      service.execute(f.intent, f.adminContext),
    ).rejects.toMatchObject({ code: "LEDGER_INSUFFICIENT_FUNDS" });
    await expect(
      service.execute(
        {
          ...f.intent,
          amount: "1",
          referenceOperationId: otherCredit.result.operationId,
        },
        f.adminContext,
      ),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    for (const change of [
      { reason: "  " },
      { reason: "x".repeat(501) },
      { direction: "RELABEL" },
      { role: "ADMIN" },
    ]) {
      await expect(
        service.execute({ ...f.intent, ...change }, f.adminContext),
      ).rejects.toMatchObject({ code: "LEDGER_INVALID_INTENT" });
    }
    expect(await records(f.wallet.id)).toEqual(before);
  });

  it("rolls back correction, audit and projection when dependent work fails; credits only the declared source", async () => {
    const f = await adminFixture();
    const before = await records(f.wallet.id);
    await expect(
      service.execute(f.intent, f.adminContext, () =>
        Promise.reject(new Error("Controlled dependent failure")),
      ),
    ).rejects.toMatchObject({ code: "LEDGER_INTERNAL" });
    expect(await records(f.wallet.id)).toEqual(before);
    const credited = await service.execute(
      { ...f.intent, direction: "CREDIT", source: "REFERRAL" },
      f.adminContext,
    );
    expect(credited.result.walletAfter).toMatchObject({
      availableReferral: "5",
      availableNonReferral: "20",
      reservedReferral: "0",
      total: "25",
    });
  });
});

describe("source-aware atomic ledger", () => {
  it("spends referral first, reserves gross non-referral first and releases original sources after expiry", async () => {
    const { wallet, context } = await fixture();
    await service.execute(credit(wallet.id, "70"), context);
    await service.execute(
      credit(wallet.id, "30", FundSource.REFERRAL),
      context,
    );
    const spent = await service.execute(debit(wallet.id, "20"), context);
    expect(spent.result.walletAfter).toEqual({
      availableNonReferral: "70",
      availableReferral: "10",
      reservedNonReferral: "0",
      reservedReferral: "0",
      total: "80",
    });
    const reservationIntent = reserve(wallet.id, "75");
    const reserved = await service.execute(reservationIntent, context);
    if (reserved.result.kind !== "RESERVE")
      throw new Error("Expected reservation.");
    expect(reserved.result.reservation.allocation).toEqual({
      nonReferral: "70",
      referral: "5",
      gross: "75",
    });
    const held = await records(wallet.id);
    await expect(
      service.execute(debit(wallet.id, "6"), context),
    ).rejects.toMatchObject({ code: "LEDGER_INSUFFICIENT_FUNDS" });
    expect(await records(wallet.id)).toEqual(held);
    const expired = {
      ...context,
      eligibleSources: () => Promise.resolve([FundSource.NON_REFERRAL]),
    };
    const releaseIntent = release(wallet.id, reserved.result.reservation.id);
    const released = await service.execute(releaseIntent, expired);
    expect(released.result.walletAfter).toEqual(spent.result.walletAfter);
    expect(await service.execute(releaseIntent, expired)).toEqual({
      result: released.result,
      replayed: true,
    });
    const original = await service.execute(reservationIntent, expired);
    expect(original).toEqual({ result: reserved.result, replayed: true });
    const saved = await records(wallet.id);
    expect(saved.operations).toHaveLength(5);
    expect(saved.postings).toHaveLength(7);
    expect(saved.audits).toHaveLength(5);
    expect(saved.allocations).toHaveLength(1);
    expect(saved.allocations[0]).toMatchObject({
      nonReferralUnits: 70000000n,
      referralUnits: 5000000n,
      state: "RELEASED",
    });
    const accepted = saved.operations.find(
      (operation) => operation.id === reserved.result.operationId,
    );
    expect(accepted?.acceptedTerms).toEqual({
      kind: "RESERVE",
      walletBefore: spent.result.walletAfter,
      reservationId: reserved.result.reservation.id,
      eligibleSources: ["NON_REFERRAL", "REFERRAL"],
    });
    expect(accepted?.outcome).toEqual(reserved.result);
    for (const operation of saved.operations) {
      const terms = acceptedTermsSchema.parse(operation.acceptedTerms);
      const outcome = financialOperationResultSchema.parse(operation.outcome);
      for (const source of [FundSource.NON_REFERRAL, FundSource.REFERRAL]) {
        const movements = saved.postings.filter(
          (posting) =>
            posting.operationId === operation.id && posting.source === source,
        );
        const available =
          source === FundSource.NON_REFERRAL
            ? "availableNonReferral"
            : "availableReferral";
        const held =
          source === FundSource.NON_REFERRAL
            ? "reservedNonReferral"
            : "reservedReferral";
        expect(
          parseUsdtAmount(terms.walletBefore[available]) +
            movements.reduce(
              (sum, posting) => sum + posting.availableDeltaUnits,
              0n,
            ),
        ).toBe(parseUsdtAmount(outcome.walletAfter[available]));
        expect(
          parseUsdtAmount(terms.walletBefore[held]) +
            movements.reduce(
              (sum, posting) => sum + posting.reservedDeltaUnits,
              0n,
            ),
        ).toBe(parseUsdtAmount(outcome.walletAfter[held]));
      }
      expect(
        saved.audits.filter((audit) => audit.operationId === operation.id),
      ).toEqual([
        expect.objectContaining({
          action: operation.kind,
          actorType: operation.actorType,
          actorUserId: operation.actorUserId,
          createdAt: operation.createdAt,
        }),
      ]);
    }
  });

  it("retains locked referral ownership for Free accounts but allows purchase spending", async () => {
    const { wallet, context } = await fixture();
    await service.execute(credit(wallet.id, "10"), context);
    await service.execute(
      credit(wallet.id, "30", FundSource.REFERRAL),
      context,
    );
    const free = {
      ...context,
      eligibleSources: () => Promise.resolve([FundSource.NON_REFERRAL]),
    };
    const before = await records(wallet.id);
    await expect(
      service.execute(reserve(wallet.id, "11"), free),
    ).rejects.toMatchObject({ code: "LEDGER_INSUFFICIENT_FUNDS" });
    expect(await records(wallet.id)).toEqual(before);
    const purchase = await service.execute(debit(wallet.id, "20"), free);
    expect(purchase.result.walletAfter.availableReferral).toBe("10");
    const reserved = await service.execute(reserve(wallet.id, "10"), free);
    expect(reserved.result.walletAfter).toMatchObject({
      availableReferral: "10",
      reservedReferral: "0",
      reservedNonReferral: "10",
    });
  });

  it("denies unsafe, wrong-wallet and closed releases without any effects", async () => {
    const { wallet, context } = await fixture();
    await service.execute(credit(wallet.id, "20"), context);
    const reserved = await service.execute(reserve(wallet.id, "15"), context);
    if (reserved.result.kind !== "RESERVE")
      throw new Error("Expected reservation.");
    const before = await records(wallet.id);
    const unsafe = {
      ...context,
      releaseSafety: () => Promise.reject(new LedgerError("LEDGER_FORBIDDEN")),
    };
    await expect(
      service.execute(
        release(wallet.id, reserved.result.reservation.id),
        unsafe,
      ),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    expect(await records(wallet.id)).toEqual(before);
    const stranger = await fixture();
    await expect(
      service.execute(
        release(stranger.wallet.id, reserved.result.reservation.id),
        stranger.context,
      ),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    await service.execute(
      release(wallet.id, reserved.result.reservation.id),
      context,
    );
    const closed = await records(wallet.id);
    await expect(
      service.execute(
        release(wallet.id, reserved.result.reservation.id),
        context,
      ),
    ).rejects.toMatchObject({ code: "LEDGER_RESERVATION_CLOSED" });
    expect(await records(wallet.id)).toEqual(closed);
  });

  it("rejects aggregate overflow before inserting history", async () => {
    const { wallet, context } = await fixture();
    await service.execute(credit(wallet.id, MAX_USDT_AMOUNT), context);
    const before = await records(wallet.id);
    await expect(
      service.execute(
        credit(wallet.id, "0.000001", FundSource.REFERRAL),
        context,
      ),
    ).rejects.toMatchObject({ code: "LEDGER_AMOUNT_BOUNDS" });
    expect(await records(wallet.id)).toEqual(before);
  });

  it("requires trusted origin, ownership and current authority, while earned process credits can reach suspended recipients", async () => {
    const { wallet, context, ownerUserId } = await fixture();
    const before = await records(wallet.id);
    for (const origin of [
      "ADMIN_ADJUSTMENT",
      "PACKAGE_PURCHASE",
      "REFERRAL_COMMISSION",
    ]) {
      await expect(
        service.execute({ ...credit(wallet.id, "1"), origin }, context),
      ).rejects.toMatchObject({ code: "LEDGER_INVALID_INTENT" });
    }
    await expect(
      service.execute({ ...credit(wallet.id, "1"), confirmed: true }, context),
    ).rejects.toMatchObject({ code: "LEDGER_INVALID_INTENT" });
    await expect(
      service.execute(credit(wallet.id, "1"), {
        ...context,
        mutate: () => Promise.reject(new LedgerError("LEDGER_FORBIDDEN")),
      }),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    await expect(
      service.execute(credit(wallet.id, "1"), undefined),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    for (const forged of [
      null,
      {},
      { ...context, actor: { type: "PROCESS", processId: "untrusted" } },
      { ...context, actor: { ...context.actor, role: "ADMIN" } },
      { ...context, mutate: undefined },
    ]) {
      await expect(
        service.execute(credit(wallet.id, "1"), forged),
      ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    }
    const stranger = await fixture();
    await expect(
      service.execute(credit(wallet.id, "1"), {
        ...stranger.context,
        walletIds: [wallet.id],
      }),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    expect(await records(wallet.id)).toEqual(before);
    await database.user.update({
      where: { id: ownerUserId },
      data: { status: UserStatus.SUSPENDED },
    });
    await expect(
      service.execute(credit(wallet.id, "1"), context),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    const processContext: LedgerContext = {
      ...context,
      actor: { type: "PROCESS", processId: PROCESS },
      observe: async () => {},
    };
    const earned = await service.execute(
      credit(wallet.id, "1"),
      processContext,
    );
    expect(earned.result.walletAfter.availableNonReferral).toBe("1");
    const operation = await database.financialOperation.findUniqueOrThrow({
      where: { id: earned.result.operationId },
    });
    expect(operation.acceptedTerms).toMatchObject({
      source: "NON_REFERRAL",
      walletBefore: { total: "0" },
    });
  });
});

describe("immutable replay and rollback", () => {
  const DELIVERIES = 100;
  it("applies 100 credit and debit deliveries once with original snapshots and independent aliases", async () => {
    const { wallet, context } = await fixture();
    const event = credit(wallet.id, "100");
    const first = await service.execute(event, context);
    const purchase = debit(wallet.id, "20");
    const spent = await service.execute(purchase, context);
    let callbackWrites = 0;
    for (let delivery = 1; delivery < DELIVERIES; delivery += 1) {
      const { requestKey: _creditKey, ...unkeyedCredit } = event;
      const { requestKey: _debitKey, ...unkeyedDebit } = purchase;
      const creditDelivery =
        delivery % 3 === 0
          ? unkeyedCredit
          : {
              ...event,
              requestKey: delivery % 3 === 1 ? event.requestKey : randomUUID(),
            };
      const debitDelivery =
        delivery % 3 === 0
          ? unkeyedDebit
          : {
              ...purchase,
              requestKey:
                delivery % 3 === 1 ? purchase.requestKey : randomUUID(),
            };
      expect(
        await service.execute(creditDelivery, context, () => {
          callbackWrites += 1;
          return Promise.resolve();
        }),
      ).toEqual({ result: first.result, replayed: true });
      expect(await service.execute(debitDelivery, context)).toEqual({
        result: spent.result,
        replayed: true,
      });
    }
    expect(callbackWrites).toBe(0);
    expect(await service.recoverOperation(event, context)).toEqual({
      result: first.result,
      replayed: true,
    });
    const final = await records(wallet.id);
    expect(final.wallet.availableNonReferralUnits).toBe(80000000n);
    expect(final.operations).toHaveLength(2);
    expect(final.postings).toHaveLength(2);
    expect(final.audits).toHaveLength(2);
    expect(
      final.operations.find(
        (operation) => operation.id === first.result.operationId,
      )?.acceptedTerms,
    ).toMatchObject({ walletBefore: { total: "0" } });
  });

  it("conflicts on changed consequential intent or changed alias reuse and keeps actors/kinds independent", async () => {
    const { wallet, context } = await fixture();
    const event = credit(wallet.id, "100");
    await service.execute(event, context);
    const aliasKey = randomUUID();
    await service.execute({ ...event, requestKey: aliasKey }, context);
    const before = await records(wallet.id);
    const changedIntents = [
      { ...event, amount: "101" },
      { ...event, source: "REFERRAL", origin: "REFERRAL_COMMISSION" },
      { ...credit(wallet.id, "1"), requestKey: aliasKey },
    ];
    for (const changed of changedIntents)
      await expect(service.execute(changed, context)).rejects.toMatchObject({
        code: "LEDGER_IDENTITY_CONFLICT",
      });
    expect(await records(wallet.id)).toEqual(before);
    await service.execute(
      { ...debit(wallet.id, "1"), requestKey: aliasKey },
      context,
    );
    const other = await fixture();
    await service.execute(
      { ...credit(other.wallet.id, "1"), requestKey: aliasKey },
      other.context,
    );
    await expect(
      service.execute(event, {
        ...context,
        observe: () => Promise.reject(new LedgerError("LEDGER_FORBIDDEN")),
      }),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    await expect(
      service.recoverOperation(event, {
        ...context,
        observe: () => Promise.reject(new LedgerError("LEDGER_FORBIDDEN")),
      }),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
  });

  it("rolls back finance and dependent domain writes on callback failure and recovers a lost committed reply", async () => {
    const { wallet, context, ownerUserId } = await fixture();
    const event = credit(wallet.id, "40");
    const before = await records(wallet.id);
    await expect(
      service.execute(event, context, async (transaction) => {
        await transaction.user.update({
          where: { id: ownerUserId },
          data: { fullName: "Uncommitted domain change" },
        });
        throw new Error("sentinel-private-driver-payload");
      }),
    ).rejects.toMatchObject({ code: "LEDGER_INTERNAL" });
    expect(await records(wallet.id)).toEqual(before);
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: ownerUserId } }))
        .fullName,
    ).toBe("Financial Fixture Owner");
    expect(await service.recoverOperation(event, context)).toBeNull();
    const committed = await service.execute(event, context);
    await service.execute(credit(wallet.id, "10"), context);
    expect(await service.recoverOperation(event, context)).toEqual({
      result: committed.result,
      replayed: true,
    });
    expect(JSON.stringify(committed)).not.toContain("acceptedTerms");
  });

  it.each(["observe", "mutate", "eligibleSources", "releaseSafety"] as const)(
    "classifies unexpected %s faults safely without retries or writes",
    async (guard) => {
      const { wallet, context } = await fixture();
      await service.execute(credit(wallet.id, "100"), context);
      const reservation = reserve(wallet.id, "20");
      if (guard === "releaseSafety")
        await service.execute(reservation, context);
      const before = await records(wallet.id);
      const fault = new TypeError("sentinel-private-authority-fault");
      let attempts = 0;
      const brokenContext = {
        ...context,
        [guard]: () => {
          attempts += 1;
          return Promise.reject(fault);
        },
      };
      const event =
        guard === "releaseSafety"
          ? release(wallet.id, reservation.reservationId)
          : guard === "eligibleSources"
            ? reservation
            : credit(wallet.id, "1");
      const failure: unknown = await service
        .execute(event, brokenContext)
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(LedgerError);
      expect(failure).toMatchObject({
        code: "LEDGER_INTERNAL",
        statusCode: 500,
        cause: fault,
      });
      expect(attempts).toBe(1);
      expect(JSON.stringify(failure)).not.toContain(
        "sentinel-private-authority-fault",
      );
      expect(await records(wallet.id)).toEqual(before);
    },
  );

  it("protects replay and recovery results when observation fails unexpectedly", async () => {
    const { wallet, context } = await fixture();
    const event = credit(wallet.id, "10");
    await service.execute(event, context);
    const before = await records(wallet.id);
    const fault = new Error("sentinel-private-replay-fault");
    const brokenContext = {
      ...context,
      observe: () => Promise.reject(fault),
    };
    for (const attempt of [
      () => service.execute(event, brokenContext),
      () => service.recoverOperation(event, brokenContext),
    ]) {
      const failure: unknown = await attempt().catch((error: unknown) => error);
      expect(failure).toMatchObject({ code: "LEDGER_INTERNAL", cause: fault });
      expect(JSON.stringify(failure)).not.toContain(
        "sentinel-private-replay-fault",
      );
      expect(JSON.stringify(failure)).not.toContain("walletAfter");
    }
    expect(await records(wallet.id)).toEqual(before);
  });

  it.each(["validation", "reentrancy"] as const)(
    "forces rollback after a caught %s failure",
    async (failureKind) => {
      const { wallet, context } = await fixture();
      const before = await records(wallet.id);
      let caught: unknown;
      const code =
        failureKind === "validation"
          ? "LEDGER_INVALID_INTENT"
          : "LEDGER_INVALID_TRANSACTION";
      await expect(
        service.runInTransaction(context, async (_transaction, ledger) => {
          await ledger.credit(credit(wallet.id, "10"));
          if (failureKind === "validation") {
            try {
              await ledger.credit(credit(wallet.id, "-1"));
            } catch (error) {
              caught = error;
            }
          } else {
            await ledger.credit(credit(wallet.id, "1"), async () => {
              try {
                await ledger.credit(credit(wallet.id, "2"));
              } catch (error) {
                caught = error;
              }
            });
          }
          return "caller completed";
        }),
      ).rejects.toMatchObject({ code });
      expect(caught).toMatchObject({ code });
      expect(await records(wallet.id)).toEqual(before);
    },
  );

  it("forces rollback when a post-finance domain failure is caught", async () => {
    const { wallet, context, ownerUserId } = await fixture();
    const event = credit(wallet.id, "40");
    const before = await records(wallet.id);
    const fault = new Error("sentinel-caught-domain-failure");
    let caught: unknown;
    await expect(
      service.runInTransaction(context, async (_transaction, ledger) => {
        try {
          await ledger.credit(event, async (transaction) => {
            await transaction.user.update({
              where: { id: ownerUserId },
              data: { fullName: "Must roll back" },
            });
            throw fault;
          });
        } catch (error) {
          caught = error;
        }
        return "caller completed";
      }),
    ).rejects.toMatchObject({ code: "LEDGER_INTERNAL" });
    expect(caught).toBe(fault);
    expect(await records(wallet.id)).toEqual(before);
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: ownerUserId } }))
        .fullName,
    ).toBe("Financial Fixture Owner");
    expect(await service.recoverOperation(event, context)).toBeNull();
  });

  it("forces rollback of earlier children when a second child failure is caught", async () => {
    const first = await fixture();
    const second = await fixture();
    await service.execute(credit(second.wallet.id, "100"), second.context);
    const beforeFirst = await records(first.wallet.id);
    const beforeSecond = await records(second.wallet.id);
    const fault = new Error("sentinel-second-child-failure");
    let subsequentFailure: unknown;
    const context = {
      ...first.context,
      walletIds: [first.wallet.id, second.wallet.id],
      observe: async () => {},
    };
    await expect(
      service.runInTransaction(context, async (_transaction, ledger) => {
        await ledger.credit(credit(first.wallet.id, "25"));
        try {
          await ledger.reserveForWithdrawal(
            reserve(second.wallet.id, "20"),
            async (transaction) => {
              await transaction.user.update({
                where: { id: second.ownerUserId },
                data: { fullName: "Must roll back" },
              });
              throw fault;
            },
          );
        } catch {
          // The caller deliberately handles the child failure.
        }
        try {
          await ledger.credit(credit(first.wallet.id, "5"));
        } catch (error) {
          subsequentFailure = error;
        }
        return "caller completed";
      }),
    ).rejects.toMatchObject({ code: "LEDGER_INTERNAL" });
    expect(subsequentFailure).toBe(fault);
    expect(await records(first.wallet.id)).toEqual(beforeFirst);
    expect(await records(second.wallet.id)).toEqual(beforeSecond);
    expect(
      (
        await database.user.findUniqueOrThrow({
          where: { id: second.ownerUserId },
        })
      ).fullName,
    ).toBe("Financial Fixture Owner");
  });

  it("aborts a two-wallet outer operation and never treats a recovered child as compound success", async () => {
    const first = await fixture();
    const second = await fixture();
    const committedIntent = credit(second.wallet.id, "10");
    await service.execute(committedIntent, second.context);
    const beforeFirst = await records(first.wallet.id);
    const beforeSecond = await records(second.wallet.id);
    const compoundContext = {
      ...first.context,
      walletIds: [second.wallet.id, first.wallet.id],
      observe: async () => {},
    };
    await expect(
      service.runInTransaction(compoundContext, async (transaction, ledger) => {
        await ledger.credit(credit(first.wallet.id, "25"));
        await transaction.user.update({
          where: { id: first.ownerUserId },
          data: { fullName: "Must roll back" },
        });
        await ledger.credit({
          ...committedIntent,
          kind: "CREDIT",
          amount: "11",
        });
      }),
    ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
    expect(await records(first.wallet.id)).toEqual(beforeFirst);
    expect(await records(second.wallet.id)).toEqual(beforeSecond);
    expect(
      (
        await database.user.findUniqueOrThrow({
          where: { id: first.ownerUserId },
        })
      ).fullName,
    ).toBe("Financial Fixture Owner");
  });

  it("rejects undeclared wallets, nested transactions and transaction handles used after commit", async () => {
    const first = await fixture();
    const second = await fixture();
    await expect(
      service.runInTransaction(first.context, async (_transaction, ledger) =>
        ledger.credit(credit(second.wallet.id, "1")),
      ),
    ).rejects.toMatchObject({ code: "LEDGER_INVALID_TRANSACTION" });
    await expect(
      service.runInTransaction(first.context, async () =>
        service.execute(credit(first.wallet.id, "1"), first.context),
      ),
    ).rejects.toMatchObject({ code: "LEDGER_INVALID_TRANSACTION" });
    const handle = await service.runInTransaction(
      first.context,
      (_transaction, ledger) => Promise.resolve(ledger),
    );
    await expect(
      handle.credit(credit(first.wallet.id, "1")),
    ).rejects.toMatchObject({ code: "LEDGER_INVALID_TRANSACTION" });
    expect((await records(first.wallet.id)).operations).toHaveLength(0);
    await expect(
      service.runInTransaction(first.context, async (_transaction, ledger) =>
        Promise.all([
          ledger.credit(credit(first.wallet.id, "1")),
          ledger.credit(credit(first.wallet.id, "2")),
        ]),
      ),
    ).rejects.toMatchObject({ code: "LEDGER_INVALID_TRANSACTION" });
    expect((await records(first.wallet.id)).operations).toHaveLength(0);
  });

  it("rechecks changed authority inside an outer transaction and rolls back its prior writes", async () => {
    const { wallet, context, ownerUserId } = await fixture();
    await expect(
      service.runInTransaction(context, async (transaction, ledger) => {
        await ledger.credit(credit(wallet.id, "10"));
        await transaction.user.update({
          where: { id: ownerUserId },
          data: { status: UserStatus.SUSPENDED },
        });
        await ledger.credit(credit(wallet.id, "1"));
      }),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    expect((await records(wallet.id)).operations).toHaveLength(0);
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: ownerUserId } }))
        .status,
    ).toBe(UserStatus.ACTIVE);
  });

  it("returns unresolved after standalone uniqueness rollback and aborts compound uniqueness without recovering a child", async () => {
    const first = await fixture();
    const second = await fixture();
    const committed = await service.execute(
      credit(first.wallet.id, "10"),
      first.context,
    );
    const alias = await database.requestIdentity.findFirstOrThrow({
      where: { operationId: committed.result.operationId },
    });
    const collision = async (transaction: Prisma.TransactionClient) => {
      await transaction.requestIdentity.create({
        data: { ...alias, id: randomUUID() },
      });
    };
    const beforeFirst = await records(first.wallet.id);
    const beforeSecond = await records(second.wallet.id);
    await expect(
      service.execute(credit(first.wallet.id, "1"), first.context, collision),
    ).rejects.toMatchObject({ code: "LEDGER_UNRESOLVED" });
    expect(await records(first.wallet.id)).toEqual(beforeFirst);
    const compound = {
      ...first.context,
      walletIds: [first.wallet.id, second.wallet.id],
      observe: async () => {},
    };
    await expect(
      service.runInTransaction(compound, async (_transaction, ledger) => {
        await ledger.credit(credit(first.wallet.id, "1"));
        await ledger.credit(credit(second.wallet.id, "2"), collision);
      }),
    ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
    expect(await records(first.wallet.id)).toEqual(beforeFirst);
    expect(await records(second.wallet.id)).toEqual(beforeSecond);
  });
});
