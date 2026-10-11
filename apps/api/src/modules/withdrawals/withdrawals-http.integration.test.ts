import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  withdrawalDestinationSchema,
  errorEnvelopeSchema,
  successEnvelopeSchema,
  withdrawalQuoteSchema,
  withdrawalCommandResultSchema,
  withdrawalHistorySchema,
  withdrawalRequestSchema,
  withdrawalQuoteOutcomeSchema,
  withdrawalStatusSchema,
  adminWithdrawalRequestSchema,
  adminWithdrawalHistorySchema,
  adminWithdrawalActionOutcomeSchema,
  walletViewSchema,
  adminWalletViewSchema,
} from "@template/contracts";
import type { DatabaseClient } from "@template/database";
import { createApp } from "../../app.js";
import { createLogger } from "../../infrastructure/logger/logger.js";
import { generateTokenPair } from "../../infrastructure/security/index.js";
import {
  EmailDeliveryError,
  type EmailDelivery,
} from "../../infrastructure/email/email-delivery.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import {
  changeDispatchPause,
  fenceFinancialRuntime,
  FinancialRuntimeAdmission,
} from "../custody/runtime-control.js";
import { WithdrawalsService } from "./withdrawals.service.js";
import {
  withWithdrawalDatabase,
  withClockedWithdrawalDatabase,
} from "./testing/withdrawal-fixtures.js";
import { TronWeb } from "tronweb";
import {
  reservationEmployee,
  RESERVATION_NOW,
  reservationServices,
  RESERVATION_CAPABILITY,
} from "./testing/withdrawal-reservation-fixtures.js";
import type { WithdrawalWakeupPublisher } from "../../infrastructure/queue/withdrawal-wakeups.js";
import {
  admitWithdrawalRuntimeFixture,
  withWithdrawalRole,
  claimWithdrawalFixture,
} from "./testing/withdrawal-authority-fixtures.js";

const address = TronWeb.address.fromHex(`41${"22".repeat(20)}`);
type Account = Awaited<ReturnType<typeof createIdentityFixture>>;
function httpHarness(
  database: DatabaseClient,
  options: {
    disposition?: "UNKNOWN" | "REJECTED";
    omitNetwork?: boolean;
    clock?: () => Date;
    wakeups?: WithdrawalWakeupPublisher;
    omitCapability?: boolean;
    admission?: FinancialRuntimeAdmission;
  } = {},
) {
  const credentials: string[] = [];
  const logs: string[] = [];
  const delivery: EmailDelivery = {
    provider: "resend",
    send: async (mail) => {
      await mail.assertCanDispatch?.();
      const token = /#withdrawal-confirmation=([A-Za-z0-9_-]{43})/u.exec(
        mail.html,
      )?.[1];
      if (token === undefined) throw new Error("Missing test email proof");
      credentials.push(token);
      if (options.disposition !== undefined)
        throw new EmailDeliveryError("resend", 1, options.disposition);
      return { providerMessageId: "test-ack" };
    },
  };
  const app = createApp({
    database,
    ...(options.wakeups === undefined
      ? {}
      : { withdrawalWakeups: options.wakeups }),
    ...(options.clock === undefined ? {} : { financialClock: options.clock }),
    emailDelivery: delivery,
    logger: createLogger({
      level: "info",
      pretty: false,
      destination: {
        write: (line) => {
          logs.push(line);
        },
      },
    }),
    financialAdmission:
      options.admission ?? financialFixtureAdmission(database),
    ...(options.omitNetwork === true
      ? {}
      : {
          depositMetadata: {
            network: "TRON_NILE" as const,
            token: {
              symbol: "USDT" as const,
              contract: address,
              decimals: 6 as const,
            },
          },
          ...(options.omitCapability === true
            ? {}
            : { payoutCapability: RESERVATION_CAPABILITY }),
        }),
  });
  const credential = (account: Account) =>
    generateTokenPair({
      userId: account.user.id,
      sessionId: account.session.id,
      tokenId: randomUUID(),
      email: account.user.email,
      role: account.user.role,
      rememberMe: false,
      absoluteExpiresAt: account.session.expiresAt,
    }).accessToken;
  const path = "/api/v1/withdrawals/me/destination";
  return {
    app,
    credentials,
    logs,
    credential,
    read: (account: Account) =>
      request(app).get(path).auth(credential(account), { type: "bearer" }),
    write: (action: string, account: Account) =>
      request(app)
        .post(`${path}/${action}`)
        .auth(credential(account), { type: "bearer" })
        .set("Cookie", "csrfToken=p08-test")
        .set("X-CSRF-Token", "p08-test"),
  };
}
function destination(response: { body: unknown }) {
  return withdrawalDestinationSchema.parse(
    successEnvelopeSchema.parse(response.body).data,
  );
}

describe("reviewed withdrawal reservation HTTP boundary", () => {
  it("agrees on configured readiness while preserving independent eligibility and fenced reads", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database, {
        nonReferral: "10",
        referral: "30",
      });
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: RESERVATION_NOW,
      });
      const http = httpHarness(database, { clock: () => RESERVATION_NOW });
      const read = async (path: string, actor: Account = owner) =>
        successEnvelopeSchema.parse(
          (
            await request(http.app)
              .get(`/api/v1${path}`)
              .auth(http.credential(actor), { type: "bearer" })
              .expect(200)
          ).body,
        ).data;
      expect(
        withdrawalStatusSchema.parse(await read("/withdrawals/me")),
      ).toMatchObject({ withdrawalExecutionReady: true, network: "TRON_NILE" });
      expect(walletViewSchema.parse(await read("/wallet/me"))).toMatchObject({
        withdrawalExecutionReady: true,
        withdrawalFunds: { total: "10", lockedReferral: "30" },
      });
      expect(
        adminWalletViewSchema.parse(
          await read(`/admin/wallets/${owner.user.id}`, admin),
        ).withdrawalExecutionReady,
      ).toBe(true);
      const quote = await reservationServices(database).quotes.create(
        owner.identity,
        { gross: "100" },
      );
      expect(quote).toMatchObject({ canAccept: false, requiredTopUp: "90" });
      await changeDispatchPause(database, {
        action: "PAUSE",
        operatorIdentity: "test-recovery",
        reason: "Pause new admission",
      });
      expect(
        withdrawalStatusSchema.parse(await read("/withdrawals/me"))
          .withdrawalExecutionReady,
      ).toBe(false);
      expect(
        walletViewSchema.parse(await read("/wallet/me"))
          .withdrawalExecutionReady,
      ).toBe(false);
      await expect(
        reservationServices(database).quotes.create(owner.identity, {
          gross: "100",
        }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_UNAVAILABLE" });
      await fenceFinancialRuntime(database, {
        operatorIdentity: "test-recovery",
        reason: "Current generation changed",
      });
      expect(
        withdrawalStatusSchema.parse(await read("/withdrawals/me"))
          .withdrawalExecutionReady,
      ).toBe(false);
      expect(
        withdrawalQuoteOutcomeSchema.parse(
          await read(`/withdrawals/quotes/${quote.quoteId}/outcome`),
        ).status,
      ).toBe("NOT_OBSERVED");
      expect(await database.withdrawalRequest.count()).toBe(0);
      expect(await database.reservationAllocation.count()).toBe(0);
    }));

  it("fails closed on absent capability or wrong/unacknowledged API boot and propagates database read failure", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database);
      const unacknowledged = new FinancialRuntimeAdmission(database, "API");
      const signer = new FinancialRuntimeAdmission(database, "SIGNER");
      for (const options of [
        { omitCapability: true },
        { admission: unacknowledged },
        { admission: signer },
      ]) {
        const http = httpHarness(database, {
          clock: () => RESERVATION_NOW,
          ...options,
        });
        const response = await request(http.app)
          .get("/api/v1/withdrawals/me")
          .auth(http.credential(owner), { type: "bearer" })
          .expect(200);
        expect(
          withdrawalStatusSchema.parse(
            successEnvelopeSchema.parse(response.body).data,
          ).withdrawalExecutionReady,
        ).toBe(false);
      }
      await unacknowledged.register();
      const unadmitted = httpHarness(database, {
        clock: () => RESERVATION_NOW,
        admission: unacknowledged,
      });
      const status = await request(unadmitted.app)
        .get("/api/v1/withdrawals/me")
        .auth(unadmitted.credential(owner), { type: "bearer" })
        .expect(200);
      expect(
        withdrawalStatusSchema.parse(
          successEnvelopeSchema.parse(status.body).data,
        ).withdrawalExecutionReady,
      ).toBe(false);
      const http = httpHarness(database, { clock: () => RESERVATION_NOW });
      await database.$executeRawUnsafe(
        "ALTER TABLE financial_runtime_admissions RENAME TO p09_unavailable_admissions",
      );
      try {
        const response = await request(http.app)
          .get("/api/v1/withdrawals/me")
          .auth(http.credential(owner), { type: "bearer" })
          .expect(500);
        expect(errorEnvelopeSchema.parse(response.body).success).toBe(false);
      } finally {
        await database.$executeRawUnsafe(
          "ALTER TABLE p09_unavailable_admissions RENAME TO financial_runtime_admissions",
        );
      }
    }));

  it("observes the exact original admin key beyond latest100 with no read effects under pause/fence", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database);
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: RESERVATION_NOW,
      });
      const otherAdmin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: RESERVATION_NOW,
      });
      const identity = { userId: admin.user.id, sessionId: admin.session.id };
      const http = httpHarness(database, { clock: () => RESERVATION_NOW });
      const services = reservationServices(database);
      const quote = await services.quotes.create(owner.identity, {
        gross: "100",
      });
      const accepted = await services.reservations.accept(owner.identity, {
        quoteId: quote.quoteId,
        confirmed: true,
      });
      const service = new WithdrawalsService(
        database,
        () => RESERVATION_NOW,
        financialFixtureAdmission(database),
      );
      const path = `/api/v1/admin/withdrawals/${accepted.withdrawal.id}`;
      const originalKey = randomUUID();
      for (let version = 1; version <= 101; version += 1)
        await service.extend(
          identity,
          accepted.withdrawal.id,
          {
            expectedVersion: version,
            countedHours: "0.000005",
            confirmed: true,
            reason: "Exact original intent",
          },
          version === 1 ? originalKey : randomUUID(),
        );
      const secondOwner = await reservationEmployee(database);
      const secondQuote = await services.quotes.create(secondOwner.identity, {
        gross: "100",
      });
      const secondRequest = await services.reservations.accept(
        secondOwner.identity,
        { quoteId: secondQuote.quoteId, confirmed: true },
      );
      await changeDispatchPause(database, {
        action: "PAUSE",
        operatorIdentity: "test-recovery",
        reason: "Keep safe admin access",
      });
      const detail = adminWithdrawalRequestSchema.parse(
        successEnvelopeSchema.parse(
          (
            await request(http.app)
              .get(path)
              .auth(http.credential(admin), { type: "bearer" })
              .expect(200)
          ).body,
        ).data,
      );
      expect(detail).toMatchObject({
        employee: {
          id: owner.user.id,
          fullName: owner.user.fullName,
          email: owner.user.email,
        },
        canExtend: true,
        canReject: true,
      });
      const original = await database.withdrawalAction.findFirstOrThrow({
        where: { requestId: accepted.withdrawal.id, requestKey: originalKey },
      });
      expect(detail.actions.some((action) => action.id === original.id)).toBe(
        false,
      );
      await fenceFinancialRuntime(database, {
        operatorIdentity: "test-recovery",
        reason: "Observe under recovery fence",
      });
      const before = {
        actions: await database.withdrawalAction.count(),
        operations: await database.financialOperation.count(),
        reservations: await database.reservationAllocation.count(),
      };
      const observe = (query: Record<string, string>, actor: Account = admin) =>
        request(http.app)
          .get(`${path}/actions/outcome`)
          .query(query)
          .auth(http.credential(actor), { type: "bearer" });
      const query = {
        kind: "EXTEND",
        requestKey: originalKey,
        expectedVersion: "1",
      };
      const committed = adminWithdrawalActionOutcomeSchema.parse(
        successEnvelopeSchema.parse((await observe(query).expect(200)).body)
          .data,
      );
      expect(committed).toMatchObject({
        status: "COMMITTED",
        action: {
          id: original.id,
          actorUserId: admin.user.id,
          expectedVersion: 1,
          committedVersion: 2,
        },
        withdrawal: { version: 102, canExtend: false, canReject: false },
      });
      expect(
        adminWithdrawalActionOutcomeSchema.parse(
          successEnvelopeSchema.parse(
            (await observe(query, otherAdmin).expect(200)).body,
          ).data,
        ).status,
      ).toBe("SUPERSEDED");
      expect(
        adminWithdrawalActionOutcomeSchema.parse(
          successEnvelopeSchema.parse(
            (
              await observe({
                ...query,
                requestKey: randomUUID(),
                expectedVersion: "102",
              }).expect(200)
            ).body,
          ).data,
        ).status,
      ).toBe("NOT_OBSERVED");
      await observe({ ...query, expectedVersion: "2" }).expect(409);
      await observe({ ...query, expectedVersion: "103" }).expect(409);
      await request(http.app)
        .get(
          `/api/v1/admin/withdrawals/${secondRequest.withdrawal.id}/actions/outcome`,
        )
        .query(query)
        .auth(http.credential(admin), { type: "bearer" })
        .expect(409);
      await request(http.app)
        .get(`/api/v1/admin/withdrawals/${randomUUID()}/actions/outcome`)
        .query(query)
        .auth(http.credential(admin), { type: "bearer" })
        .expect(404);
      await observe({
        ...query,
        kind: "REJECT",
        expectedVersion: "102",
      }).expect(200);
      await observe({ ...query, actorUserId: admin.user.id }).expect(400);
      await observe(query, owner).expect(403);
      await request(http.app)
        .get(`${path}/actions/outcome`)
        .query(query)
        .expect(401);
      expect({
        actions: await database.withdrawalAction.count(),
        operations: await database.financialOperation.count(),
        reservations: await database.reservationAllocation.count(),
      }).toEqual(before);
      const employee = await request(http.app)
        .get(`/api/v1/withdrawals/${accepted.withdrawal.id}`)
        .auth(http.credential(owner), { type: "bearer" })
        .expect(200);
      expect(
        withdrawalRequestSchema.parse(
          successEnvelopeSchema.parse(employee.body).data,
        ),
      ).not.toHaveProperty("employee");
    }));
  it("enforces current admin/CSRF/strict command authority and commits despite lost postcommit publication", async () => {
    await withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database, { nonReferral: "100" });
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: RESERVATION_NOW,
      });
      const http = httpHarness(database, {
        clock: () => RESERVATION_NOW,
        wakeups: {
          publish: () =>
            Promise.reject(new Error("controlled external queue failure")),
        },
      });
      const write = (path: string, account: Account) =>
        request(http.app)
          .post(`/api/v1${path}`)
          .auth(http.credential(account), { type: "bearer" })
          .set("Cookie", "csrfToken=p08-test")
          .set("X-CSRF-Token", "p08-test");
      const quote = withdrawalQuoteSchema.parse(
        successEnvelopeSchema.parse(
          (
            await write("/withdrawals/quotes", owner)
              .send({ gross: "100" })
              .expect(201)
          ).body,
        ).data,
      );
      const accepted = withdrawalCommandResultSchema.parse(
        successEnvelopeSchema.parse(
          (
            await write("/withdrawals", owner)
              .send({ quoteId: quote.quoteId, confirmed: true })
              .expect(201)
          ).body,
        ).data,
      );
      const path = `/admin/withdrawals/${accepted.withdrawal.id}`;
      const extension = {
        expectedVersion: 1,
        countedHours: "0.500005",
        confirmed: true,
        reason: "Reviewed extension",
      };
      await write(`${path}/extensions`, owner).send(extension).expect(403);
      await request(http.app)
        .post(`/api/v1${path}/extensions`)
        .auth(http.credential(admin), { type: "bearer" })
        .send(extension)
        .expect(403);
      for (const invalid of [
        { ...extension, confirmed: false },
        { ...extension, reason: " " },
        { ...extension, countedHours: "0" },
        { ...extension, state: "COMPLETED" },
      ])
        await write(`${path}/extensions`, admin).send(invalid).expect(400);
      await write(`${path}/extensions`, admin)
        .set("Idempotency-Key", "bad key")
        .send(extension)
        .expect(400);
      const extended = withdrawalCommandResultSchema.parse(
        successEnvelopeSchema.parse(
          (
            await write(`${path}/extensions`, admin)
              .set("Idempotency-Key", "http-extension")
              .send(extension)
              .expect(200)
          ).body,
        ).data,
      );
      expect(extended.withdrawal).toMatchObject({
        version: 2,
        scheduleVersion: 2,
        originalDueAt: accepted.withdrawal.originalDueAt,
      });
      expect(
        withdrawalCommandResultSchema.parse(
          successEnvelopeSchema.parse(
            (
              await write(`${path}/extensions`, admin)
                .set("Idempotency-Key", "http-extension")
                .send(extension)
                .expect(200)
            ).body,
          ).data,
        ).replayed,
      ).toBe(true);
      const stale = await write(`${path}/extensions`, admin)
        .set("Idempotency-Key", "fresh-stale")
        .send(extension)
        .expect(409);
      expect(errorEnvelopeSchema.parse(stale.body).code).toBe(
        "WITHDRAWAL_VERSION_CONFLICT",
      );
      await write(`${path}/extensions`, admin)
        .set("Idempotency-Key", "http-extension")
        .send({ ...extension, countedHours: "1" })
        .expect(409);
      await write(`${path}/rejections`, admin)
        .send({
          expectedVersion: 2,
          confirmed: true,
          reason: "Reviewed rejection",
        })
        .expect(200);
      expect(
        await database.financialOperation.count({ where: { kind: "RELEASE" } }),
      ).toBe(1);
      expect(
        await database.withdrawalAction.count({ where: { kind: "EXTEND" } }),
      ).toBe(1);
      for (const unsupported of ["holds", "complete", "cancel"])
        await write(`${path}/${unsupported}`, admin)
          .send({ confirmed: true, reason: "Unsupported action" })
          .expect(404);
      await database.authSession.update({
        where: { id: admin.session.id },
        data: { revokedAt: RESERVATION_NOW },
      });
      await write(`${path}/extensions`, admin)
        .send({ ...extension, expectedVersion: 3 })
        .expect(401);
    });
  });
  it("denies processing rejection and extension and leaves the original recipient and funds reserved", async () => {
    await withClockedWithdrawalDatabase(
      new Date("2026-10-16T09:00:00Z"),
      async (database, databaseUrl) => {
        const acceptedAt = new Date(Date.now() - 7 * 86400000);
        const owner = await reservationEmployee(database, {
          nonReferral: "100",
          now: acceptedAt,
        });
        const services = reservationServices(database, () => acceptedAt);
        const quote = await services.quotes.create(owner.identity, {
          gross: "100",
        });
        const accepted = await services.reservations.accept(owner.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        });
        const admin = await createIdentityFixture(database, { role: "ADMIN" });
        await withWithdrawalRole(
          { database, databaseUrl, role: "p06_signer" },
          async (signer) => {
            const admission = await admitWithdrawalRuntimeFixture(
              database,
              signer,
              "SIGNER",
            );
            expect(
              await claimWithdrawalFixture(
                { runtime: signer, owner: database },
                admission,
                accepted.withdrawal.id,
                1,
              ),
            ).toBe(true);
          },
        );
        const http = httpHarness(database);
        const rejected = await request(http.app)
          .post(
            `/api/v1/admin/withdrawals/${accepted.withdrawal.id}/rejections`,
          )
          .auth(http.credential(admin), { type: "bearer" })
          .set("Cookie", "csrfToken=p08-test")
          .set("X-CSRF-Token", "p08-test")
          .send({
            expectedVersion: 2,
            confirmed: true,
            reason: "Cannot refund processing work",
          })
          .expect(409);
        expect(errorEnvelopeSchema.parse(rejected.body).code).toBe(
          "WITHDRAWAL_STATE_CONFLICT",
        );
        const extended = await request(http.app)
          .post(
            `/api/v1/admin/withdrawals/${accepted.withdrawal.id}/extensions`,
          )
          .auth(http.credential(admin), { type: "bearer" })
          .set("Cookie", "csrfToken=p08-test")
          .set("X-CSRF-Token", "p08-test")
          .send({
            expectedVersion: 2,
            confirmed: true,
            countedHours: "1",
            reason: "Cannot extend processing work",
          })
          .expect(409);
        expect(errorEnvelopeSchema.parse(extended.body).code).toBe(
          "WITHDRAWAL_STATE_CONFLICT",
        );
        expect(
          await database.financialOperation.count({
            where: { kind: "RELEASE" },
          }),
        ).toBe(0);
        expect(
          await database.wallet.findUniqueOrThrow({
            where: { ownerUserId: owner.user.id },
          }),
        ).toMatchObject({ reservedNonReferralUnits: 100000000n });
        expect(
          (
            await database.withdrawalRequest.findUniqueOrThrow({
              where: { id: accepted.withdrawal.id },
            })
          ).recipient,
        ).toBe(accepted.withdrawal.recipient);
      },
    );
  });
  it("observes uncommitted expiry and rejects partial or changed quotes through safe HTTP errors", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database, {
        nonReferral: "70",
        referral: "30",
      });
      let now = RESERVATION_NOW;
      const http = httpHarness(database, { clock: () => now });
      const write = (path: string) =>
        request(http.app)
          .post(`/api/v1/withdrawals${path}`)
          .auth(http.credential(owner), { type: "bearer" })
          .set("Cookie", "csrfToken=p08-test")
          .set("X-CSRF-Token", "p08-test");
      const quote = withdrawalQuoteSchema.parse(
        successEnvelopeSchema.parse(
          (await write("/quotes").send({ gross: "100" }).expect(201)).body,
        ).data,
      );
      expect(quote).toMatchObject({
        canAccept: false,
        requiredTopUp: "30",
        blockReason: "INSUFFICIENT_FUNDS",
      });
      const outcomePath = `/api/v1/withdrawals/quotes/${quote.quoteId}/outcome`;
      const observed = await request(http.app)
        .get(outcomePath)
        .auth(http.credential(owner), { type: "bearer" })
        .expect(200);
      expect(
        withdrawalQuoteOutcomeSchema.parse(
          successEnvelopeSchema.parse(observed.body).data,
        ).status,
      ).toBe("NOT_OBSERVED");
      const rejected = await write("")
        .send({ quoteId: quote.quoteId, confirmed: true })
        .expect(409);
      expect(errorEnvelopeSchema.parse(rejected.body)).toMatchObject({
        code: "WITHDRAWAL_QUOTE_STALE",
      });
      now = new Date(quote.quoteExpiresAt);
      const expired = await request(http.app)
        .get(outcomePath)
        .auth(http.credential(owner), { type: "bearer" })
        .expect(200);
      expect(
        withdrawalQuoteOutcomeSchema.parse(
          successEnvelopeSchema.parse(expired.body).data,
        ).status,
      ).toBe("EXPIRED_UNCOMMITTED");
      expect(await database.reservationAllocation.count()).toBe(0);
    }));
  it("quotes exact 100/21/79, atomically accepts and recovers a lost reply through owned outcome", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database);
      const stranger = await createIdentityFixture(database);
      const http = httpHarness(database, { clock: () => RESERVATION_NOW });
      const write = (path: string, account = owner) =>
        request(http.app)
          .post(`/api/v1/withdrawals${path}`)
          .auth(http.credential(account), { type: "bearer" })
          .set("Cookie", "csrfToken=p08-test")
          .set("X-CSRF-Token", "p08-test");
      const quoted = await write("/quotes").send({ gross: "100" }).expect(201);
      const quote = withdrawalQuoteSchema.parse(
        successEnvelopeSchema.parse(quoted.body).data,
      );
      expect(quote).toMatchObject({
        gross: "100",
        fee: "21",
        net: "79",
        canAccept: true,
      });
      await request(http.app)
        .post("/api/v1/withdrawals")
        .auth(http.credential(owner), { type: "bearer" })
        .send({ quoteId: quote.quoteId, confirmed: true })
        .expect(403);
      await write("")
        .set("Idempotency-Key", "bad key")
        .send({ quoteId: quote.quoteId, confirmed: true })
        .expect(400);
      await write("")
        .send({ quoteId: quote.quoteId, confirmed: true, fee: "0" })
        .expect(400);
      const accepted = withdrawalCommandResultSchema.parse(
        successEnvelopeSchema.parse(
          (
            await write("")
              .set("Idempotency-Key", "http-reserve")
              .send({ quoteId: quote.quoteId, confirmed: true })
              .expect(201)
          ).body,
        ).data,
      );
      const replay = withdrawalCommandResultSchema.parse(
        successEnvelopeSchema.parse(
          (
            await write("")
              .send({ quoteId: quote.quoteId, confirmed: true })
              .expect(200)
          ).body,
        ).data,
      );
      expect(replay).toMatchObject({
        replayed: true,
        withdrawal: { id: accepted.withdrawal.id },
      });
      const outcomePath = `/api/v1/withdrawals/quotes/${quote.quoteId}/outcome`;
      const outcome = await request(http.app)
        .get(outcomePath)
        .auth(http.credential(owner), { type: "bearer" })
        .expect(200);
      expect(
        withdrawalQuoteOutcomeSchema.parse(
          successEnvelopeSchema.parse(outcome.body).data,
        ),
      ).toMatchObject({
        status: "COMMITTED",
        withdrawal: { id: accepted.withdrawal.id },
      });
      await request(http.app)
        .get(outcomePath)
        .auth(http.credential(stranger), { type: "bearer" })
        .expect(404);
      await request(http.app)
        .get(`/api/v1/withdrawals/${accepted.withdrawal.id}`)
        .auth(http.credential(stranger), { type: "bearer" })
        .expect(404);
      expect(await database.reservationAllocation.count()).toBe(1);
      expect(JSON.stringify(outcome.body)).not.toMatch(
        /termsHash|reservationId|intentHash|proofHash|walletId|actorScope/u,
      );
    }));
  it("keeps restricted history readable, bounded and private while enforcing current administrator authority", async () =>
    withWithdrawalDatabase(async (database) => {
      const first = await reservationEmployee(database);
      const second = await reservationEmployee(database);
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: RESERVATION_NOW,
      });
      const http = httpHarness(database, { clock: () => RESERVATION_NOW });
      const { reservationServices } =
        await import("./testing/withdrawal-reservation-fixtures.js");
      for (const owner of [first, second]) {
        const services = reservationServices(database);
        const quote = await services.quotes.create(owner.identity, {
          gross: "80",
        });
        await services.reservations.accept(owner.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        });
      }
      await database.user.update({
        where: { id: first.user.id },
        data: { withdrawalsBlocked: true },
      });
      const own = await request(http.app)
        .get("/api/v1/withdrawals")
        .auth(http.credential(first), { type: "bearer" })
        .expect(200);
      expect(
        withdrawalHistorySchema.parse(
          successEnvelopeSchema.parse(own.body).data,
        ),
      ).toMatchObject({ pagination: { total: 1 } });
      expect(own.headers["cache-control"]).toBe("no-store");
      const ownEnvelope = successEnvelopeSchema.parse(own.body);
      expect(ownEnvelope.paginationMeta).toEqual(
        withdrawalHistorySchema.parse(ownEnvelope.data).pagination,
      );
      expect(JSON.stringify(own.body)).not.toContain(second.user.id);
      await request(http.app)
        .get("/api/v1/admin/withdrawals")
        .auth(http.credential(first), { type: "bearer" })
        .expect(403);
      const list = await request(http.app)
        .get("/api/v1/admin/withdrawals")
        .query({
          limit: "1",
          from: RESERVATION_NOW.toISOString(),
          to: new Date(RESERVATION_NOW.getTime() + 1).toISOString(),
        })
        .auth(http.credential(admin), { type: "bearer" })
        .expect(200);
      expect(
        adminWithdrawalHistorySchema.parse(
          successEnvelopeSchema.parse(list.body).data,
        ),
      ).toMatchObject({
        items: [expect.anything()],
        pagination: { total: 2, totalPages: 2, hasNextPage: true },
      });
      const filtered = await request(http.app)
        .get("/api/v1/admin/withdrawals")
        .query({ employeeId: second.user.id, q: second.user.email })
        .auth(http.credential(admin), { type: "bearer" })
        .expect(200);
      expect(
        adminWithdrawalHistorySchema.parse(
          successEnvelopeSchema.parse(filtered.body).data,
        ).pagination.total,
      ).toBe(1);
      await request(http.app)
        .get("/api/v1/admin/withdrawals")
        .query({ limit: "101" })
        .auth(http.credential(admin), { type: "bearer" })
        .expect(400);
      await request(http.app)
        .get("/api/v1/withdrawals")
        .query({ employeeId: second.user.id })
        .auth(http.credential(first), { type: "bearer" })
        .expect(400);
      await database.authSession.update({
        where: { id: admin.session.id },
        data: { revokedAt: RESERVATION_NOW },
      });
      await request(http.app)
        .get("/api/v1/admin/withdrawals")
        .auth(http.credential(admin), { type: "bearer" })
        .expect(401);
    }));
  it("uses exact server countdowns without mistaking admitted capability for completion", async () =>
    withWithdrawalDatabase(async (database) => {
      const owner = await reservationEmployee(database);
      await database.user.update({
        where: { id: owner.user.id },
        data: { tasksBlocked: true },
      });
      let now = RESERVATION_NOW;
      const { reservationServices } =
        await import("./testing/withdrawal-reservation-fixtures.js");
      const services = reservationServices(database, () => now);
      const quote = await services.quotes.create(owner.identity, {
        gross: "100",
      });
      const saved = await services.reservations.accept(owner.identity, {
        quoteId: quote.quoteId,
        confirmed: true,
      });
      const due = new Date(saved.withdrawal.dueAt);
      owner.session = await database.authSession.update({
        where: { id: owner.session.id },
        data: { expiresAt: new Date(due.getTime() + 86400000) },
      });
      const http = httpHarness(database, { clock: () => now });
      now = new Date(due.getTime() - 1);
      const detail = await request(http.app)
        .get(`/api/v1/withdrawals/${saved.withdrawal.id}`)
        .auth(http.credential(owner), { type: "bearer" })
        .expect(200);
      expect(
        withdrawalRequestSchema.parse(
          successEnvelopeSchema.parse(detail.body).data,
        ),
      ).toMatchObject({
        remainingCountedMilliseconds: "1",
        remainingCountedHours: "0",
      });
      now = due;
      const status = await request(http.app)
        .get("/api/v1/withdrawals/me")
        .auth(http.credential(owner), { type: "bearer" })
        .expect(200);
      expect(
        withdrawalStatusSchema.parse(
          successEnvelopeSchema.parse(status.body).data,
        ),
      ).toMatchObject({
        withdrawalExecutionReady: true,
        activeWithdrawal: {
          remainingCountedMilliseconds: "0",
          remainingCountedHours: "0",
          state: "SCHEDULED",
        },
      });
    }));
});

describe("first withdrawal destination HTTP boundary", () => {
  it.each(["EXPIRED", "SUPERSEDED", "MISMATCHED"] as const)(
    "returns generic 409 for a valid-format proof that is %s without changing authority",
    async (scenario) =>
      withWithdrawalDatabase(async (database) => {
        let now = new Date();
        const employee = await createIdentityFixture(database, { now });
        const http = httpHarness(database, { clock: () => now });
        const issued = destination(
          await http
            .write("confirmations", employee)
            .send({ address })
            .expect(201),
        );
        if (issued.state !== "PENDING")
          throw new Error("Expected pending proof");
        const originalToken = http.credentials[0];
        if (originalToken === undefined)
          throw new Error("Missing test credential");
        if (scenario === "EXPIRED") now = new Date(issued.expiresAt);
        if (scenario === "SUPERSEDED") {
          now = new Date(issued.nextIssuanceAt);
          await http
            .write("resend", employee)
            .send({ expectedVersion: issued.version })
            .expect(200);
        }
        const token =
          scenario === "MISMATCHED"
            ? (originalToken.startsWith("A") ? "B" : "A") +
              originalToken.slice(1)
            : originalToken;
        const before = await database.withdrawalDestination.findUniqueOrThrow({
          where: { employeeId: employee.user.id },
        });
        const auditCount = await database.withdrawalDestinationAudit.count();
        const rejected = await http
          .write("consume", employee)
          .send({ token })
          .expect(409);
        expect(errorEnvelopeSchema.parse(rejected.body)).toMatchObject({
          statusCode: 409,
          code: "WITHDRAWAL_PROOF_INVALID",
          message: "Withdrawal proof is invalid or no longer current.",
        });
        expect(
          await database.withdrawalDestination.findUniqueOrThrow({
            where: { id: before.id },
          }),
        ).toEqual(before);
        expect(await database.withdrawalDestinationAudit.count()).toBe(
          auditCount,
        );
        expect(await database.withdrawalRequest.count()).toBe(0);
        expect(await database.reservationAllocation.count()).toBe(0);
        expect(http.logs.join("\n")).not.toContain(token);
      }),
  );

  it("shows truthful owned pending/saved state without GET consumption, preview tokens or log credentials", async () =>
    withWithdrawalDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const stranger = await createIdentityFixture(database);
      const http = httpHarness(database);
      expect(destination(await http.read(employee).expect(200))).toMatchObject({
        state: "UNSET",
      });
      const issued = await http
        .write("confirmations", employee)
        .send({ address })
        .expect(201);
      expect(issued.headers["cache-control"]).toBe("no-store");
      expect(destination(issued)).toMatchObject({
        state: "PENDING",
        address,
        deliveryStatus: "ACKNOWLEDGED",
      });
      const token = http.credentials[0];
      if (token === undefined) throw new Error("Missing test credential");
      expect(JSON.stringify(issued.body)).not.toContain(token);
      const rejectedRead = await http
        .read(employee)
        .query({ token })
        .expect(400);
      errorEnvelopeSchema.parse(rejectedRead.body);
      expect(destination(await http.read(employee).expect(200))).toMatchObject({
        state: "PENDING",
      });
      const mismatchedOwner = await http
        .write("consume", stranger)
        .send({ token })
        .expect(409);
      expect(errorEnvelopeSchema.parse(mismatchedOwner.body)).toMatchObject({
        code: "WITHDRAWAL_PROOF_INVALID",
      });
      expect(destination(await http.read(stranger).expect(200))).toMatchObject({
        state: "UNSET",
      });
      const saved = await http
        .write("consume", employee)
        .send({ token })
        .expect(200);
      expect(destination(saved)).toMatchObject({
        state: "CONFIRMED",
        address,
        addressVersion: 1,
      });
      expect(destination(await http.read(employee).expect(200))).toMatchObject({
        state: "CONFIRMED",
        address,
        addressVersion: 1,
      });
      const replay = await http
        .write("consume", employee)
        .send({ token })
        .expect(409);
      expect(errorEnvelopeSchema.parse(replay.body)).toMatchObject({
        code: "WITHDRAWAL_PROOF_INVALID",
      });
      await http.write("confirmations", employee).send({ address }).expect(409);
      expect(await database.withdrawalDestinationAudit.count()).toBe(2);
      expect(await database.withdrawalRequest.count()).toBe(0);
      expect(await database.reservationAllocation.count()).toBe(0);
      expect(http.logs.join("\n")).not.toContain(token);
      expect(JSON.stringify(saved.body)).not.toMatch(
        /proofHash|proofId|employeeId|token|withdrawalExecutionReady/u,
      );
    }));

  it.each(["UNKNOWN", "REJECTED"] as const)(
    "returns committed PENDING with %s delivery instead of confirmed success",
    async (disposition) =>
      withWithdrawalDatabase(async (database) => {
        const employee = await createIdentityFixture(database);
        const http = httpHarness(database, { disposition });
        expect(
          destination(
            await http
              .write("confirmations", employee)
              .send({ address })
              .expect(201),
          ),
        ).toMatchObject({ state: "PENDING", deliveryStatus: disposition });
        expect(
          destination(await http.read(employee).expect(200)),
        ).toMatchObject({ state: "PENDING", deliveryStatus: disposition });
        expect(await database.withdrawalDestinationAudit.count()).toBe(1);
      }),
  );

  it("enforces authentication, current role/session, CSRF and strict inputs before creating authority", async () =>
    withWithdrawalDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const http = httpHarness(database);
      const path = "/api/v1/withdrawals/me/destination";
      await request(http.app).get(path).expect(401);
      await http.read(admin).expect(403);
      await request(http.app)
        .post(`${path}/confirmations`)
        .auth(http.credential(employee), { type: "bearer" })
        .send({ address })
        .expect(403);
      for (const body of [
        { address, employeeId: admin.user.id },
        { address: "bad" },
        { address, feeBps: 0 },
      ]) {
        errorEnvelopeSchema.parse(
          (await http.write("confirmations", employee).send(body).expect(400))
            .body,
        );
      }
      await http
        .write("resend", employee)
        .send({ expectedVersion: 1 })
        .expect(409);
      await http
        .write("consume", employee)
        .send({ token: "malformed" })
        .expect(400);
      await database.authSession.update({
        where: { id: employee.session.id },
        data: { revokedAt: new Date() },
      });
      await http.read(employee).expect(401);
      await http.write("confirmations", employee).send({ address }).expect(401);
      expect(await database.withdrawalDestination.count()).toBe(0);
      expect(await database.withdrawalDestinationAudit.count()).toBe(0);
      expect(http.credentials).toEqual([]);
    }));

  it("allows task-only restriction, preserves pending reads under withdrawal block and persists cooldown", async () =>
    withWithdrawalDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      await database.user.update({
        where: { id: employee.user.id },
        data: { tasksBlocked: true },
      });
      const http = httpHarness(database);
      const issued = await http
        .write("confirmations", employee)
        .send({ address })
        .expect(201);
      await http
        .write("resend", employee)
        .send({ expectedVersion: 1 })
        .expect(429);
      await http
        .write("resend", employee)
        .send({ expectedVersion: 2 })
        .expect(409);
      await database.user.update({
        where: { id: employee.user.id },
        data: { withdrawalsBlocked: true },
      });
      expect(destination(await http.read(employee).expect(200))).toMatchObject({
        state: "PENDING",
        address,
      });
      await http
        .write("consume", employee)
        .send({ token: http.credentials[0] })
        .expect(403);
      expect(await database.withdrawalDestinationAudit.count()).toBe(1);
      expect(destination(issued)).toMatchObject({ version: 1 });
    }));

  it("bounds repeated invalid credential attempts per current employee without consuming authority", async () =>
    withWithdrawalDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const http = httpHarness(database);
      let limited = false;
      for (let attempt = 0; attempt < 32; attempt += 1) {
        const reply = await http
          .write("consume", employee)
          .send({ token: "bad" });
        if (reply.status === 429) {
          limited = true;
          errorEnvelopeSchema.parse(reply.body);
          break;
        }
        expect(reply.status).toBe(400);
      }
      expect(limited).toBe(true);
      expect(await database.withdrawalDestinationAudit.count()).toBe(0);
    }));

  it("fails closed with unavailable network configuration without committing a proof", async () =>
    withWithdrawalDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const http = httpHarness(database, { omitNetwork: true });
      const reply = await http
        .write("confirmations", employee)
        .send({ address })
        .expect(503);
      expect(errorEnvelopeSchema.parse(reply.body).code).toBe(
        "WITHDRAWAL_UNAVAILABLE",
      );
      expect(await database.withdrawalDestination.count()).toBe(0);
    }));
});
