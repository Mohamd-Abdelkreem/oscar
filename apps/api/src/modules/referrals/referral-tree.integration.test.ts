import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import pino from "pino";
import {
  adminMemberPageSchema,
  employeeMemberPageSchema,
  employeeTeamSummarySchema,
  adminCommissionPageSchema,
  employeeCommissionPageSchema,
  adminTeamSummarySchema,
  rootIdentityPageSchema,
  successEnvelopeSchema,
} from "@template/contracts";
import { createApp } from "../../app.js";
import { generateTokenPair } from "../../infrastructure/security/index.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import {
  activateSubscriptionFixture,
  fundSubscriptionFixture,
  withSubscriptionDatabase,
  P04_FIXTURE_NOW,
} from "../subscriptions/testing/subscription-fixtures.js";
import { PurchaseQuoteService } from "../subscriptions/purchase-quote.service.js";
import { SubscriptionPurchaseService } from "../subscriptions/subscription-purchase.service.js";
import { ReferralsService } from "./referrals.service.js";
import { WalletsService } from "../wallets/wallets.service.js";

describe("bounded relative referral projections", () => {
  it("separates roots and filtered members, caps paths at L5, aggregates deeper counts and reaches live server pages", async () => {
    await withSubscriptionDatabase(async (database) => {
      const root = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      const admin = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
        role: "ADMIN",
      });
      const unrelated = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      const members = [];
      let sponsor = root.user.id;
      for (let level = 1; level <= 7; level += 1) {
        const member = await createIdentityFixture(database, {
          now: P04_FIXTURE_NOW,
          sponsorUserId: sponsor,
        });
        await database.user.update({
          where: { id: member.user.id },
          data: { fullName: `Level ${String(level)}` },
        });
        members.push(member);
        sponsor = member.user.id;
      }
      const service = new ReferralsService(database, () => P04_FIXTURE_NOW);
      const identity = { userId: root.user.id, sessionId: root.session.id };
      const administrator = {
        userId: admin.user.id,
        sessionId: admin.session.id,
      };
      const summary = employeeTeamSummarySchema.parse(
        await service.summary(identity),
      );
      expect(summary.root.id).toBe(root.user.id);
      expect(summary.levelCounts.map((count) => count.members)).toEqual([
        1, 1, 1, 1, 1,
      ]);
      expect(
        (await service.summary(administrator, root.user.id))
          .deeperDescendantCount,
      ).toBe(2);
      const seen = new Set<string>();
      for (let page = 1; page <= 5; page += 1) {
        const response = employeeMemberPageSchema.parse(
          await service.members(identity, { page, limit: 1 }),
        );
        expect(response.pagination.total).toBe(5);
        expect(response.items[0]?.level).toBe(page);
        for (const member of response.items) seen.add(member.id);
        expect(JSON.stringify(response)).not.toMatch(
          /email|wallet|passwordHash|sponsorUserId/u,
        );
      }
      expect(seen.size).toBe(5);
      const firstMember = members[0];
      if (firstMember === undefined)
        throw new Error("Missing tree fixture member.");
      await expect(
        database.user.update({
          where: { id: firstMember.user.id },
          data: { sponsorUserId: unrelated.user.id },
        }),
      ).rejects.toThrow("Identity relationship is immutable");
      expect(
        (await service.members(identity, { page: 6, limit: 1 })).items,
      ).toEqual([]);
      const selected = adminMemberPageSchema.parse(
        await service.members(administrator, { q: "Level 3" }, root.user.id),
      );
      expect(selected.pagination.total).toBe(1);
      expect(selected.items[0]?.path.map((step) => step.fullName)).toEqual([
        "Level 1",
        "Level 2",
        "Level 3",
      ]);
      expect(
        (await service.summary(administrator, root.user.id)).levelCounts,
      ).toEqual(summary.levelCounts);
      expect(
        (
          await service.members(
            administrator,
            { q: unrelated.user.email },
            root.user.id,
          )
        ).pagination.total,
      ).toBe(0);
      const roots = await service.roots(administrator, {
        q: root.user.referralCode,
      });
      expect(roots.items.map((item) => item.id)).toEqual([root.user.id]);
      const pagedRoots = new Set<string>();
      for (let page = 1; page <= 2; page += 1) {
        const matchingRoots = await service.roots(administrator, {
          q: "Identity Fixture",
          limit: 1,
          page,
        });
        // Seven descendants were renamed, so the root search matches only the two independent roots.
        expect(matchingRoots.pagination.total).toBe(2);
        for (const employee of matchingRoots.items) pagedRoots.add(employee.id);
      }
      expect(pagedRoots).toEqual(new Set([root.user.id, unrelated.user.id]));
      const matchingMembers = new Set<string>();
      for (let page = 1; page <= 5; page += 1) {
        const matching = await service.members(
          administrator,
          { q: "Level", limit: 1, page },
          root.user.id,
        );
        expect(matching.pagination.total).toBe(5);
        for (const member of matching.items) matchingMembers.add(member.id);
      }
      expect(matchingMembers).toEqual(seen);
      expect(
        (await service.roots(administrator, { q: "absent-root" })).pagination
          .totalPages,
      ).toBe(0);
      await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
        sponsorUserId: root.user.id,
      });
      expect((await service.members(identity, {})).pagination.total).toBe(6);
      expect(
        (
          await service.summary(administrator, unrelated.user.id)
        ).levelCounts.every((count) => count.members === 0),
      ).toBe(true);
      await expect(
        service.summary(identity, unrelated.user.id),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        service.summary(administrator, admin.user.id),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  it("shows only own event awards to employees and preserves selected admin beneficiary skips, saved rates and private HTTP authority", async () => {
    await withSubscriptionDatabase(async (database) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(P04_FIXTURE_NOW);
      try {
        const root = await createIdentityFixture(database);
        const buyer = await createIdentityFixture(database, {
          sponsorUserId: root.user.id,
        });
        const admin = await createIdentityFixture(database, { role: "ADMIN" });
        const service = new ReferralsService(database, () => P04_FIXTURE_NOW);
        const identity = { userId: root.user.id, sessionId: root.session.id };
        const administrator = {
          userId: admin.user.id,
          sessionId: admin.session.id,
        };
        await fundSubscriptionFixture(database, buyer, {
          referral: "0",
          nonReferral: "180",
        });
        const buyerIdentity = {
          userId: buyer.user.id,
          sessionId: buyer.session.id,
        };
        const quotes = new PurchaseQuoteService(
          database,
          () => P04_FIXTURE_NOW,
        );
        const purchases = new SubscriptionPurchaseService(
          database,
          () => P04_FIXTURE_NOW,
          financialFixtureAdmission(database),
        );
        await purchases.purchase(buyerIdentity, {
          quoteId: (await quotes.create(buyerIdentity, { packageCode: "S1" }))
            .quoteId,
          confirmed: true,
        });
        expect((await service.commissions(identity, {})).pagination.total).toBe(
          0,
        );
        expect(
          adminCommissionPageSchema.parse(
            await service.commissions(
              administrator,
              { decision: "SKIPPED" },
              root.user.id,
            ),
          ).items[0],
        ).toMatchObject({
          decision: "SKIPPED",
          skippedReason: "FREE",
          rateBps: 1200,
        });
        await fundSubscriptionFixture(database, root, {
          referral: "0",
          nonReferral: "60",
        });
        await activateSubscriptionFixture(database, root);
        await purchases.purchase(buyerIdentity, {
          quoteId: (await quotes.create(buyerIdentity, { packageCode: "S2" }))
            .quoteId,
          confirmed: true,
        });
        expect(
          (await service.commissions(identity, { limit: 1 })).summary.awarded,
        ).toBe("7.2");
        expect(
          (await service.members(identity, {})).items[0]
            ?.viewerEarnedFromMember,
        ).toBe("7.2");
        expect((await service.summary(identity)).ownEarned.total).toBe("7.2");
        expect(
          (await service.summary(identity)).levelCounts[0]?.paidMembers,
        ).toBe(1);
        const buyerTerm = await database.subscription.findFirstOrThrow({
          where: { ownerUserId: buyer.user.id, state: "CURRENT" },
        });
        await database.authSession.updateMany({
          data: { expiresAt: new Date("2030-01-01T00:00:00Z") },
        });
        const expiredViews = new ReferralsService(
          database,
          () => buyerTerm.expiresAt,
        );
        expect(
          (await expiredViews.summary(identity)).levelCounts[0]?.paidMembers,
        ).toBe(0);
        expect(
          (await expiredViews.members(identity, {})).items[0]?.packageCode,
        ).toBeNull();
        const finance = await new WalletsService(
          database,
          () => P04_FIXTURE_NOW,
        ).finance(administrator, {});
        expect(finance.summary).toMatchObject({
          credits: "247.2",
          debits: "240",
          net: "7.2",
        });
        expect(finance.pagination.total).toBe(6);
        const commissionsOnly = await new WalletsService(
          database,
          () => P04_FIXTURE_NOW,
        ).finance(administrator, { q: "عمولة" });
        expect(commissionsOnly).toMatchObject({
          summary: { credits: "7.2", debits: "0", neutralOperationsCount: 0 },
          pagination: { total: 1 },
        });
        await database.referralSettings.update({
          where: { id: 1 },
          data: {
            level1Bps: 900,
            version: { increment: 1 },
            updatedAt: new Date(
              Math.max(P04_FIXTURE_NOW.getTime(), vi.getRealSystemTime()),
            ),
            updatedByUserId: admin.user.id,
          },
        });
        expect((await service.summary(identity)).currentRates.ratesBps[0]).toBe(
          900,
        );
        expect(
          (await service.commissions(identity, {})).items[0]?.rateBps,
        ).toBe(1200);
        const firstHistory = await service.commissions(
          administrator,
          { limit: 1 },
          root.user.id,
        );
        const nextHistory = await service.commissions(
          administrator,
          { limit: 1, page: 2 },
          root.user.id,
        );
        expect(firstHistory.summary).toEqual(nextHistory.summary);
        expect(
          new Set(
            [...firstHistory.items, ...nextHistory.items].map(
              (entry) => entry.decisionId,
            ),
          ).size,
        ).toBe(2);
        expect(
          (
            await service.commissions(
              administrator,
              { page: 3, limit: 1 },
              root.user.id,
            )
          ).items,
        ).toEqual([]);
        expect(
          (
            await service.commissions(
              administrator,
              { buyerId: root.user.id },
              root.user.id,
            )
          ).summary.awarded,
        ).toBe("0");
        const app = createApp({
          database,
          logger: pino({ level: "silent" }),
          emailDelivery: {
            provider: "console",
            send: () => Promise.resolve({ providerMessageId: "unused" }),
          },
        });
        const token = (account: typeof root) =>
          generateTokenPair({
            userId: account.user.id,
            sessionId: account.session.id,
            tokenId: randomUUID(),
            email: account.user.email,
            role: account.user.role,
            rememberMe: false,
            absoluteExpiresAt: account.session.expiresAt,
          }).accessToken;
        const read = (path: string, account = root) =>
          request(app)
            .get(`/api/v1${path}`)
            .auth(token(account), { type: "bearer" });
        for (const [path, schema, account] of [
          ["/referrals/me", employeeTeamSummarySchema, root],
          ["/referrals/me/members", employeeMemberPageSchema, root],
          ["/referrals/me/commissions", employeeCommissionPageSchema, root],
          ["/admin/referrals/roots", rootIdentityPageSchema, admin],
          [`/admin/referrals/${root.user.id}`, adminTeamSummarySchema, admin],
          [
            `/admin/referrals/${root.user.id}/members`,
            adminMemberPageSchema,
            admin,
          ],
          [
            `/admin/referrals/${root.user.id}/commissions`,
            adminCommissionPageSchema,
            admin,
          ],
        ] as const) {
          const projection = await read(path, account);
          expect(projection.status).toBe(200);
          expect(projection.headers["cache-control"]).toBe("no-store");
          schema.parse(successEnvelopeSchema.parse(projection.body).data);
        }
        expect((await request(app).get("/api/v1/referrals/me")).status).toBe(
          401,
        );
        expect((await read(`/admin/referrals/${buyer.user.id}`)).status).toBe(
          403,
        );
        expect(
          (await read(`/referrals/me?rootId=${buyer.user.id}`)).status,
        ).toBe(400);
        expect((await read("/referrals/me/members?q=private")).status).toBe(
          400,
        );
        expect(
          (await read("/referrals/me/commissions?decision=SKIPPED")).status,
        ).toBe(400);
        expect(
          (await read(`/admin/referrals/${randomUUID()}`, admin)).status,
        ).toBe(404);
        const response = await read(
          `/admin/referrals/${root.user.id}/members?limit=1`,
          admin,
        );
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        const envelope = successEnvelopeSchema.parse(response.body);
        expect(envelope.paginationMeta).toEqual(
          adminMemberPageSchema.parse(envelope.data).pagination,
        );
        const ownResponse = await read("/referrals/me/commissions");
        expect(JSON.stringify(ownResponse.body)).not.toMatch(
          /eligibility|email|passwordHash|intentHash|recipientUserId/u,
        );
        await database.authSession.update({
          where: { id: root.session.id },
          data: { revokedAt: new Date() },
        });
        expect((await read("/referrals/me")).status).toBe(401);
        await expect(service.summary(identity)).rejects.toMatchObject({
          statusCode: 401,
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
