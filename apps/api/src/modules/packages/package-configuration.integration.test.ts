import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  Prisma,
  createDatabaseClient,
  type DatabaseClient,
} from "@template/database";
import pino from "pino";
import request from "supertest";
import {
  configurationResultSchema,
  configurationOutcomeSchema,
  successEnvelopeSchema,
  referralSettingsDataSchema,
  errorEnvelopeSchema,
} from "@template/contracts";
import { createApp } from "../../app.js";
import { generateTokenPair } from "../../infrastructure/security/index.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import {
  P04_FIXTURE_NOW,
  withSubscriptionDatabase,
  withIndependentSubscriptionClients,
  withSubscriptionUserLock,
} from "../subscriptions/testing/subscription-fixtures.js";
import { PackageConfigurationService } from "./package-configuration.service.js";
import { PackagesService } from "./packages.service.js";
import { PurchaseQuoteService } from "../subscriptions/purchase-quote.service.js";
import { SubscriptionPurchaseService } from "../subscriptions/subscription-purchase.service.js";
import { fundSubscriptionFixture } from "../subscriptions/testing/subscription-fixtures.js";

// Keep the fixed configuration clock after migration seed timestamps.
const configurationNow = new Date(
  Math.max(P04_FIXTURE_NOW.getTime(), Date.now()) + 86_400_000,
);
const clock = () => configurationNow;
const identity = (
  account: Awaited<ReturnType<typeof createIdentityFixture>>,
) => ({
  userId: account.user.id,
  sessionId: account.session.id,
});
const edit = (fields: Record<string, unknown> = {}) => ({
  commandId: randomUUID(),
  expectedVersion: 1,
  confirmed: true,
  reason: "Reviewed future terms",
  price: "70",
  ...fields,
});

async function waitForConfigurationLocks(
  database: DatabaseClient,
  fragment: string,
  count = 1,
) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const waiting = await database.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()
        AND wait_event_type='Lock' AND query LIKE ${`%${fragment}%`}`;
    if ((waiting[0]?.count ?? 0n) >= BigInt(count)) return;
  }
  throw new Error("The configuration lock barrier was not reached.");
}

describe("future configuration commands", () => {
  it("quotes the complete new configuration after waiting for its actor lock", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      const buyer = await createIdentityFixture(database, { now: clock() });
      await withIndependentSubscriptionClients(url, async (first) => {
        await withSubscriptionUserLock(
          database,
          buyer.user.id,
          async (release) => {
            const quoting = new PurchaseQuoteService(first, clock).create(
              identity(buyer),
              { packageCode: "S1" },
            );
            await waitForConfigurationLocks(database, "FROM users");
            const saved = await new PackageConfigurationService(
              database,
              clock,
            ).editPackage(
              identity(admin),
              "S1",
              edit({
                dailyReward: "3",
                countedWorkDates: 5,
                withdrawalFeeBps: 1234,
              }),
            );
            release();
            expect((await quoting).terms).toEqual(saved.after);
          },
        );
        expect(await database.purchase.count()).toBe(0);
        expect(await database.financialOperation.count()).toBe(0);
      });
    });
  });

  it("rejects a delayed absent original after a competing edit proves supersession", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      const competitor = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      const original = edit();
      await withIndependentSubscriptionClients(url, async (first) => {
        const delayedService = new PackageConfigurationService(first, clock);
        await withSubscriptionUserLock(
          database,
          admin.user.id,
          async (release) => {
            const delayed = delayedService.editPackage(
              identity(admin),
              "S1",
              original,
            );
            const rejected = expect(delayed).rejects.toMatchObject({
              code: "CONFIGURATION_SUPERSEDED",
            });
            await waitForConfigurationLocks(database, "FROM users");
            await new PackageConfigurationService(database, clock).editPackage(
              identity(competitor),
              "S1",
              edit({ price: "80" }),
            );
            release();
            await rejected;
          },
        );
        expect(
          await delayedService.outcome(identity(admin), original.commandId),
        ).toMatchObject({ status: "NOT_OBSERVED" });
        expect(await database.configurationChange.count()).toBe(1);
        expect(
          await database.package.findUniqueOrThrow({ where: { code: "S1" } }),
        ).toMatchObject({
          version: 2,
          priceUnits: 80000000n,
          updatedByUserId: competitor.user.id,
        });
      });
    });
  });
  it.each(["package", "rates"] as const)(
    "requires renewed review when a %s edit wins the target lock before purchase",
    async (target) => {
      await withSubscriptionDatabase(async (database, url) => {
        const admin = await createIdentityFixture(database, {
          role: "ADMIN",
          now: clock(),
        });
        const buyer = await createIdentityFixture(database, { now: clock() });
        await fundSubscriptionFixture(database, buyer, {
          referral: "0",
          nonReferral: "100",
        });
        await withIndependentSubscriptionClients(url, async (first, second) => {
          const quotes = new PurchaseQuoteService(database, clock);
          const originalQuote = await quotes.create(identity(buyer), {
            packageCode: "S1",
          });
          expect(originalQuote.terms).toMatchObject({
            version: 1,
            price: "60",
          });
          let release = () => {};
          let acquired = () => {};
          const holding = new Promise<void>((resolve) => {
            acquired = resolve;
          });
          const released = new Promise<void>((resolve) => {
            release = resolve;
          });
          const barrier = database.$transaction(async (transaction) => {
            if (target === "package")
              await transaction.$queryRaw`SELECT code FROM packages WHERE code='S1' FOR UPDATE`;
            else
              await transaction.$queryRaw`SELECT id FROM referral_settings WHERE id=1 FOR UPDATE`;
            acquired();
            await released;
          });
          try {
            await holding;
            const configuration = new PackageConfigurationService(first, clock);
            const changing =
              target === "package"
                ? configuration.editPackage(
                    identity(admin),
                    "S1",
                    edit({
                      dailyReward: "3",
                      countedWorkDates: 5,
                      withdrawalFeeBps: 1234,
                    }),
                  )
                : configuration.editReferrals(identity(admin), {
                    commandId: randomUUID(),
                    expectedVersion: 1,
                    confirmed: true,
                    reason: "Reviewed future rates",
                    ratesBps: [1000, 500, 300, 100, 0],
                  });
            const fragment =
              target === "package" ? "FROM packages" : "FROM referral_settings";
            await waitForConfigurationLocks(database, fragment);
            const purchases = new SubscriptionPurchaseService(
              second,
              clock,
              financialFixtureAdmission(second),
            );
            const purchasing = purchases.purchase(identity(buyer), {
              quoteId: originalQuote.quoteId,
              confirmed: true,
            });
            const stale = expect(purchasing).rejects.toMatchObject({
              code: "PURCHASE_QUOTE_STALE",
            });
            await waitForConfigurationLocks(database, fragment, 2);
            release();
            await changing;
            await stale;
            expect(await database.purchase.count()).toBe(0);
            expect(await database.subscription.count()).toBe(0);
            expect(await database.financialOperation.count()).toBe(1);
            expect(
              await database.wallet.findUniqueOrThrow({
                where: { ownerUserId: buyer.user.id },
              }),
            ).toMatchObject({ availableNonReferralUnits: 100000000n });
            const refreshed = await quotes.create(identity(buyer), {
              packageCode: "S1",
            });
            const accepted = await purchases.purchase(
              identity(buyer),
              { quoteId: refreshed.quoteId, confirmed: true },
              "original-review",
            );
            expect(accepted.purchase.subscriptionAtPurchase.terms).toEqual(
              refreshed.terms,
            );
            if (target === "package")
              expect(refreshed.terms).toMatchObject({
                price: "70",
                dailyReward: "3",
                countedWorkDates: 5,
                withdrawalFeeBps: 1234,
                version: 2,
                conditionalGross: "15",
              });
            const saved = await database.purchase.findUniqueOrThrow({
              where: { id: accepted.purchase.purchaseId },
            });
            expect(saved.referralSettingsVersion).toBe(
              target === "rates" ? 2 : 1,
            );
            expect(saved.savedRatesBps).toEqual(
              target === "rates"
                ? [1000, 500, 300, 100, 0]
                : [1200, 600, 400, 200, 200],
            );
            await configuration.editPackage(
              identity(admin),
              "S1",
              edit({
                expectedVersion: target === "package" ? 2 : 1,
                price: "80",
              }),
            );
            await fundSubscriptionFixture(database, buyer, {
              referral: "0",
              nonReferral: "200",
            });
            const otherQuote = await quotes.create(identity(buyer), {
              packageCode: "S2",
            });
            const state = await database.wallet.findUniqueOrThrow({
              where: { ownerUserId: buyer.user.id },
            });
            expect(
              await purchases.purchase(
                identity(buyer),
                { quoteId: refreshed.quoteId, confirmed: true },
                "new-alias",
              ),
            ).toEqual({ ...accepted, replayed: true });
            await expect(
              purchases.purchase(
                identity(buyer),
                { quoteId: otherQuote.quoteId, confirmed: true },
                "original-review",
              ),
            ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
            expect(
              await database.wallet.findUniqueOrThrow({
                where: { ownerUserId: buyer.user.id },
              }),
            ).toEqual(state);
          } finally {
            release();
            await barrier;
          }
        });
      });
    },
  );
  it("saves partial future terms and immutable audit, then replays before newer-version checks", async () => {
    await withSubscriptionDatabase(async (database) => {
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      const service = new PackageConfigurationService(database, clock);
      const packages = new PackagesService(database, clock);
      const initial = await packages.adminCatalog(identity(admin));
      expect(
        initial.items.map(({ terms, activeSubscriptionsCount }) => [
          terms.price,
          terms.dailyReward,
          terms.conditionalGross,
          terms.countedWorkDates,
          terms.withdrawalFeeBps,
          activeSubscriptionsCount,
        ]),
      ).toEqual([
        ["60", "2", "730", 365, 2100, 0],
        ["120", "4", "1460", 365, 2100, 0],
        ["600", "16", "5840", 365, 2100, 0],
        ["1200", "38", "13870", 365, 2100, 0],
        ["2600", "67", "24455", 365, 2100, 0],
      ]);
      expect(await packages.referralSettings(identity(admin))).toMatchObject({
        version: 1,
        ratesBps: [1200, 600, 400, 200, 200],
      });
      const original = edit();
      expect(
        await service.outcome(identity(admin), original.commandId),
      ).toMatchObject({ status: "NOT_OBSERVED" });
      const saved = await service.editPackage(identity(admin), "S1", original);
      expect(saved).toMatchObject({
        replayed: false,
        reason: original.reason,
        before: initial.items[0]?.terms,
        after: { price: "70", dailyReward: "2", version: 2 },
      });
      await service.editPackage(
        identity(admin),
        "S1",
        edit({ expectedVersion: 2, price: "80" }),
      );
      expect(
        await service.editPackage(identity(admin), "S1", original),
      ).toEqual({ ...saved, replayed: true });
      expect(
        await service.outcome(identity(admin), original.commandId),
      ).toMatchObject({
        status: "COMMITTED",
        change: { ...saved, replayed: true },
      });
      await expect(
        service.editPackage(identity(admin), "S1", {
          ...original,
          price: "71",
        }),
      ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
      await expect(
        service.editPackage(identity(admin), "S2", original),
      ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
      const audit = await database.configurationChange.findMany({
        orderBy: { committedVersion: "asc" },
      });
      expect(audit).toHaveLength(2);
      expect(audit[0]).toMatchObject({
        actorUserId: admin.user.id,
        commandId: original.commandId,
        occurredAt: clock(),
        beforeSnapshot: saved.before,
        afterSnapshot: saved.after,
      });
      await expect(
        database.configurationChange.update({
          where: { id: saved.changeId },
          data: { reason: "Rewrite accepted history" },
        }),
      ).rejects.toBeDefined();
      const other = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      expect(
        await service.outcome(identity(other), original.commandId),
      ).toMatchObject({ status: "NOT_OBSERVED" });
    });
  });

  it("rejects invalid intent and resulting calendar/gross without a save or audit", async () => {
    await withSubscriptionDatabase(async (database) => {
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      const service = new PackageConfigurationService(database, clock);
      const before = await database.package.findMany();
      for (const fields of [
        { price: null },
        { price: "0" },
        { confirmed: false },
        { reason: " " },
        { expectedVersion: 2147483647 },
        { expectedVersion: 0 },
        { commandId: "invalid" },
        { tierOrder: 2 },
        { calendar: {} },
        { dailyReward: "9223372036854.775807" },
        { countedWorkDates: 2147483647 },
      ]) {
        await expect(
          service.editPackage(identity(admin), "S1", edit(fields)),
        ).rejects.toBeDefined();
      }
      const { price: _price, ...empty } = edit();
      await expect(
        service.editPackage(identity(admin), "S1", empty),
      ).rejects.toBeDefined();
      await expect(
        service.editReferrals(identity(admin), {
          ...empty,
          ratesBps: [1, 2, 3, 4],
        }),
      ).rejects.toBeDefined();
      expect(await database.package.findMany()).toEqual(before);
      expect(await database.configurationChange.count()).toBe(0);
      for (const version of [0, 2147483647]) {
        await expect(
          database.package.update({
            where: { code: "S1" },
            data: { version, updatedByUserId: admin.user.id },
          }),
        ).rejects.toBeDefined();
      }
      await expect(
        service.editPackage(
          identity(admin),
          "S1",
          edit({ expectedVersion: 2 }),
        ),
      ).rejects.toMatchObject({ code: "CONFIGURATION_STALE" });
      expect(
        await service.outcome(identity(admin), empty.commandId),
      ).toMatchObject({ status: "NOT_OBSERVED" });
    });
  });

  it("races delayed originals and identical retries once, and proves absent supersession only on PATCH", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      await withIndependentSubscriptionClients(url, async (first, second) => {
        const original = edit();
        const a = new PackageConfigurationService(first, clock);
        const b = new PackageConfigurationService(second, clock);
        await withSubscriptionUserLock(
          database,
          admin.user.id,
          async (release) => {
            const delayed = a.editPackage(identity(admin), "S1", original);
            const retry = b.editPackage(identity(admin), "S1", original);
            await waitForConfigurationLocks(database, "FROM users", 2);
            release();
            const outcomes = await Promise.all([delayed, retry]);
            expect(outcomes.map((change) => change.replayed).sort()).toEqual([
              false,
              true,
            ]);
            expect(outcomes[0].changeId).toBe(outcomes[1].changeId);
          },
        );
        const absent = edit();
        expect(
          await a.outcome(identity(admin), absent.commandId),
        ).toMatchObject({ status: "NOT_OBSERVED" });
        await expect(
          a.editPackage(identity(admin), "S1", absent),
        ).rejects.toMatchObject({ code: "CONFIGURATION_SUPERSEDED" });
        await expect(
          b.editPackage(identity(admin), "S1", absent),
        ).rejects.toMatchObject({ code: "CONFIGURATION_SUPERSEDED" });
        expect(await database.configurationChange.count()).toBe(1);
        expect(
          await database.package.findUniqueOrThrow({ where: { code: "S1" } }),
        ).toMatchObject({ version: 2, priceUnits: 70000000n });
      });
    });
  });

  it("rechecks revoked authority after the actor lock and refuses replay and observation", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      await withIndependentSubscriptionClients(url, async (first) => {
        const service = new PackageConfigurationService(first, clock);
        const original = edit();
        await withSubscriptionUserLock(
          database,
          admin.user.id,
          async (release) => {
            const saving = service.editPackage(identity(admin), "S1", original);
            const rejected = expect(saving).rejects.toMatchObject({
              statusCode: 401,
            });
            await waitForConfigurationLocks(database, "FROM users");
            await database.authSession.update({
              where: { id: admin.session.id },
              data: { revokedAt: clock() },
            });
            release();
            await rejected;
          },
        );
        await expect(
          service.outcome(identity(admin), original.commandId),
        ).rejects.toMatchObject({ statusCode: 401 });
        expect(await database.configurationChange.count()).toBe(0);
        expect(
          await database.package.findUniqueOrThrow({ where: { code: "S1" } }),
        ).toMatchObject({ version: 1 });
      });
    });
  });

  it("serializes different admins at one target version and preserves the winning audit", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const firstAdmin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      const secondAdmin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      await withIndependentSubscriptionClients(url, async (first, second) => {
        let release = () => {};
        let acquired = () => {};
        const holding = new Promise<void>((resolve) => {
          acquired = resolve;
        });
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        const barrier = database.$transaction(async (transaction) => {
          await transaction.$queryRaw`SELECT code FROM packages WHERE code='S1' FOR UPDATE`;
          acquired();
          await released;
        });
        try {
          await holding;
          const outcomes = Promise.allSettled([
            new PackageConfigurationService(first, clock).editPackage(
              identity(firstAdmin),
              "S1",
              edit(),
            ),
            new PackageConfigurationService(second, clock).editPackage(
              identity(secondAdmin),
              "S1",
              edit({ price: "80" }),
            ),
          ]);
          await waitForConfigurationLocks(database, "FROM packages", 2);
          release();
          const settled = await outcomes;
          expect(
            settled.filter((outcome) => outcome.status === "fulfilled"),
          ).toHaveLength(1);
          expect(
            settled.find((outcome) => outcome.status === "rejected"),
          ).toMatchObject({ reason: { code: "CONFIGURATION_SUPERSEDED" } });
          const audit = await database.configurationChange.findMany();
          expect(audit).toHaveLength(1);
          expect(
            await database.package.findUniqueOrThrow({ where: { code: "S1" } }),
          ).toMatchObject({
            version: 2,
            updatedByUserId: audit[0]?.actorUserId,
          });
        } finally {
          release();
          await barrier;
        }
      });
    });
  });

  it("rolls back updated terms when immutable audit fails, then accepts the unchanged retry", async () => {
    await withSubscriptionDatabase(async (database) => {
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      const service = new PackageConfigurationService(database, clock);
      const original = edit();
      const before = await database.package.findUniqueOrThrow({
        where: { code: "S1" },
      });
      await database.$executeRawUnsafe(
        "CREATE SEQUENCE configuration_update_reached",
      );
      await database.$executeRawUnsafe(
        "CREATE FUNCTION fail_configuration_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('configuration_update_reached'); RAISE EXCEPTION 'controlled audit failure'; END $$",
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER fail_configuration_audit BEFORE INSERT ON configuration_changes FOR EACH ROW EXECUTE FUNCTION fail_configuration_audit()",
      );
      await expect(
        service.editPackage(identity(admin), "S1", original),
      ).rejects.toBeDefined();
      expect(
        await database.$queryRaw`SELECT is_called FROM configuration_update_reached`,
      ).toEqual([{ is_called: true }]);
      expect(
        await database.package.findUniqueOrThrow({ where: { code: "S1" } }),
      ).toEqual(before);
      expect(await database.configurationChange.count()).toBe(0);
      await database.$executeRawUnsafe(
        "DROP TRIGGER fail_configuration_audit ON configuration_changes",
      );
      expect(
        await service.editPackage(identity(admin), "S1", original),
      ).toMatchObject({ replayed: false, committedVersion: 2 });
    });
  });

  it("keeps failed locked reads and lock timeouts nonterminal with no mutation", async () => {
    await withSubscriptionDatabase(async (database, url) => {
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: clock(),
      });
      const limitedUrl = new URL(url);
      limitedUrl.searchParams.set("options", "-c lock_timeout=100ms");
      const limited = createDatabaseClient(limitedUrl.toString());
      const service = new PackageConfigurationService(limited, clock);
      const original = edit();
      try {
        await withSubscriptionUserLock(database, admin.user.id, async () => {
          await expect(
            service.editPackage(identity(admin), "S1", original),
          ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
          await expect(
            service.outcome(identity(admin), original.commandId),
          ).rejects.toBeDefined();
        });
        await database.$executeRawUnsafe(
          "ALTER TABLE configuration_changes RENAME TO unavailable_configuration_changes",
        );
        try {
          await expect(
            service.outcome(identity(admin), original.commandId),
          ).rejects.toBeDefined();
          await expect(
            service.editPackage(identity(admin), "S1", original),
          ).rejects.toBeDefined();
        } finally {
          await database.$executeRawUnsafe(
            "ALTER TABLE unavailable_configuration_changes RENAME TO configuration_changes",
          );
        }
        expect(
          await service.outcome(identity(admin), original.commandId),
        ).toMatchObject({ status: "NOT_OBSERVED" });
        expect(await database.configurationChange.count()).toBe(0);
        expect(
          await database.package.findUniqueOrThrow({ where: { code: "S1" } }),
        ).toMatchObject({ version: 1 });
      } finally {
        await limited.$disconnect();
      }
    });
  });
});

describe("actual configuration HTTP boundary", () => {
  it("enforces ADMIN, CSRF, strict reviewed input and actor-scoped outcomes with safe JSON", async () => {
    await withSubscriptionDatabase(async (database) => {
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const other = await createIdentityFixture(database, { role: "ADMIN" });
      const employee = await createIdentityFixture(database);
      const token = (account = admin) =>
        generateTokenPair({
          ...identity(account),
          tokenId: randomUUID(),
          email: account.user.email,
          role: account.user.role,
          rememberMe: false,
          absoluteExpiresAt: account.session.expiresAt,
        }).accessToken;
      const app = createApp({
        database,
        logger: pino({ level: "silent" }),
        emailDelivery: {
          provider: "console",
          send: () => Promise.resolve({ providerMessageId: "unused" }),
        },
      });
      const patch = (path: string, body: object, account = admin) =>
        request(app)
          .patch(`/api/v1${path}`)
          .auth(token(account), { type: "bearer" })
          .set("Cookie", "csrfToken=configuration-test")
          .set("X-CSRF-Token", "configuration-test")
          .send(body);
      expect(
        (await request(app).patch("/api/v1/admin/packages/S1").send(edit()))
          .status,
      ).toBe(401);
      expect((await patch("/admin/packages/S1", edit(), employee)).status).toBe(
        403,
      );
      expect(
        (
          await request(app)
            .patch("/api/v1/admin/packages/S1")
            .auth(token(), { type: "bearer" })
            .send(edit())
        ).status,
      ).toBe(403);
      for (const fields of [
        { actorUserId: other.user.id },
        { reason: " " },
        { confirmed: false },
        { price: null },
        { tierOrder: 5 },
      ]) {
        const rejected = await patch("/admin/packages/S1", edit(fields));
        expect(rejected.status).toBe(400);
        expect(errorEnvelopeSchema.parse(rejected.body).code).toBe(
          "VALIDATION_ERROR",
        );
      }
      const original = edit();
      const saved = await patch("/admin/packages/S1", original);
      expect(saved.status).toBe(200);
      expect(saved.headers["cache-control"]).toBe("no-store");
      expect(
        configurationResultSchema.parse(
          successEnvelopeSchema.parse(saved.body).data,
        ),
      ).toMatchObject({ commandId: original.commandId, replayed: false });
      expect(JSON.stringify(saved.body)).not.toMatch(
        /intentHash|actorUserId|passwordHash|sessionId|priceUnits/u,
      );
      expect(
        configurationResultSchema.parse(
          successEnvelopeSchema.parse(
            (await patch("/admin/packages/S1", original)).body,
          ).data,
        ),
      ).toMatchObject({ replayed: true });
      const absent = edit();
      const superseded = await patch("/admin/packages/S1", absent);
      expect(superseded.status).toBe(409);
      expect(errorEnvelopeSchema.parse(superseded.body).code).toBe(
        "CONFIGURATION_SUPERSEDED",
      );
      const observation = await request(app)
        .get(`/api/v1/admin/configuration-changes/${absent.commandId}`)
        .auth(token(), { type: "bearer" });
      expect(
        configurationOutcomeSchema.parse(
          successEnvelopeSchema.parse(observation.body).data,
        ),
      ).toMatchObject({ status: "NOT_OBSERVED" });
      const foreign = await request(app)
        .get(`/api/v1/admin/configuration-changes/${original.commandId}`)
        .auth(token(other), { type: "bearer" });
      expect(
        configurationOutcomeSchema.parse(
          successEnvelopeSchema.parse(foreign.body).data,
        ),
      ).toMatchObject({ status: "NOT_OBSERVED" });
      const { price: _price, ...referralBody } = edit();
      const referral = await patch("/admin/referral-settings", {
        ...referralBody,
        ratesBps: [0, 10000, 1, 2, 3],
      });
      expect(referral.status).toBe(200);
      expect(
        configurationResultSchema.parse(
          successEnvelopeSchema.parse(referral.body).data,
        ),
      ).toMatchObject({
        target: { kind: "REFERRAL_SETTINGS" },
        after: { version: 2, ratesBps: [0, 10000, 1, 2, 3] },
      });
      const rates = await request(app)
        .get("/api/v1/admin/referral-settings")
        .auth(token(), { type: "bearer" });
      expect(
        referralSettingsDataSchema.parse(
          successEnvelopeSchema.parse(rates.body).data,
        ),
      ).toMatchObject({ version: 2 });
      await database.authSession.update({
        where: { id: admin.session.id },
        data: { revokedAt: new Date() },
      });
      expect((await patch("/admin/packages/S1", original)).status).toBe(401);
      expect(
        (
          await request(app)
            .get(`/api/v1/admin/configuration-changes/${original.commandId}`)
            .auth(token(), { type: "bearer" })
        ).status,
      ).toBe(401);
      expect(await database.configurationChange.count()).toBe(2);
    });
  });
});
