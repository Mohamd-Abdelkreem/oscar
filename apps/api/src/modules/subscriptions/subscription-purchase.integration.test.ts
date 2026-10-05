import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { Prisma, type DatabaseClient } from "@template/database";
import { PackagesService } from "../packages/packages.service.js";
import { PackageConfigurationService } from "../packages/package-configuration.service.js";
import { EmployeeRestrictionsService } from "../users/employee-restrictions.service.js";
import * as referralCommissions from "../referrals/referral-commissions.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { PurchaseQuoteService } from "./purchase-quote.service.js";
import { SubscriptionPurchaseService } from "./subscription-purchase.service.js";
import { SubscriptionsService } from "./subscriptions.service.js";
import {
  activateSubscriptionFixture,
  fundSubscriptionFixture,
  P04_FIXTURE_NOW,
  withSubscriptionDatabase,
  withIndependentSubscriptionClients,
  subscriptionRaceBarrier,
  withSubscriptionUserLock,
  createSubscriptionScenario,
} from "./testing/subscription-fixtures.js";

async function waitForPurchaseLock(
  database: DatabaseClient,
  queryFragment: string,
) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const waiting = await database.$queryRaw<
      { waiting: boolean }[]
    >`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE ${`%${queryFragment}%`}) AS waiting`;
    if (waiting[0]?.waiting === true) return;
  }
  throw new Error("The controlled purchase lock barrier was not reached.");
}

async function purchaseState(database: DatabaseClient) {
  const orderBy = { id: "asc" as const };
  return {
    wallets: await database.wallet.findMany({ orderBy }),
    purchases: await database.purchase.findMany({ orderBy }),
    subscriptions: await database.subscription.findMany({ orderBy }),
    decisions: await database.referralDecision.findMany({ orderBy }),
    operations: await database.financialOperation.findMany({ orderBy }),
    postings: await database.ledgerPosting.findMany({ orderBy }),
    aliases: await database.requestIdentity.findMany({ orderBy }),
    audit: await database.auditRecord.findMany({ orderBy }),
    allocations: await database.reservationAllocation.findMany({ orderBy }),
  };
}

describe("atomic full-price purchases", () => {
  it.each([
    [
      "weekday cutoff",
      "2026-10-05T14:59:59.999Z",
      "2026-10-05T15:00:00Z",
      "2026-10-06",
    ],
    [
      "Friday cutoff",
      "2026-10-02T14:59:59.999Z",
      "2026-10-02T15:00:00Z",
      "2026-10-05",
    ],
    [
      "weekend entry",
      "2026-10-02T20:59:59.999Z",
      "2026-10-02T21:00:00Z",
      "2026-10-05",
    ],
    [
      "weekend exit",
      "2026-10-04T20:59:59.999Z",
      "2026-10-04T21:00:00Z",
      "2026-10-05",
    ],
  ])(
    "revalidates a quote crossing %s and activates only at commitment",
    async (_scenario, quotedAt, committedAt, firstWorkDate) => {
      await withSubscriptionDatabase(async (database) => {
        let now = new Date(quotedAt);
        const buyer = await createIdentityFixture(database, { now });
        await fundSubscriptionFixture(
          database,
          buyer,
          { referral: "0", nonReferral: "60" },
          now,
        );
        const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
        const quotes = new PurchaseQuoteService(database, () => now);
        const purchases = new SubscriptionPurchaseService(database, () => now);
        const original = await quotes.create(identity, { packageCode: "S1" });
        now = new Date(committedAt);
        let quote = original;
        if (original.preview.firstWorkDate !== firstWorkDate) {
          const before = await purchaseState(database);
          await expect(
            purchases.purchase(identity, {
              quoteId: original.quoteId,
              confirmed: true,
            }),
          ).rejects.toMatchObject({ code: "PURCHASE_QUOTE_STALE" });
          expect(await purchaseState(database)).toEqual(before);
          quote = await quotes.create(identity, { packageCode: "S1" });
        }
        const accepted = await purchases.purchase(identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        });
        expect(accepted.purchase.subscriptionAtPurchase).toMatchObject({
          activationAt: now.toISOString(),
          ...quote.preview,
        });
        expect(accepted.purchase.purchasedAt).toBe(now.toISOString());
        expect(
          await database.subscription.findUniqueOrThrow({
            where: { id: accepted.purchase.subscriptionAtPurchase.id },
          }),
        ).toMatchObject({
          activationAt: now,
          firstWorkDate: new Date(`${firstWorkDate}T00:00:00Z`),
          expiresAt: new Date(quote.preview.expiresAt),
        });
        expect(
          await database.financialOperation.findMany({
            where: { businessNamespace: "p04.purchase" },
          }),
        ).toHaveLength(1);
      });
    },
  );

  it("starts a fresh upgrade term, retains edited historical terms and replays after replacement and expiry", async () => {
    await withSubscriptionDatabase(async (database) => {
      let now = new Date("2026-10-05T09:00:00Z");
      const buyer = await createIdentityFixture(database, { now });
      const admin = await createIdentityFixture(database, {
        now,
        role: "ADMIN",
      });
      await database.authSession.update({
        where: { id: buyer.session.id },
        data: { expiresAt: new Date("2029-01-01T00:00:00Z") },
      });
      await fundSubscriptionFixture(
        database,
        buyer,
        { referral: "200", nonReferral: "100" },
        now,
      );
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quotes = new PurchaseQuoteService(database, () => now);
      const purchases = new SubscriptionPurchaseService(database, () => now);
      const memberships = new SubscriptionsService(database, () => now);
      const firstQuote = await quotes.create(identity, { packageCode: "S1" });
      const first = await purchases.purchase(identity, {
        quoteId: firstQuote.quoteId,
        confirmed: true,
      });
      const savedFirst = await database.subscription.findUniqueOrThrow({
        where: { id: first.purchase.subscriptionAtPurchase.id },
      });
      await new PackageConfigurationService(database, () => now).editPackage(
        { userId: admin.user.id, sessionId: admin.session.id },
        "S1",
        {
          commandId: randomUUID(),
          expectedVersion: 1,
          confirmed: true,
          reason: "Reviewed future subscription terms",
          price: "70",
          dailyReward: "3",
          countedWorkDates: 5,
          withdrawalFeeBps: 1234,
        },
      );
      now = new Date("2026-10-09T15:00:00Z");
      const upgradeQuote = await quotes.create(identity, { packageCode: "S2" });
      const upgrade = await purchases.purchase(identity, {
        quoteId: upgradeQuote.quoteId,
        confirmed: true,
      });
      expect(upgrade.purchase).toMatchObject({
        fullDebit: "120",
        commissionBase: "60",
        subscriptionAtPurchase: {
          activationAt: now.toISOString(),
          firstWorkDate: "2026-10-12",
          finalWorkDate: "2028-03-03",
          expiresAt: "2028-03-03T21:00:00.000Z",
          terms: { countedWorkDates: 365 },
        },
      });
      const replaced = await database.subscription.findUniqueOrThrow({
        where: { id: savedFirst.id },
      });
      expect(replaced).toEqual({
        ...savedFirst,
        state: "REPLACED",
        replacedAt: now,
        replacementPurchaseId: upgrade.purchase.purchaseId,
      });
      const originalCommand = { quoteId: firstQuote.quoteId, confirmed: true };
      expect(await purchases.purchase(identity, originalCommand)).toEqual({
        purchase: first.purchase,
        replayed: true,
      });
      now = new Date(upgrade.purchase.subscriptionAtPurchase.expiresAt);
      expect(await memberships.membership(identity)).toMatchObject({
        effective: "FREE",
        subscription: { state: "CURRENT" },
      });
      const beforeReplay = await purchaseState(database);
      expect(await purchases.purchase(identity, originalCommand)).toEqual({
        purchase: first.purchase,
        replayed: true,
      });
      expect(
        await purchases.purchase(identity, {
          quoteId: upgradeQuote.quoteId,
          confirmed: true,
        }),
      ).toEqual({ purchase: upgrade.purchase, replayed: true });
      expect(await purchaseState(database)).toEqual(beforeReplay);
      const renewalQuote = await quotes.create(identity, { packageCode: "S1" });
      const renewal = await purchases.purchase(identity, {
        quoteId: renewalQuote.quoteId,
        confirmed: true,
      });
      expect(renewal.purchase).toMatchObject({
        action: "PURCHASE",
        fullDebit: "70",
        commissionBase: "70",
        subscriptionAtPurchase: {
          terms: {
            price: "70",
            dailyReward: "3",
            countedWorkDates: 5,
            withdrawalFeeBps: 1234,
            conditionalGross: "15",
            version: 2,
          },
        },
      });
      expect(
        await database.subscription.findUniqueOrThrow({
          where: { id: upgrade.purchase.subscriptionAtPurchase.id },
        }),
      ).toMatchObject({
        state: "EXPIRED",
        acceptedTerms: upgrade.purchase.subscriptionAtPurchase.terms,
      });
      expect(
        await database.subscription.count({
          where: { state: "CURRENT", ownerUserId: buyer.user.id },
        }),
      ).toBe(1);
      expect(
        await database.financialOperation.findMany({
          where: { businessNamespace: "p04.purchase" },
          orderBy: { id: "asc" },
        }),
      ).toHaveLength(3);
      expect(
        await database.financialOperation.count({
          where: { origin: "TASK_REWARD" },
        }),
      ).toBe(0);
    });
  });

  it("rejects an upgrade quote when the saved membership expires while review is live", async () => {
    await withSubscriptionDatabase(async (database) => {
      let now = new Date("2026-10-05T09:00:00Z");
      const buyer = await createIdentityFixture(database, { now });
      await fundSubscriptionFixture(
        database,
        buyer,
        { referral: "0", nonReferral: "180" },
        now,
      );
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quotes = new PurchaseQuoteService(database, () => now);
      const purchases = new SubscriptionPurchaseService(database, () => now);
      const firstQuote = await quotes.create(identity, { packageCode: "S1" });
      const first = await purchases.purchase(identity, {
        quoteId: firstQuote.quoteId,
        confirmed: true,
      });
      const expiry = new Date(first.purchase.subscriptionAtPurchase.expiresAt);
      await database.authSession.update({
        where: { id: buyer.session.id },
        data: { expiresAt: new Date(expiry.getTime() + 86400000) },
      });
      now = new Date(expiry.getTime() - 1);
      const quote = await quotes.create(identity, { packageCode: "S2" });
      expect(quote.action).toBe("UPGRADE");
      now = expiry;
      const before = await purchaseState(database);
      await expect(
        purchases.purchase(identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        }),
      ).rejects.toMatchObject({ code: "PURCHASE_QUOTE_STALE" });
      expect(await purchaseState(database)).toEqual(before);
      const renewedReview = await quotes.create(identity, {
        packageCode: "S2",
      });
      expect(renewedReview.action).toBe("PURCHASE");
      expect(
        (
          await purchases.purchase(identity, {
            quoteId: renewedReview.quoteId,
            confirmed: true,
          })
        ).purchase.commissionBase,
      ).toBe("120");
    });
  });
  it.each(["59.999999", "60", "60.000001"])(
    "preserves exact one-micro purchase boundaries with %s available",
    async (amount) => {
      await withSubscriptionDatabase(async (database) => {
        const buyer = await createIdentityFixture(database, {
          now: P04_FIXTURE_NOW,
        });
        await fundSubscriptionFixture(database, buyer, {
          referral: amount,
          nonReferral: "0",
        });
        const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
        const quote = await new PurchaseQuoteService(
          database,
          () => P04_FIXTURE_NOW,
        ).create(identity, { packageCode: "S1" });
        const purchasing = new SubscriptionPurchaseService(
          database,
          () => P04_FIXTURE_NOW,
        ).purchase(identity, { quoteId: quote.quoteId, confirmed: true });
        if (amount === "59.999999") {
          expect(quote.requiredTopUp).toBe("0.000001");
          await expect(purchasing).rejects.toMatchObject({
            code: "LEDGER_INSUFFICIENT_FUNDS",
          });
          expect(await database.purchase.count()).toBe(0);
          expect(await database.financialOperation.count()).toBe(1);
        } else {
          expect(
            (await purchasing).purchase.walletAfter.availableReferral,
          ).toBe(amount === "60" ? "0" : "0.000001");
          expect(await database.purchase.count()).toBe(1);
        }
      });
    },
  );
  it.each([
    "price",
    "reward",
    "duration",
    "fee",
    "rates",
    "funds",
    "cutoff",
  ] as const)(
    "rejects material %s changes with zero purchase effects",
    async (change) => {
      await withSubscriptionDatabase(async (database) => {
        const quotedAt = new Date("2026-10-05T14:59:00.000Z");
        let now = quotedAt;
        const buyer = await createIdentityFixture(database, { now });
        const admin = await createIdentityFixture(database, {
          role: "ADMIN",
          now,
        });
        await fundSubscriptionFixture(
          database,
          buyer,
          { referral: "0", nonReferral: "60" },
          now,
        );
        const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
        const quote = await new PurchaseQuoteService(
          database,
          () => now,
        ).create(identity, { packageCode: "S1" });
        const configuration = new PackageConfigurationService(
          database,
          () => now,
        );
        const adminIdentity = {
          userId: admin.user.id,
          sessionId: admin.session.id,
        };
        if (
          change === "price" ||
          change === "reward" ||
          change === "duration" ||
          change === "fee"
        )
          await configuration.editPackage(adminIdentity, "S1", {
            commandId: randomUUID(),
            expectedVersion: 1,
            confirmed: true,
            reason: "Review material future change",
            ...(change === "price"
              ? { price: "61" }
              : change === "reward"
                ? { dailyReward: "3" }
                : change === "duration"
                  ? { countedWorkDates: 5 }
                  : { withdrawalFeeBps: 1000 }),
          });
        if (change === "rates")
          await configuration.editReferrals(adminIdentity, {
            commandId: randomUUID(),
            expectedVersion: 1,
            confirmed: true,
            reason: "Review future commission rates",
            ratesBps: [1100, 600, 400, 200, 200],
          });
        if (change === "funds")
          await fundSubscriptionFixture(
            database,
            buyer,
            { referral: "0", nonReferral: "0.000001" },
            now,
          );
        if (change === "cutoff") now = new Date("2026-10-05T15:00:00.000Z");
        const before = {
          wallet: await database.wallet.findUnique({
            where: { ownerUserId: buyer.user.id },
          }),
          operations: await database.financialOperation.count(),
          postings: await database.ledgerPosting.count(),
          audit: await database.auditRecord.count(),
        };
        await expect(
          new SubscriptionPurchaseService(database, () => now).purchase(
            identity,
            { quoteId: quote.quoteId, confirmed: true },
          ),
        ).rejects.toMatchObject({ code: "PURCHASE_QUOTE_STALE" });
        expect(await database.purchase.count()).toBe(0);
        expect(await database.subscription.count()).toBe(0);
        expect(await database.referralDecision.count()).toBe(0);
        expect(
          await database.wallet.findUnique({
            where: { ownerUserId: buyer.user.id },
          }),
        ).toEqual(before.wallet);
        expect(await database.financialOperation.count()).toBe(
          before.operations,
        );
        expect(await database.ledgerPosting.count()).toBe(before.postings);
        expect(await database.auditRecord.count()).toBe(before.audit);
      });
    },
  );

  it("rolls every debit/domain/award/alias/audit effect back on a real late database failure", async () => {
    await withSubscriptionDatabase(async (database) => {
      const { buyer, ancestors } = await createSubscriptionScenario(database);
      const sponsor = ancestors[0];
      if (sponsor === undefined) throw new Error("Missing sponsor.");
      await fundSubscriptionFixture(database, sponsor, {
        referral: "0",
        nonReferral: "60",
      });
      await activateSubscriptionFixture(database, sponsor);
      await fundSubscriptionFixture(database, buyer, {
        referral: "10",
        nonReferral: "50",
      });
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quote = await new PurchaseQuoteService(
        database,
        () => P04_FIXTURE_NOW,
      ).create(identity, { packageCode: "S1" });
      const before = {
        wallets: await database.wallet.findMany({ orderBy: { id: "asc" } }),
        purchases: await database.purchase.count(),
        subscriptions: await database.subscription.count(),
        operations: await database.financialOperation.count(),
        postings: await database.ledgerPosting.count(),
        audit: await database.auditRecord.count(),
        aliases: await database.requestIdentity.count(),
      };
      await database.$executeRawUnsafe(
        "CREATE FUNCTION fail_p04_award() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled late award failure'; END $$",
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER fail_p04_award BEFORE INSERT ON referral_decisions FOR EACH ROW EXECUTE FUNCTION fail_p04_award()",
      );
      await expect(
        new SubscriptionPurchaseService(
          database,
          () => P04_FIXTURE_NOW,
        ).purchase(
          identity,
          { quoteId: quote.quoteId, confirmed: true },
          "rollback-alias",
        ),
      ).rejects.toMatchObject({ code: "LEDGER_INTERNAL" });
      expect(
        await database.wallet.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(before.wallets);
      expect(await database.purchase.count()).toBe(before.purchases);
      expect(await database.subscription.count()).toBe(before.subscriptions);
      expect(await database.financialOperation.count()).toBe(before.operations);
      expect(await database.ledgerPosting.count()).toBe(before.postings);
      expect(await database.auditRecord.count()).toBe(before.audit);
      expect(await database.requestIdentity.count()).toBe(before.aliases);
      expect(await database.referralDecision.count()).toBe(0);
    });
  });
  it("quotes without effects, spends referral first and replays the immutable outcome with any key", async () => {
    await withSubscriptionDatabase(async (database) => {
      const buyer = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      await fundSubscriptionFixture(database, buyer, {
        referral: "30",
        nonReferral: "70.000001",
      });
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const clock = () => P04_FIXTURE_NOW;
      const quotes = new PurchaseQuoteService(database, clock);
      const purchases = new SubscriptionPurchaseService(database, clock);
      const before = await database.financialOperation.count();
      const quote = await quotes.create(identity, { packageCode: "S1" });
      expect(await database.financialOperation.count()).toBe(before);
      expect(quote.fullDebit).toBe("60");
      expect(quote.fundedAllocation).toEqual({
        referral: "30",
        nonReferral: "30",
        total: "60",
      });
      const command = { quoteId: quote.quoteId, confirmed: true as const };
      const first = await purchases.purchase(identity, command, "original");
      expect(first.replayed).toBe(false);
      expect(first.purchase.walletAfter).toEqual({
        availableReferral: "0",
        availableNonReferral: "40.000001",
        reservedReferral: "0",
        reservedNonReferral: "0",
        total: "40.000001",
      });
      for (const key of ["original", "alias", undefined]) {
        expect(await purchases.purchase(identity, command, key)).toEqual({
          purchase: first.purchase,
          replayed: true,
        });
      }
      expect(await database.purchase.count()).toBe(1);
      expect(await database.subscription.count()).toBe(1);
      expect(await database.financialOperation.count()).toBe(before + 1);
      expect(await quotes.outcome(identity, quote.quoteId)).toMatchObject({
        status: "COMMITTED",
        purchase: first.purchase,
      });
    });
  });

  it("commits the inseparable eligible award at the purchase instant without replaying it", async () => {
    await withSubscriptionDatabase(async (database) => {
      const { buyer, ancestors } = await createSubscriptionScenario(database);
      const sponsor = ancestors[0];
      if (sponsor === undefined) throw new Error("Missing L1 fixture.");
      await fundSubscriptionFixture(database, sponsor, {
        referral: "0",
        nonReferral: "60",
      });
      await activateSubscriptionFixture(database, sponsor);
      await fundSubscriptionFixture(database, buyer, {
        referral: "0",
        nonReferral: "600",
      });
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quotes = new PurchaseQuoteService(database, () => P04_FIXTURE_NOW);
      const purchaseService = new SubscriptionPurchaseService(
        database,
        () => P04_FIXTURE_NOW,
      );
      const quote = await quotes.create(identity, { packageCode: "O1" });
      const command = { quoteId: quote.quoteId, confirmed: true as const };
      const first = await purchaseService.purchase(identity, command);
      await purchaseService.purchase(identity, command, "award-replay");
      const decisions = await database.referralDecision.findMany({
        where: { purchaseId: first.purchase.purchaseId },
        orderBy: { level: "asc" },
      });
      expect(decisions).toHaveLength(5);
      expect(decisions[0]).toMatchObject({
        decision: "AWARDED",
        rateBps: 1200,
        awardUnits: 72000000n,
        occurredAt: P04_FIXTURE_NOW,
      });
      expect(
        decisions.slice(1).every((decision) => decision.decision === "SKIPPED"),
      ).toBe(true);
      expect(
        await database.wallet.findUnique({
          where: { ownerUserId: sponsor.user.id },
        }),
      ).toMatchObject({ availableReferralUnits: 72000000n });
      expect(
        await database.financialOperation.count({
          where: { businessNamespace: "p04.referral" },
        }),
      ).toBe(1);
    });
  });

  it("serializes distinct quotes across independent device connections and preserves every losing effect", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const buyer = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      await fundSubscriptionFixture(database, buyer, {
        referral: "60",
        nonReferral: "60",
      });
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quotes = new PurchaseQuoteService(database, () => P04_FIXTURE_NOW);
      const reviewed = await Promise.all([
        quotes.create(identity, { packageCode: "S1" }),
        quotes.create(identity, { packageCode: "S2" }),
      ]);
      const before = {
        operations: await database.financialOperation.count(),
        postings: await database.ledgerPosting.count(),
        audit: await database.auditRecord.count(),
      };
      const outcomes = await withIndependentSubscriptionClients(
        url,
        async (first, second) => {
          const start = subscriptionRaceBarrier(2);
          return Promise.allSettled(
            [first, second].map(async (connection, index) => {
              await start();
              const quote = reviewed[index];
              if (quote === undefined) throw new Error("Missing quote.");
              return new SubscriptionPurchaseService(
                connection,
                () => P04_FIXTURE_NOW,
              ).purchase(
                identity,
                { quoteId: quote.quoteId, confirmed: true },
                `device-${String(index)}`,
              );
            }),
          );
        },
      );
      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.find((outcome) => outcome.status === "rejected"),
      ).toMatchObject({ reason: { code: "PURCHASE_QUOTE_STALE" } });
      const winner = outcomes.find((outcome) => outcome.status === "fulfilled");
      if (winner?.status !== "fulfilled")
        throw new Error("No winning purchase.");
      expect(await database.purchase.count()).toBe(1);
      expect(await database.subscription.count()).toBe(1);
      expect(await database.requestIdentity.count()).toBe(1);
      expect(await database.financialOperation.count()).toBe(
        before.operations + 1,
      );
      expect(await database.auditRecord.count()).toBe(before.audit + 1);
      expect(await database.ledgerPosting.count()).toBe(
        before.postings + (winner.value.purchase.fullDebit === "60" ? 1 : 2),
      );
      expect(
        await database.wallet.findUnique({
          where: { ownerUserId: buyer.user.id },
        }),
      ).toMatchObject({
        availableReferralUnits: 0n,
        availableNonReferralUnits:
          winner.value.purchase.fullDebit === "60" ? 60000000n : 0n,
      });
    });
  });

  it("rejects changed-key intent and tampered bodies with no alias or domain effects", async () => {
    await withSubscriptionDatabase(async (database) => {
      const buyer = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      await fundSubscriptionFixture(database, buyer, {
        referral: "0",
        nonReferral: "180",
      });
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quotes = new PurchaseQuoteService(database, () => P04_FIXTURE_NOW);
      const purchases = new SubscriptionPurchaseService(
        database,
        () => P04_FIXTURE_NOW,
      );
      const first = await quotes.create(identity, { packageCode: "S1" });
      await purchases.purchase(
        identity,
        { quoteId: first.quoteId, confirmed: true },
        "bound-key",
      );
      const next = await quotes.create(identity, { packageCode: "S2" });
      await expect(
        purchases.purchase(
          identity,
          { quoteId: next.quoteId, confirmed: true },
          "bound-key",
        ),
      ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
      await expect(
        purchases.purchase(identity, {
          quoteId: next.quoteId,
          confirmed: true,
          price: "1",
        }),
      ).rejects.toThrow();
      expect(await database.purchase.count()).toBe(1);
      expect(await database.requestIdentity.count()).toBe(1);
      expect(
        await database.wallet.findUnique({
          where: { ownerUserId: buyer.user.id },
        }),
      ).toMatchObject({ availableNonReferralUnits: 120000000n });
    });
  });

  it("spends retained referrals after exact expiry and leaves recorded reservation sources unchanged", async () => {
    await withSubscriptionDatabase(async (database) => {
      const buyer = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      await fundSubscriptionFixture(database, buyer, {
        referral: "60",
        nonReferral: "80",
      });
      const old = await activateSubscriptionFixture(database, buyer);
      const expiredAt = old.subscription.expiresAt;
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: expiredAt,
      });
      const expiredCounts = await new PackagesService(
        database,
        () => expiredAt,
      ).adminCatalog({ userId: admin.user.id, sessionId: admin.session.id });
      expect(
        expiredCounts.items.every((row) => row.activeSubscriptionsCount === 0),
      ).toBe(true);
      await database.authSession.update({
        where: { id: buyer.session.id },
        data: { expiresAt: new Date(expiredAt.getTime() + 86400000) },
      });
      await fundSubscriptionFixture(
        database,
        buyer,
        { referral: "60", nonReferral: "0" },
        expiredAt,
      );
      const wallet = buyer.wallet;
      if (wallet === null) throw new Error("Missing wallet.");
      const reservationId = randomUUID();
      await new LedgerService(database, {
        businessNamespaces: ["p04.fixture.reserve"],
        processIds: ["fixture"],
      }).execute(
        {
          kind: "RESERVE",
          walletId: wallet.id,
          businessNamespace: "p04.fixture.reserve",
          businessKey: reservationId,
          reservationId,
          amount: "80",
        },
        {
          actor: { type: "PROCESS", processId: "fixture" },
          walletIds: [wallet.id],
          clock: () => expiredAt,
          observe: async () => {},
          mutate: async () => {},
          eligibleSources: () => Promise.resolve(["NON_REFERRAL"]),
        },
      );
      const reserved = await database.reservationAllocation.findUniqueOrThrow({
        where: { id: reservationId },
      });
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quote = await new PurchaseQuoteService(
        database,
        () => expiredAt,
      ).create(identity, { packageCode: "S1" });
      expect(quote).toMatchObject({
        action: "PURCHASE",
        usableFunds: "60",
        fundedAllocation: { referral: "60", nonReferral: "0" },
      });
      const command = await new SubscriptionPurchaseService(
        database,
        () => expiredAt,
      ).purchase(identity, { quoteId: quote.quoteId, confirmed: true });
      expect(command.purchase).toMatchObject({
        commissionBase: "60",
        walletAfter: {
          availableReferral: "0",
          reservedNonReferral: "80",
          total: "80",
        },
      });
      expect(
        await database.reservationAllocation.findUnique({
          where: { id: reservationId },
        }),
      ).toEqual(reserved);
      expect(
        await database.subscription.findUnique({
          where: { id: old.subscription.id },
        }),
      ).toMatchObject({ state: "EXPIRED" });
    });
  });

  it("returns live absence, locked exact-expiry absence and immutable success after a service restart", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const buyer = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      await fundSubscriptionFixture(database, buyer, {
        referral: "0",
        nonReferral: "60",
      });
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      let now = P04_FIXTURE_NOW;
      const quotes = new PurchaseQuoteService(database, () => now);
      const quote = await quotes.create(identity, { packageCode: "S1" });
      expect(await quotes.outcome(identity, quote.quoteId)).toMatchObject({
        status: "NOT_OBSERVED",
      });
      await withIndependentSubscriptionClients(
        url,
        async (holder, observer) => {
          await withSubscriptionUserLock(
            holder,
            buyer.user.id,
            async (release) => {
              const pending = new PurchaseQuoteService(
                observer,
                () => now,
              ).outcome(identity, quote.quoteId);
              now = new Date(quote.quoteExpiresAt);
              release();
              expect(await pending).toMatchObject({
                status: "EXPIRED_UNCOMMITTED",
              });
            },
          );
        },
      );
      await expect(
        new SubscriptionPurchaseService(database, () => now).purchase(
          identity,
          { quoteId: quote.quoteId, confirmed: true },
        ),
      ).rejects.toMatchObject({ code: "PURCHASE_QUOTE_STALE" });
      const fresh = await quotes.create(identity, { packageCode: "S1" });
      const accepted = await new SubscriptionPurchaseService(
        database,
        () => now,
      ).purchase(identity, { quoteId: fresh.quoteId, confirmed: true });
      now = new Date(now.getTime() + 600001);
      const restarted = new PurchaseQuoteService(database, () => now);
      expect(await restarted.outcome(identity, fresh.quoteId)).toMatchObject({
        status: "COMMITTED",
        purchase: accepted.purchase,
      });
      expect(
        await new SubscriptionPurchaseService(database, () => now).purchase(
          identity,
          { quoteId: fresh.quoteId, confirmed: true },
        ),
      ).toEqual({ purchase: accepted.purchase, replayed: true });
    });
  });

  it("waits for an already locked purchase before reporting its expired outcome", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const buyer = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      await fundSubscriptionFixture(database, buyer, {
        referral: "0",
        nonReferral: "60",
      });
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quote = await new PurchaseQuoteService(
        database,
        () => P04_FIXTURE_NOW,
      ).create(identity, { packageCode: "S1" });
      await database.$executeRawUnsafe(
        "CREATE FUNCTION hold_p04_purchase() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(404017); RETURN NEW; END $$",
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER hold_p04_purchase BEFORE INSERT ON purchases FOR EACH ROW EXECUTE FUNCTION hold_p04_purchase()",
      );
      await withIndependentSubscriptionClients(
        url,
        async (holder, purchaser) => {
          let announce: () => void = () => {};
          let release: () => void = () => {};
          let failAcquisition: (error: unknown) => void = () => {};
          const acquired = new Promise<void>((resolve, reject) => {
            announce = resolve;
            failAcquisition = reject;
          });
          const released = new Promise<void>((resolve) => {
            release = resolve;
          });
          const holding = holder.$transaction(
            async (transaction) => {
              await transaction.$queryRaw`SELECT true AS held FROM (SELECT pg_advisory_xact_lock(404017)) acquired`;
              announce();
              await released;
            },
            { timeout: 10000 },
          );
          void holding.catch(failAcquisition);
          await acquired;
          const purchasing = new SubscriptionPurchaseService(
            purchaser,
            () => P04_FIXTURE_NOW,
          ).purchase(identity, { quoteId: quote.quoteId, confirmed: true });
          let observed: ReturnType<PurchaseQuoteService["outcome"]> | undefined;
          try {
            await waitForPurchaseLock(database, "INSERT INTO");
            observed = new PurchaseQuoteService(
              database,
              () => new Date(quote.quoteExpiresAt),
            ).outcome(identity, quote.quoteId);
            await waitForPurchaseLock(database, "FROM users");
            release();
            const accepted = await purchasing;
            expect(await observed).toMatchObject({
              status: "COMMITTED",
              purchase: accepted.purchase,
            });
          } finally {
            release();
            await holding;
            await Promise.allSettled([
              purchasing,
              ...(observed === undefined ? [] : [observed]),
            ]);
          }
        },
      );
    });
  });

  it("never produces terminal absence on a buyer-lock timeout", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const buyer = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quote = await new PurchaseQuoteService(
        database,
        () => P04_FIXTURE_NOW,
      ).create(identity, { packageCode: "S1" });
      await withIndependentSubscriptionClients(
        url,
        async (holder, observer) => {
          await withSubscriptionUserLock(holder, buyer.user.id, async () => {
            await expect(
              new PurchaseQuoteService(
                observer,
                () => new Date(quote.quoteExpiresAt),
              ).outcome(identity, quote.quoteId),
            ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
          });
        },
      );
      expect(await database.purchase.count()).toBe(0);
      expect(await database.financialOperation.count()).toBe(0);
    });
  });

  it("serializes separate buyers sharing paid ancestors without lost or duplicate credits", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const { buyer, ancestors } = await createSubscriptionScenario(database);
      const sponsor = ancestors[0];
      if (sponsor === undefined) throw new Error("Missing sponsor.");
      for (const ancestor of ancestors) {
        await fundSubscriptionFixture(database, ancestor, {
          referral: "0",
          nonReferral: "60",
        });
        await activateSubscriptionFixture(database, ancestor);
      }
      const sibling = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
        sponsorUserId: sponsor.user.id,
      });
      const buyers = [buyer, sibling];
      const quotes: Awaited<ReturnType<PurchaseQuoteService["create"]>>[] = [];
      for (const account of buyers) {
        await fundSubscriptionFixture(database, account, {
          referral: "0",
          nonReferral: "60",
        });
        quotes.push(
          await new PurchaseQuoteService(
            database,
            () => P04_FIXTURE_NOW,
          ).create(
            { userId: account.user.id, sessionId: account.session.id },
            { packageCode: "S1" },
          ),
        );
      }
      const before = await purchaseState(database);
      const outcomes = await withIndependentSubscriptionClients(
        url,
        async (first, second) => {
          const start = subscriptionRaceBarrier(2);
          return Promise.all(
            [first, second].map(async (connection, index) => {
              const account = buyers[index];
              const quote = quotes[index];
              if (account === undefined || quote === undefined)
                throw new Error("Missing race participant.");
              await start();
              return new SubscriptionPurchaseService(
                connection,
                () => P04_FIXTURE_NOW,
              ).purchase(
                { userId: account.user.id, sessionId: account.session.id },
                { quoteId: quote.quoteId, confirmed: true },
                `shared-${String(index)}`,
              );
            }),
          );
        },
      );
      expect(outcomes).toHaveLength(2);
      expect(outcomes.every((outcome) => !outcome.replayed)).toBe(true);
      const after = await purchaseState(database);
      expect(after.operations.length - before.operations.length).toBe(12);
      expect(after.postings.length - before.postings.length).toBe(12);
      expect(after.audit.length - before.audit.length).toBe(12);
      expect(after.decisions).toHaveLength(10);
      expect(after.aliases).toHaveLength(2);
      for (const [index, ancestor] of ancestors.entries()) {
        expect(
          await database.wallet.findUniqueOrThrow({
            where: { ownerUserId: ancestor.user.id },
          }),
        ).toMatchObject({
          availableReferralUnits: [
            14400000n,
            7200000n,
            4800000n,
            2400000n,
            2400000n,
          ][index],
          reservedReferralUnits: 0n,
          availableNonReferralUnits: 0n,
          reservedNonReferralUnits: 0n,
        });
      }
      for (const outcome of outcomes) {
        const saved = await database.referralDecision.findMany({
          where: { purchaseId: outcome.purchase.purchaseId },
          orderBy: { level: "asc" },
        });
        expect(saved.map((decision) => decision.level)).toEqual([
          1, 2, 3, 4, 5,
        ]);
        expect(
          saved.every(
            (decision) =>
              decision.occurredAt.toISOString() ===
              outcome.purchase.purchasedAt,
          ),
        ).toBe(true);
        expect(
          after.operations
            .filter(
              (operation) =>
                operation.businessKey === outcome.purchase.quoteId ||
                operation.businessKey.startsWith(
                  `${outcome.purchase.purchaseId}:`,
                ),
            )
            .every(
              (operation) =>
                operation.createdAt.toISOString() ===
                outcome.purchase.purchasedAt,
            ),
        ).toBe(true);
      }
    });
  });

  it.each(["reserve", "correction"] as const)(
    "rechecks a purchase after an independently locked foundation %s and preserves the winner alone",
    async (effect) => {
      await withSubscriptionDatabase(async (database, url) => {
        const buyer = await createIdentityFixture(database, {
          now: P04_FIXTURE_NOW,
        });
        const admin = await createIdentityFixture(database, {
          role: "ADMIN",
          now: P04_FIXTURE_NOW,
        });
        if (buyer.wallet === null) throw new Error("Missing wallet.");
        const walletId = buyer.wallet.id;
        await fundSubscriptionFixture(database, buyer, {
          referral: "20",
          nonReferral: "40",
        });
        const reference = await database.financialOperation.findFirstOrThrow({
          where: { walletId, kind: "CREDIT", origin: "DEPOSIT" },
        });
        const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
        const quote = await new PurchaseQuoteService(
          database,
          () => P04_FIXTURE_NOW,
        ).create(identity, { packageCode: "S1" });
        const before = await purchaseState(database);
        await withIndependentSubscriptionClients(
          url,
          async (winner, purchaser) => {
            let announce: () => void = () => {};
            let release: () => void = () => {};
            let fail: (error: unknown) => void = () => {};
            const acquired = new Promise<void>((resolve, reject) => {
              announce = resolve;
              fail = reject;
            });
            const released = new Promise<void>((resolve) => {
              release = resolve;
            });
            const businessKey = randomUUID();
            const winning = new LedgerService(winner, {
              businessNamespaces: ["p04.race"],
              processIds: ["fixture"],
            }).execute(
              effect === "reserve"
                ? {
                    kind: "RESERVE",
                    walletId,
                    businessNamespace: "p04.race",
                    businessKey,
                    reservationId: businessKey,
                    amount: "20",
                  }
                : {
                    kind: "CORRECTION",
                    walletId,
                    businessNamespace: "p04.race",
                    businessKey,
                    amount: "20",
                    source: "NON_REFERRAL",
                    direction: "DEBIT",
                    reason: "Controlled source correction",
                    referenceOperationId: reference.id,
                  },
              {
                actor:
                  effect === "reserve"
                    ? { type: "PROCESS", processId: "fixture" }
                    : { type: "USER", userId: admin.user.id },
                walletIds: [walletId],
                clock: () => P04_FIXTURE_NOW,
                observe: async () => {},
                mutate: async () => {
                  announce();
                  await released;
                },
                eligibleSources: () => Promise.resolve(["NON_REFERRAL"]),
              },
            );
            void winning.catch(fail);
            await acquired;
            const purchasing = new SubscriptionPurchaseService(
              purchaser,
              () => P04_FIXTURE_NOW,
            ).purchase(
              identity,
              { quoteId: quote.quoteId, confirmed: true },
              `losing-${effect}`,
            );
            const observedFailure = purchasing.catch((error: unknown) => error);
            try {
              await waitForPurchaseLock(database, "FROM users");
              release();
              await winning;
              expect(await observedFailure).toMatchObject({
                code: "PURCHASE_QUOTE_STALE",
              });
            } finally {
              release();
              await Promise.allSettled([winning, purchasing]);
            }
          },
        );
        const after = await purchaseState(database);
        expect(after.purchases).toEqual(before.purchases);
        expect(after.subscriptions).toEqual(before.subscriptions);
        expect(after.decisions).toEqual(before.decisions);
        expect(after.aliases).toEqual(before.aliases);
        expect(after.operations.length).toBe(before.operations.length + 1);
        expect(after.postings.length).toBe(before.postings.length + 1);
        expect(after.audit.length).toBe(before.audit.length + 1);
        expect(
          await database.wallet.findUniqueOrThrow({ where: { id: walletId } }),
        ).toMatchObject({
          availableReferralUnits: 20000000n,
          availableNonReferralUnits: 20000000n,
          reservedReferralUnits: 0n,
          reservedNonReferralUnits: effect === "reserve" ? 20000000n : 0n,
        });
        expect(after.allocations).toHaveLength(effect === "reserve" ? 1 : 0);
      });
    },
  );

  it.each(["buyer", "ancestor"] as const)(
    "evaluates %s expiry after waiting for the shared user lock",
    async (expiring) => {
      await withSubscriptionDatabase(async (database, url) => {
        const ancestor = await createIdentityFixture(database, {
          now: new Date("2025-05-19T09:00:00Z"),
        });
        await fundSubscriptionFixture(database, ancestor, {
          referral: "0",
          nonReferral: "60",
        });
        const oldAncestor = await activateSubscriptionFixture(
          database,
          ancestor,
          "S1",
          new Date("2025-05-19T09:00:00Z"),
        );
        const expiresAt = oldAncestor.subscription.expiresAt;
        let now = new Date(expiresAt.getTime() - 1);
        const buyer = await createIdentityFixture(database, {
          now,
          sponsorUserId: ancestor.user.id,
        });
        await fundSubscriptionFixture(
          database,
          buyer,
          { referral: "0", nonReferral: "660" },
          now,
        );
        if (expiring === "buyer") {
          const old = await activateSubscriptionFixture(
            database,
            buyer,
            "S1",
            new Date("2025-05-19T09:00:00Z"),
          );
          expect(old.subscription.expiresAt).toEqual(expiresAt);
        }
        const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
        const quote = await new PurchaseQuoteService(
          database,
          () => now,
        ).create(identity, { packageCode: "O1" });
        const before = await purchaseState(database);
        await withIndependentSubscriptionClients(
          url,
          async (holder, purchaser) => {
            await withSubscriptionUserLock(
              holder,
              expiring === "buyer" ? buyer.user.id : ancestor.user.id,
              async (release) => {
                const purchasing = new SubscriptionPurchaseService(
                  purchaser,
                  () => now,
                ).purchase(
                  identity,
                  { quoteId: quote.quoteId, confirmed: true },
                  `expiry-${expiring}`,
                );
                const observed = purchasing.catch((error: unknown) => error);
                try {
                  await waitForPurchaseLock(database, "FROM users");
                  now = expiresAt;
                  release();
                  if (expiring === "buyer")
                    expect(await observed).toMatchObject({
                      code: "PURCHASE_QUOTE_STALE",
                    });
                  else {
                    const accepted = await purchasing;
                    expect(accepted.purchase.purchasedAt).toBe(
                      expiresAt.toISOString(),
                    );
                    expect(
                      await database.referralDecision.findMany({
                        where: { purchaseId: accepted.purchase.purchaseId },
                      }),
                    ).toMatchObject([
                      {
                        level: 1,
                        decision: "SKIPPED",
                        skippedReason: "EXPIRED",
                        awardUnits: 0n,
                        creditOperationId: null,
                        occurredAt: expiresAt,
                      },
                    ]);
                  }
                } finally {
                  release();
                  await Promise.allSettled([purchasing]);
                }
              },
            );
          },
        );
        if (expiring === "buyer")
          expect(await purchaseState(database)).toEqual(before);
        else
          expect(
            await database.wallet.findUniqueOrThrow({
              where: { ownerUserId: ancestor.user.id },
            }),
          ).toMatchObject({ availableReferralUnits: 0n });
      });
    },
  );

  it.each([
    "subscription",
    "second-award",
    "caught-second-award",
    "missing-wallet",
  ] as const)(
    "rolls back every purchase effect on a late %s failure",
    async (failure) => {
      await withSubscriptionDatabase(async (database) => {
        const { buyer, ancestors } = await createSubscriptionScenario(database);
        for (const ancestor of ancestors.slice(0, 2)) {
          await fundSubscriptionFixture(database, ancestor, {
            referral: "0",
            nonReferral: "60",
          });
          await activateSubscriptionFixture(database, ancestor);
        }
        await fundSubscriptionFixture(database, buyer, {
          referral: "20",
          nonReferral: "640",
        });
        await activateSubscriptionFixture(database, buyer);
        const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
        const quote = await new PurchaseQuoteService(
          database,
          () => P04_FIXTURE_NOW,
        ).create(identity, { packageCode: "O1" });
        if (failure !== "missing-wallet") {
          await database.$executeRawUnsafe(
            "CREATE SEQUENCE dependency_reached",
          );
          await database.$executeRawUnsafe(
            failure === "subscription"
              ? "CREATE FUNCTION fail_p04_dependency() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.package_code = 'O1' THEN PERFORM nextval('dependency_reached'); RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'controlled late dependency failure'; END IF; RETURN NEW; END $$"
              : "CREATE FUNCTION fail_p04_dependency() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('dependency_reached'); IF NEW.level = 2 THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'controlled late dependency failure'; END IF; RETURN NEW; END $$",
          );
          await database.$executeRawUnsafe(
            failure === "subscription"
              ? "CREATE TRIGGER fail_p04_dependency BEFORE INSERT ON subscriptions FOR EACH ROW EXECUTE FUNCTION fail_p04_dependency()"
              : "CREATE TRIGGER fail_p04_dependency BEFORE INSERT ON referral_decisions FOR EACH ROW EXECUTE FUNCTION fail_p04_dependency()",
          );
        }
        const before = await purchaseState(database);
        const second = ancestors[1];
        const resolveParticipants =
          referralCommissions.resolveReferralParticipants;
        const awardCommissions = referralCommissions.awardReferralCommissions;
        // Retained debit history prevents deleting a paid user's wallet. Inject only a missing pre-resolved pointer;
        // the actual purchase, first award, second-recipient eligibility, transaction and rollback remain real PostgreSQL.
        const missingPointer =
          failure === "missing-wallet"
            ? vi
                .spyOn(referralCommissions, "resolveReferralParticipants")
                .mockImplementation(async (connection, buyerId) => {
                  const participants = await resolveParticipants(
                    connection,
                    buyerId,
                  );
                  return participants.map((participant) =>
                    participant.userId === second?.user.id
                      ? { ...participant, walletId: null }
                      : participant,
                  );
                })
            : undefined;
        // Task T022 explicitly requires caught-child fault injection. Execute the actual collaborator and SQL
        // failure, then deliberately swallow it; the real ledger must still reject and roll back the purchase.
        const caughtChild =
          failure === "caught-second-award"
            ? vi
                .spyOn(referralCommissions, "awardReferralCommissions")
                .mockImplementation(async (input) => {
                  try {
                    await awardCommissions(input);
                  } catch (error) {
                    if (
                      !(error instanceof Prisma.PrismaClientKnownRequestError)
                    )
                      throw error;
                  }
                })
            : undefined;
        try {
          await expect(
            new SubscriptionPurchaseService(
              database,
              () => P04_FIXTURE_NOW,
            ).purchase(
              identity,
              { quoteId: quote.quoteId, confirmed: true },
              `rollback-${failure}`,
            ),
          ).rejects.toMatchObject({ code: "LEDGER_INTERNAL" });
          expect(await purchaseState(database)).toEqual(before);
          if (failure !== "missing-wallet")
            expect(
              await database.$queryRaw`SELECT last_value FROM dependency_reached`,
            ).toEqual([{ last_value: failure === "subscription" ? 1n : 2n }]);
        } finally {
          missingPointer?.mockRestore();
          caughtChild?.mockRestore();
        }
      });
    },
  );

  it.each(["buyer", "ancestor"] as const)(
    "serializes current %s restrictions against purchase on independent connections",
    async (restricted) => {
      await withSubscriptionDatabase(async (database, url) => {
        const now = new Date();
        const { buyer, ancestors } = await createSubscriptionScenario(
          database,
          now,
        );
        const ancestor = ancestors[0];
        if (ancestor === undefined) throw new Error("Missing ancestor.");
        await fundSubscriptionFixture(
          database,
          ancestor,
          {
            referral: "0",
            nonReferral: "60",
          },
          now,
        );
        await activateSubscriptionFixture(database, ancestor, "S1", now);
        await fundSubscriptionFixture(
          database,
          buyer,
          {
            referral: "0",
            nonReferral: "60",
          },
          now,
        );
        const admin = await createIdentityFixture(database, {
          role: "ADMIN",
          now,
        });
        const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
        const quote = await new PurchaseQuoteService(
          database,
          () => now,
        ).create(identity, { packageCode: "S1" });
        const before = await purchaseState(database);
        const [purchaseOutcome, restrictionOutcome] =
          await withIndependentSubscriptionClients(
            url,
            async (purchaser, controller) => {
              const start = subscriptionRaceBarrier(2);
              return Promise.allSettled([
                (async () => {
                  await start();
                  return new SubscriptionPurchaseService(
                    purchaser,
                    () => now,
                  ).purchase(
                    identity,
                    { quoteId: quote.quoteId, confirmed: true },
                    `restriction-${restricted}`,
                  );
                })(),
                (async () => {
                  await start();
                  return new EmployeeRestrictionsService(
                    controller,
                  ).updateRestrictions(
                    { userId: admin.user.id, sessionId: admin.session.id },
                    restricted === "buyer" ? buyer.user.id : ancestor.user.id,
                    {
                      expectedVersion: 0,
                      confirmed: true,
                      status: "BANNED",
                      reason: "Controlled concurrent restriction",
                    },
                  );
                })(),
              ] as const);
            },
          );
        if (restrictionOutcome.status === "rejected")
          throw restrictionOutcome.reason;
        const after = await purchaseState(database);
        if (purchaseOutcome.status === "rejected") {
          expect(restricted).toBe("buyer");
          expect(purchaseOutcome.reason).toMatchObject({
            code: "LEDGER_FORBIDDEN",
          });
          expect(after).toEqual(before);
        } else {
          expect(after.purchases.length).toBe(before.purchases.length + 1);
          expect(after.subscriptions.length).toBe(
            before.subscriptions.length + 1,
          );
          const decisions = await database.referralDecision.findMany({
            where: { purchaseId: purchaseOutcome.value.purchase.purchaseId },
            orderBy: { level: "asc" },
          });
          const first = decisions[0];
          if (first === undefined) throw new Error("Missing decision.");
          if (first.decision === "SKIPPED")
            expect(first).toMatchObject({
              skippedReason: "BANNED",
              awardUnits: 0n,
              eligibilitySnapshot: { status: "BANNED", accountVersion: 1 },
            });
          else
            expect(first).toMatchObject({
              decision: "AWARDED",
              awardUnits: 7200000n,
              eligibilitySnapshot: { status: "ACTIVE", accountVersion: 0 },
            });
          expect(
            await database.wallet.findUniqueOrThrow({
              where: { ownerUserId: ancestor.user.id },
            }),
          ).toMatchObject({ availableReferralUnits: first.awardUnits });
          expect(after.operations.length - before.operations.length).toBe(
            first.decision === "AWARDED" ? 2 : 1,
          );
          expect(after.postings.length - before.postings.length).toBe(
            first.decision === "AWARDED" ? 2 : 1,
          );
          expect(after.audit.length - before.audit.length).toBe(
            first.decision === "AWARDED" ? 2 : 1,
          );
          expect(after.aliases.length - before.aliases.length).toBe(1);
          expect(
            await database.wallet.findUniqueOrThrow({
              where: { ownerUserId: buyer.user.id },
            }),
          ).toMatchObject({
            availableReferralUnits: 0n,
            availableNonReferralUnits: 0n,
            reservedReferralUnits: 0n,
            reservedNonReferralUnits: 0n,
          });
        }
      });
    },
  );

  it("charges 600 for an S1 upgrade and calculates a separate 540 commission base", async () => {
    await withSubscriptionDatabase(async (database) => {
      const buyer = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      await fundSubscriptionFixture(database, buyer, {
        referral: "0",
        nonReferral: "100",
      });
      const previous = await activateSubscriptionFixture(database, buyer);
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const quotes = new PurchaseQuoteService(database, () => P04_FIXTURE_NOW);
      const purchases = new SubscriptionPurchaseService(
        database,
        () => P04_FIXTURE_NOW,
      );
      const unfunded = await quotes.create(identity, { packageCode: "O1" });
      expect(unfunded).toMatchObject({
        fullDebit: "600",
        usableFunds: "40",
        requiredTopUp: "560",
        canPurchase: false,
      });
      await expect(
        purchases.purchase(identity, {
          quoteId: unfunded.quoteId,
          confirmed: true,
        }),
      ).rejects.toMatchObject({ code: "LEDGER_INSUFFICIENT_FUNDS" });
      await fundSubscriptionFixture(database, buyer, {
        referral: "560",
        nonReferral: "0",
      });
      await expect(
        purchases.purchase(identity, {
          quoteId: unfunded.quoteId,
          confirmed: true,
        }),
      ).rejects.toMatchObject({ code: "PURCHASE_QUOTE_STALE" });
      const quote = await quotes.create(identity, { packageCode: "O1" });
      const purchased = await purchases.purchase(identity, {
        quoteId: quote.quoteId,
        confirmed: true,
      });
      expect(purchased.purchase).toMatchObject({
        fullDebit: "600",
        commissionBase: "540",
        sourceAllocation: { referral: "560", nonReferral: "40", gross: "600" },
        walletAfter: { total: "0" },
      });
      expect(
        await database.subscription.findUnique({
          where: { id: previous.subscription.id },
        }),
      ).toMatchObject({ state: "REPLACED" });
      await expect(
        quotes.create(identity, { packageCode: "O1" }),
      ).rejects.toMatchObject({ code: "PURCHASE_TRANSITION_DENIED" });
      await expect(
        quotes.create(identity, { packageCode: "S1" }),
      ).rejects.toMatchObject({ code: "PURCHASE_TRANSITION_DENIED" });
      await expect(
        purchases.purchase(identity, {
          quoteId: randomUUID(),
          confirmed: true,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
