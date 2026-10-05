import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@template/database";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { PackageConfigurationService } from "../packages/package-configuration.service.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { PurchaseQuoteService } from "../subscriptions/purchase-quote.service.js";
import { SubscriptionPurchaseService } from "../subscriptions/subscription-purchase.service.js";
import {
  mapAdminCommission,
  mapEmployeeCommission,
  savedCommissionInclude,
} from "./referrals.mapper.js";
import {
  activateSubscriptionFixture,
  createSubscriptionScenario,
  fundSubscriptionFixture,
  P04_FIXTURE_NOW,
  withSubscriptionDatabase,
  type SubscriptionAccountFixture,
} from "../subscriptions/testing/subscription-fixtures.js";

async function payAncestor(
  database: DatabaseClient,
  account: SubscriptionAccountFixture,
  now = P04_FIXTURE_NOW,
) {
  await fundSubscriptionFixture(
    database,
    account,
    { referral: "0", nonReferral: "60" },
    now,
  );
  return activateSubscriptionFixture(database, account, "S1", now);
}

async function buy(
  database: DatabaseClient,
  buyer: SubscriptionAccountFixture,
  packageCode: "S1" | "S2" | "O1" = "O1",
  now = P04_FIXTURE_NOW,
) {
  const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
  const quote = await new PurchaseQuoteService(database, () => now).create(
    identity,
    { packageCode },
  );
  return new SubscriptionPurchaseService(database, () => now).purchase(
    identity,
    { quoteId: quote.quoteId, confirmed: true },
  );
}

async function savedDecisions(database: DatabaseClient, purchaseId: string) {
  return database.referralDecision.findMany({
    where: { purchaseId },
    orderBy: { level: "asc" },
  });
}

describe("fixed-level event-time commissions", () => {
  it("awards all five actual ancestors once at the full ordinary price and never exposes them to the buyer", async () => {
    await withSubscriptionDatabase(async (database) => {
      const { buyer, ancestors } = await createSubscriptionScenario(database);
      for (const ancestor of ancestors) await payAncestor(database, ancestor);
      await fundSubscriptionFixture(database, buyer, {
        referral: "0",
        nonReferral: "600",
      });
      const accepted = await buy(database, buyer);
      const decisions = await savedDecisions(
        database,
        accepted.purchase.purchaseId,
      );
      expect(
        decisions.map(
          ({
            level,
            rateBps,
            awardUnits,
            commissionBaseUnits,
            decision,
            occurredAt,
          }) => ({
            level,
            rateBps,
            awardUnits,
            commissionBaseUnits,
            decision,
            occurredAt,
          }),
        ),
      ).toEqual(
        [72000000n, 36000000n, 24000000n, 12000000n, 12000000n].map(
          (awardUnits, index) => ({
            level: index + 1,
            rateBps: [1200, 600, 400, 200, 200][index],
            awardUnits,
            commissionBaseUnits: 600000000n,
            decision: "AWARDED",
            occurredAt: P04_FIXTURE_NOW,
          }),
        ),
      );
      for (const [index, ancestor] of ancestors.entries()) {
        const decision = decisions[index];
        if (decision === undefined)
          throw new Error("Missing fixed-level decision.");
        expect(decision.recipientUserId).toBe(ancestor.user.id);
        expect(decision.eligibilitySnapshot).toMatchObject({
          status: "ACTIVE",
          role: "USER",
          emailVerified: true,
          effectivePaid: true,
        });
        expect(
          await database.wallet.findUniqueOrThrow({
            where: { ownerUserId: ancestor.user.id },
          }),
        ).toMatchObject({
          availableReferralUnits: decision.awardUnits,
          reservedReferralUnits: 0n,
          availableNonReferralUnits: 0n,
          reservedNonReferralUnits: 0n,
        });
        expect(
          await database.ledgerPosting.findMany({
            where: { operationId: decision.creditOperationId ?? "" },
          }),
        ).toMatchObject([
          {
            source: "REFERRAL",
            availableDeltaUnits: decision.awardUnits,
            reservedDeltaUnits: 0n,
          },
        ]);
      }
      const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
      const command = { quoteId: accepted.purchase.quoteId, confirmed: true };
      for (const key of [undefined, "new-replay-alias", "new-replay-alias"]) {
        expect(
          await new SubscriptionPurchaseService(
            database,
            () => P04_FIXTURE_NOW,
          ).purchase(identity, command, key),
        ).toEqual({ purchase: accepted.purchase, replayed: true });
      }
      expect(
        await savedDecisions(database, accepted.purchase.purchaseId),
      ).toEqual(decisions);
      expect(
        await database.financialOperation.count({
          where: { businessNamespace: "p04.referral" },
        }),
      ).toBe(5);
      const publicReply = JSON.stringify(accepted);
      for (const ancestor of ancestors) {
        expect(publicReply).not.toContain(ancestor.user.id);
        expect(publicReply).not.toContain(ancestor.user.email);
        expect(publicReply).not.toContain(ancestor.wallet?.id);
      }
      expect(publicReply).not.toContain("eligibilitySnapshot");
    });
  });

  it.each([
    "FREE",
    "EXPIRED",
    "BANNED",
    "SUSPENDED",
    "PENDING_VERIFICATION",
    "WITHDRAWAL_ONLY",
  ] as const)(
    "preserves L2 when L1 is %s and never backfills its saved event",
    async (state) => {
      await withSubscriptionDatabase(async (database) => {
        const { buyer, ancestors } = await createSubscriptionScenario(database);
        const [first, second] = ancestors;
        if (first === undefined || second === undefined)
          throw new Error("Missing ancestors.");
        await payAncestor(database, second);
        if (state !== "FREE")
          await payAncestor(
            database,
            first,
            state === "EXPIRED"
              ? new Date("2025-05-19T09:00:00Z")
              : P04_FIXTURE_NOW,
          );
        if (state === "EXPIRED") {
          // Arrange exact exclusive expiry by accepting the buyer at the ancestor's saved boundary.
          const old = await database.subscription.findFirstOrThrow({
            where: { ownerUserId: first.user.id },
          });
          await database.authSession.update({
            where: { id: buyer.session.id },
            data: { expiresAt: new Date(old.expiresAt.getTime() + 86400000) },
          });
          await database.authSession.update({
            where: { id: second.session.id },
            data: { expiresAt: new Date(old.expiresAt.getTime() + 86400000) },
          });
          await fundSubscriptionFixture(
            database,
            buyer,
            { referral: "0", nonReferral: "600" },
            old.expiresAt,
          );
          const accepted = await buy(database, buyer, "O1", old.expiresAt);
          const decisions = await savedDecisions(
            database,
            accepted.purchase.purchaseId,
          );
          expect(decisions[0]).toMatchObject({
            level: 1,
            decision: "SKIPPED",
            skippedReason: "EXPIRED",
            awardUnits: 0n,
            creditOperationId: null,
            occurredAt: old.expiresAt,
          });
          expect(decisions[1]).toMatchObject({
            level: 2,
            decision: "AWARDED",
            rateBps: 600,
            awardUnits: 36000000n,
          });
          await database.authSession.update({
            where: { id: first.session.id },
            data: { expiresAt: new Date(old.expiresAt.getTime() + 86400000) },
          });
          await fundSubscriptionFixture(
            database,
            first,
            { referral: "0", nonReferral: "60" },
            old.expiresAt,
          );
          await buy(database, first, "S1", old.expiresAt);
          await new SubscriptionPurchaseService(
            database,
            () => old.expiresAt,
          ).purchase(
            { userId: buyer.user.id, sessionId: buyer.session.id },
            { quoteId: accepted.purchase.quoteId, confirmed: true },
            "expired-then-reactivated",
          );
          expect(
            await savedDecisions(database, accepted.purchase.purchaseId),
          ).toEqual(decisions);
          expect(
            await database.wallet.findUniqueOrThrow({
              where: { ownerUserId: first.user.id },
            }),
          ).toMatchObject({ availableReferralUnits: 0n });
          return;
        }
        if (state === "WITHDRAWAL_ONLY")
          await database.user.update({
            where: { id: first.user.id },
            data: {
              withdrawalsBlocked: true,
              accountVersion: { increment: 1 },
            },
          });
        else if (state !== "FREE")
          await database.user.update({
            where: { id: first.user.id },
            data: {
              status: state,
              accountVersion: { increment: 1 },
              ...(state === "PENDING_VERIFICATION"
                ? { emailVerifiedAt: null }
                : {}),
            },
          });
        await fundSubscriptionFixture(database, buyer, {
          referral: "0",
          nonReferral: "600",
        });
        const accepted = await buy(database, buyer);
        const decisions = await savedDecisions(
          database,
          accepted.purchase.purchaseId,
        );
        expect(decisions[0]).toMatchObject(
          state === "WITHDRAWAL_ONLY"
            ? { level: 1, decision: "AWARDED", awardUnits: 72000000n }
            : {
                level: 1,
                decision: "SKIPPED",
                skippedReason:
                  state === "FREE" || state === "BANNED"
                    ? state
                    : "ACCOUNT_UNAVAILABLE",
                awardUnits: 0n,
                creditOperationId: null,
              },
        );
        expect(decisions[1]).toMatchObject({
          level: 2,
          decision: "AWARDED",
          rateBps: 600,
          awardUnits: 36000000n,
        });
        expect(decisions.slice(2)).toMatchObject(
          [3, 4, 5].map((level) => ({
            level,
            decision: "SKIPPED",
            skippedReason: "FREE",
          })),
        );
        if (state === "FREE") await payAncestor(database, first);
        else if (state !== "WITHDRAWAL_ONLY")
          await database.user.update({
            where: { id: first.user.id },
            data: {
              status: "ACTIVE",
              emailVerifiedAt: P04_FIXTURE_NOW,
              accountVersion: { increment: 1 },
            },
          });
        await new SubscriptionPurchaseService(
          database,
          () => P04_FIXTURE_NOW,
        ).purchase(
          { userId: buyer.user.id, sessionId: buyer.session.id },
          { quoteId: accepted.purchase.quoteId, confirmed: true },
          "after-reactivation",
        );
        expect(
          await savedDecisions(database, accepted.purchase.purchaseId),
        ).toEqual(decisions);
        expect(
          await database.wallet.findUniqueOrThrow({
            where: { ownerUserId: first.user.id },
          }),
        ).toMatchObject({
          availableReferralUnits: state === "WITHDRAWAL_ONLY" ? 72000000n : 0n,
        });
      });
    },
  );

  it.each([0, 2])(
    "records only %s existing ancestors without inventing deeper recipients",
    async (depth) => {
      await withSubscriptionDatabase(async (database) => {
        let sponsorUserId: string | undefined;
        for (let level = 0; level < depth; level += 1) {
          const ancestor = await createIdentityFixture(database, {
            now: P04_FIXTURE_NOW,
            ...(sponsorUserId === undefined ? {} : { sponsorUserId }),
          });
          await payAncestor(database, ancestor);
          sponsorUserId = ancestor.user.id;
        }
        const buyer = await createIdentityFixture(database, {
          now: P04_FIXTURE_NOW,
          ...(sponsorUserId === undefined ? {} : { sponsorUserId }),
        });
        await fundSubscriptionFixture(database, buyer, {
          referral: "0",
          nonReferral: "60",
        });
        const accepted = await buy(database, buyer, "S1");
        const decisions = await savedDecisions(
          database,
          accepted.purchase.purchaseId,
        );
        expect(decisions.map((decision) => decision.level)).toEqual(
          depth === 0 ? [] : [1, 2],
        );
        expect(decisions.map((decision) => decision.awardUnits)).toEqual(
          depth === 0 ? [] : [7200000n, 3600000n],
        );
        expect(
          await database.financialOperation.count({
            where: { businessNamespace: "p04.referral" },
          }),
        ).toBe(depth);
      });
    },
  );

  it.each([
    {
      price: 600000000n,
      rate: 1200,
      base: 540000000n,
      award: 64800000n,
      zeroReason: null,
    },
    {
      price: 60000000n,
      rate: 1200,
      base: 0n,
      award: 0n,
      zeroReason: "ZERO_BASE",
    },
    {
      price: 50000000n,
      rate: 1200,
      base: 0n,
      award: 0n,
      zeroReason: "ZERO_BASE",
    },
    {
      price: 600000000n,
      rate: 0,
      base: 540000000n,
      award: 0n,
      zeroReason: "ZERO_RATE",
    },
    {
      price: 60000001n,
      rate: 1200,
      base: 1n,
      award: 0n,
      zeroReason: "FLOORED_ZERO",
    },
  ])(
    "keeps the saved prior price and exact upgrade award with $price units and $rate bps",
    async ({ price, rate, base, award, zeroReason }) => {
      await withSubscriptionDatabase(async (database) => {
        const ancestor = await createIdentityFixture(database, {
          now: P04_FIXTURE_NOW,
        });
        await payAncestor(database, ancestor);
        const buyer = await createIdentityFixture(database, {
          now: P04_FIXTURE_NOW,
          sponsorUserId: ancestor.user.id,
        });
        await fundSubscriptionFixture(database, buyer, {
          referral: "0",
          nonReferral: "660",
        });
        await activateSubscriptionFixture(database, buyer);
        const admin = await createIdentityFixture(database, {
          role: "ADMIN",
          now: P04_FIXTURE_NOW,
        });
        const configuration = new PackageConfigurationService(
          database,
          () => P04_FIXTURE_NOW,
        );
        const adminIdentity = {
          userId: admin.user.id,
          sessionId: admin.session.id,
        };
        const command = () => ({
          commandId: randomUUID(),
          expectedVersion: 1,
          confirmed: true,
          reason: "Reviewed future award terms",
        });
        await configuration.editPackage(adminIdentity, "S1", {
          ...command(),
          price: "70",
        });
        await configuration.editPackage(adminIdentity, "O1", {
          ...command(),
          price: formatUsdtAmount(price),
        });
        await configuration.editReferrals(adminIdentity, {
          ...command(),
          ratesBps: [rate, 600, 400, 200, 200],
        });
        const accepted = await buy(database, buyer);
        expect(
          await database.purchase.findUniqueOrThrow({
            where: { id: accepted.purchase.purchaseId },
          }),
        ).toMatchObject({
          action: "UPGRADE",
          fullDebitUnits: price,
          commissionBaseUnits: base,
        });
        const [decision] = await savedDecisions(
          database,
          accepted.purchase.purchaseId,
        );
        expect(decision).toMatchObject({
          level: 1,
          rateBps: rate,
          commissionBaseUnits: base,
          awardUnits: award,
          decision: award > 0n ? "AWARDED" : "ELIGIBLE_ZERO",
          zeroReason,
          skippedReason: null,
        });
        expect(
          await database.financialOperation.count({
            where: { businessNamespace: "p04.referral" },
          }),
        ).toBe(award > 0n ? 1 : 0);
        expect(
          await database.wallet.findUniqueOrThrow({
            where: { ownerUserId: ancestor.user.id },
          }),
        ).toMatchObject({ availableReferralUnits: award });
        const saved = await database.referralDecision.findFirstOrThrow({
          where: { purchaseId: accepted.purchase.purchaseId },
          include: savedCommissionInclude,
        });
        expect(mapEmployeeCommission(saved, ancestor.user.id)).toMatchObject({
          award: award === 0n ? "0" : "64.8",
          decision: award === 0n ? "ELIGIBLE_ZERO" : "AWARDED",
          ...(zeroReason === null ? {} : { zeroReason }),
        });
        expect(mapAdminCommission(saved)).toMatchObject({
          award: award === 0n ? "0" : "64.8",
          zeroReason,
          eligibility: { accountVersion: 0 },
        });
      });
    },
  );

  it("uses the full price after buyer expiry rather than a historical upgrade difference", async () => {
    await withSubscriptionDatabase(async (database) => {
      const ancestor = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      const buyer = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
        sponsorUserId: ancestor.user.id,
      });
      await fundSubscriptionFixture(database, buyer, {
        referral: "0",
        nonReferral: "180",
      });
      const previous = await activateSubscriptionFixture(database, buyer);
      const now = previous.subscription.expiresAt;
      await payAncestor(database, ancestor, now);
      await database.authSession.update({
        where: { id: buyer.session.id },
        data: { expiresAt: new Date(now.getTime() + 86400000) },
      });
      const accepted = await buy(database, buyer, "S2", now);
      expect(accepted.purchase).toMatchObject({
        action: "PURCHASE",
        fullDebit: "120",
        commissionBase: "120",
      });
      expect(
        await savedDecisions(database, accepted.purchase.purchaseId),
      ).toMatchObject([
        {
          level: 1,
          decision: "AWARDED",
          commissionBaseUnits: 120000000n,
          awardUnits: 14400000n,
        },
      ]);
      expect(
        await database.subscription.findUniqueOrThrow({
          where: { id: previous.subscription.id },
        }),
      ).toMatchObject({ state: "EXPIRED" });
    });
  });

  it("projects only owned earnings and maps admin skipped evidence from the immutable event after settings and account changes", async () => {
    await withSubscriptionDatabase(async (database) => {
      const { buyer, ancestors } = await createSubscriptionScenario(database);
      const [first, second] = ancestors;
      if (first === undefined || second === undefined)
        throw new Error("Missing ancestors.");
      await payAncestor(database, first);
      await database.user.update({
        where: { id: first.user.id },
        data: { withdrawalsBlocked: true, accountVersion: { increment: 1 } },
      });
      await fundSubscriptionFixture(database, buyer, {
        referral: "0",
        nonReferral: "600",
      });
      const accepted = await buy(database, buyer);
      const decisions = await database.referralDecision.findMany({
        where: { purchaseId: accepted.purchase.purchaseId },
        include: savedCommissionInclude,
        orderBy: { level: "asc" },
      });
      const awarded = decisions[0];
      const skipped = decisions[1];
      if (awarded === undefined || skipped === undefined)
        throw new Error("Missing decisions.");
      const employee = mapEmployeeCommission(awarded, first.user.id);
      expect(employee).toEqual({
        decisionId: awarded.id,
        purchaseId: accepted.purchase.purchaseId,
        occurredAt: P04_FIXTURE_NOW.toISOString(),
        level: 1,
        buyer: { id: buyer.user.id, fullName: buyer.user.fullName },
        decision: "AWARDED",
        rateBps: 1200,
        commissionBase: "600",
        award: "72",
      });
      expect(mapEmployeeCommission(skipped, second.user.id)).toBeNull();
      expect(() => mapEmployeeCommission(awarded, buyer.user.id)).toThrow();
      const admin = mapAdminCommission(awarded);
      expect(admin.eligibility).toMatchObject({
        accountVersion: 1,
        status: "ACTIVE",
        role: "USER",
        emailVerified: true,
      });
      expect(mapAdminCommission(skipped)).toMatchObject({
        decision: "SKIPPED",
        skippedReason: "FREE",
        award: "0",
        eligibility: {
          accountVersion: 0,
          subscriptionId: null,
          expiresAt: null,
        },
      });
      const editor = await createIdentityFixture(database, {
        role: "ADMIN",
        now: P04_FIXTURE_NOW,
      });
      await new PackageConfigurationService(
        database,
        () => P04_FIXTURE_NOW,
      ).editReferrals(
        { userId: editor.user.id, sessionId: editor.session.id },
        {
          commandId: randomUUID(),
          expectedVersion: 1,
          confirmed: true,
          reason: "Reviewed future rates without backfill",
          ratesBps: [0, 600, 400, 200, 200],
        },
      );
      await database.user.update({
        where: { id: first.user.id },
        data: { status: "BANNED", accountVersion: { increment: 1 } },
      });
      await payAncestor(database, second);
      const reloaded = await database.referralDecision.findUniqueOrThrow({
        where: { id: awarded.id },
        include: savedCommissionInclude,
      });
      expect(mapAdminCommission(reloaded)).toEqual(admin);
      expect(mapEmployeeCommission(reloaded, first.user.id)).toEqual(employee);
      const serialized = JSON.stringify({ employee, admin });
      for (const secret of [
        first.user.email,
        first.user.passwordHash,
        first.wallet?.id,
        "effectivePaid",
        "packageVersion",
        "withdrawalsBlocked",
      ])
        expect(serialized).not.toContain(secret);
      expect(() =>
        mapAdminCommission({ ...reloaded, eligibilitySnapshot: {} }),
      ).toThrow();
    });
  });
});
