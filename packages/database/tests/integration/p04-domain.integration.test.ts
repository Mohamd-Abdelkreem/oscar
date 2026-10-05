import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  type DatabaseClient,
  type Prisma,
} from "../../src/index.js";

const url = process.env["DATABASE_URL"];
if (url === undefined || new URL(url).pathname !== "/template_integration")
  throw new Error("Disposable database integration runtime is required.");
const pool = new Pool({ connectionString: url });
const database = createDatabaseClient(url);
afterAll(async () => {
  await database.$disconnect();
  await pool.end();
});
const occurredAt = new Date("2026-10-05T09:00:00Z");
const terms = {
  code: "S1",
  tierOrder: 1,
  version: 1,
  price: "60",
  dailyReward: "2",
  countedWorkDates: 365,
  withdrawalFeeBps: 2100,
  conditionalGross: "730",
  calendar: {
    zone: "Asia/Baghdad",
    workdays: [1, 2, 3, 4, 5],
    firstDateCutoff: "18:00",
    expiryBoundary: "EXCLUSIVE_NEXT_CALENDAR_DATE_START",
  },
};
const typedTerms = {
  packageCode: "S1",
  tierOrder: 1,
  packageVersion: 1,
  priceUnits: 60000000n,
  dailyRewardUnits: 2000000n,
  countedWorkDates: 365,
  withdrawalFeeBps: 2100,
  acceptedTerms: terms,
};
const dates = {
  firstWorkDate: new Date("2026-10-05T00:00:00Z"),
  finalWorkDate: new Date("2028-02-25T00:00:00Z"),
};

async function account(client: DatabaseClient, sponsorUserId?: string) {
  const user = await client.user.create({
    data: {
      email: `p04-${randomUUID()}@example.test`,
      fullName: "P04 Fixture",
      passwordHash: "test-only-hash",
      status: "ACTIVE",
      emailVerifiedAt: occurredAt,
      ...(sponsorUserId === undefined ? {} : { sponsorUserId }),
    },
  });
  const wallet = await client.wallet.create({ data: { ownerUserId: user.id } });
  return { user, wallet };
}

async function quote(
  client: DatabaseClient,
  buyerId: string,
  sequence = 0n,
  overrides: Partial<Prisma.PurchaseQuoteUncheckedCreateInput> = {},
) {
  return client.purchaseQuote.create({
    data: {
      ...typedTerms,
      buyerId,
      createdAt: occurredAt,
      expiresAt: new Date("2026-10-05T09:10:00Z"),
      referralSettingsVersion: 1,
      savedRatesBps: [1200, 600, 400, 200, 200],
      expectedBuyerPurchaseSequence: sequence,
      action: "PURCHASE",
      intentHash: "a".repeat(64),
      availableReferralUnits: 10000000n,
      reservedReferralUnits: 3000000n,
      availableNonReferralUnits: 50000000n,
      reservedNonReferralUnits: 2000000n,
      fullDebitUnits: 60000000n,
      usableUnits: 60000000n,
      topUpUnits: 0n,
      fundedReferralUnits: 10000000n,
      fundedNonReferralUnits: 50000000n,
      ...dates,
      subscriptionExpiresAt: new Date("2028-02-25T21:00:00Z"),
      ...overrides,
    },
  });
}

async function purchaseFixture(
  client: DatabaseClient,
  ownedAccount?: Awaited<ReturnType<typeof account>>,
  sequence = 0n,
  quoteOverrides: Partial<Prisma.PurchaseQuoteUncheckedCreateInput> = {},
) {
  const owner = ownedAccount ?? (await account(client));
  const reviewed = await quote(client, owner.user.id, sequence, quoteOverrides);
  const debit = await client.financialOperation.create({
    data: {
      walletId: owner.wallet.id,
      kind: "PURCHASE_DEBIT",
      origin: "PACKAGE_PURCHASE",
      businessNamespace: "p04.purchase",
      businessKey: reviewed.id,
      intentHash: "b".repeat(64),
      magnitudeUnits: reviewed.fullDebitUnits,
      actorType: "USER",
      actorUserId: owner.user.id,
      acceptedTerms: {},
      outcome: {},
    },
  });
  await client.ledgerPosting.createMany({
    data: [
      {
        operationId: debit.id,
        walletId: owner.wallet.id,
        source: "REFERRAL" as const,
        availableDeltaUnits: -reviewed.fundedReferralUnits,
        reservedDeltaUnits: 0n,
      },
      {
        operationId: debit.id,
        walletId: owner.wallet.id,
        source: "NON_REFERRAL" as const,
        availableDeltaUnits: -reviewed.fundedNonReferralUnits,
        reservedDeltaUnits: 0n,
      },
    ].filter((posting) => posting.availableDeltaUnits !== 0n),
  });
  const purchaseData: Prisma.PurchaseUncheckedCreateInput = {
    ...typedTerms,
    packageCode: reviewed.packageCode,
    tierOrder: reviewed.tierOrder,
    priceUnits: reviewed.priceUnits,
    acceptedTerms: reviewed.acceptedTerms as Prisma.InputJsonValue,
    quoteId: reviewed.id,
    buyerId: owner.user.id,
    buyerSequence: sequence + 1n,
    action: reviewed.action,
    previousSubscriptionId: reviewed.observedSubscriptionId,
    debitOperationId: debit.id,
    purchasedAt: occurredAt,
    fullDebitUnits: reviewed.fullDebitUnits,
    sourceReferralUnits: reviewed.fundedReferralUnits,
    sourceNonReferralUnits: reviewed.fundedNonReferralUnits,
    commissionBaseUnits: reviewed.fullDebitUnits,
    referralSettingsVersion: 1,
    savedRatesBps: reviewed.savedRatesBps as Prisma.InputJsonValue,
  };
  return { owner, reviewed, debit, purchaseData };
}

async function subscription(
  client: DatabaseClient,
  purchaseId: string,
  ownerUserId: string,
) {
  return client.subscription.create({
    data: {
      ...typedTerms,
      ownerUserId,
      purchaseId,
      activationAt: occurredAt,
      ...dates,
      expiresAt: new Date("2028-02-25T21:00:00Z"),
    },
  });
}

async function rejectedUpdate(
  table:
    | "purchase_quotes"
    | "purchases"
    | "subscriptions"
    | "referral_decisions"
    | "configuration_changes",
  id: string,
  patch: Record<string, unknown>,
) {
  return pool.query(
    `UPDATE ${table} SET ${Object.keys(patch)
      .map((column, index) => `"${column}" = $${String(index + 2)}`)
      .join(",")} WHERE id=$1`,
    [id, ...Object.values(patch)],
  );
}

async function cloneRecord(
  table: "purchase_quotes" | "purchases" | "subscriptions",
  id: string,
  patch: Record<string, unknown>,
) {
  return pool.query<{ id: string }>(
    `INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table}, to_jsonb(saved) || $2::jsonb)).* FROM ${table} saved WHERE id=$1 RETURNING id`,
    [id, JSON.stringify({ id: randomUUID(), ...patch })],
  );
}

describe("P04 persisted domain guards", () => {
  it("seeds exact five stable tiers/rates without employee purchase history", async () => {
    const catalog = await database.package.findMany({
      orderBy: { tierOrder: "asc" },
    });
    expect(
      catalog.map((entry) => [
        entry.code,
        entry.priceUnits,
        entry.dailyRewardUnits,
        entry.countedWorkDates,
        entry.withdrawalFeeBps,
        entry.version,
      ]),
    ).toEqual([
      ["S1", 60000000n, 2000000n, 365, 2100, 1],
      ["S2", 120000000n, 4000000n, 365, 2100, 1],
      ["O1", 600000000n, 16000000n, 365, 2100, 1],
      ["O2", 1200000000n, 38000000n, 365, 2100, 1],
      ["A1", 2600000000n, 67000000n, 365, 2100, 1],
    ]);
    expect(
      await database.referralSettings.findUnique({ where: { id: 1 } }),
    ).toMatchObject({
      version: 1,
      level1Bps: 1200,
      level2Bps: 600,
      level3Bps: 400,
      level4Bps: 200,
      level5Bps: 200,
    });
    expect(await database.purchase.count()).toBe(0);
  });

  it("rejects forged funding, malformed snapshots/rates and foreign observed terms", async () => {
    const first = await account(database),
      second = await account(database);
    const reviewed = await quote(database, first.user.id);
    await expect(
      cloneRecord("purchase_quotes", reviewed.id, {
        funded_referral_units: "0",
      }),
    ).rejects.toMatchObject({ constraint: "ck_purchase_quotes_funding" });
    await expect(
      cloneRecord("purchase_quotes", reviewed.id, {
        saved_rates_bps: ["bad", 0, 0, 0, 0],
      }),
    ).rejects.toMatchObject({ constraint: "ck_purchase_quotes_terms" });
    for (const patch of [
      { fundedReferralUnits: 0n },
      { acceptedTerms: { ...terms, privateKey: "sentinel" } },
      { savedRatesBps: ["bad", 0, 0, 0, 0] },
      { countedWorkDates: 2147483647 },
      { topUpUnits: 1n },
    ]) {
      const { id: _id, ...saved } = reviewed;
      await expect(
        database.purchaseQuote.create({ data: { ...saved, ...patch } }),
      ).rejects.toThrow();
    }
    const fixture = await purchaseFixture(database, second);
    const purchase = await database.purchase.create({
      data: fixture.purchaseData,
    });
    const term = await subscription(database, purchase.id, second.user.id);
    const { id: _id, ...saved } = reviewed;
    await expect(
      database.purchaseQuote.create({
        data: { ...saved, observedSubscriptionId: term.id, action: "UPGRADE" },
      }),
    ).rejects.toThrow();
    expect(
      await database.purchaseQuote.count({ where: { buyerId: first.user.id } }),
    ).toBe(1);
  });

  it("enforces quote, sequence, ownership, source and CURRENT uniqueness with retained snapshots", async () => {
    const fixture = await purchaseFixture(database);
    const purchase = await database.purchase.create({
      data: fixture.purchaseData,
    });
    const term = await subscription(
      database,
      purchase.id,
      fixture.owner.user.id,
    );
    await expect(
      database.purchase.create({ data: fixture.purchaseData }),
    ).rejects.toThrow();
    const next = await purchaseFixture(database, fixture.owner, 0n);
    await expect(
      database.purchase.create({ data: next.purchaseData }),
    ).rejects.toThrow();
    const later = await purchaseFixture(database, fixture.owner, 1n);
    const secondPurchase = await database.purchase.create({
      data: later.purchaseData,
    });
    await expect(
      subscription(database, secondPurchase.id, fixture.owner.user.id),
    ).rejects.toThrow();
    const foreign = await account(database);
    await expect(
      subscription(database, secondPurchase.id, foreign.user.id),
    ).rejects.toThrow();
    const wrongSource = await purchaseFixture(database);
    await expect(
      database.purchase.create({
        data: {
          ...wrongSource.purchaseData,
          sourceReferralUnits: 0n,
          sourceNonReferralUnits: 60000000n,
        },
      }),
    ).rejects.toThrow();
    await expect(
      rejectedUpdate("purchases", purchase.id, { full_debit_units: "1" }),
    ).rejects.toMatchObject({ constraint: "ck_p04_history_immutable" });
    await expect(
      rejectedUpdate("purchase_quotes", fixture.reviewed.id, {
        top_up_units: "1",
      }),
    ).rejects.toMatchObject({ constraint: "ck_p04_history_immutable" });
    await expect(
      rejectedUpdate("subscriptions", term.id, { daily_reward_units: "1" }),
    ).rejects.toMatchObject({ constraint: "ck_p04_subscription_immutable" });
    await expect(
      rejectedUpdate("subscriptions", term.id, { state: "EXPIRED" }),
    ).rejects.toMatchObject({ constraint: "ck_p04_subscription_expiry" });
    expect(
      await database.subscription.count({
        where: { ownerUserId: fixture.owner.user.id, state: "CURRENT" },
      }),
    ).toBe(1);
  });

  it("permits one same-owner higher-tier replacement while rejecting revival and forged replacement", async () => {
    const fixture = await purchaseFixture(database);
    const initial = await database.purchase.create({
      data: fixture.purchaseData,
    });
    const oldTerm = await subscription(
      database,
      initial.id,
      fixture.owner.user.id,
    );
    const higherTerms = {
      ...terms,
      code: "S2",
      tierOrder: 2,
      price: "120",
      dailyReward: "4",
      conditionalGross: "1460",
    };
    const quoteClone = await cloneRecord(
      "purchase_quotes",
      fixture.reviewed.id,
      {
        package_code: "S2",
        tier_order: 2,
        price_units: "120000000",
        daily_reward_units: "4000000",
        accepted_terms: higherTerms,
        action: "UPGRADE",
        observed_subscription_id: oldTerm.id,
        expected_buyer_purchase_sequence: "1",
        available_non_referral_units: "120000000",
        usable_units: "130000000",
        full_debit_units: "120000000",
        funded_non_referral_units: "110000000",
      },
    );
    const quoteId = quoteClone.rows[0]?.id;
    if (quoteId === undefined)
      throw new Error("Upgrade quote fixture was not created.");
    const debit = await database.financialOperation.create({
      data: {
        walletId: fixture.owner.wallet.id,
        kind: "PURCHASE_DEBIT",
        origin: "PACKAGE_PURCHASE",
        businessNamespace: "p04.purchase",
        businessKey: quoteId,
        intentHash: "f".repeat(64),
        magnitudeUnits: 120000000n,
        actorType: "USER",
        actorUserId: fixture.owner.user.id,
        acceptedTerms: {},
        outcome: {},
      },
    });
    await database.ledgerPosting.createMany({
      data: [
        {
          operationId: debit.id,
          walletId: fixture.owner.wallet.id,
          source: "REFERRAL",
          availableDeltaUnits: -10000000n,
          reservedDeltaUnits: 0n,
        },
        {
          operationId: debit.id,
          walletId: fixture.owner.wallet.id,
          source: "NON_REFERRAL",
          availableDeltaUnits: -110000000n,
          reservedDeltaUnits: 0n,
        },
      ],
    });
    const replacement = await database.purchase.create({
      data: {
        ...fixture.purchaseData,
        quoteId,
        buyerSequence: 2n,
        debitOperationId: debit.id,
        action: "UPGRADE",
        previousSubscriptionId: oldTerm.id,
        packageCode: "S2",
        tierOrder: 2,
        priceUnits: 120000000n,
        dailyRewardUnits: 4000000n,
        acceptedTerms: higherTerms,
        fullDebitUnits: 120000000n,
        sourceNonReferralUnits: 110000000n,
        commissionBaseUnits: 60000000n,
      },
    });
    await expect(
      rejectedUpdate("subscriptions", oldTerm.id, {
        state: "REPLACED",
        replaced_at: occurredAt,
        replacement_purchase_id: initial.id,
      }),
    ).rejects.toMatchObject({ constraint: "ck_p04_subscription_replacement" });
    await database.subscription.update({
      where: { id: oldTerm.id },
      data: {
        state: "REPLACED",
        replacedAt: occurredAt,
        replacementPurchaseId: replacement.id,
      },
    });
    await database.subscription.create({
      data: {
        ...typedTerms,
        packageCode: "S2",
        tierOrder: 2,
        priceUnits: 120000000n,
        dailyRewardUnits: 4000000n,
        acceptedTerms: higherTerms,
        purchaseId: replacement.id,
        ownerUserId: fixture.owner.user.id,
        activationAt: occurredAt,
        ...dates,
        expiresAt: new Date("2028-02-25T21:00:00Z"),
      },
    });
    await expect(
      rejectedUpdate("subscriptions", oldTerm.id, {
        state: "CURRENT",
        replaced_at: null,
        replacement_purchase_id: null,
      }),
    ).rejects.toMatchObject({ constraint: "ck_p04_subscription_immutable" });
    expect(
      await database.subscription.count({
        where: { ownerUserId: fixture.owner.user.id, state: "CURRENT" },
      }),
    ).toBe(1);
  });

  it("lazily expires at the saved renewal event without consulting a second wall clock", async () => {
    const fixture = await purchaseFixture(database);
    const initial = await database.purchase.create({
      data: fixture.purchaseData,
    });
    const oldTerm = await subscription(
      database,
      initial.id,
      fixture.owner.user.id,
    );
    const renewedAt = new Date("2028-02-28T09:00:00Z");
    const quoteClone = await cloneRecord(
      "purchase_quotes",
      fixture.reviewed.id,
      {
        created_at: renewedAt.toISOString(),
        expires_at: "2028-02-28T09:10:00Z",
        observed_subscription_id: oldTerm.id,
        expected_buyer_purchase_sequence: "1",
        first_work_date: "2028-02-28",
        final_work_date: "2029-07-20",
        subscription_expires_at: "2029-07-20T21:00:00Z",
      },
    );
    const quoteId = quoteClone.rows[0]?.id;
    if (quoteId === undefined)
      throw new Error("Renewal quote fixture was not created.");
    const debit = await database.financialOperation.create({
      data: {
        walletId: fixture.owner.wallet.id,
        kind: "PURCHASE_DEBIT",
        origin: "PACKAGE_PURCHASE",
        businessNamespace: "p04.purchase",
        businessKey: quoteId,
        intentHash: "f".repeat(64),
        magnitudeUnits: 60000000n,
        actorType: "USER",
        actorUserId: fixture.owner.user.id,
        acceptedTerms: {},
        outcome: {},
      },
    });
    await database.ledgerPosting.createMany({
      data: [
        {
          operationId: debit.id,
          walletId: fixture.owner.wallet.id,
          source: "REFERRAL",
          availableDeltaUnits: -10000000n,
          reservedDeltaUnits: 0n,
        },
        {
          operationId: debit.id,
          walletId: fixture.owner.wallet.id,
          source: "NON_REFERRAL",
          availableDeltaUnits: -50000000n,
          reservedDeltaUnits: 0n,
        },
      ],
    });
    const renewal = await database.purchase.create({
      data: {
        ...fixture.purchaseData,
        quoteId,
        buyerSequence: 2n,
        debitOperationId: debit.id,
        purchasedAt: renewedAt,
        previousSubscriptionId: oldTerm.id,
      },
    });
    await database.subscription.update({
      where: { id: oldTerm.id },
      data: { state: "EXPIRED" },
    });
    await database.subscription.create({
      data: {
        ...typedTerms,
        purchaseId: renewal.id,
        ownerUserId: fixture.owner.user.id,
        activationAt: renewedAt,
        firstWorkDate: new Date("2028-02-28"),
        finalWorkDate: new Date("2029-07-20"),
        expiresAt: new Date("2029-07-20T21:00:00Z"),
      },
    });
    await expect(
      rejectedUpdate("subscriptions", oldTerm.id, { state: "CURRENT" }),
    ).rejects.toMatchObject({ constraint: "ck_p04_subscription_immutable" });
  });

  it("links positive awards to the recipient's exact referral credit and immutable ancestor level", async () => {
    const ancestor = await account(database);
    const ancestorFixture = await purchaseFixture(database, ancestor);
    const ancestorPurchase = await database.purchase.create({
      data: ancestorFixture.purchaseData,
    });
    const ancestorTerm = await subscription(
      database,
      ancestorPurchase.id,
      ancestor.user.id,
    );
    const buyer = await account(database, ancestor.user.id);
    const buyerFixture = await purchaseFixture(database, buyer);
    const purchase = await database.purchase.create({
      data: buyerFixture.purchaseData,
    });
    const credit = await database.financialOperation.create({
      data: {
        walletId: ancestor.wallet.id,
        kind: "CREDIT",
        origin: "REFERRAL_COMMISSION",
        businessNamespace: "p04.referral",
        businessKey: `${purchase.id}:${ancestor.user.id}:1`,
        intentHash: "f".repeat(64),
        magnitudeUnits: 7200000n,
        actorType: "PROCESS",
        actorProcessId: "p04-db-fixture",
        acceptedTerms: {},
        outcome: {},
      },
    });
    await database.ledgerPosting.create({
      data: {
        operationId: credit.id,
        walletId: ancestor.wallet.id,
        source: "REFERRAL",
        availableDeltaUnits: 7200000n,
        reservedDeltaUnits: 0n,
      },
    });
    const decision = {
      purchaseId: purchase.id,
      recipientUserId: ancestor.user.id,
      recipientSubscriptionId: ancestorTerm.id,
      level: 1,
      decision: "AWARDED",
      rateBps: 1200,
      commissionBaseUnits: 60000000n,
      awardUnits: 7200000n,
      creditOperationId: credit.id,
      eligibilitySnapshot: {
        status: "ACTIVE",
        role: "USER",
        accountVersion: 0,
        emailVerified: true,
        subscriptionId: ancestorTerm.id,
        expiresAt: ancestorTerm.expiresAt.toISOString(),
      },
      occurredAt,
    };
    await expect(
      database.referralDecision.create({
        data: { ...decision, creditOperationId: buyerFixture.debit.id },
      }),
    ).rejects.toThrow();
    await expect(
      database.referralDecision.create({
        data: { ...decision, recipientSubscriptionId: null },
      }),
    ).rejects.toThrow();
    const accepted = await database.referralDecision.create({ data: decision });
    expect(accepted.awardUnits).toBe(7200000n);
    await expect(
      database.referralDecision.create({ data: decision }),
    ).rejects.toThrow();
  });

  it("records fixed-tree skipped decisions once and rejects forged awards and history removal", async () => {
    const ancestor = await account(database),
      buyer = await account(database, ancestor.user.id);
    const fixture = await purchaseFixture(database, buyer);
    const purchase = await database.purchase.create({
      data: fixture.purchaseData,
    });
    const saved = {
      purchaseId: purchase.id,
      recipientUserId: ancestor.user.id,
      level: 1,
      decision: "SKIPPED",
      skippedReason: "FREE",
      rateBps: 1200,
      commissionBaseUnits: 60000000n,
      awardUnits: 0n,
      eligibilitySnapshot: {
        status: "ACTIVE",
        role: "USER",
        accountVersion: 0,
        emailVerified: true,
        subscriptionId: null,
        expiresAt: null,
      },
      occurredAt,
    };
    const decision = await database.referralDecision.create({ data: saved });
    await expect(
      database.referralDecision.create({ data: saved }),
    ).rejects.toThrow();
    for (const patch of [
      { recipientUserId: buyer.user.id },
      { level: 2147483647 },
      { awardUnits: 1n },
      { rateBps: 600 },
    ])
      await expect(
        database.referralDecision.create({ data: { ...saved, ...patch } }),
      ).rejects.toThrow();
    await expect(
      rejectedUpdate("referral_decisions", decision.id, { award_units: "1" }),
    ).rejects.toMatchObject({ constraint: "ck_p04_history_immutable" });
    for (const table of [
      "purchase_quotes",
      "purchases",
      "subscriptions",
      "referral_decisions",
      "configuration_changes",
      "packages",
      "referral_settings",
    ] as const)
      await expect(
        pool.query(`TRUNCATE ${table} CASCADE`),
      ).rejects.toMatchObject({ constraint: "ck_p04_history_immutable" });
    expect(
      await database.referralDecision.count({
        where: { purchaseId: purchase.id },
      }),
    ).toBe(1);
  });

  it.each(["SKIPPED", "ZERO_BASE", "ZERO_RATE", "FLOORED_ZERO"] as const)(
    "rejects a null %s reason independently and accepts its valid control",
    async (reason) => {
      const ancestor = await account(database);
      const ancestorFixture = await purchaseFixture(database, ancestor);
      const ancestorPurchase = await database.purchase.create({
        data: ancestorFixture.purchaseData,
      });
      const ancestorTerm = await subscription(
        database,
        ancestorPurchase.id,
        ancestor.user.id,
      );
      const buyer = await account(database, ancestor.user.id);
      let priorId: string | undefined;
      if (reason === "ZERO_BASE") {
        const initial = await purchaseFixture(database, buyer);
        const purchase = await database.purchase.create({
          data: initial.purchaseData,
        });
        priorId = (await subscription(database, purchase.id, buyer.user.id)).id;
      }
      const overrides: Partial<Prisma.PurchaseQuoteUncheckedCreateInput> =
        reason === "ZERO_BASE"
          ? {
              packageCode: "S2",
              tierOrder: 2,
              acceptedTerms: { ...terms, code: "S2", tierOrder: 2 },
              action: "UPGRADE",
              observedSubscriptionId: priorId,
            }
          : reason === "ZERO_RATE"
            ? { savedRatesBps: [0, 600, 400, 200, 200] }
            : reason === "FLOORED_ZERO"
              ? {
                  priceUnits: 1n,
                  acceptedTerms: { ...terms, price: "0.000001" },
                  fullDebitUnits: 1n,
                  fundedReferralUnits: 1n,
                  fundedNonReferralUnits: 0n,
                }
              : {};
      const fixture = await purchaseFixture(
        database,
        buyer,
        priorId === undefined ? 0n : 1n,
        overrides,
      );
      const base =
        reason === "ZERO_BASE" ? 0n : fixture.purchaseData.fullDebitUnits;
      const purchase = await database.purchase.create({
        data: { ...fixture.purchaseData, commissionBaseUnits: base },
      });
      const insert = (savedReason: string | null) =>
        pool.query(
          `INSERT INTO referral_decisions(id,purchase_id,recipient_user_id,level,decision,skipped_reason,zero_reason,rate_bps,commission_base_units,award_units,recipient_subscription_id,eligibility_snapshot,occurred_at)
       VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,0,$9,'{}',$10) RETURNING id`,
          [
            randomUUID(),
            purchase.id,
            ancestor.user.id,
            reason === "SKIPPED" ? "SKIPPED" : "ELIGIBLE_ZERO",
            reason === "SKIPPED" ? savedReason : null,
            reason === "SKIPPED" ? null : savedReason,
            reason === "ZERO_RATE" ? 0 : 1200,
            base.toString(),
            reason === "SKIPPED" ? null : ancestorTerm.id,
            occurredAt,
          ],
        );
      await expect(insert(null)).rejects.toMatchObject({
        constraint: "ck_referral_decisions_shape",
      });
      expect(
        (await insert(reason === "SKIPPED" ? "FREE" : reason)).rowCount,
      ).toBe(1);
    },
  );

  it.each(["PACKAGE", "REFERRAL_SETTINGS"] as const)(
    "rejects missing/null %s snapshot identity keys and preserves valid controls",
    async (target) => {
      const admin = await database.user.create({
        data: {
          email: `shape-${randomUUID()}@example.test`,
          fullName: "Admin",
          passwordHash: "test-only-hash",
          role: "ADMIN",
          status: "ACTIVE",
          emailVerifiedAt: occurredAt,
        },
      });
      const before =
        target === "PACKAGE"
          ? terms
          : { version: 1, ratesBps: [1200, 600, 400, 200, 200] };
      const after =
        target === "PACKAGE"
          ? { ...terms, version: 2, price: "61" }
          : { version: 2, ratesBps: [1000, 600, 400, 200, 200] };
      const insert = (
        beforeSnapshot: Record<string, unknown>,
        afterSnapshot: Record<string, unknown>,
      ) =>
        pool.query(
          `INSERT INTO configuration_changes(id,actor_user_id,command_id,target_kind,package_code,intent_hash,expected_version,committed_version,reason,before_snapshot,after_snapshot,occurred_at)
       VALUES($1,$2,$3,$4,$5,$6,1,2,'Future terms',$7,$8,$9) RETURNING id`,
          [
            randomUUID(),
            admin.id,
            randomUUID(),
            target,
            target === "PACKAGE" ? "S1" : null,
            "c".repeat(64),
            JSON.stringify(beforeSnapshot),
            JSON.stringify(afterSnapshot),
            occurredAt,
          ],
        );
      for (const key of target === "PACKAGE"
        ? ["version", "code"]
        : ["version"]) {
        for (const side of ["before", "after"]) {
          for (const value of [undefined, null]) {
            const invalid: Record<string, unknown> = {
              ...(side === "before" ? before : after),
              [key]: value,
            };
            await expect(
              insert(
                side === "before" ? invalid : before,
                side === "after" ? invalid : after,
              ),
            ).rejects.toMatchObject({
              constraint: "ck_configuration_change_shape",
            });
          }
        }
      }
      expect((await insert(before, after)).rowCount).toBe(1);
    },
  );

  it("protects target counters/identity and immutable actor-command changes", async () => {
    const admin = await database.user.create({
      data: {
        email: `p04-admin-${randomUUID()}@example.test`,
        fullName: "Admin",
        passwordHash: "test-only-hash",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: occurredAt,
      },
    });
    const changeData = {
      actorUserId: admin.id,
      commandId: randomUUID(),
      targetKind: "PACKAGE",
      packageCode: "S1",
      intentHash: "c".repeat(64),
      expectedVersion: 1,
      committedVersion: 2,
      reason: "Future price",
      beforeSnapshot: terms,
      afterSnapshot: { ...terms, price: "61", version: 2 },
      occurredAt,
    };
    const change = await database.configurationChange.create({
      data: changeData,
    });
    await expect(
      database.configurationChange.create({ data: changeData }),
    ).rejects.toThrow();
    await expect(
      rejectedUpdate("configuration_changes", change.id, {
        reason: "rewritten",
      }),
    ).rejects.toMatchObject({ constraint: "ck_p04_history_immutable" });
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query(
        "UPDATE packages SET version=2,price_units=61000000,updated_by_user_id=$1,updated_at=now() WHERE code='S1'",
        [admin.id],
      );
      await expect(
        connection.query("UPDATE packages SET version=1 WHERE code='S1'"),
      ).rejects.toMatchObject({
        constraint: "ck_p04_configuration_transition",
      });
    } finally {
      await connection.query("ROLLBACK");
      connection.release();
    }
    await expect(
      pool.query(
        "UPDATE packages SET version=2,tier_order=2,updated_by_user_id=$1 WHERE code='S1'",
        [admin.id],
      ),
    ).rejects.toMatchObject({ constraint: "ck_p04_configuration_transition" });
    await expect(
      pool.query(
        "INSERT INTO referral_settings SELECT * FROM referral_settings",
      ),
    ).rejects.toMatchObject({ constraint: "ck_p04_configuration_fixed" });
  });
});

const execFileAsync = promisify(execFile);
async function deploy(databaseUrl: string, config?: string) {
  const pnpmScript = process.env["npm_execpath"];
  if (pnpmScript === undefined)
    throw new Error("pnpm execution context is required.");
  await execFileAsync(
    process.execPath,
    [
      pnpmScript,
      "exec",
      "prisma",
      "migrate",
      "deploy",
      ...(config === undefined ? [] : ["--config", config]),
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      timeout: 180000,
      windowsHide: true,
    },
  );
}

it("deploys forward over populated P01-P04 history, rejects malformed retained rows and redeploys unchanged", async () => {
  const name = `p04_upgrade_${randomUUID().replaceAll("-", "")}`;
  const isolatedUrl = new URL(url);
  isolatedUrl.pathname = `/${name}`;
  const cacheRoot = resolve("node_modules/.cache");
  await mkdir(cacheRoot, { recursive: true });
  const temporary = await mkdtemp(join(cacheRoot, "p04-upgrade-"));
  if (!resolve(temporary).startsWith(`${cacheRoot}${sep}`))
    throw new Error("Unsafe fixture cleanup target.");
  let client: DatabaseClient | undefined;
  let created = false;
  try {
    await pool.query(`CREATE DATABASE "${name}"`);
    created = true;
    const migrations = join(temporary, "migrations");
    for (const entry of await readdir("prisma/migrations", {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || entry.name >= "20261004000000") continue;
      await mkdir(join(migrations, entry.name), { recursive: true });
      await copyFile(
        join("prisma/migrations", entry.name, "migration.sql"),
        join(migrations, entry.name, "migration.sql"),
      );
    }
    await copyFile(
      "prisma/migrations/migration_lock.toml",
      join(migrations, "migration_lock.toml"),
    );
    const config = join(temporary, "prisma.config.ts");
    await writeFile(
      config,
      `import { defineConfig, env } from "prisma/config";\nexport default defineConfig({ schema: ${JSON.stringify(resolve("prisma/schema.prisma"))}, migrations: { path: ${JSON.stringify(migrations)} }, datasource: { url: env("DATABASE_URL") } });\n`,
    );
    await deploy(isolatedUrl.toString(), config);
    client = createDatabaseClient(isolatedUrl.toString());
    const sponsor = await account(client),
      employee = await account(client, sponsor.user.id);
    const session = await client.authSession.create({
      data: {
        userId: employee.user.id,
        rememberMe: true,
        expiresAt: new Date("2030-01-01"),
      },
    });
    await client.refreshToken.create({
      data: {
        userId: employee.user.id,
        sessionId: session.id,
        tokenHash: "d".repeat(64),
        expiresAt: session.expiresAt,
      },
    });
    const reserve = await client.financialOperation.create({
      data: {
        walletId: employee.wallet.id,
        kind: "RESERVE",
        origin: "WITHDRAWAL_RESERVATION",
        magnitudeUnits: 5000000n,
        businessNamespace: "p04.upgrade.fixture",
        businessKey: randomUUID(),
        intentHash: "e".repeat(64),
        actorType: "PROCESS",
        actorProcessId: "migration-fixture",
        acceptedTerms: {},
        outcome: {},
      },
    });
    await client.ledgerPosting.createMany({
      data: [
        {
          operationId: reserve.id,
          walletId: employee.wallet.id,
          source: "REFERRAL",
          availableDeltaUnits: -3000000n,
          reservedDeltaUnits: 3000000n,
        },
        {
          operationId: reserve.id,
          walletId: employee.wallet.id,
          source: "NON_REFERRAL",
          availableDeltaUnits: -2000000n,
          reservedDeltaUnits: 2000000n,
        },
      ],
    });
    await client.reservationAllocation.create({
      data: {
        walletId: employee.wallet.id,
        openingOperationId: reserve.id,
        grossUnits: 5000000n,
        referralUnits: 3000000n,
        nonReferralUnits: 2000000n,
      },
    });
    await client.auditRecord.create({
      data: {
        operationId: reserve.id,
        actorType: "PROCESS",
        actorProcessId: "migration-fixture",
        action: "RESERVE",
      },
    });
    await client.requestIdentity.create({
      data: {
        operationId: reserve.id,
        actorScope: "PROCESS:migration-fixture",
        kind: "RESERVE",
        requestKey: "migration-reserve",
        intentHash: "e".repeat(64),
      },
    });
    await client.wallet.update({
      where: { id: employee.wallet.id },
      data: {
        availableReferralUnits: 10000000n,
        availableNonReferralUnits: 50000000n,
        reservedReferralUnits: 3000000n,
        reservedNonReferralUnits: 2000000n,
      },
    });
    const snapshot = async (active: DatabaseClient) => ({
      users: await active.user.findMany({ orderBy: { id: "asc" } }),
      wallets: await active.wallet.findMany({ orderBy: { id: "asc" } }),
      sessions: await active.authSession.findMany(),
      refresh: await active.refreshToken.findMany(),
      operations: await active.financialOperation.findMany(),
      postings: await active.ledgerPosting.findMany({ orderBy: { id: "asc" } }),
      allocations: await active.reservationAllocation.findMany(),
      audits: await active.auditRecord.findMany(),
      aliases: await active.requestIdentity.findMany(),
    });
    const before = await snapshot(client);
    const previousMigration = "20261004000000_packages_referrals_wallet";
    await mkdir(join(migrations, previousMigration));
    await copyFile(
      join("prisma/migrations", previousMigration, "migration.sql"),
      join(migrations, previousMigration, "migration.sql"),
    );
    await deploy(isolatedUrl.toString(), config);
    expect(await snapshot(client)).toEqual(before);
    const fixture = await purchaseFixture(client, employee);
    const purchase = await client.purchase.create({
      data: fixture.purchaseData,
    });
    const term = await subscription(client, purchase.id, employee.user.id);
    const decision = await client.referralDecision.create({
      data: {
        purchaseId: purchase.id,
        recipientUserId: sponsor.user.id,
        level: 1,
        decision: "SKIPPED",
        skippedReason: "FREE",
        rateBps: 1200,
        commissionBaseUnits: 60000000n,
        awardUnits: 0n,
        eligibilitySnapshot: {},
        occurredAt,
      },
    });
    const admin = await client.user.create({
      data: {
        email: `upgrade-admin-${randomUUID()}@example.test`,
        fullName: "Admin",
        passwordHash: "test-only-hash",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: occurredAt,
      },
    });
    const change = await client.configurationChange.create({
      data: {
        actorUserId: admin.id,
        commandId: randomUUID(),
        targetKind: "PACKAGE",
        packageCode: "S1",
        intentHash: "c".repeat(64),
        expectedVersion: 1,
        committedVersion: 2,
        reason: "Future price",
        beforeSnapshot: terms,
        afterSnapshot: { ...terms, version: 2, price: "61" },
        occurredAt,
      },
    });
    const history = async () => ({
      purchase: await client?.purchase.findUnique({
        where: { id: purchase.id },
      }),
      term: await client?.subscription.findUnique({ where: { id: term.id } }),
      decision: await client?.referralDecision.findUnique({
        where: { id: decision.id },
      }),
      change: await client?.configurationChange.findUnique({
        where: { id: change.id },
      }),
    });
    const savedHistory = await history();
    const another = await purchaseFixture(
      client,
      await account(client, sponsor.user.id),
    );
    const anotherPurchase = await client.purchase.create({
      data: another.purchaseData,
    });
    const isolatedPool = new Pool({ connectionString: isolatedUrl.toString() });
    const connection = await isolatedPool.connect();
    try {
      const migrationSql = await readFile(
        "prisma/migrations/20261005000000_p04_history_shape/migration.sql",
        "utf8",
      );
      for (const [table, id, patch, constraint] of [
        [
          "configuration_changes",
          change.id,
          { command_id: randomUUID(), before_snapshot: { code: "S1" } },
          "ck_configuration_change_shape",
        ],
        [
          "referral_decisions",
          decision.id,
          {
            skipped_reason: null,
            purchase_id: anotherPurchase.id,
          },
          "ck_referral_decisions_shape",
        ],
      ] as const) {
        await connection.query("BEGIN");
        try {
          await connection.query(
            `INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table},to_jsonb(saved) || $2::jsonb)).* FROM ${table} saved WHERE id=$1`,
            [id, JSON.stringify({ id: randomUUID(), ...patch })],
          );
          await expect(connection.query(migrationSql)).rejects.toMatchObject({
            constraint,
          });
        } finally {
          await connection.query("ROLLBACK");
        }
      }
    } finally {
      connection.release();
      await isolatedPool.end();
    }
    const beforeForward = await snapshot(client);
    await deploy(isolatedUrl.toString());
    expect(await snapshot(client)).toEqual(beforeForward);
    expect(await history()).toEqual(savedHistory);
    await deploy(isolatedUrl.toString());
    expect(await snapshot(client)).toEqual(beforeForward);
    expect(await history()).toEqual(savedHistory);
    expect(await client.package.count()).toBe(5);
  } finally {
    await client?.$disconnect();
    if (created) await pool.query(`DROP DATABASE "${name}"`);
    await rm(temporary, { recursive: true, force: true });
  }
});
