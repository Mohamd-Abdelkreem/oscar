import { randomUUID } from "node:crypto";
import type { DatabaseClient, Prisma } from "../../../src/index.js";

export const occurredAt = new Date("2026-10-05T09:00:00Z");
export const terms = {
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
export const typedTerms = {
  packageCode: "S1",
  tierOrder: 1,
  packageVersion: 1,
  priceUnits: 60000000n,
  dailyRewardUnits: 2000000n,
  countedWorkDates: 365,
  withdrawalFeeBps: 2100,
  acceptedTerms: terms,
};
export const dates = {
  firstWorkDate: new Date("2026-10-05T00:00:00Z"),
  finalWorkDate: new Date("2028-02-25T00:00:00Z"),
};

export async function account(client: DatabaseClient, sponsorUserId?: string) {
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

export async function quote(
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

export async function purchaseFixture(
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

export async function subscription(
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
