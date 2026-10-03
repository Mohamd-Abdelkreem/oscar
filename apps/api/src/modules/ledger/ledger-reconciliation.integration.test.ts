import { randomUUID } from "node:crypto";

import { MAX_USDT_AMOUNT } from "@template/contracts";
import {
  createDatabaseClient,
  FundSource,
  UserRole,
  type Prisma,
} from "@template/database";
import { afterAll, describe, expect, it } from "vitest";

import { parseUsdtAmount } from "../../core/financial/money.js";
import { LedgerService } from "./ledger.service.js";
import { LedgerError } from "./ledger.errors.js";
import type {
  LedgerContext,
  LedgerObservationContext,
} from "./ledger.types.js";
import {
  createFinancialAccount,
  financialIdentity,
  fixedFinancialClock,
} from "./testing/financial-fixtures.js";

const url = process.env["DATABASE_URL"];
if (url === undefined) throw new Error("Isolated PostgreSQL is required.");
const database = createDatabaseClient(url);
const service = new LedgerService(database, {
  businessNamespaces: ["financial-test"],
  processIds: ["fixture"],
});
const instant = "2026-10-02T09:00:00.000Z";
const zero = {
  availableNonReferral: "0",
  reservedNonReferral: "0",
  availableReferral: "0",
  reservedReferral: "0",
  total: "0",
};
const fixture = async () => {
  const account = await createFinancialAccount(database);
  const observation: LedgerObservationContext = {
    actor: { type: "USER", userId: account.ownerUserId },
    observe: ({ wallet, actor }) => {
      if (actor.type !== "USER" || actor.userId !== wallet.ownerUserId)
        return Promise.reject(new LedgerError("LEDGER_FORBIDDEN"));
      return Promise.resolve();
    },
  };
  const context: LedgerContext = {
    ...observation,
    walletIds: [account.wallet.id],
    clock: fixedFinancialClock(new Date(instant)),
    mutate: async () => {},
    eligibleSources: () =>
      Promise.resolve([FundSource.NON_REFERRAL, FundSource.REFERRAL]),
    releaseSafety: async () => {},
  };
  return { ...account, observation, context };
};
const credit = (
  walletId: string,
  amount: string,
  source: FundSource = FundSource.NON_REFERRAL,
) => ({
  ...financialIdentity(),
  kind: "CREDIT",
  walletId,
  amount,
  source,
  origin:
    source === FundSource.NON_REFERRAL ? "DEPOSIT" : "REFERRAL_COMMISSION",
});
const snapshot = async (walletId: string) => ({
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
  aliases: await database.requestIdentity.findMany({
    where: { operation: { walletId } },
    orderBy: { id: "asc" },
  }),
});
// New admissible rows retain all insert/immutability guards; faults are cross-row inconsistencies.
const seedCredit = async ({
  walletId,
  amount = "10",
  posted = "10",
  audit = true,
  outcome,
  terms,
}: {
  walletId: string;
  amount?: string;
  posted?: string | null;
  audit?: boolean;
  outcome?: Prisma.InputJsonObject;
  terms?: Prisma.InputJsonObject;
}) => {
  const id = randomUUID();
  const after = {
    ...zero,
    availableNonReferral: posted ?? "0",
    total: posted ?? "0",
  };
  await database.financialOperation.create({
    data: {
      id,
      walletId,
      kind: "CREDIT",
      businessNamespace: "financial-test",
      businessKey: randomUUID(),
      intentHash: "a".repeat(64),
      magnitudeUnits: parseUsdtAmount(amount),
      origin: "DEPOSIT",
      actorType: "PROCESS",
      actorProcessId: "fixture",
      acceptedTerms: terms ?? {
        kind: "CREDIT",
        walletBefore: zero,
        source: "NON_REFERRAL",
      },
      outcome: outcome ?? {
        operationId: id,
        walletId,
        kind: "CREDIT",
        amount,
        recordedAt: instant,
        walletAfter: after,
      },
      createdAt: new Date(instant),
    },
  });
  if (posted !== null)
    await database.ledgerPosting.create({
      data: {
        operationId: id,
        walletId,
        source: "NON_REFERRAL",
        availableDeltaUnits: parseUsdtAmount(posted),
        reservedDeltaUnits: 0n,
      },
    });
  if (audit)
    await database.auditRecord.create({
      data: {
        operationId: id,
        actorType: "PROCESS",
        actorProcessId: "fixture",
        action: "CREDIT",
        createdAt: new Date(instant),
      },
    });
  return id;
};
afterAll(async () => {
  await database.$disconnect();
});

describe("scoped read-only ledger reconciliation", () => {
  it("retains unexpected observation faults without disclosing a report or changing history", async () => {
    const f = await fixture();
    await service.execute(credit(f.wallet.id, "10"), f.context);
    const before = await snapshot(f.wallet.id);
    const fault = new TypeError("sentinel-private-reconciliation-fault");
    let attempts = 0;
    const failure: unknown = await service
      .reconcileWallet(f.wallet.id, {
        ...f.observation,
        observe: () => {
          attempts += 1;
          return Promise.reject(fault);
        },
      })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(LedgerError);
    expect(failure).toMatchObject({
      code: "LEDGER_INTERNAL",
      statusCode: 500,
      cause: fault,
    });
    expect(attempts).toBe(1);
    expect(JSON.stringify(failure)).not.toContain(
      "sentinel-private-reconciliation-fault",
    );
    expect(JSON.stringify(failure)).not.toContain("discrepancies");
    expect(await snapshot(f.wallet.id)).toEqual(before);
  });
  it("detects wrong source ordering and original allocation even when postings, outcomes and projections agree", async () => {
    const f = await fixture();
    await service.execute(credit(f.wallet.id, "70"), f.context);
    const funded = await service.execute(
      credit(f.wallet.id, "30", FundSource.REFERRAL),
      f.context,
    );
    const purchaseId = randomUUID();
    const purchased = {
      ...zero,
      availableNonReferral: "50",
      availableReferral: "30",
      total: "80",
    };
    await database.financialOperation.create({
      data: {
        id: purchaseId,
        walletId: f.wallet.id,
        kind: "PURCHASE_DEBIT",
        businessNamespace: "financial-test",
        businessKey: randomUUID(),
        intentHash: "a".repeat(64),
        magnitudeUnits: 20_000_000n,
        origin: "PACKAGE_PURCHASE",
        actorType: "PROCESS",
        actorProcessId: "fixture",
        acceptedTerms: {
          kind: "PURCHASE_DEBIT",
          walletBefore: funded.result.walletAfter,
        },
        outcome: {
          operationId: purchaseId,
          walletId: f.wallet.id,
          kind: "PURCHASE_DEBIT",
          amount: "20",
          recordedAt: instant,
          walletAfter: purchased,
        },
        createdAt: new Date(instant),
      },
    });
    await database.ledgerPosting.create({
      data: {
        operationId: purchaseId,
        walletId: f.wallet.id,
        source: "NON_REFERRAL",
        availableDeltaUnits: -20_000_000n,
        reservedDeltaUnits: 0n,
      },
    });
    await database.auditRecord.create({
      data: {
        operationId: purchaseId,
        actorType: "PROCESS",
        actorProcessId: "fixture",
        action: "PURCHASE_DEBIT",
        createdAt: new Date(instant),
      },
    });
    const reserveId = randomUUID();
    const allocationId = randomUUID();
    const reserved = {
      ...zero,
      availableNonReferral: "10",
      reservedNonReferral: "40",
      reservedReferral: "30",
      total: "80",
    };
    await database.financialOperation.create({
      data: {
        id: reserveId,
        walletId: f.wallet.id,
        kind: "RESERVE",
        businessNamespace: "financial-test",
        businessKey: randomUUID(),
        intentHash: "a".repeat(64),
        magnitudeUnits: 70_000_000n,
        origin: "WITHDRAWAL_RESERVATION",
        actorType: "PROCESS",
        actorProcessId: "fixture",
        acceptedTerms: {
          kind: "RESERVE",
          walletBefore: purchased,
          eligibleSources: ["NON_REFERRAL", "REFERRAL"],
          reservationId: allocationId,
        },
        outcome: {
          operationId: reserveId,
          walletId: f.wallet.id,
          kind: "RESERVE",
          amount: "70",
          recordedAt: instant,
          walletAfter: reserved,
          reservation: {
            id: allocationId,
            allocation: { nonReferral: "40", referral: "30", gross: "70" },
            state: "ACTIVE",
          },
        },
        createdAt: new Date(instant),
      },
    });
    await database.ledgerPosting.createMany({
      data: [
        {
          operationId: reserveId,
          walletId: f.wallet.id,
          source: "NON_REFERRAL",
          availableDeltaUnits: -40_000_000n,
          reservedDeltaUnits: 40_000_000n,
        },
        {
          operationId: reserveId,
          walletId: f.wallet.id,
          source: "REFERRAL",
          availableDeltaUnits: -30_000_000n,
          reservedDeltaUnits: 30_000_000n,
        },
      ],
    });
    await database.reservationAllocation.create({
      data: {
        id: allocationId,
        walletId: f.wallet.id,
        openingOperationId: reserveId,
        grossUnits: 70_000_000n,
        nonReferralUnits: 40_000_000n,
        referralUnits: 30_000_000n,
        createdAt: new Date(instant),
      },
    });
    await database.auditRecord.create({
      data: {
        operationId: reserveId,
        actorType: "PROCESS",
        actorProcessId: "fixture",
        action: "RESERVE",
        createdAt: new Date(instant),
      },
    });
    await database.wallet.update({
      where: { id: f.wallet.id },
      data: {
        availableNonReferralUnits: 10_000_000n,
        availableReferralUnits: 0n,
        reservedNonReferralUnits: 40_000_000n,
        reservedReferralUnits: 30_000_000n,
      },
    });
    const before = await snapshot(f.wallet.id);
    const report = await service.reconcileWallet(f.wallet.id, f.observation);
    expect(report.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "MISSING_POSTING",
          operationId: purchaseId,
          source: "REFERRAL",
        }),
        expect.objectContaining({
          category: "EXTRA_POSTING",
          operationId: purchaseId,
          source: "NON_REFERRAL",
        }),
        expect.objectContaining({
          category: "ALLOCATION_MISMATCH",
          operationId: reserveId,
          expected: "50",
          actual: "40",
        }),
      ]),
    );
    expect(
      report.discrepancies.some(
        ({ category }) =>
          category === "PROJECTION_MISMATCH" || category === "INVALID_OUTCOME",
      ),
    ).toBe(false);
    expect(await snapshot(f.wallet.id)).toEqual(before);
  });

  it("bounds diagnostics and scans beyond the first operation page without repairing history", async () => {
    const f = await fixture();
    await database.financialOperation.createMany({
      data: Array.from({ length: 101 }, () => {
        const id = randomUUID();
        return {
          id,
          walletId: f.wallet.id,
          kind: "CREDIT",
          businessNamespace: "financial-test",
          businessKey: randomUUID(),
          intentHash: "a".repeat(64),
          magnitudeUnits: 10_000_000n,
          origin: "DEPOSIT",
          actorType: "PROCESS",
          actorProcessId: "fixture",
          acceptedTerms: {
            kind: "CREDIT",
            walletBefore: zero,
            source: "NON_REFERRAL",
          },
          outcome: {
            operationId: id,
            walletId: f.wallet.id,
            kind: "CREDIT",
            amount: "10",
            recordedAt: instant,
            walletAfter: zero,
          },
          createdAt: new Date(instant),
        };
      }),
    });
    const before = await snapshot(f.wallet.id);
    const report = await service.reconcileWallet(f.wallet.id, f.observation);
    expect(report).toMatchObject({ consistent: false, truncated: true });
    expect(report.discrepancies).toHaveLength(200);
    expect(await snapshot(f.wallet.id)).toEqual(before);
  });

  it("reconstructs every kind, mixed sources and historical ACTIVE reserve outcomes after release", async () => {
    const f = await fixture();
    const original = await service.execute(
      credit(f.wallet.id, "70"),
      f.context,
    );
    await service.execute(
      credit(f.wallet.id, "30", FundSource.REFERRAL),
      f.context,
    );
    await service.execute(
      {
        ...financialIdentity(),
        kind: "PURCHASE_DEBIT",
        walletId: f.wallet.id,
        amount: "20",
      },
      f.context,
    );
    const reservationId = randomUUID();
    await service.execute(
      {
        ...financialIdentity(),
        kind: "RESERVE",
        walletId: f.wallet.id,
        amount: "75",
        reservationId,
      },
      f.context,
    );
    expect(
      (await service.reconcileWallet(f.wallet.id, f.observation)).consistent,
    ).toBe(true);
    await service.execute(
      {
        ...financialIdentity(),
        kind: "RELEASE",
        walletId: f.wallet.id,
        reservationId,
      },
      f.context,
    );
    const admin = await createFinancialAccount(database);
    await database.user.update({
      where: { id: admin.ownerUserId },
      data: { role: UserRole.ADMIN },
    });
    await service.execute(
      {
        ...financialIdentity(),
        kind: "CORRECTION",
        walletId: f.wallet.id,
        amount: "1",
        source: "REFERRAL",
        direction: "DEBIT",
        reason: "Manual correction",
        referenceOperationId: original.result.operationId,
      },
      {
        ...f.context,
        actor: { type: "USER", userId: admin.ownerUserId },
        observe: async () => {},
      },
    );
    const before = await snapshot(f.wallet.id);
    expect(
      await service.reconcileWallet(f.wallet.id, f.observation),
    ).toMatchObject({
      walletId: f.wallet.id,
      consistent: true,
      discrepancies: [],
      truncated: false,
    });
    expect(await snapshot(f.wallet.id)).toEqual(before);
  });

  it.each([
    { posted: null, audit: true, category: "MISSING_POSTING", projection: "0" },
    { posted: "9", audit: true, category: "POSTING_MISMATCH", projection: "9" },
    {
      posted: "10",
      audit: false,
      category: "AUDIT_MISMATCH",
      projection: "10",
    },
  ])(
    "reports $category even when projection agrees with actual postings",
    async ({ posted, audit, category, projection }) => {
      const f = await fixture();
      const id = await seedCredit({ walletId: f.wallet.id, posted, audit });
      await database.wallet.update({
        where: { id: f.wallet.id },
        data: { availableNonReferralUnits: parseUsdtAmount(projection) },
      });
      const before = await snapshot(f.wallet.id);
      const report = await service.reconcileWallet(f.wallet.id, f.observation);
      expect(report.consistent).toBe(false);
      expect(report.discrepancies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category, operationId: id }),
        ]),
      );
      expect(
        report.discrepancies.some(
          (fault) => fault.category === "PROJECTION_MISMATCH",
        ),
      ).toBe(false);
      expect(await snapshot(f.wallet.id)).toEqual(before);
    },
  );

  it("detects offsetting 9/11 credit faults despite matching command and ledger totals", async () => {
    const f = await fixture();
    const ids = [
      await seedCredit({ walletId: f.wallet.id, posted: "9" }),
      await seedCredit({ walletId: f.wallet.id, posted: "11" }),
    ];
    await database.wallet.update({
      where: { id: f.wallet.id },
      data: { availableNonReferralUnits: 20_000_000n },
    });
    const before = await snapshot(f.wallet.id);
    const report = await service.reconcileWallet(f.wallet.id, f.observation);
    for (const id of ids)
      expect(report.discrepancies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: "POSTING_MISMATCH",
            operationId: id,
          }),
        ]),
      );
    expect(await snapshot(f.wallet.id)).toEqual(before);
  });

  it("reports malformed terms, inconsistent outcome IDs/time and missing allocation without returning private JSON", async () => {
    const f = await fixture();
    const malformed = await seedCredit({
      walletId: f.wallet.id,
      terms: {
        kind: "CREDIT",
        privateSentinel: "private-evidence-do-not-expose",
      },
    });
    const wrong = await seedCredit({
      walletId: f.wallet.id,
      outcome: {
        operationId: randomUUID(),
        walletId: f.wallet.id,
        kind: "CREDIT",
        amount: "10",
        recordedAt: "2026-10-03T09:00:00.000Z",
        walletAfter: { ...zero, availableNonReferral: "9", total: "9" },
      },
    });
    const missing = randomUUID();
    await database.financialOperation.create({
      data: {
        id: missing,
        walletId: f.wallet.id,
        kind: "RESERVE",
        businessNamespace: "financial-test",
        businessKey: randomUUID(),
        intentHash: "a".repeat(64),
        magnitudeUnits: 1_000_000n,
        origin: "WITHDRAWAL_RESERVATION",
        actorType: "PROCESS",
        actorProcessId: "fixture",
        acceptedTerms: {
          kind: "RESERVE",
          walletBefore: { ...zero, availableNonReferral: "1", total: "1" },
          reservationId: randomUUID(),
          eligibleSources: ["NON_REFERRAL"],
        },
        outcome: {},
      },
    });
    const before = await snapshot(f.wallet.id);
    const report = await service.reconcileWallet(f.wallet.id, f.observation);
    expect(report.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationId: malformed,
          category: "INVALID_TERMS",
        }),
        expect.objectContaining({
          operationId: wrong,
          category: "INVALID_OUTCOME",
        }),
        expect.objectContaining({
          operationId: missing,
          category: "ALLOCATION_MISMATCH",
        }),
      ]),
    );
    expect(JSON.stringify(report)).not.toMatch(
      /private-evidence|intentHash|acceptedTerms|actorProcessId/u,
    );
    expect(await snapshot(f.wallet.id)).toEqual(before);
  });

  it("preserves cumulative aggregate and difference precision beyond int64 without repair", async () => {
    const f = await fixture();
    await seedCredit({
      walletId: f.wallet.id,
      amount: MAX_USDT_AMOUNT,
      posted: MAX_USDT_AMOUNT,
    });
    await seedCredit({
      walletId: f.wallet.id,
      amount: MAX_USDT_AMOUNT,
      posted: MAX_USDT_AMOUNT,
    });
    const before = await snapshot(f.wallet.id);
    const report = await service.reconcileWallet(f.wallet.id, f.observation);
    expect(report.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "PROJECTION_MISMATCH",
          component: "availableNonReferral",
          expected: "18446744073709.551614",
          actual: "0",
          difference: "-18446744073709.551614",
        }),
      ]),
    );
    expect(await snapshot(f.wallet.id)).toEqual(before);
  });

  it("uses one snapshot across a concurrent commit and detects separate mutable projection corruption", async () => {
    const f = await fixture();
    await service.execute(credit(f.wallet.id, "1"), f.context);
    let entered: () => void = () => {};
    let continueRead: () => void = () => {};
    const guardEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const committed = new Promise<void>((resolve) => {
      continueRead = resolve;
    });
    const read = service.reconcileWallet(f.wallet.id, {
      ...f.observation,
      observe: async (scope) => {
        await f.observation.observe(scope);
        entered();
        await committed;
      },
    });
    try {
      await guardEntered;
      await service.execute(credit(f.wallet.id, "2"), f.context);
    } finally {
      continueRead();
    }
    expect((await read).consistent).toBe(true);
    await database.wallet.update({
      where: { id: f.wallet.id },
      data: { availableNonReferralUnits: 2_000_000n },
    });
    const before = await snapshot(f.wallet.id);
    expect(
      (await service.reconcileWallet(f.wallet.id, f.observation)).discrepancies,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "PROJECTION_MISMATCH",
          expected: "3",
          actual: "2",
          difference: "-1",
        }),
      ]),
    );
    expect(await snapshot(f.wallet.id)).toEqual(before);
  });

  it("denies wrong owner, stale identity and mutating observation guards without disclosing or writing", async () => {
    const f = await fixture();
    const other = await fixture();
    const before = await snapshot(f.wallet.id);
    await expect(
      service.reconcileWallet(f.wallet.id, other.observation),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    await expect(
      service.reconcileWallet(randomUUID(), f.observation),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
    await expect(
      service.reconcileWallet(f.wallet.id, {
        ...f.observation,
        observe: async ({ transaction }) => {
          await transaction.wallet.update({
            where: { id: f.wallet.id },
            data: { availableNonReferralUnits: 1n },
          });
        },
      }),
    ).rejects.toMatchObject({ code: "LEDGER_INTERNAL" });
    expect(await snapshot(f.wallet.id)).toEqual(before);
    await database.user.update({
      where: { id: f.ownerUserId },
      data: { status: "SUSPENDED" },
    });
    await expect(
      service.reconcileWallet(f.wallet.id, f.observation),
    ).rejects.toMatchObject({ code: "LEDGER_FORBIDDEN" });
  });
});
