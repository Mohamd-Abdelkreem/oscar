import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import pino from "pino";
import request from "supertest";
import {
  MAX_USDT_AMOUNT,
  adminFinancePageSchema,
  walletViewSchema,
  adminWalletViewSchema,
  ledgerPageSchema,
  employeeLedgerDetailSchema,
  adminLedgerDetailSchema,
  successEnvelopeSchema,
} from "@template/contracts";
import { createApp } from "../../app.js";
import { generateTokenPair } from "../../infrastructure/security/index.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { LedgerService } from "../ledger/ledger.service.js";
import type { LedgerContext } from "../ledger/ledger.types.js";
import {
  activateSubscriptionFixture,
  fundSubscriptionFixture,
  withSubscriptionDatabase,
  P04_FIXTURE_NOW,
} from "../subscriptions/testing/subscription-fixtures.js";
import { WalletsService } from "./wallets.service.js";
import { TaskReviewService } from "../task-submissions/task-review.service.js";
import { acceptedReviewFixture } from "../task-submissions/testing/review-fixtures.js";
import {
  withTaskDatabase,
  withTaskFileFixture,
  taskIdentity,
} from "../tasks/testing/task-fixtures.js";
import { PurchaseQuoteService } from "../subscriptions/purchase-quote.service.js";
import { SubscriptionPurchaseService } from "../subscriptions/subscription-purchase.service.js";
import { ManualCreditService } from "../deposits/manual-credit.service.js";
import {
  depositIdentity,
  manualGrant,
} from "../deposits/testing/deposit-http-fixtures.js";

describe("source-aware wallet projections", () => {
  it("projects administrative grants as CREDIT with correction null and retains referral/reserved provenance", async () =>
    withSubscriptionDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      if (employee.wallet === null) throw new Error("Employee wallet required");
      await fundSubscriptionFixture(database, employee, {
        referral: "20",
        nonReferral: "40",
      });
      const ledger = new LedgerService(
        database,
        {
          businessNamespaces: ["p06.manual-credit", "p06.wallet-fixture"],
          processIds: [],
        },
        financialFixtureAdmission(database),
      );
      const context: LedgerContext = {
        actor: { type: "USER", userId: admin.user.id },
        walletIds: [employee.wallet.id],
        clock: () => new Date(),
        observe: async () => {},
        mutate: async () => {},
        eligibleSources: () => Promise.resolve(["NON_REFERRAL", "REFERRAL"]),
      };
      await ledger.execute(
        {
          kind: "RESERVE",
          walletId: employee.wallet.id,
          businessNamespace: "p06.wallet-fixture",
          businessKey: randomUUID(),
          reservationId: randomUUID(),
          amount: "50",
        },
        context,
      );
      const before = await database.wallet.findUniqueOrThrow({
        where: { id: employee.wallet.id },
      });
      const grant = await new ManualCreditService(
        database,
        () => new Date(),
        financialFixtureAdmission(database),
      ).create(
        depositIdentity(admin),
        manualGrant(employee.user.id),
        randomUUID(),
      );
      const wallets = new WalletsService(database);
      const detail = await wallets.detail(
        depositIdentity(admin),
        grant.operationId,
        true,
      );
      expect(adminLedgerDetailSchema.parse(detail)).toMatchObject({
        kind: "CREDIT",
        origin: "ADMIN_ADJUSTMENT",
        correction: null,
        magnitude: "1.000001",
      });
      const after = await database.wallet.findUniqueOrThrow({
        where: { id: employee.wallet.id },
      });
      expect(after).toMatchObject({
        availableNonReferralUnits: before.availableNonReferralUnits + 1000001n,
        availableReferralUnits: before.availableReferralUnits,
        reservedNonReferralUnits: before.reservedNonReferralUnits,
        reservedReferralUnits: before.reservedReferralUnits,
      });
      expect(
        (
          await ledger.reconcileWallet(employee.wallet.id, {
            actor: context.actor,
            observe: async () => {},
          })
        ).consistent,
      ).toBe(true);
      const corrected = await ledger.execute(
        {
          kind: "CORRECTION",
          walletId: employee.wallet.id,
          businessNamespace: "p06.wallet-fixture",
          businessKey: randomUUID(),
          amount: "1",
          source: "REFERRAL",
          direction: "CREDIT",
          reason: "Prior source correction",
          referenceOperationId: grant.operationId,
        },
        context,
      );
      expect(
        await wallets.detail(
          depositIdentity(admin),
          corrected.result.operationId,
          true,
        ),
      ).toMatchObject({
        kind: "CORRECTION",
        correction: {
          reason: "Prior source correction",
          referenceOperationId: grant.operationId,
        },
      });
      expect(await database.depositReceipt.count()).toBe(0);
    }));
  it("shows only approved captured rewards as non-referral funds after expiry and retains ban restrictions", async () => {
    await withTaskDatabase(async (database) =>
      withTaskFileFixture(async (root) => {
        const fixture = await acceptedReviewFixture(database, root);
        await fundSubscriptionFixture(database, fixture.employee, {
          referral: "10",
          nonReferral: "0",
        });
        const expiry = fixture.subscription.expiresAt;
        await database.authSession.updateMany({
          data: { expiresAt: new Date(expiry.getTime() + 86_400_000) },
        });
        const clock = () => expiry;
        const wallets = new WalletsService(database, clock);
        expect(
          await wallets.wallet(taskIdentity(fixture.employee)),
        ).toMatchObject({
          withdrawalFunds: {
            eligibleReferral: "0",
            lockedReferral: "10",
            total: "0",
          },
        });
        await new TaskReviewService(
          database,
          clock,
          undefined,
          financialFixtureAdmission(database),
        ).review(
          taskIdentity(fixture.admin),
          fixture.submission.id,
          fixture.intent,
        );
        expect(
          await wallets.wallet(taskIdentity(fixture.employee)),
        ).toMatchObject({
          withdrawalFunds: {
            eligibleReferral: "0",
            lockedReferral: "10",
            total: "2",
          },
        });
        const history = await wallets.history(taskIdentity(fixture.employee), {
          origin: "TASK_REWARD",
        });
        expect(history.items).toHaveLength(1);
        await database.user.update({
          where: { id: fixture.employee.user.id },
          data: { status: "BANNED" },
        });
        await expect(
          wallets.wallet(taskIdentity(fixture.employee)),
        ).rejects.toMatchObject({ statusCode: 401 });
        expect(
          await wallets.employeeWallet(
            taskIdentity(fixture.admin),
            fixture.employee.user.id,
          ),
        ).toMatchObject({
          restrictions: { accountUnavailable: true },
          withdrawalFunds: { lockedReferral: "10" },
        });
      }),
    );
  });
  it("retains four components at expiry, separates restrictions and restores referral eligibility on paid reactivation", async () => {
    await withSubscriptionDatabase(async (database) => {
      const owner = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: P04_FIXTURE_NOW,
      });
      await fundSubscriptionFixture(database, owner, {
        referral: "150",
        nonReferral: "300",
      });
      const active = await activateSubscriptionFixture(database, owner);
      const expiry = active.subscription.expiresAt;
      await database.authSession.updateMany({
        data: { expiresAt: new Date("2030-01-01T00:00:00Z") },
      });
      let now = P04_FIXTURE_NOW;
      const service = new WalletsService(database, () => now);
      const identity = { userId: owner.user.id, sessionId: owner.session.id };
      const initial = walletViewSchema.parse(await service.wallet(identity));
      expect(initial).toMatchObject({
        purchaseEligibleAmount: "390",
        withdrawalFunds: {
          eligibleReferral: "90",
          lockedReferral: "0",
          total: "390",
        },
        withdrawalExecutionReady: false,
      });
      await database.user.update({
        where: { id: owner.user.id },
        data: { tasksBlocked: true, withdrawalsBlocked: true },
      });
      expect(await service.wallet(identity)).toMatchObject({
        withdrawalFunds: { total: "390" },
        restrictions: { accountUnavailable: false, withdrawalsBlocked: true },
      });
      now = expiry;
      const expired = await service.wallet(identity);
      expect(expired).toMatchObject({
        walletComponents: initial.walletComponents,
        purchaseEligibleAmount: "390",
        membership: { effective: "FREE" },
        withdrawalFunds: {
          eligibleNonReferral: "300",
          eligibleReferral: "0",
          lockedReferral: "90",
          total: "300",
        },
      });
      const renewal = await new PurchaseQuoteService(
        database,
        () => now,
      ).create(identity, { packageCode: "S1" });
      await new SubscriptionPurchaseService(
        database,
        () => now,
        financialFixtureAdmission(database),
      ).purchase(identity, { quoteId: renewal.quoteId, confirmed: true });
      expect(await service.wallet(identity)).toMatchObject({
        membership: { effective: "PAID" },
        withdrawalFunds: { eligibleReferral: "30", lockedReferral: "0" },
      });
      const adminView = await service.employeeWallet(
        { userId: admin.user.id, sessionId: admin.session.id },
        owner.user.id,
      );
      expect(adminView.employee.id).toBe(owner.user.id);
      expect(JSON.stringify(adminView)).not.toMatch(
        /passwordHash|sessionId|intentHash/u,
      );
    });
  });

  it("counts neutral operations before paging without source multiplicity and keeps audited corrections away from reserved funds", async () => {
    await withSubscriptionDatabase(async (database) => {
      const owner = await createIdentityFixture(database, {
        now: P04_FIXTURE_NOW,
      });
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: P04_FIXTURE_NOW,
      });
      await fundSubscriptionFixture(database, owner, {
        referral: "50",
        nonReferral: "20",
      });
      if (owner.wallet === null) throw new Error("Missing fixture wallet");
      const walletId = owner.wallet.id;
      const ledger = new LedgerService(
        database,
        {
          businessNamespaces: ["p04.views"],
          processIds: [],
        },
        financialFixtureAdmission(database),
      );
      const context: LedgerContext = {
        actor: { type: "USER", userId: admin.user.id },
        walletIds: [walletId],
        clock: () => P04_FIXTURE_NOW,
        observe: async () => {},
        mutate: async () => {},
        eligibleSources: () => Promise.resolve(["NON_REFERRAL", "REFERRAL"]),
        releaseSafety: async () => {},
      };
      const reservationId = randomUUID();
      const reserve = await ledger.execute(
        {
          kind: "RESERVE",
          walletId,
          businessNamespace: "p04.views",
          businessKey: randomUUID(),
          amount: "30",
          reservationId,
        },
        context,
      );
      const correction = {
        kind: "CORRECTION",
        walletId,
        businessNamespace: "p04.views",
        businessKey: randomUUID(),
        amount: "5",
        source: "REFERRAL",
        direction: "DEBIT",
        reason: "Correct duplicate referral allocation",
        referenceOperationId: reserve.result.operationId,
      } as const;
      await ledger.execute(correction, context);
      expect((await ledger.execute(correction, context)).replayed).toBe(true);
      await expect(
        ledger.execute(
          { ...correction, businessKey: randomUUID(), amount: "36" },
          context,
        ),
      ).rejects.toMatchObject({ code: "LEDGER_INSUFFICIENT_FUNDS" });
      const service = new WalletsService(database, () => P04_FIXTURE_NOW);
      const identity = { userId: admin.user.id, sessionId: admin.session.id };
      const beforeRelease = await service.employeeWallet(
        identity,
        owner.user.id,
      );
      expect(beforeRelease.walletComponents).toMatchObject({
        availableReferral: "35",
        reservedReferral: "10",
        availableNonReferral: "0",
        reservedNonReferral: "20",
        total: "65",
      });
      await ledger.execute(
        {
          kind: "RELEASE",
          walletId,
          businessNamespace: "p04.views",
          businessKey: randomUUID(),
          reservationId,
        },
        context,
      );
      for (const filter of [
        {},
        { source: "REFERRAL" },
        { origin: "WITHDRAWAL_RESERVATION" },
        { kind: "RELEASE" },
        { direction: "NEUTRAL" },
        { employeeId: owner.user.id },
        { q: reserve.result.operationId },
        { from: P04_FIXTURE_NOW.toISOString(), to: "2026-10-06T00:00:00Z" },
      ] as const) {
        const first = adminFinancePageSchema.parse(
          await service.finance(identity, { ...filter, limit: 1 }),
        );
        const second = await service.finance(identity, {
          ...filter,
          limit: 1,
          page: 2,
        });
        expect(first.summary).toEqual(second.summary);
        expect(first.summary.neutralOperationsCount).toBe(
          filter.origin !== undefined ||
            filter.q !== undefined ||
            filter.kind !== undefined
            ? 1
            : 2,
        );
      }
      const all = await service.finance(identity, {});
      expect(all.summary).toEqual({
        scope: "FILTERED_OPERATIONS",
        credits: "70",
        debits: "5",
        net: "65",
        neutralOperationsCount: 2,
      });
      expect(all.pagination.total).toBe(5);
      expect(
        (await service.finance(identity, { q: "حجز" })).summary
          .neutralOperationsCount,
      ).toBe(2);
      expect(
        (await service.finance(identity, { q: "' OR TRUE --" })).pagination
          .total,
      ).toBe(0);
      expect(
        (await service.finance(identity, { from: "2026-10-06T00:00:00Z" }))
          .walletTotals.owned,
      ).toBe("65");
      expect(
        (await service.finance(identity, { to: P04_FIXTURE_NOW.toISOString() }))
          .summary.neutralOperationsCount,
      ).toBe(0);
      expect(
        (await service.finance(identity, { page: 6, limit: 1 })).items,
      ).toEqual([]);
      for (const direction of ["CREDIT", "DEBIT"])
        expect(
          (await service.finance(identity, { direction })).summary
            .neutralOperationsCount,
        ).toBe(0);
      const own = await service.history(
        { userId: owner.user.id, sessionId: owner.session.id },
        {},
      );
      expect(own.summary).toEqual({
        scope: "FILTERED_OPERATIONS",
        credits: "70",
        debits: "5",
        net: "65",
      });
      const detail = await service.detail(
        identity,
        (
          await database.financialOperation.findFirstOrThrow({
            where: { kind: "CORRECTION" },
          })
        ).id,
        true,
      );
      expect(detail).toMatchObject({
        correction: {
          reason: correction.reason,
          referenceOperationId: reserve.result.operationId,
        },
        actor: { id: admin.user.id },
        signedOwnershipDelta: "-5",
      });
      expect(
        (await service.employeeWallet(identity, owner.user.id)).withdrawalFunds,
      ).toMatchObject({ lockedReferral: "45", total: "20" });
      expect(
        await database.auditRecord.count({ where: { action: "CORRECTION" } }),
      ).toBe(1);
    });
  });

  it("aggregates multiple int64 wallets exactly and enforces real HTTP private scope, filters and current sessions", async () => {
    await withSubscriptionDatabase(async (database) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(P04_FIXTURE_NOW);
      try {
        const owner = await createIdentityFixture(database);
        const other = await createIdentityFixture(database);
        const admin = await createIdentityFixture(database, { role: "ADMIN" });
        for (const account of [owner, other])
          await fundSubscriptionFixture(database, account, {
            referral: "0",
            nonReferral: MAX_USDT_AMOUNT,
          });
        const service = new WalletsService(database, () => P04_FIXTURE_NOW);
        expect(
          (
            await service.finance(
              { userId: admin.user.id, sessionId: admin.session.id },
              {},
            )
          ).walletTotals.owned,
        ).toBe("18446744073709.551614");
        const operation = await database.financialOperation.findFirstOrThrow({
          where: { wallet: { ownerUserId: other.user.id } },
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
        const token = (account: typeof owner) =>
          generateTokenPair({
            userId: account.user.id,
            sessionId: account.session.id,
            tokenId: randomUUID(),
            email: account.user.email,
            role: account.user.role,
            rememberMe: false,
            absoluteExpiresAt: account.session.expiresAt,
          }).accessToken;
        const read = (path: string, account = owner) =>
          request(app)
            .get(`/api/v1${path}`)
            .auth(token(account), { type: "bearer" });
        const ownedOperation =
          await database.financialOperation.findFirstOrThrow({
            where: { wallet: { ownerUserId: owner.user.id } },
          });
        for (const [path, schema, account] of [
          ["/wallet/me", walletViewSchema, owner],
          ["/wallet/me/ledger", ledgerPageSchema, owner],
          [
            `/wallet/me/ledger/${ownedOperation.id}`,
            employeeLedgerDetailSchema,
            owner,
          ],
          [`/admin/wallets/${owner.user.id}`, adminWalletViewSchema, admin],
          ["/admin/finance", adminFinancePageSchema, admin],
          [
            `/admin/finance/${ownedOperation.id}`,
            adminLedgerDetailSchema,
            admin,
          ],
        ] as const) {
          const projection = await read(path, account);
          expect(projection.status).toBe(200);
          expect(projection.headers["cache-control"]).toBe("no-store");
          schema.parse(successEnvelopeSchema.parse(projection.body).data);
        }
        expect((await request(app).get("/api/v1/wallet/me")).status).toBe(401);
        expect((await read("/admin/finance")).status).toBe(403);
        expect((await read("/wallet/me", admin)).status).toBe(403);
        expect((await read(`/wallet/me/ledger/${operation.id}`)).status).toBe(
          404,
        );
        for (const query of [
          "source=other",
          "employeeId=" + other.user.id,
          "limit=101",
          "source=REFERRAL&source=NON_REFERRAL",
          "from=2026-10-06T00:00:00Z&to=2026-10-05T00:00:00Z",
        ])
          expect((await read(`/wallet/me/ledger?${query}`)).status).toBe(400);
        const response = await read("/admin/finance?limit=1", admin);
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        const envelope = successEnvelopeSchema.parse(response.body);
        const page = adminFinancePageSchema.parse(envelope.data);
        expect(envelope.paginationMeta).toEqual(page.pagination);
        expect(page.summary.credits).toBe("18446744073709.551614");
        expect(JSON.stringify(response.body)).not.toMatch(
          /passwordHash|businessNamespace|intentHash|sessionId/u,
        );
        await database.user.update({
          where: { id: other.user.id },
          data: { status: "BANNED", accountVersion: { increment: 1 } },
        });
        const unavailable = await service.employeeWallet(
          { userId: admin.user.id, sessionId: admin.session.id },
          other.user.id,
        );
        expect(unavailable).toMatchObject({
          restrictions: { accountUnavailable: true },
          walletComponents: { total: MAX_USDT_AMOUNT },
          withdrawalFunds: { eligibleNonReferral: MAX_USDT_AMOUNT },
        });
        expect((await read("/wallet/me", other)).status).toBe(401);
        await database.authSession.update({
          where: { id: admin.session.id },
          data: { revokedAt: new Date() },
        });
        expect((await read("/admin/finance", admin)).status).toBe(401);
        await expect(
          service.finance(
            { userId: admin.user.id, sessionId: admin.session.id },
            {},
          ),
        ).rejects.toMatchObject({ statusCode: 401 });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
