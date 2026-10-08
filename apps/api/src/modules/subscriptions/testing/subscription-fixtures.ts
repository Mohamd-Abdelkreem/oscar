import { randomUUID } from "node:crypto";

import { packageTermsSchema, type PackageCode } from "@template/contracts";
import type { DatabaseClient } from "@template/database";
import type { FinancialRuntimeAdmission } from "../../custody/runtime-control.js";

import { BusinessClock } from "../../../core/business-calendar/business-clock.js";
import {
  formatUsdtAmount,
  parseUsdtAmount,
} from "../../../core/financial/money.js";
import { createIdentityFixture } from "../../auth/testing/identity-fixtures.js";
import { LedgerError } from "../../ledger/ledger.errors.js";
import { LedgerService } from "../../ledger/ledger.service.js";
import type {
  LedgerContext,
  LedgerGuardScope,
} from "../../ledger/ledger.types.js";
import {
  fixedFinancialClock,
  admitCleanDisposableFinancialBoot,
} from "../../ledger/testing/financial-fixtures.js";

export {
  financialRaceBarrier as subscriptionRaceBarrier,
  withAdmittedIndependentFinancialClients as withIndependentSubscriptionClients,
} from "../../ledger/testing/financial-fixtures.js";
export { withAdmittedFinancialDatabase as withSubscriptionDatabase } from "../../ledger/testing/financial-fixtures.js";
export type SubscriptionAccountFixture = Awaited<
  ReturnType<typeof createIdentityFixture>
>;
export const P04_FIXTURE_NOW = new Date("2026-10-05T09:00:00.000Z");
const FIXTURE_FUNDING = "p04.fixture.funding";
const FIXTURE_PROCESS = "p04-fixture";
type FixtureRuntime =
  Date | { now?: Date; admission: FinancialRuntimeAdmission };
async function fixtureRuntime(
  database: DatabaseClient,
  runtime: FixtureRuntime,
) {
  const admission =
    runtime instanceof Date
      ? await admitCleanDisposableFinancialBoot(database)
      : runtime.admission;
  const now =
    runtime instanceof Date ? runtime : (runtime.now ?? P04_FIXTURE_NOW);
  await database.$transaction((transaction) =>
    admission.assertMutationAdmission(transaction),
  );
  return { now, admission };
}
const ledger = (
  database: DatabaseClient,
  admission: FinancialRuntimeAdmission,
) =>
  new LedgerService(
    database,
    {
      businessNamespaces: [FIXTURE_FUNDING, "p04.purchase"],
      processIds: [FIXTURE_PROCESS],
    },
    admission,
  );

const fixtureWalletGuard =
  (walletId: string) =>
  (scope: LedgerGuardScope): Promise<void> => {
    if (
      scope.wallet.id !== walletId ||
      (scope.actor.type === "USER" &&
        scope.actor.userId !== scope.wallet.ownerUserId)
    )
      return Promise.reject(new LedgerError("LEDGER_FORBIDDEN"));
    return Promise.resolve();
  };

export async function fundSubscriptionFixture(
  database: DatabaseClient,
  account: SubscriptionAccountFixture,
  amounts: { referral: string; nonReferral: string },
  runtime: FixtureRuntime = P04_FIXTURE_NOW,
) {
  const { now, admission } = await fixtureRuntime(database, runtime);
  if (account.wallet === null)
    throw new Error("Employee wallet fixture is required.");
  const walletId = account.wallet.id;
  const context: LedgerContext = {
    actor: { type: "PROCESS", processId: FIXTURE_PROCESS },
    walletIds: [walletId],
    clock: fixedFinancialClock(now),
    observe: fixtureWalletGuard(walletId),
    mutate: fixtureWalletGuard(walletId),
  };
  for (const [source, amount] of [
    ["REFERRAL", amounts.referral],
    ["NON_REFERRAL", amounts.nonReferral],
  ] as const) {
    if (parseUsdtAmount(amount) === 0n) continue;
    await ledger(database, admission).execute(
      {
        kind: "CREDIT",
        walletId,
        businessNamespace: FIXTURE_FUNDING,
        businessKey: randomUUID(),
        amount,
        source,
        origin: source === "REFERRAL" ? "REFERRAL_COMMISSION" : "DEPOSIT",
      },
      context,
    );
  }
  return database.wallet.findUniqueOrThrow({ where: { id: walletId } });
}

export async function createSubscriptionScenario(
  database: DatabaseClient,
  now = P04_FIXTURE_NOW,
) {
  const ancestors: SubscriptionAccountFixture[] = [];
  let sponsorUserId: string | undefined;
  for (let depth = 5; depth > 0; depth -= 1) {
    const ancestor = await createIdentityFixture(database, {
      now,
      ...(sponsorUserId === undefined ? {} : { sponsorUserId }),
    });
    ancestors.unshift(ancestor);
    sponsorUserId = ancestor.user.id;
  }
  const buyer = await createIdentityFixture(database, {
    now,
    ...(sponsorUserId === undefined ? {} : { sponsorUserId }),
  });
  return { buyer, ancestors, clock: fixedFinancialClock(now) };
}

// Fixture setup exercises real ledger effects; it is not a substitute for the purchase service's acceptance.
export async function activateSubscriptionFixture(
  database: DatabaseClient,
  account: SubscriptionAccountFixture,
  packageCode: PackageCode = "S1",
  runtime: FixtureRuntime = P04_FIXTURE_NOW,
) {
  const { now, admission } = await fixtureRuntime(database, runtime);
  if (account.wallet === null)
    throw new Error("Employee wallet fixture is required.");
  const configured = await database.package.findUniqueOrThrow({
    where: { code: packageCode },
  });
  const settings = await database.referralSettings.findUniqueOrThrow({
    where: { id: 1 },
  });
  const terms = packageTermsSchema.parse({
    code: configured.code,
    tierOrder: configured.tierOrder,
    version: configured.version,
    price: formatUsdtAmount(configured.priceUnits),
    dailyReward: formatUsdtAmount(configured.dailyRewardUnits),
    countedWorkDates: configured.countedWorkDates,
    withdrawalFeeBps: configured.withdrawalFeeBps,
    conditionalGross: formatUsdtAmount(
      configured.dailyRewardUnits * BigInt(configured.countedWorkDates),
    ),
    calendar: {
      zone: "Asia/Baghdad",
      workdays: [1, 2, 3, 4, 5],
      firstDateCutoff: "18:00",
      expiryBoundary: "EXCLUSIVE_NEXT_CALENDAR_DATE_START",
    },
  });
  const typedTerms = {
    packageCode,
    tierOrder: configured.tierOrder,
    packageVersion: configured.version,
    priceUnits: configured.priceUnits,
    dailyRewardUnits: configured.dailyRewardUnits,
    countedWorkDates: configured.countedWorkDates,
    withdrawalFeeBps: configured.withdrawalFeeBps,
    acceptedTerms: terms,
  };
  const term = new BusinessClock(fixedFinancialClock(now)).subscriptionTerm(
    now.toISOString(),
    configured.countedWorkDates,
  );
  const wallet = await database.wallet.findUniqueOrThrow({
    where: { id: account.wallet.id },
  });
  const referral =
    wallet.availableReferralUnits < configured.priceUnits
      ? wallet.availableReferralUnits
      : configured.priceUnits;
  const nonReferral = configured.priceUnits - referral;
  if (wallet.availableNonReferralUnits < nonReferral)
    throw new Error("Fund the subscription fixture before activation.");
  const rates = [
    settings.level1Bps,
    settings.level2Bps,
    settings.level3Bps,
    settings.level4Bps,
    settings.level5Bps,
  ];
  const quote = await database.purchaseQuote.create({
    data: {
      ...typedTerms,
      buyerId: account.user.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 600000),
      referralSettingsVersion: settings.version,
      savedRatesBps: rates,
      expectedBuyerPurchaseSequence: 0n,
      action: "PURCHASE",
      intentHash: "f".repeat(64),
      availableReferralUnits: wallet.availableReferralUnits,
      reservedReferralUnits: wallet.reservedReferralUnits,
      availableNonReferralUnits: wallet.availableNonReferralUnits,
      reservedNonReferralUnits: wallet.reservedNonReferralUnits,
      fullDebitUnits: configured.priceUnits,
      usableUnits:
        wallet.availableReferralUnits + wallet.availableNonReferralUnits,
      topUpUnits: 0n,
      fundedReferralUnits: referral,
      fundedNonReferralUnits: nonReferral,
      firstWorkDate: new Date(`${term.firstWorkDate}T00:00:00Z`),
      finalWorkDate: new Date(`${term.finalWorkDate}T00:00:00Z`),
      subscriptionExpiresAt: new Date(term.expiresAt),
    },
  });
  const context: LedgerContext = {
    actor: { type: "USER", userId: account.user.id },
    walletIds: [wallet.id],
    clock: fixedFinancialClock(now),
    observe: fixtureWalletGuard(wallet.id),
    mutate: fixtureWalletGuard(wallet.id),
  };
  const reply = await ledger(database, admission).execute(
    {
      kind: "PURCHASE_DEBIT",
      walletId: wallet.id,
      businessNamespace: "p04.purchase",
      businessKey: quote.id,
      amount: terms.price,
    },
    context,
    async (transaction, operation) => {
      const purchase = await transaction.purchase.create({
        data: {
          ...typedTerms,
          quoteId: quote.id,
          buyerId: account.user.id,
          buyerSequence: 1n,
          action: "PURCHASE",
          debitOperationId: operation.operationId,
          purchasedAt: now,
          fullDebitUnits: configured.priceUnits,
          sourceReferralUnits: referral,
          sourceNonReferralUnits: nonReferral,
          commissionBaseUnits: configured.priceUnits,
          referralSettingsVersion: settings.version,
          savedRatesBps: rates,
        },
      });
      await transaction.subscription.create({
        data: {
          ...typedTerms,
          ownerUserId: account.user.id,
          purchaseId: purchase.id,
          activationAt: now,
          firstWorkDate: quote.firstWorkDate,
          finalWorkDate: quote.finalWorkDate,
          expiresAt: quote.subscriptionExpiresAt,
        },
      });
    },
  );
  return {
    quote,
    reply,
    subscription: await database.subscription.findFirstOrThrow({
      where: { ownerUserId: account.user.id, state: "CURRENT" },
    }),
  };
}

export async function withSubscriptionUserLock<T>(
  database: DatabaseClient,
  userId: string,
  work: (releaseLock: () => void) => Promise<T>,
): Promise<T> {
  let announceLock: () => void = () => {};
  let releaseLock: () => void = () => {};
  let rejectLock: (error: unknown) => void = () => {};
  const acquired = new Promise<void>((resolve, reject) => {
    announceLock = resolve;
    rejectLock = reject;
  });
  const released = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const holding = database.$transaction(
    async (transaction) => {
      const locked = await transaction.$queryRaw<
        { id: string }[]
      >`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      if (locked.length !== 1)
        throw new Error("The fixture lock owner is missing.");
      announceLock();
      await released;
    },
    { timeout: 10000 },
  );
  void holding.catch(rejectLock);
  try {
    await acquired;
    return await work(releaseLock);
  } finally {
    releaseLock();
    await holding;
  }
}
