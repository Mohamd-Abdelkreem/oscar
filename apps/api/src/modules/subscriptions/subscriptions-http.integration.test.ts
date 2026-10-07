import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import pino from "pino";
import request from "supertest";
import {
  adminCatalogSchema,
  catalogSchema,
  errorEnvelopeSchema,
  membershipSchema,
  subscriptionHistorySchema,
  purchaseResultSchema,
  purchaseCommandResultSchema,
  purchaseHistorySchema,
  purchaseQuoteSchema,
  quoteOutcomeSchema,
  successEnvelopeSchema,
} from "@template/contracts";
import { createApp } from "../../app.js";
import { generateTokenPair } from "../../infrastructure/security/index.js";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { PurchaseQuoteService } from "./purchase-quote.service.js";
import { SubscriptionPurchaseService } from "./subscription-purchase.service.js";
import {
  fundSubscriptionFixture,
  withSubscriptionDatabase,
} from "./testing/subscription-fixtures.js";

const credentials = (
  account: Awaited<ReturnType<typeof createIdentityFixture>>,
) =>
  generateTokenPair({
    userId: account.user.id,
    sessionId: account.session.id,
    tokenId: randomUUID(),
    email: account.user.email,
    role: account.user.role,
    rememberMe: false,
    absoluteExpiresAt: account.session.expiresAt,
  }).accessToken;
const csrf = { cookie: "csrfToken=p04-test", header: "p04-test" };

describe("actual subscription HTTP authority", () => {
  it("reads immutable paged terms and owner/admin membership at exclusive expiry without maintenance writes", async () => {
    await withSubscriptionDatabase(async (database) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-05T09:00:00Z"));
      try {
        const buyer = await createIdentityFixture(database);
        const other = await createIdentityFixture(database);
        const admin = await createIdentityFixture(database, { role: "ADMIN" });
        await database.authSession.updateMany({
          data: { expiresAt: new Date("2029-01-01T00:00:00Z") },
        });
        await fundSubscriptionFixture(
          database,
          buyer,
          { referral: "0", nonReferral: "180" },
          new Date(),
        );
        const identity = { userId: buyer.user.id, sessionId: buyer.session.id };
        const quotes = new PurchaseQuoteService(database, () => new Date());
        const purchases = new SubscriptionPurchaseService(
          database,
          () => new Date(),
          financialFixtureAdmission(database),
        );
        const firstQuote = await quotes.create(identity, { packageCode: "S1" });
        const first = await purchases.purchase(identity, {
          quoteId: firstQuote.quoteId,
          confirmed: true,
        });
        const app = createApp({
          financialAdmission: financialFixtureAdmission(database),
          database,
          logger: pino({ level: "silent" }),
          emailDelivery: {
            provider: "console",
            send: () => Promise.resolve({ providerMessageId: "unused" }),
          },
        });
        const read = (path: string, account = buyer) =>
          request(app)
            .get(`/api/v1${path}`)
            .auth(credentials(account), { type: "bearer" });
        const beforeInsert = await read("/subscriptions/me/history?limit=1");
        expect(
          subscriptionHistorySchema.parse(
            successEnvelopeSchema.parse(beforeInsert.body).data,
          ).pagination.total,
        ).toBe(1);
        vi.setSystemTime(new Date("2026-10-06T09:00:00Z"));
        const nextQuote = await quotes.create(identity, { packageCode: "S2" });
        const next = await purchases.purchase(identity, {
          quoteId: nextQuote.quoteId,
          confirmed: true,
        });
        const expectedSubscriptions = await database.subscription.findMany({
          orderBy: { id: "asc" },
        });
        const walletBeforeReads = await database.wallet.findUniqueOrThrow({
          where: { ownerUserId: buyer.user.id },
        });
        for (const [page, expected] of [
          [1, next.purchase],
          [2, first.purchase],
        ] as const) {
          const response = await read(
            `/subscriptions/me/history?page=${String(page)}&limit=1`,
          );
          expect(response.status).toBe(200);
          expect(response.headers["cache-control"]).toBe("no-store");
          const envelope = successEnvelopeSchema.parse(response.body);
          const history = subscriptionHistorySchema.parse(envelope.data);
          const { stateAtPurchase: _state, ...savedTerm } =
            expected.subscriptionAtPurchase;
          expect(history.items).toEqual([
            { ...savedTerm, state: page === 1 ? "CURRENT" : "REPLACED" },
          ]);
          expect(history.pagination).toMatchObject({
            page,
            limit: 1,
            total: 2,
            totalPages: 2,
          });
          expect(envelope.paginationMeta).toEqual(history.pagination);
          expect(JSON.stringify(response.body)).not.toMatch(
            /ownerUserId|passwordHash|intentHash|sessionId|replacementPurchaseId/u,
          );
        }
        const outside = await read("/subscriptions/me/history?page=3&limit=1");
        expect(
          subscriptionHistorySchema.parse(
            successEnvelopeSchema.parse(outside.body).data,
          ),
        ).toMatchObject({
          items: [],
          pagination: { total: 2, totalPages: 2, page: 3 },
        });
        const empty = await read("/subscriptions/me/history", other);
        expect(
          subscriptionHistorySchema.parse(
            successEnvelopeSchema.parse(empty.body).data,
          ),
        ).toMatchObject({ items: [], pagination: { total: 0, totalPages: 0 } });
        const expiry = Date.parse(
          next.purchase.subscriptionAtPurchase.expiresAt,
        );
        for (const offset of [-1, 0, 1]) {
          vi.setSystemTime(new Date(expiry + offset));
          for (const [path, account] of [
            ["/subscriptions/me", buyer],
            [`/admin/subscriptions/${buyer.user.id}`, admin],
          ] as const) {
            const response = await read(path, account);
            expect(response.status).toBe(200);
            expect(response.headers["cache-control"]).toBe("no-store");
            expect(
              membershipSchema.parse(
                successEnvelopeSchema.parse(response.body).data,
              ),
            ).toMatchObject({
              employeeId: buyer.user.id,
              effective: offset < 0 ? "PAID" : "FREE",
              subscription: {
                id: next.purchase.subscriptionAtPurchase.id,
                state: "CURRENT",
                terms: next.purchase.subscriptionAtPurchase.terms,
              },
            });
          }
        }
        expect(
          await database.subscription.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(expectedSubscriptions);
        expect(
          await database.wallet.findUniqueOrThrow({
            where: { ownerUserId: buyer.user.id },
          }),
        ).toEqual(walletBeforeReads);
        expect(
          (await read(`/admin/subscriptions/${buyer.user.id}`)).status,
        ).toBe(403);
        expect(
          (await read(`/admin/subscriptions/${admin.user.id}`, admin)).status,
        ).toBe(404);
        expect(
          (await read(`/admin/subscriptions/${randomUUID()}`, admin)).status,
        ).toBe(404);
        expect(
          (await read("/admin/subscriptions/not-a-uuid", admin)).status,
        ).toBe(400);
        expect((await read("/subscriptions/me/history", admin)).status).toBe(
          403,
        );
        for (const query of [
          "ownerId=forged",
          "page=0",
          "limit=101",
          "page=1&page=2",
        ]) {
          expect(
            (await read(`/subscriptions/me/history?${query}`)).status,
          ).toBe(400);
        }
        expect(
          (
            await request(app).get(
              `/api/v1/admin/subscriptions/${buyer.user.id}`,
            )
          ).status,
        ).toBe(401);
        await database.authSession.update({
          where: { id: admin.session.id },
          data: { revokedAt: new Date() },
        });
        expect(
          (await read(`/admin/subscriptions/${buyer.user.id}`, admin)).status,
        ).toBe(401);
      } finally {
        vi.useRealTimers();
      }
    });
  });
  it.each(["terms", "funds", "dates"] as const)(
    "rejects stale %s over HTTP before financial effects",
    async (change) => {
      await withSubscriptionDatabase(async (database) => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-05T14:59:00.000Z"));
        try {
          const buyer = await createIdentityFixture(database);
          const admin = await createIdentityFixture(database, {
            role: "ADMIN",
          });
          await fundSubscriptionFixture(
            database,
            buyer,
            { referral: "0", nonReferral: "60" },
            new Date(),
          );
          const app = createApp({
            financialAdmission: financialFixtureAdmission(database),
            database,
            logger: pino({ level: "silent" }),
            emailDelivery: {
              provider: "console",
              send: () => Promise.resolve({ providerMessageId: "unused" }),
            },
          });
          const token = credentials(buyer);
          const response = await request(app)
            .post("/api/v1/subscriptions/purchase-quotes")
            .auth(token, { type: "bearer" })
            .set("Cookie", csrf.cookie)
            .set("x-csrf-token", csrf.header)
            .send({ packageCode: "S1" });
          const quote = purchaseQuoteSchema.parse(
            successEnvelopeSchema.parse(response.body).data,
          );
          if (change === "terms")
            await database.package.update({
              where: { code: "S1" },
              data: {
                version: { increment: 1 },
                priceUnits: 61000000n,
                updatedByUserId: admin.user.id,
              },
            });
          if (change === "funds")
            await fundSubscriptionFixture(
              database,
              buyer,
              { referral: "0", nonReferral: "0.000001" },
              new Date(),
            );
          if (change === "dates")
            vi.setSystemTime(new Date("2026-10-05T15:00:00.000Z"));
          const before = await database.wallet.findUnique({
            where: { ownerUserId: buyer.user.id },
          });
          const rejected = await request(app)
            .post("/api/v1/subscriptions/purchases")
            .auth(token, { type: "bearer" })
            .set("Cookie", csrf.cookie)
            .set("x-csrf-token", csrf.header)
            .send({ quoteId: quote.quoteId, confirmed: true });
          expect(rejected.status).toBe(409);
          expect(errorEnvelopeSchema.parse(rejected.body).code).toBe(
            "PURCHASE_QUOTE_STALE",
          );
          expect(
            await database.wallet.findUnique({
              where: { ownerUserId: buyer.user.id },
            }),
          ).toEqual(before);
          expect(await database.purchase.count()).toBe(0);
          expect(await database.subscription.count()).toBe(0);
          expect(
            await database.financialOperation.count({
              where: { businessNamespace: "p04.purchase" },
            }),
          ).toBe(0);
        } finally {
          vi.useRealTimers();
        }
      });
    },
  );
  it("produces validated catalog/quote/purchase/history/outcome envelopes and current admin counts", async () => {
    await withSubscriptionDatabase(async (database) => {
      const buyer = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      await fundSubscriptionFixture(
        database,
        buyer,
        { referral: "30", nonReferral: "150" },
        new Date(),
      );
      const app = createApp({
        financialAdmission: financialFixtureAdmission(database),
        database,
        logger: pino({ level: "silent" }),
        emailDelivery: {
          provider: "console",
          send: () => Promise.resolve({ providerMessageId: "unused" }),
        },
      });
      const token = credentials(buyer);
      const adminToken = credentials(admin);
      const catalogResponse = await request(app)
        .get("/api/v1/packages")
        .auth(token, { type: "bearer" });
      expect(catalogResponse.status).toBe(200);
      expect(catalogResponse.headers["cache-control"]).toBe("no-store");
      expect(
        catalogSchema
          .parse(successEnvelopeSchema.parse(catalogResponse.body).data)
          .items.map((terms) => terms.price),
      ).toEqual(["60", "120", "600", "1200", "2600"]);
      const before = await request(app)
        .get("/api/v1/admin/packages")
        .auth(adminToken, { type: "bearer" });
      expect(
        adminCatalogSchema
          .parse(successEnvelopeSchema.parse(before.body).data)
          .items.every((row) => row.activeSubscriptionsCount === 0),
      ).toBe(true);
      const quoteResponse = await request(app)
        .post("/api/v1/subscriptions/purchase-quotes")
        .auth(token, { type: "bearer" })
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.header)
        .send({ packageCode: "S1" });
      expect(quoteResponse.status).toBe(201);
      const quote = purchaseQuoteSchema.parse(
        successEnvelopeSchema.parse(quoteResponse.body).data,
      );
      const command = { quoteId: quote.quoteId, confirmed: true };
      const acceptedResponse = await request(app)
        .post("/api/v1/subscriptions/purchases")
        .auth(token, { type: "bearer" })
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.header)
        .set("Idempotency-Key", "http-purchase")
        .send(command);
      expect(acceptedResponse.status).toBe(201);
      const accepted = purchaseCommandResultSchema.parse(
        successEnvelopeSchema.parse(acceptedResponse.body).data,
      );
      expect(accepted.replayed).toBe(false);
      const replayResponse = await request(app)
        .post("/api/v1/subscriptions/purchases")
        .auth(token, { type: "bearer" })
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.header)
        .send(command);
      expect(replayResponse.status).toBe(200);
      expect(
        purchaseCommandResultSchema.parse(
          successEnvelopeSchema.parse(replayResponse.body).data,
        ),
      ).toEqual({ ...accepted, replayed: true });
      const observation = await request(app)
        .get(`/api/v1/subscriptions/purchase-quotes/${quote.quoteId}/outcome`)
        .auth(token, { type: "bearer" });
      expect(
        quoteOutcomeSchema.parse(
          successEnvelopeSchema.parse(observation.body).data,
        ),
      ).toMatchObject({ status: "COMMITTED", purchase: accepted.purchase });
      const history = await request(app)
        .get("/api/v1/subscriptions/purchases?page=1&limit=1")
        .auth(token, { type: "bearer" });
      const page = purchaseHistorySchema.parse(
        successEnvelopeSchema.parse(history.body).data,
      );
      expect(page.items).toEqual([accepted.purchase]);
      expect(successEnvelopeSchema.parse(history.body).paginationMeta).toEqual(
        page.pagination,
      );
      const membership = await request(app)
        .get("/api/v1/subscriptions/me")
        .auth(token, { type: "bearer" });
      expect(
        membershipSchema.parse(
          successEnvelopeSchema.parse(membership.body).data,
        ),
      ).toMatchObject({ effective: "PAID" });
      const after = await request(app)
        .get("/api/v1/admin/packages")
        .auth(adminToken, { type: "bearer" });
      expect(
        adminCatalogSchema
          .parse(successEnvelopeSchema.parse(after.body).data)
          .items.map((row) => row.activeSubscriptionsCount),
      ).toEqual([1, 0, 0, 0, 0]);
      expect(await database.purchase.count()).toBe(1);
      const detail = await request(app)
        .get(`/api/v1/subscriptions/purchases/${accepted.purchase.purchaseId}`)
        .auth(token, { type: "bearer" });
      expect(detail.status).toBe(200);
      expect(
        purchaseResultSchema.parse(
          successEnvelopeSchema.parse(detail.body).data,
        ),
      ).toEqual(accepted.purchase);
      const other = await createIdentityFixture(database);
      const hidden = await request(app)
        .get(`/api/v1/subscriptions/purchases/${accepted.purchase.purchaseId}`)
        .auth(credentials(other), { type: "bearer" });
      expect(hidden.status).toBe(404);
      const upgradeQuoteResponse = await request(app)
        .post("/api/v1/subscriptions/purchase-quotes")
        .auth(token, { type: "bearer" })
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.header)
        .send({ packageCode: "S2" });
      const upgradeQuote = purchaseQuoteSchema.parse(
        successEnvelopeSchema.parse(upgradeQuoteResponse.body).data,
      );
      const upgradeResponse = await request(app)
        .post("/api/v1/subscriptions/purchases")
        .auth(token, { type: "bearer" })
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.header)
        .send({ quoteId: upgradeQuote.quoteId, confirmed: true });
      expect(upgradeResponse.status).toBe(201);
      const upgradedCatalog = await request(app)
        .get("/api/v1/admin/packages")
        .auth(adminToken, { type: "bearer" });
      expect(
        adminCatalogSchema
          .parse(successEnvelopeSchema.parse(upgradedCatalog.body).data)
          .items.map((row) => row.activeSubscriptionsCount),
      ).toEqual([0, 1, 0, 0, 0]);
      expect(
        JSON.stringify([
          quoteResponse.body,
          acceptedResponse.body,
          history.body,
        ]),
      ).not.toMatch(
        /passwordHash|intentHash|sessionId|eligibilitySnapshot|sponsorUserId/u,
      );
    });
  });

  it("denies anonymous/admin/foreign access, forged authority, invalid aliases, CSRF and malformed pages before effects", async () => {
    await withSubscriptionDatabase(async (database) => {
      const buyer = await createIdentityFixture(database);
      const other = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      await fundSubscriptionFixture(
        database,
        buyer,
        { referral: "0", nonReferral: "60" },
        new Date(),
      );
      const app = createApp({
        financialAdmission: financialFixtureAdmission(database),
        database,
        logger: pino({ level: "silent" }),
        emailDelivery: {
          provider: "console",
          send: () => Promise.resolve({ providerMessageId: "unused" }),
        },
      });
      const token = credentials(buyer);
      expect((await request(app).get("/api/v1/packages")).status).toBe(401);
      expect(
        (
          await request(app)
            .get("/api/v1/subscriptions/me")
            .auth(credentials(admin), { type: "bearer" })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .get("/api/v1/admin/packages")
            .auth(token, { type: "bearer" })
        ).status,
      ).toBe(403);
      const missingCsrf = await request(app)
        .post("/api/v1/subscriptions/purchase-quotes")
        .auth(token, { type: "bearer" })
        .send({ packageCode: "S1" });
      expect(missingCsrf.status).toBe(403);
      for (const body of [
        { packageCode: "S1", ownerId: other.user.id },
        { packageCode: "INVALID" },
      ]) {
        const rejected = await request(app)
          .post("/api/v1/subscriptions/purchase-quotes")
          .auth(token, { type: "bearer" })
          .set("Cookie", csrf.cookie)
          .set("x-csrf-token", csrf.header)
          .send(body);
        expect(rejected.status).toBe(400);
        expect(errorEnvelopeSchema.parse(rejected.body).code).toBe(
          "VALIDATION_ERROR",
        );
      }
      const quoteResponse = await request(app)
        .post("/api/v1/subscriptions/purchase-quotes")
        .auth(token, { type: "bearer" })
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.header)
        .send({ packageCode: "S1" });
      const quote = purchaseQuoteSchema.parse(
        successEnvelopeSchema.parse(quoteResponse.body).data,
      );
      const foreign = await request(app)
        .get(`/api/v1/subscriptions/purchase-quotes/${quote.quoteId}/outcome`)
        .auth(credentials(other), { type: "bearer" });
      expect(foreign.status).toBe(404);
      const foreignCommand = await request(app)
        .post("/api/v1/subscriptions/purchases")
        .auth(credentials(other), { type: "bearer" })
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.header)
        .send({ quoteId: quote.quoteId, confirmed: true });
      expect(foreignCommand.status).toBe(404);
      for (const query of [
        "page=0",
        "limit=101",
        "page=1&page=2",
        "ownerId=forged",
        "page=9007199254740991&limit=100",
      ])
        expect(
          (
            await request(app)
              .get(`/api/v1/subscriptions/purchases?${query}`)
              .auth(token, { type: "bearer" })
          ).status,
        ).toBe(400);
      const invalidKey = await request(app)
        .post("/api/v1/subscriptions/purchases")
        .auth(token, { type: "bearer" })
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.header)
        .set("Idempotency-Key", "bad key")
        .send({ quoteId: quote.quoteId, confirmed: true });
      expect(invalidKey.status).toBe(400);
      expect(
        (
          await request(app)
            .get("/api/v1/subscriptions/purchase-quotes/not-a-uuid/outcome")
            .auth(token, { type: "bearer" })
        ).status,
      ).toBe(400);
      expect(await database.purchase.count()).toBe(0);
      expect(await database.subscription.count()).toBe(0);
      expect(await database.financialOperation.count()).toBe(1);
    });
  });

  it.each(["revoked", "banned", "unverified"] as const)(
    "rejects %s authority before consuming an owned quote",
    async (state) => {
      await withSubscriptionDatabase(async (database) => {
        const buyer = await createIdentityFixture(database);
        await fundSubscriptionFixture(
          database,
          buyer,
          { referral: "0", nonReferral: "60" },
          new Date(),
        );
        const app = createApp({
          financialAdmission: financialFixtureAdmission(database),
          database,
          logger: pino({ level: "silent" }),
          emailDelivery: {
            provider: "console",
            send: () => Promise.resolve({ providerMessageId: "unused" }),
          },
        });
        const token = credentials(buyer);
        const quoteResponse = await request(app)
          .post("/api/v1/subscriptions/purchase-quotes")
          .auth(token, { type: "bearer" })
          .set("Cookie", csrf.cookie)
          .set("x-csrf-token", csrf.header)
          .send({ packageCode: "S1" });
        const quote = purchaseQuoteSchema.parse(
          successEnvelopeSchema.parse(quoteResponse.body).data,
        );
        if (state === "revoked")
          await database.authSession.update({
            where: { id: buyer.session.id },
            data: { revokedAt: new Date() },
          });
        else
          await database.user.update({
            where: { id: buyer.user.id },
            data:
              state === "banned"
                ? { status: "BANNED" }
                : { status: "PENDING_VERIFICATION", emailVerifiedAt: null },
          });
        const rejected = await request(app)
          .post("/api/v1/subscriptions/purchases")
          .auth(token, { type: "bearer" })
          .set("Cookie", csrf.cookie)
          .set("x-csrf-token", csrf.header)
          .send({ quoteId: quote.quoteId, confirmed: true });
        expect(rejected.status).toBe(401);
        expect(await database.purchase.count()).toBe(0);
        expect(await database.subscription.count()).toBe(0);
        expect(await database.financialOperation.count()).toBe(1);
      });
    },
  );

  it("preserves a committed outcome when HTTP response delivery fails without exposing the fault", async () => {
    await withSubscriptionDatabase(async (database) => {
      const buyer = await createIdentityFixture(database);
      await fundSubscriptionFixture(
        database,
        buyer,
        { referral: "0", nonReferral: "60" },
        new Date(),
      );
      const app = createApp({
        financialAdmission: financialFixtureAdmission(database),
        database,
        logger: pino({ level: "silent" }),
        emailDelivery: {
          provider: "console",
          send: () => Promise.resolve({ providerMessageId: "unused" }),
        },
      });
      const token = credentials(buyer);
      const quoteResponse = await request(app)
        .post("/api/v1/subscriptions/purchase-quotes")
        .auth(token, { type: "bearer" })
        .set("Cookie", csrf.cookie)
        .set("x-csrf-token", csrf.header)
        .send({ packageCode: "S1" });
      const quote = purchaseQuoteSchema.parse(
        successEnvelopeSchema.parse(quoteResponse.body).data,
      );
      const delivery = vi
        .spyOn(ResponseHelper, "created")
        .mockImplementationOnce(() => {
          throw new Error("sentinel-private-response-fault");
        });
      try {
        const uncertain = await request(app)
          .post("/api/v1/subscriptions/purchases")
          .auth(token, { type: "bearer" })
          .set("Cookie", csrf.cookie)
          .set("x-csrf-token", csrf.header)
          .send({ quoteId: quote.quoteId, confirmed: true });
        expect(uncertain.status).toBe(500);
        expect(errorEnvelopeSchema.parse(uncertain.body).code).toBe(
          "INTERNAL_SERVER_ERROR",
        );
        expect(JSON.stringify(uncertain.body)).not.toContain(
          "sentinel-private-response-fault",
        );
      } finally {
        delivery.mockRestore();
      }
      const observed = await request(app)
        .get(`/api/v1/subscriptions/purchase-quotes/${quote.quoteId}/outcome`)
        .auth(token, { type: "bearer" });
      expect(
        quoteOutcomeSchema.parse(
          successEnvelopeSchema.parse(observed.body).data,
        ),
      ).toMatchObject({ status: "COMMITTED", purchase: { fullDebit: "60" } });
      expect(await database.purchase.count()).toBe(1);
      expect(
        await database.financialOperation.count({
          where: { businessNamespace: "p04.purchase" },
        }),
      ).toBe(1);
    });
  });
});
